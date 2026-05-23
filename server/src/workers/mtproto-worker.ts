import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";
import { supabase } from "../db.js";
import { MtprotoClient } from "../services/mtproto/client.js";
import { AccountPool, type PoolAccount } from "../services/mtproto/pool.js";
import {
  CampaignRunner,
  type CampaignTargetRow,
} from "../services/mtproto/campaign-runner.js";
import type { MtprotoJobData } from "../queue-mtproto.js";

const liveClients = new Map<string, MtprotoClient>();

async function getOrCreateClient(accountId: string, sessionString: string): Promise<MtprotoClient> {
  let client = liveClients.get(accountId);
  if (!client) {
    client = new MtprotoClient(config.telegramApiId, config.telegramApiHash, sessionString);
    await client.connect();
    liveClients.set(accountId, client);
  }
  return client;
}

async function updateAccount(accountId: string, patch: Record<string, unknown>): Promise<void> {
  await supabase
    .from("mtproto_accounts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", accountId);
}

async function handleRequestCode(accountId: string, phoneNumber: string): Promise<void> {
  const client = new MtprotoClient(config.telegramApiId, config.telegramApiHash);
  try {
    const { phoneCodeHash } = await client.sendCode(phoneNumber);
    await supabase
      .from("mtproto_auth_sessions")
      .delete()
      .eq("account_id", accountId);
    await supabase.from("mtproto_auth_sessions").insert({
      account_id: accountId,
      phone_code_hash: phoneCodeHash,
      needs_password: false,
    });
    await updateAccount(accountId, { status: "code_sent", last_error: null });
    liveClients.set(accountId, client);
  } catch (err) {
    await updateAccount(accountId, {
      status: "disconnected",
      last_error: err instanceof Error ? err.message : String(err),
    });
    await client.disconnect().catch(() => {});
    throw err;
  }
}

async function handleSignIn(accountId: string, phoneNumber: string, code: string): Promise<void> {
  const { data: session } = await supabase
    .from("mtproto_auth_sessions")
    .select("*")
    .eq("account_id", accountId)
    .single();
  if (!session) throw new Error("auth session not found");
  const client = liveClients.get(accountId);
  if (!client) throw new Error("client not live — re-solicite o código");

  try {
    const result = await client.signIn(phoneNumber, session.phone_code_hash, code);
    if (result.ok) {
      await updateAccount(accountId, {
        status: "active",
        session_string: result.sessionString,
        last_error: null,
      });
      await supabase.from("mtproto_auth_sessions").delete().eq("account_id", accountId);
    } else if (result.needsPassword) {
      await supabase
        .from("mtproto_auth_sessions")
        .update({ needs_password: true })
        .eq("account_id", accountId);
      await updateAccount(accountId, { status: "needs_password" });
    }
  } catch (err) {
    await updateAccount(accountId, {
      last_error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function handleSubmitPassword(accountId: string, password: string): Promise<void> {
  const client = liveClients.get(accountId);
  if (!client) throw new Error("client not live — re-solicite o código");
  try {
    const result = await client.signInWithPassword(password);
    if (result.ok) {
      await updateAccount(accountId, {
        status: "active",
        session_string: result.sessionString,
        last_error: null,
      });
      await supabase.from("mtproto_auth_sessions").delete().eq("account_id", accountId);
    }
  } catch (err) {
    await updateAccount(accountId, {
      last_error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function handleSyncDialogs(accountId: string): Promise<void> {
  const { data: account } = await supabase
    .from("mtproto_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (!account) {
    console.error(`[mtproto.sync] account ${accountId} not found`);
    return;
  }
  if (account.status !== "active" || !account.session_string) {
    console.error(`[mtproto.sync] account ${accountId} not authenticated (status=${account.status})`);
    return;
  }

  console.log(`[mtproto.sync] starting dialog sync for account ${accountId}`);

  let client: MtprotoClient;
  try {
    client = await getOrCreateClient(accountId, account.session_string);
  } catch (err) {
    console.error(`[mtproto.sync] failed to get client for ${accountId}:`, err);
    await updateAccount(accountId, {
      last_error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  let dialogs;
  try {
    dialogs = await client.listDialogs();
  } catch (err) {
    console.error(`[mtproto.sync] listDialogs failed for ${accountId}:`, err);
    await updateAccount(accountId, {
      last_error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  console.log(`[mtproto.sync] account ${accountId}: fetched ${dialogs.length} dialogs`);

  // Substitui o conteúdo da tabela pra essa conta — sync é snapshot completo.
  // Não usamos delete+insert pra evitar perder dialog_ids referenciados por
  // mtproto_targets (FK on delete set null); upsert preserva ids existentes.
  const now = new Date().toISOString();
  const rows = dialogs.map((d) => ({
    account_id: accountId,
    peer_id: d.peerId,
    peer_type: d.peerType,
    peer_access_hash: d.peerAccessHash,
    kind: d.kind,
    title: d.title,
    username: d.username,
    is_bot: d.isBot,
    last_synced_at: now,
  }));

  // Upsert em lotes de 500 pra evitar payload gigante
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("mtproto_dialogs")
      .upsert(batch, { onConflict: "account_id,peer_id,peer_type" });
    if (error) {
      console.error(`[mtproto.sync] upsert batch failed:`, error);
      await updateAccount(accountId, { last_error: `sync upsert failed: ${error.message}` });
      return;
    }
  }

  // Remove dialogs que não apareceram nesse sync (peer saiu da conta)
  if (rows.length > 0) {
    const peerKeys = rows.map((r) => `(${r.peer_type},${r.peer_id})`).join(",");
    // O Supabase Postgrest não tem `not in (tuple, tuple)`, então delete por última atualização:
    // tudo que NÃO foi atualizado nesse sync (last_synced_at < now) é removido.
    const { error: delErr } = await supabase
      .from("mtproto_dialogs")
      .delete()
      .eq("account_id", accountId)
      .lt("last_synced_at", now);
    if (delErr) {
      console.warn(`[mtproto.sync] stale dialog cleanup failed (non-fatal):`, delErr);
    }
    void peerKeys; // mantém log opcional pra debug
  }

  await updateAccount(accountId, { last_error: null });
  console.log(`[mtproto.sync] account ${accountId}: ${rows.length} dialogs synced`);
}

async function handleCampaignRun(campaignId: string): Promise<void> {
  const { data: campaign } = await supabase
    .from("mtproto_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (!campaign) return;

  const { data: accountsRaw } = await supabase
    .from("mtproto_accounts")
    .select("*")
    .eq("tenant_id", campaign.tenant_id)
    .in("status", ["active", "flood_wait"]);

  const pool = new AccountPool();
  pool.load(
    (accountsRaw ?? []).map(
      (a): PoolAccount => ({
        id: a.id,
        phoneNumber: a.phone_number,
        sessionString: a.session_string ?? "",
        status: a.status,
        floodWaitUntil: a.flood_wait_until ? new Date(a.flood_wait_until) : null,
      }),
    ),
  );

  const { data: targets } = await supabase
    .from("mtproto_targets")
    .select("*, mtproto_dialogs(peer_id, peer_type, peer_access_hash)")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const targetRows: CampaignTargetRow[] = (targets ?? []).map((t) => {
    const row: CampaignTargetRow = {
      id: t.id,
      identifier: t.target_identifier,
      type: t.target_type,
      status: t.status,
    };
    const dialog = t.mtproto_dialogs as
      | { peer_id: string; peer_type: "user" | "chat" | "channel"; peer_access_hash: string | null }
      | null;
    if (dialog) {
      row.dialog = {
        peerId: dialog.peer_id,
        peerType: dialog.peer_type,
        peerAccessHash: dialog.peer_access_hash,
      };
    }
    // Em campanhas globais (e em alguns casos com dialog), a conta já vem
    // pré-atribuída no target — o access_hash do dialog só vale pra ela.
    if (t.account_id) {
      row.pinnedAccountId = t.account_id;
    }
    return row;
  });

  const runner = new CampaignRunner(
    pool,
    {
      sendMessage: async (accountId, target, text) => {
        const acc = (accountsRaw ?? []).find((a) => a.id === accountId);
        if (!acc) throw new Error("account missing");
        const client = await getOrCreateClient(accountId, acc.session_string ?? "");
        if (target.dialog) {
          // Peer estruturado (vindo da sincronização) — caminho rápido e seguro.
          await client.sendMessageToPeer(
            target.dialog.peerId,
            target.dialog.peerType,
            target.dialog.peerAccessHash,
            text,
          );
        } else {
          // Caminho legado: lista colada com @username ou +telefone.
          await client.sendMessage(target.identifier, target.type, text);
        }
        await supabase
          .from("mtproto_accounts")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", accountId);
      },
      markTargetSent: async (targetId, accountId) => {
        await supabase
          .from("mtproto_targets")
          .update({
            status: "sent",
            account_id: accountId,
            sent_at: new Date().toISOString(),
          })
          .eq("id", targetId);
      },
      markTargetFailed: async (targetId, accountId, error) => {
        await supabase
          .from("mtproto_targets")
          .update({ status: "failed", account_id: accountId, error_message: error })
          .eq("id", targetId);
      },
      incrementCounters: async (id, kind) => {
        const field = kind === "sent" ? "sent_count" : "failed_count";
        const { data: c } = await supabase
          .from("mtproto_campaigns")
          .select(field)
          .eq("id", id)
          .single();
        const current = (c as unknown as Record<string, number> | null)?.[field] ?? 0;
        await supabase
          .from("mtproto_campaigns")
          .update({ [field]: current + 1 })
          .eq("id", id);
      },
      setCampaignStatus: async (id, status) => {
        const patch: Record<string, unknown> = { status };
        if (status === "running" && !campaign.started_at) {
          patch.started_at = new Date().toISOString();
        }
        if (status === "completed" || status === "failed") {
          patch.completed_at = new Date().toISOString();
        }
        // Se a campanha é recorrente E completou: agenda próxima execução
        // e reseta a campanha de volta pra 'draft' (pronta pro próximo ciclo).
        if (status === "completed" && campaign.recurrence_hours) {
          const nextRun = new Date(Date.now() + campaign.recurrence_hours * 60 * 60 * 1000);
          patch.status = "scheduled";
          patch.last_run_at = new Date().toISOString();
          patch.next_run_at = nextRun.toISOString();
          patch.sent_count = 0;
          patch.failed_count = 0;
          patch.started_at = null;
          patch.completed_at = null;
          // Reseta targets de 'sent'/'failed' (recuperáveis) pra 'pending'
          // pra próxima execução. Mantém 'failed' com error_message='invalid_identifier'
          // (esses foram listados pelo user; não vão funcionar nunca).
          await supabase
            .from("mtproto_targets")
            .update({ status: "pending", account_id: null, sent_at: null, error_message: null })
            .eq("campaign_id", id)
            .neq("error_message", "invalid_identifier");
          console.log(`[mtproto] campaign ${id} is recurrent — next run scheduled at ${nextRun.toISOString()}`);
        }
        await supabase.from("mtproto_campaigns").update(patch).eq("id", id);
      },
      delay: (ms) => new Promise((r) => setTimeout(r, ms)),
    },
    {
      campaignId,
      messageText: campaign.message_text,
      delayMinSeconds: campaign.delay_min_seconds,
      delayMaxSeconds: campaign.delay_max_seconds,
    },
  );

  await runner.run(targetRows);
}

export function startMtprotoWorker(): void {
  if (!config.mtprotoWorkerEnabled) {
    console.log("[mtproto] worker disabled via env");
    return;
  }
  if (!config.telegramApiId || !config.telegramApiHash) {
    console.log("[mtproto] TELEGRAM_API_ID/HASH not configured — worker not started");
    return;
  }

  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  new Worker<MtprotoJobData>(
    "mtproto",
    async (job: Job<MtprotoJobData>) => {
      const d = job.data;
      switch (d.kind) {
        case "auth.request-code":
          return handleRequestCode(d.accountId, d.phoneNumber);
        case "auth.sign-in":
          return handleSignIn(d.accountId, d.phoneNumber, d.code);
        case "auth.submit-password":
          return handleSubmitPassword(d.accountId, d.password);
        case "campaign.run":
          return handleCampaignRun(d.campaignId);
        case "account.sync-dialogs":
          return handleSyncDialogs(d.accountId);
      }
    },
    { connection, concurrency: 4 },
  );

  console.log("[mtproto] worker started");
}
