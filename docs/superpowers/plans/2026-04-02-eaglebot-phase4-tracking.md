# Phase 4: Tracking & Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete tracking pipeline — tracking page (redirect + pre-lander modes), Facebook Conversions API integration, Utmify event forwarding, and bot settings page for per-bot configuration.

**Architecture:** The tracking page is a Next.js route at `/t/[code]` that captures fbclid + UTMs, generates a TID, saves a `page_view` event, and either redirects or renders a pre-lander. Facebook CAPI and Utmify dispatchers live in the bot engine server (`server/src/services/`) as they're called when purchases are confirmed. The bot settings page is a dashboard page under `/dashboard/bots/[botId]/settings` where users configure Pixel ID, CAPI token, Utmify key, and tracking page content.

**Tech Stack:** Next.js 16, nanoid, Supabase, Facebook Graph API v18.0, server-side fetch

**Spec reference:** `docs/superpowers/specs/2026-04-01-eaglebot-design.md` — Tracking System section

---

## File Structure

```
app/t/[code]/
├── page.tsx                            # Tracking page — captures params, saves event, redirect/prelander
lib/
├── actions/
│   └── bot-settings-actions.ts         # Server actions for saving bot settings
app/dashboard/bots/[botId]/
├── settings/
│   └── page.tsx                        # Bot settings page
components/dashboard/
├── bot-settings-form.tsx               # Bot settings form (tokens, tracking config)
server/src/services/
├── facebook-capi.ts                    # Facebook Conversions API dispatcher
├── utmify.ts                           # Utmify event dispatcher
├── tracking-service.ts                 # Tracking event creation + dispatch orchestration
server/tests/services/
├── facebook-capi.test.ts
├── tracking-service.test.ts
```

---

## Task 1: Add nanoid dependency

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add nanoid to package.json**

Add `"nanoid": "^5"` to `dependencies` in the root `package.json`.

Then run:
```bash
npm install
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add nanoid for tracking ID generation"
```

---

## Task 2: Tracking page route (`/t/[code]`)

**Files:**
- Create: `app/t/[code]/page.tsx`

- [ ] **Step 1: Create tracking page**

Create `app/t/[code]/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import type { Bot } from "@/lib/types/database";

interface TrackingPageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TrackingPage({ params, searchParams }: TrackingPageProps) {
  const { code } = await params;
  const search = await searchParams;

  const supabase = await createClient();

  // code is the bot_username (or could be a custom tracking code)
  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("bot_username", code)
    .eq("is_active", true)
    .single();

  if (!bot) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-white/40">Link inválido</p>
      </div>
    );
  }

  const typedBot = bot as Bot;

  // Extract tracking parameters
  const fbclid = String(search.fbclid ?? "");
  const utmSource = String(search.utm_source ?? "");
  const utmMedium = String(search.utm_medium ?? "");
  const utmCampaign = String(search.utm_campaign ?? "");
  const utmContent = String(search.utm_content ?? "");
  const utmTerm = String(search.utm_term ?? "");

  // Generate unique tracking ID
  const tid = `tid_${nanoid(16)}`;

  // Save page_view tracking event
  await supabase.from("tracking_events").insert({
    tenant_id: typedBot.tenant_id,
    bot_id: typedBot.id,
    lead_id: null, // no lead yet
    event_type: "page_view",
    fbclid: fbclid || null,
    tid,
    utm_params: {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
    },
    event_data: {},
    sent_to_facebook: false,
    sent_to_utmify: false,
  });

  const telegramDeepLink = `https://t.me/${typedBot.bot_username}?start=${tid}`;

  // Redirect mode — immediate redirect
  if (typedBot.tracking_mode === "redirect") {
    redirect(telegramDeepLink);
  }

  // Pre-lander mode — render customizable page
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#0a0a0f] flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {typedBot.prelander_image_url && (
          <img
            src={typedBot.prelander_image_url}
            alt=""
            className="w-full max-h-80 object-cover rounded-2xl mb-8"
          />
        )}
        <h1 className="text-3xl font-bold text-white mb-4">
          {typedBot.prelander_headline ?? "Bem-vindo!"}
        </h1>
        {typedBot.prelander_description && (
          <p className="text-white/60 text-lg mb-8 leading-relaxed">
            {typedBot.prelander_description}
          </p>
        )}
        <a
          href={telegramDeepLink}
          className="inline-block px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold rounded-xl transition shadow-lg shadow-purple-600/20"
        >
          {typedBot.prelander_cta_text ?? "Acessar no Telegram →"}
        </a>
        <p className="text-white/20 text-xs mt-8">
          Powered by EagleBot
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/t/
git commit -m "feat: add tracking page with redirect and pre-lander modes"
```

---

## Task 3: Facebook Conversions API service

**Files:**
- Create: `server/src/services/facebook-capi.ts`
- Create: `server/tests/services/facebook-capi.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/tests/services/facebook-capi.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FacebookCapi } from "../../src/services/facebook-capi.js";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("FacebookCapi", () => {
  let capi: FacebookCapi;

  beforeEach(() => {
    vi.clearAllMocks();
    capi = new FacebookCapi("pixel_123", "access_token_abc");
  });

  it("should send a Purchase event to Facebook CAPI", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events_received: 1 }),
    });

    await capi.sendPurchaseEvent({
      eventTime: 1700000000,
      fbc: "fb.1.123.fbclid_abc",
      value: 97.0,
      currency: "BRL",
      eventId: "evt_123",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v18.0/pixel_123/events");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.access_token).toBe("access_token_abc");
    expect(body.data[0].event_name).toBe("Purchase");
    expect(body.data[0].custom_data.value).toBe(97.0);
    expect(body.data[0].custom_data.currency).toBe("BRL");
    expect(body.data[0].user_data.fbc).toBe("fb.1.123.fbclid_abc");
  });

  it("should send a Lead event", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events_received: 1 }),
    });

    await capi.sendLeadEvent({
      eventTime: 1700000000,
      fbc: "fb.1.123.fbclid_abc",
      eventId: "evt_456",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.data[0].event_name).toBe("Lead");
  });

  it("should skip sending if no pixel or token configured", async () => {
    const emptyCapi = new FacebookCapi("", "");

    await emptyCapi.sendPurchaseEvent({
      eventTime: 1700000000,
      fbc: "",
      value: 97.0,
      currency: "BRL",
      eventId: "evt_789",
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement Facebook CAPI service**

Create `server/src/services/facebook-capi.ts`:
```ts
interface PurchaseEventParams {
  eventTime: number;
  fbc: string;
  value: number;
  currency: string;
  eventId: string;
}

interface LeadEventParams {
  eventTime: number;
  fbc: string;
  eventId: string;
}

export class FacebookCapi {
  private apiUrl: string;

  constructor(
    private pixelId: string,
    private accessToken: string,
  ) {
    this.apiUrl = `https://graph.facebook.com/v18.0/${pixelId}/events`;
  }

  private isConfigured(): boolean {
    return Boolean(this.pixelId && this.accessToken);
  }

  async sendPurchaseEvent(params: PurchaseEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    return this.sendEvent({
      event_name: "Purchase",
      event_time: params.eventTime,
      event_id: params.eventId,
      action_source: "website",
      user_data: {
        fbc: params.fbc || undefined,
      },
      custom_data: {
        value: params.value,
        currency: params.currency,
      },
    });
  }

  async sendLeadEvent(params: LeadEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    return this.sendEvent({
      event_name: "Lead",
      event_time: params.eventTime,
      event_id: params.eventId,
      action_source: "website",
      user_data: {
        fbc: params.fbc || undefined,
      },
    });
  }

  private async sendEvent(eventData: Record<string, unknown>): Promise<boolean> {
    try {
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
        console.error("Facebook CAPI error:", result);
        return false;
      }

      console.log(`Facebook CAPI: ${eventData.event_name} sent, received: ${result.events_received}`);
      return true;
    } catch (error) {
      console.error("Facebook CAPI request failed:", error);
      return false;
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/facebook-capi.ts server/tests/services/facebook-capi.test.ts
git commit -m "feat: add Facebook Conversions API service with Purchase and Lead events"
```

---

## Task 4: Utmify event dispatcher

**Files:**
- Create: `server/src/services/utmify.ts`

- [ ] **Step 1: Implement Utmify service**

Create `server/src/services/utmify.ts`:
```ts
interface UtmifyEventParams {
  orderId: string;
  amount: number;
  currency: string;
  status: "approved" | "pending" | "refused" | "refunded";
  customerEmail?: string;
  customerName?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export class UtmifyService {
  private baseUrl = "https://api.utmify.com.br/api/v1";

  constructor(private apiKey: string) {}

  private isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async sendConversion(params: UtmifyEventParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/conversions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({
          order_id: params.orderId,
          amount: params.amount,
          currency: params.currency,
          status: params.status,
          customer: {
            email: params.customerEmail,
            name: params.customerName,
          },
          utm: {
            source: params.utmSource,
            medium: params.utmMedium,
            campaign: params.utmCampaign,
            content: params.utmContent,
            term: params.utmTerm,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Utmify error:", error);
        return false;
      }

      console.log(`Utmify: Conversion sent for order ${params.orderId}`);
      return true;
    } catch (error) {
      console.error("Utmify request failed:", error);
      return false;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/utmify.ts
git commit -m "feat: add Utmify event dispatcher service"
```

---

## Task 5: Tracking service (orchestration)

**Files:**
- Create: `server/src/services/tracking-service.ts`
- Create: `server/tests/services/tracking-service.test.ts`

- [ ] **Step 1: Write test**

Create `server/tests/services/tracking-service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrackingService } from "../../src/services/tracking-service.js";

const mockSupabase = {
  from: vi.fn(),
};

const mockFacebookCapi = {
  sendPurchaseEvent: vi.fn().mockResolvedValue(true),
  sendLeadEvent: vi.fn().mockResolvedValue(true),
};

const mockUtmify = {
  sendConversion: vi.fn().mockResolvedValue(true),
};

function mockChain(returnData: unknown = null, returnError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  mockSupabase.from.mockReturnValue(chain);
  return chain;
}

describe("TrackingService", () => {
  let service: TrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TrackingService(
      mockSupabase as any,
      mockFacebookCapi as any,
      mockUtmify as any,
    );
  });

  it("should track a purchase event and dispatch to Facebook + Utmify", async () => {
    const chain = mockChain({ id: "evt-1" });

    await service.trackPurchase({
      tenantId: "t-1",
      leadId: "lead-1",
      botId: "bot-1",
      transactionId: "tx-1",
      amount: 97.0,
      currency: "BRL",
      fbclid: "fbclid_abc",
      tid: "tid_xyz",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "launch",
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("tracking_events");
    expect(mockFacebookCapi.sendPurchaseEvent).toHaveBeenCalled();
    expect(mockUtmify.sendConversion).toHaveBeenCalled();
  });

  it("should track a lead event (bot_start)", async () => {
    mockChain({ id: "evt-2" });

    await service.trackLead({
      tenantId: "t-1",
      leadId: "lead-1",
      botId: "bot-1",
      fbclid: "fbclid_abc",
      tid: "tid_xyz",
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("tracking_events");
    expect(mockFacebookCapi.sendLeadEvent).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement tracking service**

Create `server/src/services/tracking-service.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FacebookCapi } from "./facebook-capi.js";
import type { UtmifyService } from "./utmify.js";

interface TrackPurchaseParams {
  tenantId: string;
  leadId: string;
  botId: string;
  transactionId: string;
  amount: number;
  currency: string;
  fbclid: string | null;
  tid: string | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  customerEmail?: string;
  customerName?: string;
}

interface TrackLeadParams {
  tenantId: string;
  leadId: string;
  botId: string;
  fbclid: string | null;
  tid: string | null;
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

export class TrackingService {
  constructor(
    private db: SupabaseClient,
    private facebookCapi: FacebookCapi,
    private utmify: UtmifyService,
  ) {}

  async trackPurchase(params: TrackPurchaseParams): Promise<void> {
    const eventId = `purchase_${params.transactionId}`;
    const eventTime = Math.floor(Date.now() / 1000);

    // Save tracking event
    await this.saveEvent({
      tenantId: params.tenantId,
      leadId: params.leadId,
      botId: params.botId,
      eventType: "purchase",
      fbclid: params.fbclid,
      tid: params.tid,
      utmParams: {
        utm_source: params.utmSource ?? "",
        utm_medium: params.utmMedium ?? "",
        utm_campaign: params.utmCampaign ?? "",
        utm_content: params.utmContent ?? "",
        utm_term: params.utmTerm ?? "",
      },
      eventData: {
        transaction_id: params.transactionId,
        amount: params.amount,
        currency: params.currency,
      },
    });

    // Dispatch to Facebook CAPI
    const fbc = params.fbclid ? `fb.1.${Date.now()}.${params.fbclid}` : "";
    const fbSent = await this.facebookCapi.sendPurchaseEvent({
      eventTime,
      fbc,
      value: params.amount,
      currency: params.currency,
      eventId,
    });

    // Dispatch to Utmify
    const utmifySent = await this.utmify.sendConversion({
      orderId: params.transactionId,
      amount: params.amount,
      currency: params.currency,
      status: "approved",
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      utmSource: params.utmSource,
      utmMedium: params.utmMedium,
      utmCampaign: params.utmCampaign,
      utmContent: params.utmContent,
      utmTerm: params.utmTerm,
    });

    // Update tracking event with dispatch status
    await this.db
      .from("tracking_events")
      .update({
        sent_to_facebook: fbSent,
        sent_to_utmify: utmifySent,
      })
      .eq("event_type", "purchase")
      .eq("lead_id", params.leadId)
      .eq("bot_id", params.botId);
  }

  async trackLead(params: TrackLeadParams): Promise<void> {
    const eventId = `lead_${params.leadId}`;
    const eventTime = Math.floor(Date.now() / 1000);

    await this.saveEvent({
      tenantId: params.tenantId,
      leadId: params.leadId,
      botId: params.botId,
      eventType: "bot_start",
      fbclid: params.fbclid,
      tid: params.tid,
    });

    const fbc = params.fbclid ? `fb.1.${Date.now()}.${params.fbclid}` : "";
    await this.facebookCapi.sendLeadEvent({
      eventTime,
      fbc,
      eventId,
    });
  }

  async trackCustomEvent(params: TrackEventParams): Promise<void> {
    await this.saveEvent(params);
  }

  private async saveEvent(params: TrackEventParams): Promise<void> {
    const { error } = await this.db
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
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/tracking-service.ts server/tests/services/tracking-service.test.ts
git commit -m "feat: add tracking service orchestrating Facebook CAPI + Utmify dispatchers"
```

---

## Task 6: Bot settings page (per-bot configuration)

**Files:**
- Create: `lib/actions/bot-settings-actions.ts`
- Create: `app/dashboard/bots/[botId]/settings/page.tsx`
- Create: `components/dashboard/bot-settings-form.tsx`

- [ ] **Step 1: Create server actions**

Create `lib/actions/bot-settings-actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

interface BotSettings {
  facebook_pixel_id: string;
  facebook_access_token: string;
  utmify_api_key: string;
  sigilopay_api_key: string;
  tracking_mode: "redirect" | "prelander";
  prelander_headline: string;
  prelander_description: string;
  prelander_image_url: string;
  prelander_cta_text: string;
}

export async function saveBotSettings(botId: string, settings: BotSettings) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("bots")
    .update({
      facebook_pixel_id: settings.facebook_pixel_id || null,
      facebook_access_token: settings.facebook_access_token || null,
      utmify_api_key: settings.utmify_api_key || null,
      sigilopay_api_key: settings.sigilopay_api_key || null,
      tracking_mode: settings.tracking_mode,
      prelander_headline: settings.prelander_headline || null,
      prelander_description: settings.prelander_description || null,
      prelander_image_url: settings.prelander_image_url || null,
      prelander_cta_text: settings.prelander_cta_text || null,
    })
    .eq("id", botId);

  if (error) throw new Error(`Failed to save settings: ${error.message}`);
  return { success: true };
}
```

- [ ] **Step 2: Create bot settings form**

Create `components/dashboard/bot-settings-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { saveBotSettings } from "@/lib/actions/bot-settings-actions";
import type { Bot } from "@/lib/types/database";

interface BotSettingsFormProps {
  bot: Bot;
}

export function BotSettingsForm({ bot }: BotSettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [pixelId, setPixelId] = useState(bot.facebook_pixel_id ?? "");
  const [accessToken, setAccessToken] = useState(bot.facebook_access_token ?? "");
  const [utmifyKey, setUtmifyKey] = useState(bot.utmify_api_key ?? "");
  const [sigiloKey, setSigiloKey] = useState(bot.sigilopay_api_key ?? "");
  const [trackingMode, setTrackingMode] = useState(bot.tracking_mode ?? "redirect");
  const [headline, setHeadline] = useState(bot.prelander_headline ?? "");
  const [description, setDescription] = useState(bot.prelander_description ?? "");
  const [imageUrl, setImageUrl] = useState(bot.prelander_image_url ?? "");
  const [ctaText, setCtaText] = useState(bot.prelander_cta_text ?? "");

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveBotSettings(bot.id, {
        facebook_pixel_id: pixelId,
        facebook_access_token: accessToken,
        utmify_api_key: utmifyKey,
        sigilopay_api_key: sigiloKey,
        tracking_mode: trackingMode as "redirect" | "prelander",
        prelander_headline: headline,
        prelander_description: description,
        prelander_image_url: imageUrl,
        prelander_cta_text: ctaText,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500";
  const labelClass = "block text-white/60 text-xs mb-1.5";

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Configurações</h1>
      <p className="text-white/50 mb-8 text-sm">
        Configure as integrações e tracking deste bot
      </p>

      {/* Bot Info */}
      <div className="bg-[#12121a] border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Informações do Bot</h2>
        <div className="space-y-2 text-sm">
          <p className="text-white/60">Username: <span className="text-white">@{bot.bot_username}</span></p>
          <p className="text-white/60">Status: <span className={bot.is_active ? "text-green-400" : "text-white/40"}>{bot.is_active ? "Ativo" : "Inativo"}</span></p>
          <p className="text-white/60">Link de tracking: <span className="text-purple-400">seudominio.com/t/{bot.bot_username}</span></p>
        </div>
      </div>

      {/* Facebook */}
      <div className="bg-[#12121a] border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Facebook Ads</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Pixel ID</label>
            <input type="text" value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="123456789012345" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Conversions API Token</label>
            <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAx..." className={inputClass} />
          </div>
        </div>
      </div>

      {/* Utmify */}
      <div className="bg-[#12121a] border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Utmify</h2>
        <div>
          <label className={labelClass}>API Key</label>
          <input type="password" value={utmifyKey} onChange={(e) => setUtmifyKey(e.target.value)} placeholder="utm_..." className={inputClass} />
        </div>
      </div>

      {/* SigiloPay */}
      <div className="bg-[#12121a] border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">SigiloPay</h2>
        <div>
          <label className={labelClass}>API Key</label>
          <input type="password" value={sigiloKey} onChange={(e) => setSigiloKey(e.target.value)} placeholder="sp_..." className={inputClass} />
        </div>
      </div>

      {/* Tracking Page */}
      <div className="bg-[#12121a] border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Página de Tracking</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Modo</label>
            <select value={trackingMode} onChange={(e) => setTrackingMode(e.target.value)} className={inputClass}>
              <option value="redirect">Redirect (redirecionamento direto)</option>
              <option value="prelander">Pre-lander (página customizável)</option>
            </select>
          </div>

          {trackingMode === "prelander" && (
            <>
              <div>
                <label className={labelClass}>Título</label>
                <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Bem-vindo!" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Descrição</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Descrição da oferta..." className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className={labelClass}>URL da Imagem</label>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Texto do Botão CTA</label>
                <input type="text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Acessar no Telegram →" className={inputClass} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
        {saved && <span className="text-green-400 text-sm">Salvo com sucesso!</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create settings page**

Create `app/dashboard/bots/[botId]/settings/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BotSettingsForm } from "@/components/dashboard/bot-settings-form";
import type { Bot } from "@/lib/types/database";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .single();

  if (!bot) notFound();

  return <BotSettingsForm bot={bot as Bot} />;
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/bot-settings-actions.ts components/dashboard/bot-settings-form.tsx app/dashboard/bots/\[botId\]/settings/
git commit -m "feat: add bot settings page with Facebook, Utmify, SigiloPay, and tracking config"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Verify all new files exist**

```bash
ls app/t/[code]/page.tsx
ls server/src/services/facebook-capi.ts server/src/services/utmify.ts server/src/services/tracking-service.ts
ls server/tests/services/facebook-capi.test.ts server/tests/services/tracking-service.test.ts
ls lib/actions/bot-settings-actions.ts
ls components/dashboard/bot-settings-form.tsx
ls app/dashboard/bots/[botId]/settings/page.tsx
```

- [ ] **Step 2: Run server tests**

```bash
cd server && npm test
```

- [ ] **Step 3: Verify Next.js build**

```bash
npm run build
```

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "chore: Phase 4 Tracking & Analytics complete"
```
