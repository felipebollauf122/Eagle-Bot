import type { SupabaseClient } from "@supabase/supabase-js";
import { MtprotoClient } from "../services/mtproto/client.js";
import { replaceChannel } from "../services/mtproto/channel-replacer.js";
import { config } from "../config.js";

interface MonitorRow {
  id: string;
  tenant_id: string;
  account_id: string;
  template_id: string;
  peer_channel_id: string;
  peer_access_hash: string | null;
  account: { id: string; session_string: string | null; status: string };
}

/**
 * Poller dos channel_monitors. A cada chamada:
 * 1. Pega todos os monitors com status='active'.
 * 2. Pra cada um, abre client MTProto da conta dona e chama
 *    getChannelStatus no peer.
 * 3. Se conta tá morta (auth_failed) OU canal tá inválido/forbidden,
 *    marca detected_dead_at e dispara replaceChannel.
 * 4. Em qualquer outro erro (rede, flood), guarda last_check_error e
 *    tenta de novo na próxima rodada.
 *
 * Rate: chamado pelo queue.ts a cada 10min. Cada conta consome ~1 req
 * por canal monitorado por ciclo — leve.
 */
export async function pollChannelMonitors(db: SupabaseClient): Promise<void> {
  if (!config.telegramApiId || !config.telegramApiHash) return;

  const { data: monitors } = await db
    .from("channel_monitors")
    .select(`
      id, tenant_id, account_id, template_id, peer_channel_id, peer_access_hash,
      account:mtproto_accounts!inner(id, session_string, status)
    `)
    .eq("status", "active")
    .limit(200);

  if (!monitors || monitors.length === 0) return;

  for (const m of monitors as unknown as MonitorRow[]) {
    const account = m.account;
    const checkedAt = new Date().toISOString();

    // Conta sem session (não logada ainda) ou ja banida no DB → marca como
    // detected_dead direto, sem precisar bater na API.
    if (!account.session_string || account.status === "banned") {
      console.log(`[channel-monitor] monitor ${m.id}: conta dona ${account.id} sem sessão ou banida → replace`);
      await db
        .from("channel_monitors")
        .update({
          last_checked_at: checkedAt,
          last_check_error: `account ${account.status}`,
          detected_dead_at: checkedAt,
        })
        .eq("id", m.id);
      // Dispara replacement (mesma logic do canal caído)
      await replaceChannel({
        id: m.id,
        tenant_id: m.tenant_id,
        account_id: m.account_id,
        template_id: m.template_id,
        peer_channel_id: m.peer_channel_id,
      }).catch((err) =>
        console.error(`[channel-monitor] replaceChannel falhou:`, err),
      );
      continue;
    }

    // Health check do canal pela conta dona
    const client = new MtprotoClient(
      config.telegramApiId,
      config.telegramApiHash,
      account.session_string,
    );
    let result: Awaited<ReturnType<MtprotoClient["getChannelStatus"]>>;
    try {
      result = await client.getChannelStatus(m.peer_channel_id, m.peer_access_hash);
    } catch (err) {
      console.error(`[channel-monitor] erro inesperado no monitor ${m.id}:`, err);
      await client.disconnect().catch(() => {});
      await db
        .from("channel_monitors")
        .update({
          last_checked_at: checkedAt,
          last_check_error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", m.id);
      continue;
    } finally {
      await client.disconnect().catch(() => {});
    }

    if (result.ok) {
      // Canal ainda vivo. Atualiza último check OK.
      await db
        .from("channel_monitors")
        .update({
          last_checked_at: checkedAt,
          last_check_error: null,
          channel_title: result.title,
          channel_username: result.username,
        })
        .eq("id", m.id);
      continue;
    }

    // Conta auth falhou → outro caminho pra detectar conta morta
    // (além do health-check geral de mtproto-health). Marca o canal
    // como morto e tenta replace.
    if (result.reason === "auth_failed") {
      console.warn(`[channel-monitor] conta ${account.id} auth falhou: ${result.detail}`);
      await db
        .from("mtproto_accounts")
        .update({
          status: "banned",
          last_error: result.detail,
          session_string: null,
        })
        .eq("id", account.id);
    }

    // Canal banido / inválido / privado
    if (result.reason === "channel_invalid" || result.reason === "channel_private" || result.reason === "auth_failed") {
      console.log(`[channel-monitor] monitor ${m.id} DETECTOU CANAL CAÍDO: ${result.reason}`);
      await db
        .from("channel_monitors")
        .update({
          last_checked_at: checkedAt,
          last_check_error: result.detail,
          detected_dead_at: checkedAt,
        })
        .eq("id", m.id);
      // Dispara replacement
      await replaceChannel({
        id: m.id,
        tenant_id: m.tenant_id,
        account_id: m.account_id,
        template_id: m.template_id,
        peer_channel_id: m.peer_channel_id,
      }).catch((err) =>
        console.error(`[channel-monitor] replaceChannel falhou:`, err),
      );
      continue;
    }

    // 'other' → erro transiente. Só registra e tenta próxima rodada.
    await db
      .from("channel_monitors")
      .update({
        last_checked_at: checkedAt,
        last_check_error: result.detail,
      })
      .eq("id", m.id);
  }
}
