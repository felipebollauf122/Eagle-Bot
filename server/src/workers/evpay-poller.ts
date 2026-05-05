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
 * Roda a cada 5s. Pra cada transação EvPay pendente, consulta a API
 * da Yvepay perguntando o status atual. Se voltou APPROVED, dispara
 * o mesmo pipeline do webhook (processPaymentCallback) → marca
 * approved no DB, pede email ou completa Purchase, etc.
 *
 * Existe pra resolver o caso em que a Yvepay aprova a venda mas não
 * envia webhook automático.
 *
 * Escalonamento por idade pra economizar chamadas na API:
 *   - tx ≤ 5min  → poll a cada 5s
 *   - tx 5-30min → poll a cada 30s
 *   - tx > 30min → poll a cada 2min (provavelmente já expirou)
 *   - tx > 24h   → ignora (definitivamente expirou)
 *
 * O loop sempre roda em 5s mas decide se VAI consultar cada tx
 * baseado no last_polled_at (memória in-process).
 */
const lastPolledAt = new Map<string, number>();

function shouldPoll(createdAt: string, txId: string, now: number): boolean {
  const ageMs = now - new Date(createdAt).getTime();
  // Define o intervalo mínimo de poll baseado na idade
  let intervalMs: number;
  if (ageMs <= 5 * 60_000) intervalMs = 5_000;            // ≤5min: 5s
  else if (ageMs <= 30 * 60_000) intervalMs = 30_000;     // 5-30min: 30s
  else if (ageMs <= 24 * 60 * 60_000) intervalMs = 120_000; // ≤24h: 2min
  else return false;                                       // >24h: skip

  const last = lastPolledAt.get(txId) ?? 0;
  if (now - last < intervalMs) return false;
  lastPolledAt.set(txId, now);
  return true;
}

export async function pollEvpayPendingTransactions(db: SupabaseClient): Promise<void> {
  // Pega transações pendentes EvPay das últimas 24h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await db
    .from("transactions")
    .select("id, bot_id, external_id, created_at")
    .eq("gateway", "evpay")
    .eq("status", "pending")
    .gte("created_at", dayAgo)
    .limit(100);

  if (!pending || pending.length === 0) return;

  // Filtra só as que estão na hora de pollar
  const now = Date.now();
  const due = (pending as PendingTransaction[]).filter((tx) =>
    shouldPoll(tx.created_at, tx.id, now),
  );
  if (due.length === 0) return;

  // Agrupa por bot pra reaproveitar a mesma instância EvPay por bot
  const byBot = new Map<string, PendingTransaction[]>();
  for (const tx of due) {
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
        // Tx finalizada — remove do cache pra não acumular memória
        lastPolledAt.delete(tx.id);
      } catch (err) {
        console.error(`[evpay-poller] Erro processando tx ${tx.external_id}:`, err);
      }
    }
  }
}
