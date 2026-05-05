import type { SupabaseClient } from "@supabase/supabase-js";
import { EvPay } from "../services/evpay.js";

interface PendingTransaction {
  id: string;
  bot_id: string;
  external_id: string;
  created_at: string;
}

interface BotEvpay {
  id: string;
  evpay_api_key: string | null;
  evpay_project_id: string | null;
}

/**
 * Roda em intervalo curto (30s). Pra cada transação EvPay pendente
 * criada nos últimos 7 dias, consulta a API da Yvepay perguntando
 * o status atual. Se voltou APPROVED, dispara o mesmo pipeline do
 * webhook (processPaymentCallback) → marca approved no DB, pede
 * email ou completa Purchase, etc.
 *
 * Existe pra resolver o caso em que a Yvepay aprova a venda mas não
 * envia webhook automático.
 */
export async function pollEvpayPendingTransactions(db: SupabaseClient): Promise<void> {
  // Pega transações pendentes EvPay dos últimos 7 dias
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await db
    .from("transactions")
    .select("id, bot_id, external_id, created_at")
    .eq("gateway", "evpay")
    .eq("status", "pending")
    .gte("created_at", sevenDaysAgo)
    .limit(100);

  if (!pending || pending.length === 0) return;

  // Agrupa por bot pra reaproveitar a mesma instância EvPay por bot
  const byBot = new Map<string, PendingTransaction[]>();
  for (const tx of pending as PendingTransaction[]) {
    const arr = byBot.get(tx.bot_id) ?? [];
    arr.push(tx);
    byBot.set(tx.bot_id, arr);
  }

  for (const [botId, txs] of byBot) {
    const { data: botRow } = await db
      .from("bots")
      .select("id, evpay_api_key, evpay_project_id")
      .eq("id", botId)
      .single();
    const bot = botRow as BotEvpay | null;
    if (!bot?.evpay_api_key || !bot?.evpay_project_id) {
      console.log(`[evpay-poller] Bot ${botId} sem credenciais EvPay, pulando ${txs.length} txs`);
      continue;
    }

    const evpay = new EvPay(bot.evpay_api_key, bot.evpay_project_id);

    for (const tx of txs) {
      try {
        const result = await evpay.getPaymentStatus(tx.external_id);
        if (!result) {
          console.log(`[evpay-poller] tx ${tx.external_id} not found at Yvepay`);
          continue;
        }
        const status = result.status.toUpperCase();
        if (!["APPROVED", "EXPIRED", "FAILED", "REFUNDED", "PAID"].includes(status)) {
          // Ainda pending no lado deles
          continue;
        }
        console.log(`[evpay-poller] tx ${tx.external_id} status=${status} — disparando pipeline`);

        // Reusa o pipeline do webhook
        const { processPaymentCallback } = await import("../webhook/payment.js");
        await processPaymentCallback(botId, {
          transactionId: tx.external_id,
          status,
        });
      } catch (err) {
        console.error(`[evpay-poller] Erro processando tx ${tx.external_id}:`, err);
      }
    }
  }
}
