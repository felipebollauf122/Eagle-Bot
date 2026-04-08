import { createHash } from "crypto";

interface UserData {
  fbc?: string;
  fbp?: string;
  externalId?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  country?: string;
}

interface PurchaseEventParams {
  eventTime: number;
  userData: UserData;
  value: number; // in the currency's main unit (e.g. BRL reais, not cents)
  currency: string;
  eventId: string;
  contentIds?: string[];
  contentName?: string;
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
    if (params.externalId) ud.external_id = this.hash(params.externalId);
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

    return ud;
  }

  async sendPurchaseEvent(params: PurchaseEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const eventData: Record<string, unknown> = {
      event_name: "Purchase",
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

  private async sendEvent(eventData: Record<string, unknown>): Promise<boolean> {
    try {
      console.log(`[facebook-capi] Sending ${eventData.event_name} event...`);

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [eventData],
          access_token: this.accessToken,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error(`[facebook-capi] Error (${response.status}):`, JSON.stringify(result));
        return false;
      }

      console.log(`[facebook-capi] ✓ ${eventData.event_name} sent, events_received: ${result.events_received}`);
      return true;
    } catch (error) {
      console.error("[facebook-capi] Request failed:", error);
      return false;
    }
  }
}
