import type { SupabaseClient } from "@supabase/supabase-js";
import type { FacebookCapi } from "./facebook-capi.js";
import type { UtmifyService } from "./utmify.js";

interface LeadInfo {
  id: string;
  tid: string | null;
  fbclid: string | null;
  firstName: string;
  email?: string;
  phone?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  telegramUserId?: number;
  botId?: string;
}

interface TrackPurchaseParams {
  tenantId: string;
  leadId: string;
  botId: string;
  transactionId: string;
  amount: number; // in cents
  currency: string;
  lead: LeadInfo;
  customerDocument?: string;
  productId?: string;
  productName?: string;
}

interface TrackCheckoutParams {
  tenantId: string;
  leadId: string;
  botId: string;
  amount: number; // in cents
  currency: string;
  lead: LeadInfo;
  productId?: string;
  productName?: string;
}

interface TrackLeadParams {
  tenantId: string;
  leadId: string;
  botId: string;
  lead: LeadInfo;
}

interface TrackViewOfferParams {
  tenantId: string;
  leadId: string;
  botId: string;
  lead: LeadInfo;
  contentName?: string;
}

interface TrackEventParams {
  tenantId: string;
  leadId: string | null;
  botId: string;
  eventType: string;
  fbclid: string | null;
  tid: string | null;
  utmParams?: Record<string, string>;
  eventData?: Record<string, unknown>;
}

/** Build fbc parameter from fbclid using the REAL click timestamp */
function buildFbc(fbclid: string | null, clickTimeMs: number | null): string {
  if (!fbclid) return "";
  const ts = clickTimeMs && clickTimeMs > 0 ? clickTimeMs : Date.now();
  return `fb.1.${ts}.${fbclid}`;
}

interface ClickContext {
  fbp?: string;
  clickTime?: number;
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
}

/**
 * Look up the _fbp, real click timestamp, client IP, User-Agent and source URL
 * saved on the page_view event. These are persisted when the user lands on /t —
 * essential for high-quality matching on the Facebook CAPI Purchase event.
 */
async function loadClickContext(
  db: SupabaseClient,
  tid: string | null,
): Promise<ClickContext> {
  if (!tid) return {};
  const { data } = await db
    .from("tracking_events")
    .select("event_data")
    .eq("tid", tid)
    .eq("event_type", "page_view")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ed = (data?.event_data ?? {}) as Record<string, unknown>;
  return {
    fbp: typeof ed.fbp === "string" ? ed.fbp : undefined,
    clickTime: typeof ed.click_time === "number" ? ed.click_time : undefined,
    clientIp: typeof ed.client_ip === "string" ? ed.client_ip : undefined,
    userAgent: typeof ed.user_agent === "string" ? ed.user_agent : undefined,
    sourceUrl: typeof ed.source_url === "string" ? ed.source_url : undefined,
  };
}

/**
 * external_id estável: tg_user_id + bot_id (em texto, não hash — o CAPI hasheia).
 * Mesmo lead que volta em outra campanha mantém o mesmo ID. Fallback pro UUID
 * interno se não tiver telegramUserId (cobre eventos antigos).
 */
function buildExternalId(lead: LeadInfo): string {
  if (lead.telegramUserId && lead.botId) {
    return `tg_${lead.telegramUserId}_${lead.botId}`;
  }
  return lead.id;
}

/** Build user_data for Facebook from lead info + click context */
function buildFbUserData(lead: LeadInfo, ctx: ClickContext) {
  const fbc = buildFbc(lead.fbclid, ctx.clickTime ?? null);
  return {
    fbc: fbc || undefined,
    fbp: ctx.fbp,
    externalId: buildExternalId(lead),
    firstName: lead.firstName,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    clientIp: ctx.clientIp,
    clientUserAgent: ctx.userAgent,
  };
}

/** Build UTM params record for DB */
function buildUtmRecord(lead: LeadInfo): Record<string, string> {
  return {
    utm_source: lead.utmSource ?? "",
    utm_medium: lead.utmMedium ?? "",
    utm_campaign: lead.utmCampaign ?? "",
    utm_content: lead.utmContent ?? "",
    utm_term: lead.utmTerm ?? "",
  };
}

export class TrackingService {
  constructor(
    private db: SupabaseClient,
    private facebookCapi: FacebookCapi,
    private utmify: UtmifyService,
  ) {}

  /**
   * Purchase — fires when SigiloPay confirms payment (status OK).
   * Sends: DB event + Facebook Purchase + Utmify paid order.
   *
   * This is the ONLY Facebook CAPI event fired by the platform — all user
   * data (email, phone, CPF, fbc with real click timestamp, fbp) is attached
   * here to maximize Event Match Quality.
   */
  async trackPurchase(params: TrackPurchaseParams): Promise<void> {
    const eventId = `purchase_${params.transactionId}`;
    const eventTime = Math.floor(Date.now() / 1000);
    const { lead } = params;
    const amountInCurrency = params.amount / 100;

    // Save tracking event in DB
    const dbEventId = await this.saveEvent({
      tenantId: params.tenantId,
      leadId: params.leadId,
      botId: params.botId,
      eventType: "purchase",
      fbclid: lead.fbclid,
      tid: lead.tid,
      utmParams: buildUtmRecord(lead),
      eventData: {
        transaction_id: params.transactionId,
        amount: params.amount,
        currency: params.currency,
      },
    });

    // Load fbp + real click timestamp + IP/UA/sourceUrl from the original page_view
    const clickCtx = await loadClickContext(this.db, lead.tid);

    // Build structured contents array — Meta prefers this over flat content_ids
    const contents = params.productId
      ? [{ id: params.productId, quantity: 1, item_price: amountInCurrency }]
      : undefined;

    // Facebook CAPI — Purchase event (with full user data for max EMQ)
    const fbSent = await this.facebookCapi.sendPurchaseEvent({
      eventTime,
      eventId,
      userData: buildFbUserData(lead, clickCtx),
      value: amountInCurrency,
      currency: params.currency,
      contentIds: params.productId ? [params.productId] : undefined,
      contentName: params.productName,
      contents,
      numItems: 1,
      sourceUrl: clickCtx.sourceUrl,
      orderId: params.transactionId,
    });

    // Utmify — paid order
    const now = new Date().toISOString();
    const utmifySent = await this.utmify.sendOrder({
      orderId: params.transactionId,
      status: "paid",
      platform: "eaglebot",
      paymentMethod: "pix",
      paidAt: now,
      approvedDate: now,
      customer: {
        name: lead.firstName,
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        document: params.customerDocument ?? "",
      },
      products: [
        {
          id: params.productId ?? params.transactionId,
          name: params.productName ?? "Produto",
          priceInCents: String(params.amount),
          quantity: 1,
        },
      ],
      trackingParameters: {
        src: lead.tid ?? null,
        sck: lead.fbclid ?? null,
        utm_source: lead.utmSource,
        utm_medium: lead.utmMedium,
        utm_campaign: lead.utmCampaign,
        utm_content: lead.utmContent,
        utm_term: lead.utmTerm,
      },
    });

    // Update sent flags
    if (dbEventId) {
      await this.db
        .from("tracking_events")
        .update({ sent_to_facebook: fbSent, sent_to_utmify: utmifySent })
        .eq("id", dbEventId);
    }
  }

  /**
   * InitiateCheckout — fires when Pix code is generated.
   * CAPI ativo: usa fbp/fbc/IP/UA do clique original como user_data.
   * Não há Pixel JS aqui (Pix é entregue dentro do Telegram), então
   * o evento entra só pelo CAPI mas com os identificadores do clique.
   */
  async trackCheckout(params: TrackCheckoutParams): Promise<void> {
    const eventId = `ic_${params.leadId}_${Date.now()}`;
    const eventTime = Math.floor(Date.now() / 1000);
    const { lead } = params;
    const amountInCurrency = params.amount / 100;

    const dbEventId = await this.saveEvent({
      tenantId: params.tenantId,
      leadId: params.leadId,
      botId: params.botId,
      eventType: "checkout",
      fbclid: lead.fbclid,
      tid: lead.tid,
      utmParams: buildUtmRecord(lead),
      eventData: {
        amount: params.amount,
        currency: params.currency,
        product_id: params.productId,
        event_id: eventId,
      },
    });

    const clickCtx = await loadClickContext(this.db, lead.tid);

    const fbSent = await this.facebookCapi.sendInitiateCheckoutEvent({
      eventTime,
      eventId,
      userData: buildFbUserData(lead, clickCtx),
      value: amountInCurrency,
      currency: params.currency,
      contentIds: params.productId ? [params.productId] : undefined,
      contentName: params.productName,
    });

    if (dbEventId) {
      await this.db
        .from("tracking_events")
        .update({ sent_to_facebook: fbSent })
        .eq("id", dbEventId);
    }
  }

  /**
   * Lead — fires when a new lead enters the bot via tracking link.
   * Facebook CAPI disabled: bot_start has no contact data and was lowering EMQ.
   * Only the DB row is persisted so dashboards keep their counters.
   */
  async trackLead(params: TrackLeadParams): Promise<void> {
    const { lead } = params;
    await this.saveEvent({
      tenantId: params.tenantId,
      leadId: params.leadId,
      botId: params.botId,
      eventType: "bot_start",
      fbclid: lead.fbclid,
      tid: lead.tid,
      utmParams: buildUtmRecord(lead),
    });
  }

  /**
   * ViewContent — fires when a lead sees the offer (view_offer event).
   * Facebook CAPI disabled — same reason as trackLead/trackCheckout.
   */
  async trackViewOffer(params: TrackViewOfferParams): Promise<void> {
    const { lead } = params;
    await this.saveEvent({
      tenantId: params.tenantId,
      leadId: params.leadId,
      botId: params.botId,
      eventType: "view_offer",
      fbclid: lead.fbclid,
      tid: lead.tid,
      utmParams: buildUtmRecord(lead),
    });
  }

  async trackCustomEvent(params: TrackEventParams): Promise<void> {
    await this.saveEvent(params);
  }

  private async saveEvent(params: TrackEventParams): Promise<string | null> {
    const { data, error } = await this.db
      .from("tracking_events")
      .insert({
        tenant_id: params.tenantId,
        lead_id: params.leadId,
        bot_id: params.botId,
        event_type: params.eventType,
        fbclid: params.fbclid ?? null,
        tid: params.tid ?? null,
        utm_params: params.utmParams ?? {},
        event_data: params.eventData ?? {},
        sent_to_facebook: false,
        sent_to_utmify: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to save tracking event: ${error.message}`);
      return null;
    }
    return data?.id ?? null;
  }
}
