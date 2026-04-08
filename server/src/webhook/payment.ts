import type { Request, Response } from "express";
import { supabase } from "../db.js";
import { TelegramApi } from "../telegram/api.js";
import { FlowProcessor } from "../engine/flow-processor.js";
import { LeadService } from "../services/lead-service.js";
import { TrackingService } from "../services/tracking-service.js";
import { FacebookCapi } from "../services/facebook-capi.js";
import { UtmifyService } from "../services/utmify.js";
import { SigiloPay } from "../services/sigilopay.js";
import { addDelayedJob } from "../queue.js";
import { config } from "../config.js";
import { botCache, flowByIdCache } from "../cache.js";
import type { Flow } from "../engine/flow-processor.js";
import type { Lead } from "../engine/types.js";

interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
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
export async function processPaymentCallback(botId: string, body: Record<string, unknown>): Promise<void> {
  console.log(`[payment-webhook] Processing callback for bot ${botId}:`, JSON.stringify(body));

  const { transactionId, status } = extractPaymentFields(body);

  if (!transactionId || !status) {
    console.error("[payment-webhook] Missing transactionId or status. Fields found:", { transactionId, status });
    return;
  }

  console.log(`[payment-webhook] Extracted: transactionId=${transactionId}, status=${status}`);

  // Lookup transaction — try by external_id first, then by id
  let transaction: Transaction | null = null;
  const { data: txByExternal } = await supabase
    .from("transactions")
    .select("*")
    .eq("external_id", transactionId)
    .eq("bot_id", botId)
    .maybeSingle();

  if (txByExternal) {
    transaction = txByExternal as Transaction;
  } else {
    // Maybe the transactionId is the DB id, or try without bot_id filter
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

  // Notify user that payment was confirmed
  const telegram = new TelegramApi(bot.telegram_token);
  await telegram.sendMessage({
    chatId: typedLead.telegram_user_id,
    text: "✅ Pagamento confirmado! Obrigado pela compra.",
  });

  console.log(`[payment-webhook] ✅ Sent confirmation to lead ${typedLead.id} (chat ${typedLead.telegram_user_id})`);

  // Update lead state: paid = true
  const updatedState = { ...typedLead.state, paid: true };
  await leadService.updateState(typedLead.id, updatedState);
  typedLead.state = updatedState;

  // Fire purchase tracking (fire-and-forget)
  const facebookCapi = new FacebookCapi(bot.facebook_pixel_id ?? "", bot.facebook_access_token ?? "");
  const utmify = new UtmifyService(bot.utmify_api_key ?? "");
  const trackingService = new TrackingService(supabase, facebookCapi, utmify);

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", transaction.product_id)
    .single();

  trackingService.trackPurchase({
    tenantId: transaction.tenant_id,
    leadId: transaction.lead_id,
    botId: transaction.bot_id,
    transactionId: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency,
    lead: {
      id: typedLead.id,
      tid: typedLead.tid,
      fbclid: typedLead.fbclid,
      firstName: typedLead.first_name,
      email: String(typedLead.state.email ?? ""),
      phone: String(typedLead.state.phone ?? ""),
      utmSource: typedLead.utm_source ?? undefined,
      utmMedium: typedLead.utm_medium ?? undefined,
      utmCampaign: typedLead.utm_campaign ?? undefined,
      utmContent: typedLead.utm_content ?? undefined,
      utmTerm: typedLead.utm_term ?? undefined,
    },
    customerDocument: String(typedLead.state.document ?? ""),
    productId: product?.id ?? transaction.product_id,
    productName: product?.name ?? "Produto",
  }).catch((e) => console.error("[payment-webhook] Tracking error:", e));

  // Resume flow on "paid" edge
  const paymentNodeId = String(typedLead.state.pending_payment_node_id ?? "");
  if (paymentNodeId && transaction.flow_id) {
    let flow: Flow | null = flowByIdCache.get(transaction.flow_id) as unknown as Flow | null;
    if (!flow) {
      const { data } = await supabase.from("flows").select("*").eq("id", transaction.flow_id).single();
      if (data) {
        flow = data as Flow;
        flowByIdCache.set(transaction.flow_id, data);
      }
    }

    if (flow) {
      const paidEdge = flow.flow_data.edges.find(
        (e) => e.source === paymentNodeId && e.sourceHandle === "paid",
      );

      if (paidEdge) {
        console.log(`[payment-webhook] Resuming flow on "paid" edge → node ${paidEdge.target}`);
        const sigiloPay = new SigiloPay(bot.sigilopay_public_key ?? "", bot.sigilopay_secret_key ?? "");
        const processor = new FlowProcessor(supabase, leadService, { addDelayedJob }, {
          sigiloPay,
          baseWebhookUrl: config.baseWebhookUrl,
        });
        await processor.executeFlow(
          flow,
          typedLead,
          telegram,
          typedLead.telegram_user_id,
          paidEdge.target,
        );
      } else {
        console.log(`[payment-webhook] No "paid" edge found for node ${paymentNodeId}`);
      }
    }
  }
}

/**
 * Express handler for /webhook/payment/:botId
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
