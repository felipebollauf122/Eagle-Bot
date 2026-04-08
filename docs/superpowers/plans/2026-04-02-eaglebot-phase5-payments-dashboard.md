# Phase 5: Payments & Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SigiloPay payment integration (checkout link generation + webhook handling), the payment_button flow node (both engine execution and flow builder UI), product management (CRUD), dashboard pages for leads/transactions/tracking, and an overview dashboard with aggregate metrics.

**Architecture:** SigiloPay service lives in the bot engine server (`server/src/services/sigilopay.ts`) and handles checkout URL generation and webhook processing. The payment_button node generates a checkout link via SigiloPay and sends it as an inline button in Telegram. When SigiloPay confirms payment via webhook, the engine updates the transaction, sets `lead.state.paid = true`, fires purchase tracking events, and resumes the flow on the "paid" edge. Dashboard pages are Next.js server components reading from Supabase, with client components for interactivity.

**Tech Stack:** Next.js 16 (React 19, Tailwind 4), TypeScript, Supabase, Express 5, @xyflow/react v12, vitest

**Spec reference:** `docs/superpowers/specs/2026-04-01-eaglebot-design.md` — Payments, Dashboard, and Bot Engine sections

---

## File Structure

```
server/src/services/
├── sigilopay.ts                           # SigiloPay API client (create checkout, verify webhook)
server/src/engine/nodes/
├── payment-button.ts                      # payment_button node handler
server/src/webhook/
├── payment.ts                             # SigiloPay webhook handler
server/tests/services/
├── sigilopay.test.ts                      # SigiloPay service tests
server/tests/engine/nodes/
├── payment-button.test.ts                 # payment_button node test
server/tests/webhook/
├── payment.test.ts                        # Payment webhook handler test

lib/actions/
├── product-actions.ts                     # Server actions: createProduct, updateProduct, deleteProduct, listProducts
├── lead-actions.ts                        # Server actions: getLeads (with pagination/search)
├── transaction-actions.ts                 # Server actions: getTransactions (with filters)
├── tracking-actions.ts                    # Server actions: getTrackingEvents, getTrackingStats

components/dashboard/
├── product-list.tsx                       # Product CRUD list
├── leads-table.tsx                        # Leads table with search/pagination
├── transactions-table.tsx                 # Transactions table with status filters
├── tracking-stats.tsx                     # Tracking funnel + event list
├── overview-stats.tsx                     # Global overview metrics cards
├── flow-builder/nodes/
│   └── payment-button-node.tsx            # payment_button visual node for React Flow
├── flow-builder/config-forms/
│   └── payment-button-config.tsx          # payment_button config panel

app/dashboard/
├── page.tsx                               # MODIFY: add overview stats
app/dashboard/bots/[botId]/
├── products/
│   └── page.tsx                           # Product management page
├── leads/
│   └── page.tsx                           # Leads page
├── transactions/
│   └── page.tsx                           # Transactions page
├── tracking/
│   └── page.tsx                           # Tracking events page
```

---

## Task 1: SigiloPay service

**Files:**
- Create: `server/src/services/sigilopay.ts`
- Create: `server/tests/services/sigilopay.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/tests/services/sigilopay.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SigiloPay } from "../../src/services/sigilopay.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SigiloPay", () => {
  let service: SigiloPay;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SigiloPay("sp_test_key_123");
  });

  it("should create a checkout link", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkout_url: "https://pay.sigilopay.com/checkout/abc123",
        transaction_id: "txn_abc123",
      }),
    });

    const result = await service.createCheckout({
      amount: 9700,
      currency: "BRL",
      productName: "Curso de Marketing",
      customerName: "João Silva",
      externalId: "lead_123",
      webhookUrl: "https://bot.example.com/webhook/payment/bot_1",
    });

    expect(result).toEqual({
      checkoutUrl: "https://pay.sigilopay.com/checkout/abc123",
      transactionId: "txn_abc123",
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.sigilopay.com/v1/checkouts");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.amount).toBe(9700);
    expect(body.currency).toBe("BRL");
    expect(body.product_name).toBe("Curso de Marketing");
  });

  it("should return null when API key is not configured", async () => {
    const emptyService = new SigiloPay("");
    const result = await emptyService.createCheckout({
      amount: 9700,
      currency: "BRL",
      productName: "Curso",
      externalId: "lead_123",
      webhookUrl: "https://example.com/webhook",
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should return null on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "Bad Request",
    });

    const result = await service.createCheckout({
      amount: 9700,
      currency: "BRL",
      productName: "Curso",
      externalId: "lead_123",
      webhookUrl: "https://example.com/webhook",
    });

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Implement SigiloPay service**

Create `server/src/services/sigilopay.ts`:
```ts
interface CreateCheckoutParams {
  amount: number;
  currency: string;
  productName: string;
  customerName?: string;
  externalId: string;
  webhookUrl: string;
}

interface CheckoutResult {
  checkoutUrl: string;
  transactionId: string;
}

export class SigiloPay {
  private baseUrl = "https://api.sigilopay.com/v1";

  constructor(private apiKey: string) {}

  private isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/checkouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency,
          product_name: params.productName,
          customer_name: params.customerName,
          external_id: params.externalId,
          webhook_url: params.webhookUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SigiloPay checkout error:", errorText);
        return null;
      }

      const data = await response.json();
      console.log(`SigiloPay: Checkout created for ${params.productName}`);
      return {
        checkoutUrl: data.checkout_url,
        transactionId: data.transaction_id,
      };
    } catch (error) {
      console.error("SigiloPay request failed:", error);
      return null;
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/sigilopay.ts server/tests/services/sigilopay.test.ts
git commit -m "feat: add SigiloPay service for checkout link generation"
```

---

## Task 2: payment_button node handler

**Files:**
- Create: `server/src/engine/nodes/payment-button.ts`
- Create: `server/tests/engine/nodes/payment-button.test.ts`
- Modify: `server/src/engine/node-executor.ts`
- Modify: `server/src/engine/types.ts`

- [ ] **Step 1: Write failing test**

Create `server/tests/engine/nodes/payment-button.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlePaymentButtonNode } from "../../../src/engine/nodes/payment-button.js";
import type { NodeContext } from "../../../src/engine/types.js";

const mockTelegram = {
  sendMessage: vi.fn().mockResolvedValue(undefined),
  sendPhoto: vi.fn().mockResolvedValue(undefined),
  setWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
};

const mockSigiloPay = {
  createCheckout: vi.fn(),
};

const mockDb = {
  from: vi.fn(),
};

function mockChain(returnData: unknown = null, returnError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  mockDb.from.mockReturnValue(chain);
  return chain;
}

describe("handlePaymentButtonNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create checkout and send button to user", async () => {
    const product = {
      id: "prod-1",
      name: "Curso Pro",
      price: 9700,
      currency: "BRL",
    };
    mockChain(product);

    mockSigiloPay.createCheckout.mockResolvedValueOnce({
      checkoutUrl: "https://pay.sigilopay.com/checkout/abc",
      transactionId: "txn_123",
    });

    const ctx: NodeContext = {
      node: {
        id: "payment-1",
        type: "payment_button",
        data: {
          product_id: "prod-1",
          button_text: "Comprar Agora - R$97",
        },
        position: { x: 0, y: 0 },
      },
      lead: {
        id: "lead-1",
        tenant_id: "t-1",
        bot_id: "bot-1",
        telegram_user_id: 12345,
        first_name: "João",
        username: "joao",
        tid: "tid_abc",
        fbclid: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        current_flow_id: "flow-1",
        current_node_id: "payment-1",
        state: {},
        created_at: "",
        updated_at: "",
      },
      edges: [
        { id: "e1", source: "payment-1", target: "paid-node", sourceHandle: "paid" },
        { id: "e2", source: "payment-1", target: "unpaid-node", sourceHandle: "not_paid" },
      ],
      telegram: mockTelegram as any,
      chatId: 12345,
    };

    const result = await handlePaymentButtonNode(
      ctx,
      mockDb as any,
      mockSigiloPay as any,
      "https://bot.example.com",
    );

    expect(mockSigiloPay.createCheckout).toHaveBeenCalledTimes(1);
    expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(1);

    const sentMessage = mockTelegram.sendMessage.mock.calls[0][0];
    expect(sentMessage.replyMarkup.inline_keyboard[0][0].url).toBe(
      "https://pay.sigilopay.com/checkout/abc",
    );

    // Should wait for payment webhook
    expect(result.nextNodeId).toBe("wait");
    // Should save transaction state
    expect(result.stateUpdates?.pending_transaction_id).toBe("txn_123");
  });

  it("should send error message when product not found", async () => {
    mockChain(null);

    const ctx: NodeContext = {
      node: {
        id: "payment-1",
        type: "payment_button",
        data: { product_id: "nonexistent", button_text: "Comprar" },
        position: { x: 0, y: 0 },
      },
      lead: {
        id: "lead-1",
        tenant_id: "t-1",
        bot_id: "bot-1",
        telegram_user_id: 12345,
        first_name: "João",
        username: null,
        tid: null,
        fbclid: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        current_flow_id: null,
        current_node_id: null,
        state: {},
        created_at: "",
        updated_at: "",
      },
      edges: [],
      telegram: mockTelegram as any,
      chatId: 12345,
    };

    const result = await handlePaymentButtonNode(
      ctx,
      mockDb as any,
      mockSigiloPay as any,
      "https://bot.example.com",
    );

    expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(1);
    const sentText = mockTelegram.sendMessage.mock.calls[0][0].text;
    expect(sentText).toContain("indisponível");
    expect(result.nextNodeId).toBe(null);
  });
});
```

- [ ] **Step 2: Implement payment_button node handler**

Create `server/src/engine/nodes/payment-button.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NodeContext, NodeResult } from "../types.js";
import type { SigiloPay } from "../../services/sigilopay.js";

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
}

export async function handlePaymentButtonNode(
  ctx: NodeContext,
  db: SupabaseClient,
  sigiloPay: SigiloPay,
  baseWebhookUrl: string,
): Promise<NodeResult> {
  const productId = String(ctx.node.data.product_id ?? "");
  const buttonText = String(ctx.node.data.button_text ?? "Comprar Agora");

  // Fetch product
  const { data: product } = await db
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (!product) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Desculpe, este produto está indisponível no momento.",
    });
    return { nextNodeId: null };
  }

  const typedProduct = product as Product;

  // Create SigiloPay checkout
  const webhookUrl = `${baseWebhookUrl}/webhook/payment/${ctx.lead.bot_id}`;
  const checkout = await sigiloPay.createCheckout({
    amount: typedProduct.price,
    currency: typedProduct.currency,
    productName: typedProduct.name,
    customerName: ctx.lead.first_name,
    externalId: ctx.lead.id,
    webhookUrl,
  });

  if (!checkout) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Desculpe, ocorreu um erro ao gerar o pagamento. Tente novamente.",
    });
    return { nextNodeId: null };
  }

  // Create transaction record
  await db.from("transactions").insert({
    tenant_id: ctx.lead.tenant_id,
    lead_id: ctx.lead.id,
    bot_id: ctx.lead.bot_id,
    flow_id: ctx.lead.current_flow_id,
    product_id: typedProduct.id,
    gateway: "sigilopay",
    external_id: checkout.transactionId,
    amount: typedProduct.price,
    currency: typedProduct.currency,
    status: "pending",
  });

  // Send checkout button to user
  const priceFormatted = (typedProduct.price / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: typedProduct.currency,
  });

  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: `${typedProduct.name} — ${priceFormatted}`,
    replyMarkup: {
      inline_keyboard: [
        [{ text: buttonText, url: checkout.checkoutUrl }],
      ],
    },
  });

  // Save payment node state for webhook resume
  return {
    nextNodeId: "wait",
    stateUpdates: {
      pending_transaction_id: checkout.transactionId,
      pending_payment_node_id: ctx.node.id,
    },
  };
}
```

- [ ] **Step 3: Update node-executor to include payment_button**

Modify `server/src/engine/node-executor.ts` — add the payment_button import and handler:

Add after line 8 (`import { handleActionNode } from "./nodes/action.js";`):
```ts
import { handlePaymentButtonNode } from "./nodes/payment-button.js";
```

The `payment_button` handler has a different signature (it needs `db`, `sigiloPay`, `baseWebhookUrl`), so we need to update the `executeNode` function. Replace the entire file with:

```ts
import type { NodeContext, NodeResult } from "./types.js";
import { handleTriggerNode } from "./nodes/trigger.js";
import { handleTextNode } from "./nodes/text.js";
import { handleImageNode } from "./nodes/image.js";
import { handleButtonNode } from "./nodes/button.js";
import { handleDelayNode } from "./nodes/delay.js";
import { handleConditionNode } from "./nodes/condition.js";
import { handleInputNode } from "./nodes/input.js";
import { handleActionNode } from "./nodes/action.js";
import { handlePaymentButtonNode } from "./nodes/payment-button.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SigiloPay } from "../services/sigilopay.js";

const handlers: Record<string, (ctx: NodeContext) => Promise<NodeResult>> = {
  trigger: handleTriggerNode,
  text: handleTextNode,
  image: handleImageNode,
  button: handleButtonNode,
  delay: handleDelayNode,
  condition: handleConditionNode,
  input: handleInputNode,
  action: handleActionNode,
};

export interface ExecuteNodeDeps {
  db?: SupabaseClient;
  sigiloPay?: SigiloPay;
  baseWebhookUrl?: string;
}

export async function executeNode(ctx: NodeContext, deps?: ExecuteNodeDeps): Promise<NodeResult> {
  // payment_button needs extra deps
  if (ctx.node.type === "payment_button" && deps?.db && deps?.sigiloPay && deps?.baseWebhookUrl) {
    return handlePaymentButtonNode(ctx, deps.db, deps.sigiloPay, deps.baseWebhookUrl);
  }

  const handler = handlers[ctx.node.type];
  if (!handler) {
    console.warn(`Unknown node type: ${ctx.node.type}`);
    return { nextNodeId: null };
  }
  return handler(ctx);
}
```

- [ ] **Step 4: Update flow-processor to pass deps to executeNode**

Modify `server/src/engine/flow-processor.ts`:

Add import at top (after existing imports):
```ts
import type { ExecuteNodeDeps } from "./node-executor.js";
import type { SigiloPay } from "../services/sigilopay.js";
```

Update the constructor to accept optional deps:
```ts
export class FlowProcessor {
  private executeDeps: ExecuteNodeDeps;

  constructor(
    private db: SupabaseClient,
    private leadService: LeadService,
    private delayQueue: DelayQueue,
    deps?: { sigiloPay?: SigiloPay; baseWebhookUrl?: string },
  ) {
    this.executeDeps = {
      db: this.db,
      sigiloPay: deps?.sigiloPay,
      baseWebhookUrl: deps?.baseWebhookUrl,
    };
  }
```

Update the `executeNode` call in `executeFlow` (around line 74):

Change:
```ts
const result = await executeNode(ctx);
```
To:
```ts
const result = await executeNode(ctx, this.executeDeps);
```

- [ ] **Step 5: Update telegram webhook to pass deps**

In `server/src/webhook/telegram.ts`, update the FlowProcessor instantiation.

Add imports at top:
```ts
import { SigiloPay } from "../services/sigilopay.js";
import { config } from "../config.js";
```

Update the Bot interface to include `sigilopay_api_key`:
```ts
interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
  is_active: boolean;
  sigilopay_api_key: string | null;
}
```

Replace the processor instantiation (around line 38):
```ts
const sigiloPay = new SigiloPay(typedBot.sigilopay_api_key ?? "");
const processor = new FlowProcessor(supabase, leadService, { addDelayedJob }, {
  sigiloPay,
  baseWebhookUrl: config.baseWebhookUrl,
});
```

- [ ] **Step 6: Update queue.ts worker to pass deps**

In `server/src/queue.ts`, update the FlowProcessor instantiation in the worker. Add imports at top:
```ts
import { SigiloPay } from "./services/sigilopay.js";
```

Update the Bot interface:
```ts
interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
  sigilopay_api_key: string | null;
}
```

Update the worker's processor creation (inside the worker callback, after fetching bot):
```ts
const sigiloPay = new SigiloPay((bot as Bot).sigilopay_api_key ?? "");
const processor = new FlowProcessor(
  supabase,
  leadService,
  { addDelayedJob },
  { sigiloPay, baseWebhookUrl: config.baseWebhookUrl },
);
```

Add `config` import if not already present:
```ts
import { config } from "./config.js";
```

- [ ] **Step 7: Commit**

```bash
git add server/src/engine/nodes/payment-button.ts server/tests/engine/nodes/payment-button.test.ts server/src/engine/node-executor.ts server/src/engine/flow-processor.ts server/src/webhook/telegram.ts server/src/queue.ts
git commit -m "feat: add payment_button node handler with SigiloPay checkout integration"
```

---

## Task 3: Payment webhook handler

**Files:**
- Create: `server/src/webhook/payment.ts`
- Create: `server/tests/webhook/payment.test.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `server/tests/webhook/payment.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing handler
vi.mock("../../src/db.js", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("../../src/services/lead-service.js", () => ({
  LeadService: vi.fn(),
}));

vi.mock("../../src/queue.js", () => ({
  addDelayedJob: vi.fn(),
}));

import { handlePaymentWebhook } from "../../src/webhook/payment.js";

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mocked(await import("../../src/db.js")).supabase = mockSupabase as any;

function mockSelectChain(data: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

describe("handlePaymentWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should respond 200 to valid webhook", async () => {
    const req = {
      params: { botId: "bot-1" },
      body: {
        event: "payment.approved",
        transaction_id: "txn_123",
        external_id: "lead-1",
        amount: 9700,
        currency: "BRL",
      },
    } as any;

    let statusCode = 0;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return { json: vi.fn() };
      },
    } as any;

    // Mock transaction lookup
    const transaction = {
      id: "tx-db-1",
      tenant_id: "t-1",
      lead_id: "lead-1",
      bot_id: "bot-1",
      flow_id: "flow-1",
      product_id: "prod-1",
      external_id: "txn_123",
      status: "pending",
    };
    mockSelectChain(transaction);

    await handlePaymentWebhook(req, res);

    expect(statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Implement payment webhook handler**

Create `server/src/webhook/payment.ts`:
```ts
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
import type { Flow } from "../engine/flow-processor.js";

interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
  facebook_pixel_id: string | null;
  facebook_access_token: string | null;
  utmify_api_key: string | null;
  sigilopay_api_key: string | null;
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

interface Lead {
  id: string;
  tenant_id: string;
  bot_id: string;
  telegram_user_id: number;
  first_name: string;
  username: string | null;
  tid: string | null;
  fbclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  current_flow_id: string | null;
  current_node_id: string | null;
  state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const leadService = new LeadService(supabase);

export async function handlePaymentWebhook(req: Request, res: Response): Promise<void> {
  const botId = req.params.botId;

  // Always respond 200 quickly
  res.status(200).json({ ok: true });

  try {
    const { event, transaction_id, amount, currency } = req.body;

    // Lookup transaction by external_id
    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("external_id", transaction_id)
      .eq("bot_id", botId)
      .single();

    if (!transaction) {
      console.error(`Transaction not found: ${transaction_id}`);
      return;
    }

    const typedTx = transaction as Transaction;

    // Map SigiloPay event to our status
    let newStatus: string;
    if (event === "payment.approved") {
      newStatus = "approved";
    } else if (event === "payment.refused") {
      newStatus = "refused";
    } else if (event === "payment.refunded") {
      newStatus = "refunded";
    } else {
      console.log(`Ignoring SigiloPay event: ${event}`);
      return;
    }

    // Idempotency: skip if already processed
    if (typedTx.status === newStatus) {
      console.log(`Transaction ${transaction_id} already ${newStatus}, skipping`);
      return;
    }

    // Update transaction status
    await supabase
      .from("transactions")
      .update({
        status: newStatus,
        paid_at: newStatus === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", typedTx.id);

    // Only process approved payments further
    if (newStatus !== "approved") return;

    // Fetch bot config
    const { data: bot } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single();

    if (!bot) return;

    const typedBot = bot as Bot;

    // Fetch lead
    const lead = await leadService.getById(typedTx.lead_id);
    if (!lead) return;

    const typedLead = lead as unknown as Lead;

    // Update lead state: paid = true
    const updatedState = { ...typedLead.state, paid: true };
    await leadService.updateState(typedLead.id, updatedState);
    typedLead.state = updatedState;

    // Fire purchase tracking event
    const facebookCapi = new FacebookCapi(
      typedBot.facebook_pixel_id ?? "",
      typedBot.facebook_access_token ?? "",
    );
    const utmify = new UtmifyService(typedBot.utmify_api_key ?? "");
    const trackingService = new TrackingService(supabase, facebookCapi, utmify);

    await trackingService.trackPurchase({
      tenantId: typedTx.tenant_id,
      leadId: typedTx.lead_id,
      botId: typedTx.bot_id,
      transactionId: typedTx.id,
      amount: typedTx.amount,
      currency: typedTx.currency,
      fbclid: typedLead.fbclid,
      tid: typedLead.tid,
      utmSource: typedLead.utm_source ?? undefined,
      utmMedium: typedLead.utm_medium ?? undefined,
      utmCampaign: typedLead.utm_campaign ?? undefined,
      utmContent: typedLead.utm_content ?? undefined,
      utmTerm: typedLead.utm_term ?? undefined,
      customerName: typedLead.first_name,
    });

    // Resume flow on "paid" edge
    const paymentNodeId = String(typedLead.state.pending_payment_node_id ?? "");
    if (paymentNodeId && typedTx.flow_id) {
      const { data: flow } = await supabase
        .from("flows")
        .select("*")
        .eq("id", typedTx.flow_id)
        .single();

      if (flow) {
        const typedFlow = flow as Flow;
        const paidEdge = typedFlow.flow_data.edges.find(
          (e) => e.source === paymentNodeId && e.sourceHandle === "paid",
        );

        if (paidEdge) {
          const telegram = new TelegramApi(typedBot.telegram_token);
          const sigiloPay = new SigiloPay(typedBot.sigilopay_api_key ?? "");
          const processor = new FlowProcessor(supabase, leadService, { addDelayedJob }, {
            sigiloPay,
            baseWebhookUrl: config.baseWebhookUrl,
          });
          await processor.executeFlow(
            typedFlow,
            typedLead as any,
            telegram,
            typedLead.telegram_user_id,
            paidEdge.target,
          );
        }
      }
    }
  } catch (error) {
    console.error(`Error processing payment webhook for bot ${botId}:`, error);
  }
}
```

- [ ] **Step 3: Register payment webhook route in server/src/index.ts**

Add import at top of `server/src/index.ts`:
```ts
import { handlePaymentWebhook } from "./webhook/payment.js";
```

Add route after the Telegram webhook route (after line 25):
```ts
// SigiloPay payment webhook endpoint
app.post("/webhook/payment/:botId", handlePaymentWebhook);
```

- [ ] **Step 4: Commit**

```bash
git add server/src/webhook/payment.ts server/tests/webhook/payment.test.ts server/src/index.ts
git commit -m "feat: add SigiloPay payment webhook handler with flow resume and tracking"
```

---

## Task 4: payment_button flow builder UI

**Files:**
- Create: `components/dashboard/flow-builder/nodes/payment-button-node.tsx`
- Create: `components/dashboard/flow-builder/config-forms/payment-button-config.tsx`
- Modify: `components/dashboard/flow-builder/node-palette.tsx`
- Modify: `components/dashboard/flow-builder/node-config-panel.tsx`
- Modify: `components/dashboard/flow-builder/flow-editor.tsx`
- Modify: `lib/types/database.ts` (NodeType already has payment_button)

- [ ] **Step 1: Create payment_button node component**

Create `components/dashboard/flow-builder/nodes/payment-button-node.tsx`:
```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function PaymentButtonNode({ data, selected }: NodeProps) {
  const buttonText = String(data.button_text ?? "Comprar Agora");

  return (
    <div className={`bg-[#12121a] border rounded-xl px-4 py-3 min-w-[200px] max-w-[280px] shadow-lg ${selected ? "border-yellow-400" : "border-yellow-500/30"}`}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-400 !w-3 !h-3 !border-2 !border-[#12121a]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-yellow-400" />
        <span className="text-yellow-400 text-xs font-semibold uppercase">Pagamento</span>
      </div>
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1.5 text-yellow-300 text-xs text-center font-medium">
        {buttonText}
      </div>
      <div className="flex justify-between mt-2">
        <Handle type="source" position={Position.Bottom} id="paid" className="!bg-green-400 !w-3 !h-3 !border-2 !border-[#12121a] !left-[30%]" />
        <Handle type="source" position={Position.Bottom} id="not_paid" className="!bg-red-400 !w-3 !h-3 !border-2 !border-[#12121a] !left-[70%]" />
      </div>
      <div className="flex justify-between mt-1 px-1">
        <span className="text-green-400 text-[10px]">Pagou</span>
        <span className="text-red-400 text-[10px]">Não Pagou</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create payment_button config form**

Create `components/dashboard/flow-builder/config-forms/payment-button-config.tsx`:
```tsx
"use client";

interface PaymentButtonConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function PaymentButtonConfig({ data, onChange }: PaymentButtonConfigProps) {
  const productId = String(data.product_id ?? "");
  const buttonText = String(data.button_text ?? "Comprar Agora");

  const inputClass = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500";
  const labelClass = "block text-white/60 text-xs mb-1";

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>ID do Produto</label>
        <input
          type="text"
          value={productId}
          onChange={(e) => onChange({ ...data, product_id: e.target.value })}
          placeholder="ID do produto no Supabase"
          className={inputClass}
        />
        <p className="text-white/30 text-[10px] mt-1">
          Copie o ID do produto na aba Produtos
        </p>
      </div>
      <div>
        <label className={labelClass}>Texto do Botão</label>
        <input
          type="text"
          value={buttonText}
          onChange={(e) => onChange({ ...data, button_text: e.target.value })}
          placeholder="Comprar Agora - R$97"
          className={inputClass}
        />
      </div>
      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-3 text-[11px] text-yellow-300/60">
        Este nó gera um link de pagamento SigiloPay. Configure a chave da API nas Configurações do bot. O fluxo segue pela saída "Pagou" quando o pagamento é confirmado.
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register payment_button in node-palette.tsx**

In `components/dashboard/flow-builder/node-palette.tsx`, add to the `nodeTypes` array after `input`:
```ts
{ type: "payment_button", label: "Pagamento", color: "bg-yellow-400", category: "Pagamento" },
```

Add `"Pagamento"` to the `categories` array:
```ts
const categories = ["Início", "Mensagens", "Lógica", "Ações", "Pagamento"];
```

- [ ] **Step 4: Register payment_button in node-config-panel.tsx**

In `components/dashboard/flow-builder/node-config-panel.tsx`:

Add import:
```tsx
import { PaymentButtonConfig } from "./config-forms/payment-button-config";
```

Add to `labels` object:
```ts
payment_button: "Pagamento",
```

Add to `configForms` object:
```tsx
payment_button: <PaymentButtonConfig data={node.data} onChange={handleChange} />,
```

- [ ] **Step 5: Register payment_button in flow-editor.tsx**

In `components/dashboard/flow-builder/flow-editor.tsx`:

Add import:
```tsx
import { PaymentButtonNode } from "./nodes/payment-button-node";
```

Add to `nodeTypeComponents`:
```ts
payment_button: PaymentButtonNode,
```

Add to `defaultNodeData`:
```ts
payment_button: { product_id: "", button_text: "Comprar Agora" },
```

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/flow-builder/nodes/payment-button-node.tsx components/dashboard/flow-builder/config-forms/payment-button-config.tsx components/dashboard/flow-builder/node-palette.tsx components/dashboard/flow-builder/node-config-panel.tsx components/dashboard/flow-builder/flow-editor.tsx
git commit -m "feat: add payment_button node to flow builder with gold-accent UI"
```

---

## Task 5: Product management (CRUD)

**Files:**
- Create: `lib/actions/product-actions.ts`
- Create: `components/dashboard/product-list.tsx`
- Create: `app/dashboard/bots/[botId]/products/page.tsx`
- Modify: `components/dashboard/bot-sidebar.tsx`

- [ ] **Step 1: Create product server actions**

Create `lib/actions/product-actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function createProduct(botId: string, name: string, price: number, currency: string, description: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("products").insert({
    tenant_id: user.id,
    bot_id: botId,
    name,
    price,
    currency,
    description,
    is_active: true,
  });

  if (error) throw new Error(`Failed to create product: ${error.message}`);
  return { success: true };
}

export async function updateProduct(productId: string, data: { name?: string; price?: number; description?: string; is_active?: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("products").update(data).eq("id", productId);
  if (error) throw new Error(`Failed to update product: ${error.message}`);
  return { success: true };
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw new Error(`Failed to delete product: ${error.message}`);
  return { success: true };
}
```

- [ ] **Step 2: Create product list component**

Create `components/dashboard/product-list.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createProduct, deleteProduct, updateProduct } from "@/lib/actions/product-actions";
import type { Product } from "@/lib/types/database";

interface ProductListProps {
  botId: string;
  initialProducts: Product[];
}

export function ProductList({ botId, initialProducts }: ProductListProps) {
  const [products, setProducts] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name || !price) return;
    setSaving(true);
    try {
      await createProduct(botId, name, Math.round(parseFloat(price) * 100), "BRL", description);
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      await deleteProduct(productId);
      setProducts(products.filter((p) => p.id !== productId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggle = async (productId: string, isActive: boolean) => {
    try {
      await updateProduct(productId, { is_active: !isActive });
      setProducts(products.map((p) => p.id === productId ? { ...p, is_active: !isActive } : p));
    } catch (e) {
      console.error(e);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Produtos</h1>
          <p className="text-white/50 text-sm mt-1">Gerencie os produtos vendidos por este bot</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition"
        >
          + Novo Produto
        </button>
      </div>

      {showForm && (
        <div className="bg-[#12121a] border border-white/10 rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Novo Produto</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-white/60 text-xs mb-1">Nome</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Curso de Marketing Digital" className={inputClass} />
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1">Preço (R$)</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="97.00" className={inputClass} />
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1">Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Descrição do produto..." className={`${inputClass} resize-none`} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                {saving ? "Criando..." : "Criar Produto"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">📦</span>
          <p className="text-white/40 text-sm">Nenhum produto cadastrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="bg-[#12121a] border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-medium text-sm">{product.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${product.is_active ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`}>
                    {product.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="text-white/40 text-xs mt-1">{product.description}</p>
                <p className="text-purple-400 text-sm font-semibold mt-1">
                  {(product.price / 100).toLocaleString("pt-BR", { style: "currency", currency: product.currency })}
                </p>
                <p className="text-white/20 text-[10px] mt-1 font-mono">ID: {product.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(product.id, product.is_active)}
                  className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition"
                >
                  {product.is_active ? "Desativar" : "Ativar"}
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create products page**

Create `app/dashboard/bots/[botId]/products/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { ProductList } from "@/components/dashboard/product-list";
import type { Product } from "@/lib/types/database";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <ProductList botId={botId} initialProducts={(products ?? []) as Product[]} />
    </div>
  );
}
```

- [ ] **Step 4: Add "Produtos" to bot sidebar**

In `components/dashboard/bot-sidebar.tsx`, add to the `botNavItems` array after "Fluxos":
```ts
{ label: "Produtos", segment: "products", icon: "📦" },
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/product-actions.ts components/dashboard/product-list.tsx app/dashboard/bots/\[botId\]/products/page.tsx components/dashboard/bot-sidebar.tsx
git commit -m "feat: add product management CRUD with sidebar navigation"
```

---

## Task 6: Leads dashboard page

**Files:**
- Create: `lib/actions/lead-actions.ts`
- Create: `components/dashboard/leads-table.tsx`
- Create: `app/dashboard/bots/[botId]/leads/page.tsx`

- [ ] **Step 1: Create lead server actions**

Create `lib/actions/lead-actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function getLeads(botId: string, page: number = 1, search: string = "") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to fetch leads: ${error.message}`);

  return { leads: data ?? [], total: count ?? 0, page, pageSize };
}
```

- [ ] **Step 2: Create leads table component**

Create `components/dashboard/leads-table.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { getLeads } from "@/lib/actions/lead-actions";
import type { Lead } from "@/lib/types/database";

interface LeadsTableProps {
  botId: string;
  initialLeads: Lead[];
  total: number;
  currentPage: number;
  pageSize: number;
}

export function LeadsTable({ botId, initialLeads, total, currentPage, pageSize }: LeadsTableProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [page, setPage] = useState(currentPage);
  const [count, setCount] = useState(total);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(count / pageSize);

  const loadPage = (newPage: number, searchQuery?: string) => {
    startTransition(async () => {
      const result = await getLeads(botId, newPage, searchQuery ?? search);
      setLeads(result.leads as Lead[]);
      setCount(result.total);
      setPage(newPage);
    });
  };

  const handleSearch = () => {
    loadPage(1, search);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-white/50 text-sm mt-1">{count} leads no total</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar por nome ou username..."
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 w-64"
          />
          <button onClick={handleSearch} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition">
            Buscar
          </button>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">👥</span>
          <p className="text-white/40 text-sm">Nenhum lead encontrado</p>
        </div>
      ) : (
        <>
          <div className="bg-[#12121a] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Nome</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Username</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Fonte</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">TID</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white text-sm">{lead.first_name}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{lead.username ? `@${lead.username}` : "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      {lead.utm_source ? (
                        <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded text-xs">{lead.utm_source}</span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs font-mono">{lead.tid ?? "—"}</td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => loadPage(page - 1)}
                disabled={page <= 1 || isPending}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition disabled:opacity-30"
              >
                Anterior
              </button>
              <span className="text-white/40 text-sm">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => loadPage(page + 1)}
                disabled={page >= totalPages || isPending}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition disabled:opacity-30"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create leads page**

Create `app/dashboard/bots/[botId]/leads/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { LeadsTable } from "@/components/dashboard/leads-table";
import type { Lead } from "@/lib/types/database";

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const pageSize = 20;
  const { data: leads, count } = await supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(0, pageSize - 1);

  return (
    <div className="p-8">
      <LeadsTable
        botId={botId}
        initialLeads={(leads ?? []) as Lead[]}
        total={count ?? 0}
        currentPage={1}
        pageSize={pageSize}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/lead-actions.ts components/dashboard/leads-table.tsx app/dashboard/bots/\[botId\]/leads/page.tsx
git commit -m "feat: add leads dashboard page with search and pagination"
```

---

## Task 7: Transactions dashboard page

**Files:**
- Create: `lib/actions/transaction-actions.ts`
- Create: `components/dashboard/transactions-table.tsx`
- Create: `app/dashboard/bots/[botId]/transactions/page.tsx`

- [ ] **Step 1: Create transaction server actions**

Create `lib/actions/transaction-actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function getTransactions(botId: string, page: number = 1, statusFilter: string = "all") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("transactions")
    .select("*, products(name)", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);

  return { transactions: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getTransactionStats(botId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: approved } = await supabase
    .from("transactions")
    .select("amount")
    .eq("bot_id", botId)
    .eq("status", "approved");

  const totalRevenue = (approved ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const totalSales = (approved ?? []).length;

  const { count: pendingCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("bot_id", botId)
    .eq("status", "pending");

  return { totalRevenue, totalSales, pendingCount: pendingCount ?? 0 };
}
```

- [ ] **Step 2: Create transactions table component**

Create `components/dashboard/transactions-table.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { getTransactions } from "@/lib/actions/transaction-actions";

interface TransactionRow {
  id: string;
  external_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  products: { name: string } | null;
}

interface TransactionsTableProps {
  botId: string;
  initialTransactions: TransactionRow[];
  total: number;
  currentPage: number;
  pageSize: number;
  stats: { totalRevenue: number; totalSales: number; pendingCount: number };
}

const statusColors: Record<string, string> = {
  approved: "bg-green-500/10 text-green-400",
  pending: "bg-yellow-500/10 text-yellow-400",
  refused: "bg-red-500/10 text-red-400",
  refunded: "bg-white/5 text-white/40",
};

const statusLabels: Record<string, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  refused: "Recusado",
  refunded: "Reembolsado",
};

export function TransactionsTable({ botId, initialTransactions, total, currentPage, pageSize, stats }: TransactionsTableProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [page, setPage] = useState(currentPage);
  const [count, setCount] = useState(total);
  const [filter, setFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(count / pageSize);

  const loadPage = (newPage: number, statusFilter?: string) => {
    startTransition(async () => {
      const result = await getTransactions(botId, newPage, statusFilter ?? filter);
      setTransactions(result.transactions as TransactionRow[]);
      setCount(result.total);
      setPage(newPage);
    });
  };

  const handleFilter = (newFilter: string) => {
    setFilter(newFilter);
    loadPage(1, newFilter);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Transações</h1>
      <p className="text-white/50 text-sm mb-6">{count} transações no total</p>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#12121a] border border-white/10 rounded-xl p-4">
          <p className="text-white/40 text-xs">Receita Total</p>
          <p className="text-green-400 text-xl font-bold mt-1">
            {(stats.totalRevenue / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="bg-[#12121a] border border-white/10 rounded-xl p-4">
          <p className="text-white/40 text-xs">Vendas Aprovadas</p>
          <p className="text-white text-xl font-bold mt-1">{stats.totalSales}</p>
        </div>
        <div className="bg-[#12121a] border border-white/10 rounded-xl p-4">
          <p className="text-white/40 text-xs">Pendentes</p>
          <p className="text-yellow-400 text-xl font-bold mt-1">{stats.pendingCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {["all", "approved", "pending", "refused", "refunded"].map((f) => (
          <button
            key={f}
            onClick={() => handleFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${filter === f ? "bg-purple-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
          >
            {f === "all" ? "Todas" : statusLabels[f]}
          </button>
        ))}
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">💰</span>
          <p className="text-white/40 text-sm">Nenhuma transação encontrada</p>
        </div>
      ) : (
        <>
          <div className="bg-[#12121a] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Produto</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Valor</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Status</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Data</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">ID Externo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white text-sm">{tx.products?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">
                      {(tx.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: tx.currency })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[tx.status] ?? "bg-white/5 text-white/40"}`}>
                        {statusLabels[tx.status] ?? tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-white/20 text-xs font-mono">{tx.external_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => loadPage(page - 1)}
                disabled={page <= 1 || isPending}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition disabled:opacity-30"
              >
                Anterior
              </button>
              <span className="text-white/40 text-sm">Página {page} de {totalPages}</span>
              <button
                onClick={() => loadPage(page + 1)}
                disabled={page >= totalPages || isPending}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition disabled:opacity-30"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create transactions page**

Create `app/dashboard/bots/[botId]/transactions/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { getTransactionStats } from "@/lib/actions/transaction-actions";

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const pageSize = 20;
  const { data: transactions, count } = await supabase
    .from("transactions")
    .select("*, products(name)", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(0, pageSize - 1);

  const stats = await getTransactionStats(botId);

  return (
    <div className="p-8">
      <TransactionsTable
        botId={botId}
        initialTransactions={(transactions ?? []) as any}
        total={count ?? 0}
        currentPage={1}
        pageSize={pageSize}
        stats={stats}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/transaction-actions.ts components/dashboard/transactions-table.tsx app/dashboard/bots/\[botId\]/transactions/page.tsx
git commit -m "feat: add transactions dashboard with stats, filters, and pagination"
```

---

## Task 8: Tracking events dashboard page

**Files:**
- Create: `lib/actions/tracking-actions.ts`
- Create: `components/dashboard/tracking-stats.tsx`
- Create: `app/dashboard/bots/[botId]/tracking/page.tsx`

- [ ] **Step 1: Create tracking server actions**

Create `lib/actions/tracking-actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function getTrackingEvents(botId: string, page: number = 1) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  const { data, count, error } = await supabase
    .from("tracking_events")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to fetch tracking events: ${error.message}`);
  return { events: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getTrackingFunnel(botId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const eventTypes = ["page_view", "bot_start", "view_offer", "checkout", "purchase"] as const;
  const counts: Record<string, number> = {};

  for (const eventType of eventTypes) {
    const { count } = await supabase
      .from("tracking_events")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", botId)
      .eq("event_type", eventType);

    counts[eventType] = count ?? 0;
  }

  return counts;
}
```

- [ ] **Step 2: Create tracking stats component**

Create `components/dashboard/tracking-stats.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { getTrackingEvents } from "@/lib/actions/tracking-actions";
import type { TrackingEvent } from "@/lib/types/database";

interface TrackingStatsProps {
  botId: string;
  funnel: Record<string, number>;
  initialEvents: TrackingEvent[];
  total: number;
  currentPage: number;
  pageSize: number;
}

const eventTypeLabels: Record<string, string> = {
  page_view: "Visualização",
  bot_start: "Entrou no Bot",
  view_offer: "Viu Oferta",
  checkout: "Checkout",
  purchase: "Compra",
};

const eventTypeColors: Record<string, string> = {
  page_view: "bg-blue-500/10 text-blue-400",
  bot_start: "bg-cyan-500/10 text-cyan-400",
  view_offer: "bg-purple-500/10 text-purple-400",
  checkout: "bg-yellow-500/10 text-yellow-400",
  purchase: "bg-green-500/10 text-green-400",
};

export function TrackingStats({ botId, funnel, initialEvents, total, currentPage, pageSize }: TrackingStatsProps) {
  const [events, setEvents] = useState(initialEvents);
  const [page, setPage] = useState(currentPage);
  const [count, setCount] = useState(total);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(count / pageSize);
  const maxFunnel = Math.max(...Object.values(funnel), 1);

  const loadPage = (newPage: number) => {
    startTransition(async () => {
      const result = await getTrackingEvents(botId, newPage);
      setEvents(result.events as TrackingEvent[]);
      setCount(result.total);
      setPage(newPage);
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Tracking</h1>
      <p className="text-white/50 text-sm mb-6">Funil de conversão e eventos de rastreamento</p>

      {/* Funnel */}
      <div className="bg-[#12121a] border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Funil de Conversão</h2>
        <div className="space-y-3">
          {Object.entries(eventTypeLabels).map(([key, label]) => {
            const value = funnel[key] ?? 0;
            const widthPercent = Math.max((value / maxFunnel) * 100, 2);
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-white/60 text-xs w-28 text-right">{label}</span>
                <div className="flex-1 bg-white/5 rounded-full h-7 overflow-hidden">
                  <div
                    className="h-full bg-purple-600/60 rounded-full flex items-center px-3 transition-all"
                    style={{ width: `${widthPercent}%` }}
                  >
                    <span className="text-white text-xs font-semibold">{value}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events Table */}
      <h2 className="text-white font-semibold mb-3">Eventos Recentes</h2>
      {events.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">📈</span>
          <p className="text-white/40 text-sm">Nenhum evento registrado</p>
        </div>
      ) : (
        <>
          <div className="bg-[#12121a] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Evento</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">TID</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">fbclid</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">FB</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Utmify</th>
                  <th className="text-left text-white/40 text-xs font-semibold px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${eventTypeColors[event.event_type] ?? "bg-white/5 text-white/40"}`}>
                        {eventTypeLabels[event.event_type] ?? event.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs font-mono">{event.tid ?? "—"}</td>
                    <td className="px-4 py-3 text-white/30 text-xs font-mono">
                      {event.fbclid ? event.fbclid.slice(0, 12) + "..." : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {event.sent_to_facebook ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {event.sent_to_utmify ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(event.created_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => loadPage(page - 1)}
                disabled={page <= 1 || isPending}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition disabled:opacity-30"
              >
                Anterior
              </button>
              <span className="text-white/40 text-sm">Página {page} de {totalPages}</span>
              <button
                onClick={() => loadPage(page + 1)}
                disabled={page >= totalPages || isPending}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition disabled:opacity-30"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create tracking page**

Create `app/dashboard/bots/[botId]/tracking/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { TrackingStats } from "@/components/dashboard/tracking-stats";
import { getTrackingFunnel } from "@/lib/actions/tracking-actions";
import type { TrackingEvent } from "@/lib/types/database";

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const pageSize = 30;
  const { data: events, count } = await supabase
    .from("tracking_events")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(0, pageSize - 1);

  const funnel = await getTrackingFunnel(botId);

  return (
    <div className="p-8">
      <TrackingStats
        botId={botId}
        funnel={funnel}
        initialEvents={(events ?? []) as TrackingEvent[]}
        total={count ?? 0}
        currentPage={1}
        pageSize={pageSize}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/tracking-actions.ts components/dashboard/tracking-stats.tsx app/dashboard/bots/\[botId\]/tracking/page.tsx
git commit -m "feat: add tracking events dashboard with conversion funnel visualization"
```

---

## Task 9: Overview dashboard with aggregate metrics

**Files:**
- Create: `components/dashboard/overview-stats.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Create overview stats component**

Create `components/dashboard/overview-stats.tsx`:
```tsx
interface OverviewStatsProps {
  totalBots: number;
  activeBots: number;
  totalLeads: number;
  totalRevenue: number;
  totalSales: number;
}

export function OverviewStats({ totalBots, activeBots, totalLeads, totalRevenue, totalSales }: OverviewStatsProps) {
  const cards = [
    { label: "Bots Ativos", value: `${activeBots}/${totalBots}`, color: "text-purple-400" },
    { label: "Total de Leads", value: totalLeads.toLocaleString("pt-BR"), color: "text-cyan-400" },
    { label: "Vendas Aprovadas", value: totalSales.toLocaleString("pt-BR"), color: "text-green-400" },
    { label: "Receita Total", value: (totalRevenue / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), color: "text-green-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div key={card.label} className="bg-[#12121a] border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs">{card.label}</p>
          <p className={`${card.color} text-2xl font-bold mt-1`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update dashboard page to include overview stats**

Replace `app/dashboard/page.tsx` with:
```tsx
import { createClient } from "@/lib/supabase/server";
import { BotCard } from "@/components/dashboard/bot-card";
import { OverviewStats } from "@/components/dashboard/overview-stats";
import type { Bot } from "@/lib/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: bots, error } = await supabase
    .from("bots")
    .select("*")
    .order("created_at", { ascending: false });

  const botList = (bots ?? []) as Bot[];

  // Aggregate stats
  const activeBots = botList.filter((b) => b.is_active).length;

  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { data: approvedTx } = await supabase
    .from("transactions")
    .select("amount")
    .eq("status", "approved");

  const totalRevenue = (approvedTx ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const totalSales = (approvedTx ?? []).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Meus Bots</h1>
          <p className="text-white/50 mt-1">
            Gerencie seus bots de vendas do Telegram
          </p>
        </div>
        <a
          href="/dashboard/bots/new"
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition"
        >
          + Novo Bot
        </a>
      </div>

      {botList.length > 0 && (
        <OverviewStats
          totalBots={botList.length}
          activeBots={activeBots}
          totalLeads={totalLeads ?? 0}
          totalRevenue={totalRevenue}
          totalSales={totalSales}
        />
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
          Erro ao carregar bots: {error.message}
        </div>
      )}

      {botList.length === 0 && !error ? (
        <div className="text-center py-20">
          <span className="text-5xl mb-4 block">🤖</span>
          <h2 className="text-white text-lg font-semibold mb-2">
            Nenhum bot ainda
          </h2>
          <p className="text-white/40 mb-6">
            Crie seu primeiro bot para começar a vender no Telegram
          </p>
          <a
            href="/dashboard/bots/new"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
          >
            Criar primeiro bot
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {botList.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/overview-stats.tsx app/dashboard/page.tsx
git commit -m "feat: add overview dashboard with aggregate metrics (leads, revenue, sales)"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Verify all new files exist**

```bash
ls server/src/services/sigilopay.ts
ls server/src/engine/nodes/payment-button.ts
ls server/src/webhook/payment.ts
ls server/tests/services/sigilopay.test.ts
ls server/tests/engine/nodes/payment-button.test.ts
ls server/tests/webhook/payment.test.ts
ls lib/actions/product-actions.ts lib/actions/lead-actions.ts lib/actions/transaction-actions.ts lib/actions/tracking-actions.ts
ls components/dashboard/product-list.tsx components/dashboard/leads-table.tsx components/dashboard/transactions-table.tsx components/dashboard/tracking-stats.tsx components/dashboard/overview-stats.tsx
ls components/dashboard/flow-builder/nodes/payment-button-node.tsx
ls components/dashboard/flow-builder/config-forms/payment-button-config.tsx
ls app/dashboard/bots/[botId]/products/page.tsx app/dashboard/bots/[botId]/leads/page.tsx app/dashboard/bots/[botId]/transactions/page.tsx app/dashboard/bots/[botId]/tracking/page.tsx
```

- [ ] **Step 2: Run server tests**

```bash
cd server && npm test
```

Expected: All tests pass (including new sigilopay.test.ts, payment-button.test.ts, payment.test.ts)

- [ ] **Step 3: Verify flow-editor imports compile**

Check that `flow-editor.tsx` has all 9 node types in `nodeTypeComponents` and `defaultNodeData`.

- [ ] **Step 4: Verify node-executor includes payment_button**

Check that `server/src/engine/node-executor.ts` exports `ExecuteNodeDeps` and handles `payment_button` type.

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "chore: Phase 5 Payments & Dashboard complete"
```
