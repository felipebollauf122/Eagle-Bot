import type { SupabaseClient } from "@supabase/supabase-js";
import { TelegramApi } from "../telegram/api.js";
import { FlowProcessor } from "../engine/flow-processor.js";
import { LeadService } from "./lead-service.js";
import { SigiloPay } from "./sigilopay.js";
import { FacebookCapi } from "./facebook-capi.js";
import { UtmifyService } from "./utmify.js";
import { TrackingService } from "./tracking-service.js";
import { addDelayedJob } from "../queue.js";
import { config } from "../config.js";
import { flowByIdCache } from "../cache.js";
import type { Flow } from "../engine/flow-processor.js";
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
  amount: number;
  currency: string;
}

/**
 * Dispara Purchase no Facebook + retoma o flow na edge "paid".
 * Chamado de 3 lugares:
 *  1. payment-webhook quando user já tinha email no state (não vai pedir)
 *  2. telegram-webhook quando user mandou email válido respondendo o pedido
 *  3. worker de timeout, 2h após pagamento, se user nunca respondeu
 */
export async function completePurchase(
  db: SupabaseClient,
  bot: Bot,
  lead: Lead,
  transaction: Transaction,
): Promise<void> {
  const leadService = new LeadService(db);

  // Limpa o flag de pending email (caso ainda esteja setado)
  if (lead.state.pending_email_tx_id) {
    const newState = { ...lead.state };
    delete newState.pending_email_tx_id;
    await leadService.updateState(lead.id, newState);
    lead.state = newState;
  }

  // Dispara Facebook Purchase + Utmify (fire-and-forget)
  const facebookCapi = new FacebookCapi(bot.facebook_pixel_id ?? "", bot.facebook_access_token ?? "");
  const utmify = new UtmifyService(bot.utmify_api_key ?? "");
  const trackingService = new TrackingService(db, facebookCapi, utmify);

  const { data: product } = await db
    .from("products")
    .select("id, name")
    .eq("id", transaction.product_id)
    .single();

  trackingService
    .trackPurchase({
      tenantId: transaction.tenant_id,
      leadId: transaction.lead_id,
      botId: transaction.bot_id,
      transactionId: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      lead: {
        id: lead.id,
        tid: lead.tid,
        fbclid: lead.fbclid,
        firstName: lead.first_name,
        email: String(lead.state.email ?? ""),
        phone: String(lead.state.phone ?? ""),
        utmSource: lead.utm_source ?? undefined,
        utmMedium: lead.utm_medium ?? undefined,
        utmCampaign: lead.utm_campaign ?? undefined,
        utmContent: lead.utm_content ?? undefined,
        utmTerm: lead.utm_term ?? undefined,
        telegramUserId: lead.telegram_user_id,
        botId: lead.bot_id,
      },
      customerDocument: String(lead.state.document ?? ""),
      productId: product?.id ?? transaction.product_id,
      productName: product?.name ?? "Produto",
    })
    .catch((e) => console.error("[purchase-completer] Tracking error:", e));

  // Retoma o flow na edge "paid"
  const paymentNodeId = String(lead.state.pending_payment_node_id ?? "");
  if (!paymentNodeId || !transaction.flow_id) {
    // Sem flow visual pra retomar (típico de pagamentos via remarketing).
    // Manda mensagem genérica de confirmação pra não deixar o cliente no escuro.
    console.log(`[purchase-completer] No flow to resume — sending fallback confirmation`);
    const telegramFallback = new TelegramApi(bot.telegram_token, { protectContent: bot.protect_content });
    await telegramFallback.sendMessage({
      chatId: lead.telegram_user_id,
      text:
        "✅ <b>Pagamento confirmado e acesso liberado!</b>\n\n" +
        "Em instantes você recebe os detalhes do produto. " +
        "Qualquer problema, é só falar com a gente por aqui.",
    });
    return;
  }

  let flow: Flow | null = flowByIdCache.get(transaction.flow_id) as unknown as Flow | null;
  if (!flow) {
    const { data } = await db.from("flows").select("*").eq("id", transaction.flow_id).single();
    if (!data) {
      console.error(`[purchase-completer] Flow not found: ${transaction.flow_id}`);
      return;
    }
    flow = data as Flow;
    flowByIdCache.set(transaction.flow_id, data);
  }

  const paidEdge = flow.flow_data.edges.find(
    (e) => e.source === paymentNodeId && e.sourceHandle === "paid",
  );
  if (!paidEdge) {
    console.log(`[purchase-completer] No "paid" edge found for node ${paymentNodeId}`);
    return;
  }

  console.log(`[purchase-completer] Resuming flow on "paid" edge → node ${paidEdge.target}`);
  const telegram = new TelegramApi(bot.telegram_token, { protectContent: bot.protect_content });
  const sigiloPay = new SigiloPay(bot.sigilopay_public_key ?? "", bot.sigilopay_secret_key ?? "");
  const processor = new FlowProcessor(db, leadService, { addDelayedJob }, {
    sigiloPay,
    baseWebhookUrl: config.baseWebhookUrl,
  });

  await processor.executeFlow(
    flow,
    lead,
    telegram,
    lead.telegram_user_id,
    paidEdge.target,
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}
