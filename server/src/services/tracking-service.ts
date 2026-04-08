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

/** Build fbc parameter from fbclid */
function buildFbc(fbclid: string | null): string {
  if (!fbclid) return "";
  return `fb.1.${Date.now()}.${fbclid}`;
}

/** Build user_data for Facebook from lead info */
function buildFbUserData(lead: LeadInfo) {
  const fbc = buildFbc(lead.fbclid);
  return {
    fbc: fbc || undefined,
    externalId: lead.id,
    firstName: lead.firstName,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
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

    // Facebook CAPI — Purchase event
    const fbSent = await this.facebookCapi.sendPurchaseEvent({
      eventTime,
      eventId,
      userData: buildFbUserData(lead),
      value: amountInCurrency,
      currency: params.currency,
      contentIds: params.productId ? [params.productId] : undefined,
      contentName: params.productName,
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
   * Sends: DB event + Facebook InitiateCheckout.
   */
  async trackCheckout(params: TrackCheckoutParams): Promise<void> {
    const eventId = `checkout_${params.leadId}_${Date.now()}`;
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
      },
    });

    const fbSent = await this.facebookCapi.sendInitiateCheckoutEvent({
      eventTime,
      eventId,
      userData: buildFbUserData(lead),
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
   * Sends: DB event + Facebook Lead.
   */
  async trackLead(params: TrackLeadParams): Promise<void> {
    const eventId = `lead_${params.leadId}`;
    const eventTime = Math.floor(Date.now() / 1000);
    const { lead } = params;

    const dbEventId = await this.saveEvent({
      tenantId: params.tenantId,
      leadId: params.leadId,
      botId: params.botId,
      eventType: "bot_start",
      fbclid: lead.fbclid,
      tid: lead.tid,
      utmParams: buildUtmRecord(lead),
    });

    const fbSent = await this.facebookCapi.sendLeadEvent({
      eventTime,
      eventId,
      userData: buildFbUserData(lead),
    });

    if (dbEventId) {
      await this.db
        .from("tracking_events")
        .update({ sent_to_facebook: fbSent })
        .eq("id", dbEventId);
    }
  }

  /**
   * ViewContent — fires when a lead sees the offer (view_offer event).
   * Sends: DB event + Facebook ViewContent.
   */
  async trackViewOffer(params: TrackViewOfferParams): Promise<void> {
    const eventId = `view_offer_${params.leadId}_${Date.now()}`;
    const eventTime = Math.floor(Date.now() / 1000);
    const { lead } = params;

    const dbEventId = await this.saveEvent({
      tenantId: params.tenantId,
      leadId: params.leadId,
      botId: params.botId,
      eventType: "view_offer",
      fbclid: lead.fbclid,
      tid: lead.tid,
      utmParams: buildUtmRecord(lead),
    });

    const fbSent = await this.facebookCapi.sendViewContentEvent({
      eventTime,
      eventId,
      userData: buildFbUserData(lead),
      contentName: params.contentName,
    });

    if (dbEventId) {
      await this.db
        .from("tracking_events")
        .update({ sent_to_facebook: fbSent })
        .eq("id", dbEventId);
    }
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
