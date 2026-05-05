import { createHash } from "crypto";

interface UserData {
  fbc?: string;
  fbp?: string;
  externalIds?: string[];
  firstName?: string;
  email?: string;
  phone?: string;
  country?: string;
  clientIp?: string;
  clientUserAgent?: string;
  subscriptionId?: string;
}

interface PurchaseContent {
  id: string;
  quantity: number;
  item_price: number; // in the currency's main unit
}

interface PurchaseEventParams {
  eventTime: number;
  userData: UserData;
  value: number; // in the currency's main unit (e.g. BRL reais, not cents)
  currency: string;
  eventId: string;
  contentIds?: string[];
  contentName?: string;
  contents?: PurchaseContent[];
  numItems?: number;
  sourceUrl?: string;
  orderId?: string;
}

interface CheckoutEventParams {
  eventTime: number;
  userData: UserData;
  value: number;
  currency: string;
  eventId: string;
  contentIds?: string[];
  contentName?: string;
}

interface LeadEventParams {
  eventTime: number;
  userData: UserData;
  eventId: string;
}

interface ViewContentEventParams {
  eventTime: number;
  userData: UserData;
  eventId: string;
  contentName?: string;
}

interface PageViewEventParams {
  eventTime: number;
  userData: UserData;
  eventId: string;
  sourceUrl?: string;
}

export class FacebookCapi {
  private apiUrl: string;

  constructor(
    private pixelId: string,
    private accessToken: string,
  ) {
    this.apiUrl = `https://graph.facebook.com/v21.0/${pixelId}/events`;
  }

  private isConfigured(): boolean {
    return Boolean(this.pixelId && this.accessToken);
  }

  /** SHA-256 hash a value for Facebook's normalization requirements */
  private hash(value: string): string {
    return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
  }

  /** Build user_data object with proper hashing per Facebook spec */
  private buildUserData(params: UserData): Record<string, unknown> {
    const ud: Record<string, unknown> = {};

    if (params.fbc) ud.fbc = params.fbc;
    if (params.fbp) ud.fbp = params.fbp;
    if (params.externalIds && params.externalIds.length > 0) {
      // Meta aceita array de external_ids — testa match em cada um
      ud.external_id = params.externalIds.map((id) => this.hash(id));
    }
    if (params.subscriptionId) ud.subscription_id = params.subscriptionId;
    if (params.firstName) ud.fn = this.hash(params.firstName);
    // Only hash email/phone if they contain real data (not empty/placeholder)
    if (params.email && params.email.length > 0 && !params.email.endsWith("@eaglebot.temp")) {
      ud.em = this.hash(params.email);
    }
    if (params.phone && params.phone.length > 0 && params.phone !== "11999999999") {
      const cleaned = params.phone.replace(/\D/g, "");
      if (cleaned.length >= 10) {
        const withCountry = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
        ud.ph = this.hash(withCountry);
      }
    }
    ud.country = this.hash(params.country ?? "br");

    // IP and User-Agent are NOT hashed — sent as-is per Meta spec
    if (params.clientIp && params.clientIp.length > 0) {
      ud.client_ip_address = params.clientIp;
    }
    if (params.clientUserAgent && params.clientUserAgent.length > 0) {
      ud.client_user_agent = params.clientUserAgent;
    }

    return ud;
  }

  async sendPurchaseEvent(params: PurchaseEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    // Guard against invalid value — Meta penalizes events with 0/NaN/negative value
    const value = Number(params.value);
    if (!Number.isFinite(value) || value <= 0) {
      console.error(`[facebook-capi] Refusing to send Purchase with invalid value=${params.value}`);
      return false;
    }

    const customData: Record<string, unknown> = {
      value,
      currency: params.currency.toUpperCase(),
      content_type: "product",
    };

    if (params.contentIds?.length) {
      customData.content_ids = params.contentIds;
    }
    if (params.contentName) {
      customData.content_name = params.contentName;
    }
    if (params.contents?.length) {
      customData.contents = params.contents;
      customData.num_items = params.numItems ?? params.contents.reduce((sum, c) => sum + c.quantity, 0);
    } else if (params.numItems) {
      customData.num_items = params.numItems;
    }
    if (params.orderId) {
      customData.order_id = params.orderId;
    }

    const eventData: Record<string, unknown> = {
      event_name: "Purchase",
      event_time: params.eventTime,
      event_id: params.eventId,
      action_source: "website",
      user_data: this.buildUserData(params.userData),
      custom_data: customData,
    };

    if (params.sourceUrl) {
      eventData.event_source_url = params.sourceUrl;
    }

    return this.sendEvent(eventData);
  }

  async sendInitiateCheckoutEvent(params: CheckoutEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const eventData: Record<string, unknown> = {
      event_name: "InitiateCheckout",
      event_time: params.eventTime,
      event_id: params.eventId,
      action_source: "website",
      user_data: this.buildUserData(params.userData),
      custom_data: {
        value: params.value,
        currency: params.currency.toUpperCase(),
        content_type: "product",
      },
    };

    if (params.contentIds?.length) {
      (eventData.custom_data as Record<string, unknown>).content_ids = params.contentIds;
    }
    if (params.contentName) {
      (eventData.custom_data as Record<string, unknown>).content_name = params.contentName;
    }

    return this.sendEvent(eventData);
  }

  async sendLeadEvent(params: LeadEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    return this.sendEvent({
      event_name: "Lead",
      event_time: params.eventTime,
      event_id: params.eventId,
      action_source: "website",
      user_data: this.buildUserData(params.userData),
    });
  }

  async sendViewContentEvent(params: ViewContentEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const eventData: Record<string, unknown> = {
      event_name: "ViewContent",
      event_time: params.eventTime,
      event_id: params.eventId,
      action_source: "website",
      user_data: this.buildUserData(params.userData),
    };

    if (params.contentName) {
      eventData.custom_data = { content_name: params.contentName };
    }

    return this.sendEvent(eventData);
  }

  async sendPageViewEvent(params: PageViewEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const eventData: Record<string, unknown> = {
      event_name: "PageView",
      event_time: params.eventTime,
      event_id: params.eventId,
      action_source: "website",
      user_data: this.buildUserData(params.userData),
    };

    if (params.sourceUrl) {
      eventData.event_source_url = params.sourceUrl;
    }

    return this.sendEvent(eventData);
  }

  private async sendEvent(eventData: Record<string, unknown>, maxRetries = 3): Promise<boolean> {
    const eventName = String(eventData.event_name);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 1) {
          console.log(`[facebook-capi] Sending ${eventName} event (event_id=${eventData.event_id})...`);
        } else {
          console.log(`[facebook-capi] Retrying ${eventName} (attempt ${attempt}/${maxRetries})...`);
        }

        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [eventData],
            access_token: this.accessToken,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`[facebook-capi] ✓ ${eventName} sent (event_id=${eventData.event_id}, events_received=${result.events_received}, fbtrace_id=${result.fbtrace_id ?? "—"})`);
          return true;
        }

        // Retry on server errors (5xx) and rate limits (429), but NOT on 4xx client errors (bad payload)
        const shouldRetry = response.status >= 500 || response.status === 429;
        if (shouldRetry && attempt < maxRetries) {
          const delayMs = Math.min(Math.pow(2, attempt) * 500, 5000);
          console.warn(`[facebook-capi] ${eventName} failed with ${response.status}, retrying in ${delayMs}ms. Response: ${JSON.stringify(result)}`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        console.error(`[facebook-capi] ✗ ${eventName} failed (${response.status}, no retry):`, JSON.stringify(result));
        return false;
      } catch (error) {
        const isLast = attempt >= maxRetries;
        if (!isLast) {
          const delayMs = Math.min(Math.pow(2, attempt) * 500, 5000);
          console.warn(`[facebook-capi] ${eventName} network error (attempt ${attempt}), retrying in ${delayMs}ms:`, error);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        console.error(`[facebook-capi] ✗ ${eventName} request failed after ${maxRetries} attempts:`, error);
        return false;
      }
    }

    return false;
  }
}
