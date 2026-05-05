import type { Request, Response } from "express";
import { supabase } from "../db.js";
import { TelegramApi } from "../telegram/api.js";
import { LeadService } from "../services/lead-service.js";
import { addPurchaseEmailTimeoutJob } from "../queue.js";
import { botCache } from "../cache.js";
import type { Lead } from "../engine/types.js";

interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
  protect_content: boolean;
  facebook_pixel_id: string | null;
  facebook_access_token: string | null;
  utmify_api_key: string | null;
  sigilopay_public_key: string | null;
  sigilopay_secret_key: string | null;
}

interface Transaction {
  id: string;
  tenant_id: string;
  lead_id: string;
  bot_id: string;
  flow_id: string;
  product_id: string;
  external_id: string;
  amount: number;
  currency: string;
  status: string;
}

const leadService = new LeadService(supabase);

/**
 * Extract transactionId and status from SigiloPay callback body.
 * Tries multiple field names since their payload format may vary.
 */
function extractPaymentFields(body: Record<string, unknown>): { transactionId?: string; status?: string } {
  const data = (body.data ?? {}) as Record<string, unknown>;
  const order = (body.order ?? {}) as Record<string, unknown>;
  const transaction = (body.transaction ?? {}) as Record<string, unknown>;

  const transactionId = String(
    body.transactionId ?? body.transaction_id ?? body.id ??
    order.id ?? data.transactionId ?? data.id ?? transaction.id ?? ""
  ) || undefined;

  const status = String(
    body.status ?? data.status ?? order.status ?? transaction.status ?? ""
  ) || undefined;

  return { transactionId, status };
}

/**
 * Core payment processing logic — can be called from either the payment
 * endpoint or redirected from the Telegram endpoint.
 */
export async function processPaymentCallback(botId: string | null, body: Record<string, unknown>): Promise<void> {
  console.log(`[payment-webhook] Processing callback (botId=${botId ?? "global"}):`, JSON.stringify(body));

  const { transactionId, status } = extractPaymentFields(body);

  if (!transactionId || !status) {
    console.error("[payment-webhook] Missing transactionId or status. Fields found:", { transactionId, status });
    return;
  }

  console.log(`[payment-webhook] Extracted: transactionId=${transactionId}, status=${status}`);

  // Lookup transaction by external_id — optionally scoped to botId
  let transaction: Transaction | null = null;

  if (botId) {
    const { data: txByExternal } = await supabase
      .from("transactions")
      .select("*")
      .eq("external_id", transactionId)
      .eq("bot_id", botId)
      .maybeSingle();

    if (txByExternal) {
      transaction = txByExternal as Transaction;
    }
  }

  // Fallback: lookup without bot_id filter (covers global webhook + legacy)
  if (!transaction) {
    const { data: txByExternalAny } = await supabase
      .from("transactions")
      .select("*")
      .eq("external_id", transactionId)
      .maybeSingle();

    if (txByExternalAny) {
      transaction = txByExternalAny as Transaction;
    }
  }

  if (!transaction) {
    console.error(`[payment-webhook] Transaction not found for external_id: ${transactionId}`);
    return;
  }

  // Map SigiloPay status to our status (case-insensitive)
  const normalizedStatus = String(status).toUpperCase();
  let newStatus: string;
  if (["OK", "COMPLETED", "APPROVED", "SUCCESS", "PAID"].includes(normalizedStatus)) {
    newStatus = "approved";
  } else if (["FAILED", "REJECTED", "ERROR"].includes(normalizedStatus)) {
    newStatus = "refused";
  } else if (["CANCELED", "REFUNDED", "CANCELLED"].includes(normalizedStatus)) {
    newStatus = "refunded";
  } else if (["PENDING", "PROCESSING", "WAITING", "CREATED"].includes(normalizedStatus)) {
    console.log(`[payment-webhook] Status is ${status}, no action needed`);
    return;
  } else {
    console.log(`[payment-webhook] Unknown status: ${status} — ignoring`);
    return;
  }

  console.log(`[payment-webhook] Mapped status: ${status} → ${newStatus}`);

  // Idempotency: skip if already processed
  if (transaction.status === newStatus) {
    console.log(`[payment-webhook] Transaction ${transactionId} already ${newStatus}, skipping`);
    return;
  }

  // Update transaction status
  await supabase
    .from("transactions")
    .update({
      status: newStatus,
      paid_at: newStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", transaction.id);

  console.log(`[payment-webhook] Transaction ${transaction.id} updated to ${newStatus}`);

  // Only process approved payments further
  if (newStatus !== "approved") return;

  // Fetch bot config (cached)
  let bot = botCache.get(transaction.bot_id) as Bot | undefined;
  if (!bot) {
    const { data } = await supabase.from("bots").select("*").eq("id", transaction.bot_id).single();
    if (!data) return;
    bot = data as Bot;
    botCache.set(transaction.bot_id, data);
  }

  // Fetch lead
  const lead = await leadService.getById(transaction.lead_id);
  if (!lead) return;

  const typedLead = lead as Lead;

  const telegram = new TelegramApi(bot.telegram_token, { protectContent: bot.protect_content });

  // Update lead state: paid = true + marca pending email (necessário pro Facebook EMQ)
  const updatedState = {
    ...typedLead.state,
    paid: true,
    pending_email_tx_id: transaction.id,
  };
  await leadService.updateState(typedLead.id, updatedState);
  typedLead.state = updatedState;

  // Pede o email do cliente. O Purchase só é disparado depois que ele responder
  // (ou após 2h via worker de timeout). Isso aumenta o EMQ do pixel.
  await telegram.sendMessage({
    chatId: typedLead.telegram_user_id,
    text:
      "✅ <b>Pagamento confirmado!</b>\n\n" +
      "Antes de liberar seu acesso, preciso do seu <b>e-mail válido</b> para registrar sua compra.\n\n" +
      "⚠️ Use um e-mail que você acessa de verdade — em caso de qualquer problema com o produto " +
      "(não receber link, suporte, atualizações), é por ele que você vai ser atendido. " +
      "E-mail errado significa ficar sem suporte.\n\n" +
      "📩 <b>Manda seu e-mail aí:</b>",
  });

  console.log(`[payment-webhook] Asked email from lead ${typedLead.id} (tx ${transaction.id})`);

  // Agenda timeout de 2h — se user não responder, dispara Purchase mesmo sem email
  await addPurchaseEmailTimeoutJob(
    { leadId: typedLead.id, transactionId: transaction.id },
    2 * 60 * 60, // 2 horas
  );
}

/**
 * Express handler for /webhook/payment (global — single webhook for the entire platform).
 * Resolves the bot from the transaction record.
 */
export async function handlePaymentWebhookGlobal(req: Request, res: Response): Promise<void> {
  res.status(200).json({ ok: true });

  try {
    await processPaymentCallback(null, req.body);
  } catch (error) {
    console.error(`[payment-webhook] Error (global):`, error);
  }
}

/**
 * Express handler for /webhook/payment/:botId (legacy — kept for backwards compatibility
 * with webhooks already registered at SigiloPay).
 */
export async function handlePaymentWebhook(req: Request, res: Response): Promise<void> {
  const botId = String(req.params.botId);
  res.status(200).json({ ok: true });

  try {
    await processPaymentCallback(botId, req.body);
  } catch (error) {
    console.error(`[payment-webhook] Error for bot ${botId}:`, error);
  }
}

/**
 * Express handler for /webhook/evpay (EvPay gateway).
 * Valida assinatura HMAC-SHA256 (header X-Webhook-Signature) usando o
 * evpay_webhook_secret salvo no bot que originou a transação.
 */
export async function handleEvPayWebhook(req: Request, res: Response): Promise<void> {
  res.status(200).json({ ok: true });

  try {
    const body = req.body as Record<string, unknown>;
    const rawBody = JSON.stringify(body);
    const signature = String(req.header("X-Webhook-Signature") ?? "");

    console.log(`[evpay-webhook] Received:`, rawBody);

    // Extrai transactionId do payload pra localizar o bot e validar a assinatura
    const data = (body.data ?? {}) as Record<string, unknown>;
    const transactionId = String(
      body.transactionId ?? body.id ?? data.id ?? data.transactionId ?? "",
    );
    if (!transactionId) {
      console.error(`[evpay-webhook] Missing transactionId in payload`);
      return;
    }

    const { data: tx } = await supabase
      .from("transactions")
      .select("bot_id")
      .eq("external_id", transactionId)
      .maybeSingle();
    if (!tx) {
      console.error(`[evpay-webhook] Transaction not found: ${transactionId}`);
      return;
    }

    const { data: botRow } = await supabase
      .from("bots")
      .select("evpay_webhook_secret")
      .eq("id", tx.bot_id)
      .single();
    const secret = String((botRow as { evpay_webhook_secret?: string } | null)?.evpay_webhook_secret ?? "");
    if (!secret) {
      console.error(`[evpay-webhook] Bot ${tx.bot_id} has no evpay_webhook_secret set`);
      return;
    }

    const { EvPay } = await import("../services/evpay.js");
    if (!EvPay.verifySignature(rawBody, signature, secret)) {
      console.error(`[evpay-webhook] Invalid signature for tx ${transactionId}`);
      return;
    }

    // Normaliza pro mesmo formato que o processPaymentCallback espera
    const event = String(body.event ?? "");
    const status =
      event === "pix.in.confirmation"
        ? "PAID"
        : String(body.status ?? data.status ?? "");

    await processPaymentCallback(tx.bot_id, { transactionId, status });
  } catch (error) {
    console.error(`[evpay-webhook] Error:`, error);
  }
}
