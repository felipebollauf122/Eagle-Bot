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
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const targetRows: CampaignTargetRow[] = (targets ?? []).map((t) => ({
    id: t.id,
    identifier: t.target_identifier,
    type: t.target_type,
    status: t.status,
  }));

  const runner = new CampaignRunner(
    pool,
    {
      sendMessage: async (accountId, target, text) => {
        const acc = (accountsRaw ?? []).find((a) => a.id === accountId);
        if (!acc) throw new Error("account missing");
        const client = await getOrCreateClient(accountId, acc.session_string ?? "");
        await client.sendMessage(target.identifier, target.type, text);
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
      }
    },
    { connection, concurrency: 4 },
  );

  console.log("[mtproto] worker started");
}
