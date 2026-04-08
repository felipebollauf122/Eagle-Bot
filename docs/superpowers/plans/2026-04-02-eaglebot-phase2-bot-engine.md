# Phase 2: Bot Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Node.js server that receives Telegram webhooks, processes configurable message flows (text, image, buttons, delays, conditions, inputs), and manages lead state — the core runtime of EagleBot.

**Architecture:** The bot engine is a standalone Express server in `server/` that shares types from `lib/types/`. It connects to Supabase Postgres via `@supabase/supabase-js` (service role key for backend access, bypassing RLS). It uses BullMQ + Redis for message queuing and delayed jobs. Each incoming Telegram update is routed to a bot-specific handler, which looks up the lead, finds the active flow, and processes nodes sequentially. The engine is stateless — all state lives in Postgres (lead.current_flow_id, lead.current_node_id, lead.state).

**Tech Stack:** Node.js, TypeScript, Express, grammy (Telegram Bot API), BullMQ, ioredis, @supabase/supabase-js, vitest

**Spec reference:** `docs/superpowers/specs/2026-04-01-eaglebot-design.md` — Bot Engine section

---

## File Structure

```
server/
├── package.json                    # Server-specific dependencies
├── tsconfig.json                   # Extends root tsconfig
├── src/
│   ├── index.ts                    # Express app setup, webhook routes, server start
│   ├── config.ts                   # Environment config (SUPABASE_URL, REDIS_URL, etc.)
│   ├── db.ts                       # Supabase admin client (service role, bypasses RLS)
│   ├── queue.ts                    # BullMQ queue + worker setup
│   ├── webhook/
│   │   └── telegram.ts             # Telegram webhook handler — parses update, routes to flow processor
│   ├── engine/
│   │   ├── flow-processor.ts       # Core: receives update + lead, finds flow, executes nodes
│   │   ├── node-executor.ts        # Dispatches to correct node handler by type
│   │   └── nodes/
│   │       ├── trigger.ts          # Trigger node — matches incoming message to flow
│   │       ├── text.ts             # Text node — sends text with variable interpolation
│   │       ├── image.ts            # Image node — sends photo with caption
│   │       ├── button.ts           # Button node — sends inline keyboard
│   │       ├── delay.ts            # Delay node — schedules next node via BullMQ
│   │       ├── condition.ts        # Condition node — evaluates expression, picks branch
│   │       ├── input.ts            # Input node — waits for user reply, saves to state
│   │       └── action.ts           # Action node — add_tag, start_flow, etc.
│   ├── telegram/
│   │   └── api.ts                  # Telegram API wrapper — sendMessage, sendPhoto, etc.
│   └── services/
│       └── lead-service.ts         # Lead CRUD — find/create lead, update state/position
├── tests/
│   ├── setup.ts                    # Test setup
│   ├── engine/
│   │   ├── flow-processor.test.ts
│   │   ├── node-executor.test.ts
│   │   └── nodes/
│   │       ├── text.test.ts
│   │       ├── condition.test.ts
│   │       └── input.test.ts
│   └── services/
│       └── lead-service.test.ts
```

---

## Task 1: Scaffold server package and config

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/config.ts`
- Create: `server/tests/setup.ts`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "eaglebot-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2",
    "bullmq": "^5",
    "express": "^5",
    "grammy": "^1",
    "ioredis": "^5"
  },
  "devDependencies": {
    "@types/express": "^5",
    "@types/node": "^20",
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "paths": {
      "@eaglebot/types": ["../lib/types/database"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `server/src/config.ts`**

```ts
import { strict as assert } from "node:assert";

function env(key: string): string {
  const value = process.env[key];
  assert(value, `Missing environment variable: ${key}`);
  return value;
}

function envOptional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(envOptional("PORT", "3001"), 10),
  supabaseUrl: env("SUPABASE_URL"),
  supabaseServiceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  redisUrl: envOptional("REDIS_URL", "redis://localhost:6379"),
  baseWebhookUrl: env("BASE_WEBHOOK_URL"), // e.g. https://your-domain.com
} as const;
```

- [ ] **Step 4: Create `server/tests/setup.ts`**

```ts
import { vi } from "vitest";

// Global mock for Supabase client
vi.mock("../src/db", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));
```

- [ ] **Step 5: Create `server/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@eaglebot/types": path.resolve(__dirname, "../lib/types/database"),
    },
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/tsconfig.json server/src/config.ts server/tests/setup.ts server/vitest.config.ts
git commit -m "chore: scaffold bot engine server with config and test setup"
```

---

## Task 2: Supabase admin client and Telegram API wrapper

**Files:**
- Create: `server/src/db.ts`
- Create: `server/src/telegram/api.ts`

- [ ] **Step 1: Create `server/src/db.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

// Service role client — bypasses RLS for backend operations
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
```

- [ ] **Step 2: Create `server/src/telegram/api.ts`**

```ts
export interface SendMessageParams {
  chatId: number;
  text: string;
  replyMarkup?: InlineKeyboardMarkup;
}

export interface SendPhotoParams {
  chatId: number;
  photo: string; // URL
  caption?: string;
  replyMarkup?: InlineKeyboardMarkup;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export class TelegramApi {
  private baseUrl: string;

  constructor(private token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(params: SendMessageParams): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: params.chatId,
      text: params.text,
      parse_mode: "HTML",
    };
    if (params.replyMarkup) {
      body.reply_markup = params.replyMarkup;
    }
    await this.request("sendMessage", body);
  }

  async sendPhoto(params: SendPhotoParams): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: params.chatId,
      photo: params.photo,
      parse_mode: "HTML",
    };
    if (params.caption) {
      body.caption = params.caption;
    }
    if (params.replyMarkup) {
      body.reply_markup = params.replyMarkup;
    }
    await this.request("sendPhoto", body);
  }

  async setWebhook(url: string): Promise<void> {
    await this.request("setWebhook", { url });
  }

  async deleteWebhook(): Promise<void> {
    await this.request("deleteWebhook", {});
  }

  private async request(method: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API error (${method}): ${data.description ?? "Unknown error"}`);
    }
    return data.result;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/db.ts server/src/telegram/api.ts
git commit -m "feat: add Supabase admin client and Telegram API wrapper"
```

---

## Task 3: Lead service

**Files:**
- Create: `server/src/services/lead-service.ts`
- Create: `server/tests/services/lead-service.test.ts`

- [ ] **Step 1: Write failing test for lead service**

Create `server/tests/services/lead-service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadService } from "../../src/services/lead-service.js";

// Mock supabase
const mockSupabase = {
  from: vi.fn(),
};

function mockChain(returnData: unknown, returnError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  mockSupabase.from.mockReturnValue(chain);
  return chain;
}

describe("LeadService", () => {
  let service: LeadService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LeadService(mockSupabase as any);
  });

  it("should find an existing lead by telegram_user_id and bot_id", async () => {
    const existingLead = {
      id: "lead-1",
      tenant_id: "tenant-1",
      bot_id: "bot-1",
      telegram_user_id: 12345,
      first_name: "João",
      username: "joao",
      state: {},
      current_flow_id: null,
      current_node_id: null,
    };
    mockChain(existingLead);

    const lead = await service.findOrCreateLead({
      botId: "bot-1",
      tenantId: "tenant-1",
      telegramUserId: 12345,
      firstName: "João",
      username: "joao",
    });

    expect(lead).toEqual(existingLead);
    expect(mockSupabase.from).toHaveBeenCalledWith("leads");
  });

  it("should create a new lead when not found", async () => {
    const chain = mockChain(null); // first call: not found
    const newLead = {
      id: "lead-new",
      tenant_id: "tenant-1",
      bot_id: "bot-1",
      telegram_user_id: 99999,
      first_name: "Maria",
      username: null,
      state: {},
      current_flow_id: null,
      current_node_id: null,
    };
    // Override: first maybeSingle returns null (not found), then insert returns new lead
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    chain.single.mockResolvedValueOnce({ data: newLead, error: null });

    const lead = await service.findOrCreateLead({
      botId: "bot-1",
      tenantId: "tenant-1",
      telegramUserId: 99999,
      firstName: "Maria",
      username: null,
    });

    expect(lead).toEqual(newLead);
  });

  it("should update lead position in flow", async () => {
    mockChain({ id: "lead-1" });

    await service.updatePosition("lead-1", "flow-1", "node-3");

    expect(mockSupabase.from).toHaveBeenCalledWith("leads");
  });

  it("should update lead state", async () => {
    mockChain({ id: "lead-1", state: { name: "João" } });

    await service.updateState("lead-1", { name: "João", email: "j@test.com" });

    expect(mockSupabase.from).toHaveBeenCalledWith("leads");
  });
});
```

- [ ] **Step 2: Implement lead service**

Create `server/src/services/lead-service.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "../../lib/types/database.js";

interface FindOrCreateParams {
  botId: string;
  tenantId: string;
  telegramUserId: number;
  firstName: string;
  username: string | null;
  tid?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export class LeadService {
  constructor(private db: SupabaseClient) {}

  async findOrCreateLead(params: FindOrCreateParams): Promise<Lead> {
    // Try to find existing lead
    const { data: existing } = await this.db
      .from("leads")
      .select("*")
      .eq("bot_id", params.botId)
      .eq("telegram_user_id", params.telegramUserId)
      .maybeSingle();

    if (existing) {
      return existing as Lead;
    }

    // Create new lead
    const { data: created, error } = await this.db
      .from("leads")
      .insert({
        tenant_id: params.tenantId,
        bot_id: params.botId,
        telegram_user_id: params.telegramUserId,
        first_name: params.firstName,
        username: params.username,
        tid: params.tid ?? null,
        fbclid: params.fbclid ?? null,
        utm_source: params.utmSource ?? null,
        utm_medium: params.utmMedium ?? null,
        utm_campaign: params.utmCampaign ?? null,
        utm_content: params.utmContent ?? null,
        utm_term: params.utmTerm ?? null,
        state: {},
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create lead: ${error.message}`);
    }
    return created as Lead;
  }

  async updatePosition(leadId: string, flowId: string | null, nodeId: string | null): Promise<void> {
    const { error } = await this.db
      .from("leads")
      .update({ current_flow_id: flowId, current_node_id: nodeId })
      .eq("id", leadId);

    if (error) {
      throw new Error(`Failed to update lead position: ${error.message}`);
    }
  }

  async updateState(leadId: string, state: Record<string, unknown>): Promise<void> {
    const { error } = await this.db
      .from("leads")
      .update({ state })
      .eq("id", leadId);

    if (error) {
      throw new Error(`Failed to update lead state: ${error.message}`);
    }
  }

  async getById(leadId: string): Promise<Lead | null> {
    const { data } = await this.db
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    return data as Lead | null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/lead-service.ts server/tests/services/lead-service.test.ts
git commit -m "feat: add lead service with find/create, position, and state updates"
```

---

## Task 4: Individual node handlers (text, image, button, delay, condition, input, action)

**Files:**
- Create: `server/src/engine/nodes/text.ts`
- Create: `server/src/engine/nodes/image.ts`
- Create: `server/src/engine/nodes/button.ts`
- Create: `server/src/engine/nodes/delay.ts`
- Create: `server/src/engine/nodes/condition.ts`
- Create: `server/src/engine/nodes/input.ts`
- Create: `server/src/engine/nodes/action.ts`
- Create: `server/src/engine/nodes/trigger.ts`
- Create: `server/tests/engine/nodes/text.test.ts`
- Create: `server/tests/engine/nodes/condition.test.ts`
- Create: `server/tests/engine/nodes/input.test.ts`

- [ ] **Step 1: Define the shared NodeContext type**

All node handlers receive a shared context. Add this to the top of each node file, or create a shared types file. For simplicity, define inline in each node:

Create `server/src/engine/types.ts`:
```ts
import type { FlowNode, FlowEdge, Lead } from "../../../lib/types/database.js";
import type { TelegramApi } from "../telegram/api.js";

export interface NodeContext {
  node: FlowNode;
  lead: Lead;
  edges: FlowEdge[];
  telegram: TelegramApi;
  chatId: number;
}

// Return value from a node handler
export interface NodeResult {
  // Which node to go to next (null = flow ends, "wait" = pause until next user message)
  nextNodeId: string | null;
  // If the node needs to update lead state
  stateUpdates?: Record<string, unknown>;
  // If the node needs a delay (in seconds) before next node
  delaySeconds?: number;
}

export type NodeHandler = (ctx: NodeContext) => Promise<NodeResult>;
```

- [ ] **Step 2: Write text node test**

Create `server/tests/engine/nodes/text.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { handleTextNode } from "../../../src/engine/nodes/text.js";
import type { NodeContext } from "../../../src/engine/types.js";

function makeContext(overrides: Partial<NodeContext> = {}): NodeContext {
  return {
    node: {
      id: "node-1",
      type: "text",
      data: { text: "Hello {{first_name}}!" },
      position: { x: 0, y: 0 },
    },
    lead: {
      id: "lead-1",
      tenant_id: "t-1",
      bot_id: "b-1",
      telegram_user_id: 123,
      first_name: "João",
      username: "joao",
      tid: null,
      fbclid: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      current_flow_id: "f-1",
      current_node_id: "node-1",
      state: { custom_var: "test" },
      created_at: "",
      updated_at: "",
    },
    edges: [{ id: "e1", source: "node-1", target: "node-2" }],
    telegram: { sendMessage: vi.fn() } as any,
    chatId: 123,
    ...overrides,
  };
}

describe("handleTextNode", () => {
  it("should send interpolated text and return next node", async () => {
    const ctx = makeContext();
    const result = await handleTextNode(ctx);

    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith({
      chatId: 123,
      text: "Hello João!",
    });
    expect(result.nextNodeId).toBe("node-2");
  });

  it("should interpolate state variables", async () => {
    const ctx = makeContext({
      node: {
        id: "n1",
        type: "text",
        data: { text: "Value: {{custom_var}}" },
        position: { x: 0, y: 0 },
      },
    });
    const result = await handleTextNode(ctx);

    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith({
      chatId: 123,
      text: "Value: test",
    });
    expect(result.nextNodeId).toBe("node-2");
  });

  it("should return null nextNodeId when no outgoing edge", async () => {
    const ctx = makeContext({ edges: [] });
    const result = await handleTextNode(ctx);
    expect(result.nextNodeId).toBeNull();
  });
});
```

- [ ] **Step 3: Implement text node**

Create `server/src/engine/nodes/text.ts`:
```ts
import type { NodeContext, NodeResult } from "../types.js";

function interpolate(template: string, lead: NodeContext["lead"]): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    // Check lead fields first, then state
    if (key in lead) {
      return String((lead as Record<string, unknown>)[key] ?? "");
    }
    if (lead.state && key in lead.state) {
      return String(lead.state[key] ?? "");
    }
    return "";
  });
}

export function findNextNodeId(edges: NodeContext["edges"], currentNodeId: string, handle?: string): string | null {
  const edge = edges.find(
    (e) => e.source === currentNodeId && (handle ? e.sourceHandle === handle : true)
  );
  return edge?.target ?? null;
}

export async function handleTextNode(ctx: NodeContext): Promise<NodeResult> {
  const text = interpolate(String(ctx.node.data.text ?? ""), ctx.lead);

  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text,
  });

  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
  };
}
```

- [ ] **Step 4: Implement image node**

Create `server/src/engine/nodes/image.ts`:
```ts
import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleImageNode(ctx: NodeContext): Promise<NodeResult> {
  const photo = String(ctx.node.data.image_url ?? ctx.node.data.photo ?? "");
  const caption = ctx.node.data.caption ? String(ctx.node.data.caption) : undefined;

  await ctx.telegram.sendPhoto({
    chatId: ctx.chatId,
    photo,
    caption,
  });

  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
  };
}
```

- [ ] **Step 5: Implement button node**

Create `server/src/engine/nodes/button.ts`:
```ts
import type { NodeContext, NodeResult } from "../types.js";
import type { InlineKeyboardButton } from "../../telegram/api.js";

export async function handleButtonNode(ctx: NodeContext): Promise<NodeResult> {
  const text = String(ctx.node.data.text ?? "");
  const buttons = (ctx.node.data.buttons ?? []) as Array<{
    text: string;
    action: string; // "go_to_node" | "open_url" | "callback"
    value: string;  // node_id, url, or callback_data
  }>;

  const inlineKeyboard: InlineKeyboardButton[][] = buttons.map((btn) => {
    if (btn.action === "open_url") {
      return [{ text: btn.text, url: btn.value }];
    }
    // For go_to_node and callback, use callback_data
    return [{ text: btn.text, callback_data: `${ctx.node.id}:${btn.value}` }];
  });

  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text,
    replyMarkup: { inline_keyboard: inlineKeyboard },
  });

  // Button node waits for user to click — don't advance automatically
  return { nextNodeId: "wait" };
}
```

- [ ] **Step 6: Implement delay node**

Create `server/src/engine/nodes/delay.ts`:
```ts
import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleDelayNode(ctx: NodeContext): Promise<NodeResult> {
  const amount = Number(ctx.node.data.amount ?? 0);
  const unit = String(ctx.node.data.unit ?? "seconds");

  let delaySeconds = amount;
  if (unit === "minutes") delaySeconds = amount * 60;
  if (unit === "hours") delaySeconds = amount * 3600;

  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
    delaySeconds,
  };
}
```

- [ ] **Step 7: Write condition node test**

Create `server/tests/engine/nodes/condition.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { handleConditionNode } from "../../../src/engine/nodes/condition.js";
import type { NodeContext } from "../../../src/engine/types.js";

function makeContext(state: Record<string, unknown>, edges: NodeContext["edges"]): NodeContext {
  return {
    node: {
      id: "cond-1",
      type: "condition",
      data: { field: "paid", operator: "equals", value: "true" },
      position: { x: 0, y: 0 },
    },
    lead: {
      id: "lead-1", tenant_id: "t-1", bot_id: "b-1", telegram_user_id: 123,
      first_name: "João", username: null, tid: null, fbclid: null,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
      current_flow_id: "f-1", current_node_id: "cond-1",
      state,
      created_at: "", updated_at: "",
    },
    edges,
    telegram: { sendMessage: vi.fn() } as any,
    chatId: 123,
  };
}

describe("handleConditionNode", () => {
  it("should follow 'true' edge when condition matches", async () => {
    const ctx = makeContext({ paid: true }, [
      { id: "e-true", source: "cond-1", target: "node-paid", sourceHandle: "true" },
      { id: "e-false", source: "cond-1", target: "node-unpaid", sourceHandle: "false" },
    ]);

    const result = await handleConditionNode(ctx);
    expect(result.nextNodeId).toBe("node-paid");
  });

  it("should follow 'false' edge when condition does not match", async () => {
    const ctx = makeContext({ paid: false }, [
      { id: "e-true", source: "cond-1", target: "node-paid", sourceHandle: "true" },
      { id: "e-false", source: "cond-1", target: "node-unpaid", sourceHandle: "false" },
    ]);

    const result = await handleConditionNode(ctx);
    expect(result.nextNodeId).toBe("node-unpaid");
  });

  it("should handle 'exists' operator", async () => {
    const ctx = makeContext({ email: "j@test.com" }, [
      { id: "e-true", source: "cond-1", target: "node-a", sourceHandle: "true" },
      { id: "e-false", source: "cond-1", target: "node-b", sourceHandle: "false" },
    ]);
    ctx.node.data = { field: "email", operator: "exists", value: "" };

    const result = await handleConditionNode(ctx);
    expect(result.nextNodeId).toBe("node-a");
  });
});
```

- [ ] **Step 8: Implement condition node**

Create `server/src/engine/nodes/condition.ts`:
```ts
import type { NodeContext, NodeResult } from "../types.js";

function evaluateCondition(
  state: Record<string, unknown>,
  field: string,
  operator: string,
  value: string
): boolean {
  const actual = state[field];

  switch (operator) {
    case "equals":
      return String(actual) === value;
    case "not_equals":
      return String(actual) !== value;
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "not_exists":
      return actual === undefined || actual === null || actual === "";
    case "contains":
      return String(actual ?? "").includes(value);
    case "greater_than":
      return Number(actual) > Number(value);
    case "less_than":
      return Number(actual) < Number(value);
    default:
      return false;
  }
}

export async function handleConditionNode(ctx: NodeContext): Promise<NodeResult> {
  const field = String(ctx.node.data.field ?? "");
  const operator = String(ctx.node.data.operator ?? "equals");
  const value = String(ctx.node.data.value ?? "");

  const result = evaluateCondition(ctx.lead.state, field, operator, value);
  const handle = result ? "true" : "false";

  const edge = ctx.edges.find(
    (e) => e.source === ctx.node.id && e.sourceHandle === handle
  );

  return {
    nextNodeId: edge?.target ?? null,
  };
}
```

- [ ] **Step 9: Write input node test**

Create `server/tests/engine/nodes/input.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { handleInputNode, handleInputResponse } from "../../../src/engine/nodes/input.js";
import type { NodeContext } from "../../../src/engine/types.js";

function makeContext(): NodeContext {
  return {
    node: {
      id: "input-1",
      type: "input",
      data: { prompt: "Qual seu email?", variable: "email" },
      position: { x: 0, y: 0 },
    },
    lead: {
      id: "lead-1", tenant_id: "t-1", bot_id: "b-1", telegram_user_id: 123,
      first_name: "João", username: null, tid: null, fbclid: null,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
      current_flow_id: "f-1", current_node_id: "input-1",
      state: {},
      created_at: "", updated_at: "",
    },
    edges: [{ id: "e1", source: "input-1", target: "node-next" }],
    telegram: { sendMessage: vi.fn() } as any,
    chatId: 123,
  };
}

describe("handleInputNode", () => {
  it("should send prompt and wait", async () => {
    const ctx = makeContext();
    const result = await handleInputNode(ctx);

    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith({
      chatId: 123,
      text: "Qual seu email?",
    });
    expect(result.nextNodeId).toBe("wait");
  });
});

describe("handleInputResponse", () => {
  it("should save user response to state and advance", () => {
    const result = handleInputResponse(
      "input-1",
      "email",
      "joao@test.com",
      [{ id: "e1", source: "input-1", target: "node-next" }]
    );

    expect(result.stateUpdates).toEqual({ email: "joao@test.com" });
    expect(result.nextNodeId).toBe("node-next");
  });
});
```

- [ ] **Step 10: Implement input node**

Create `server/src/engine/nodes/input.ts`:
```ts
import type { FlowEdge } from "../../../lib/types/database.js";
import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleInputNode(ctx: NodeContext): Promise<NodeResult> {
  const prompt = String(ctx.node.data.prompt ?? "");

  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: prompt,
  });

  // Wait for user to reply
  return { nextNodeId: "wait" };
}

export function handleInputResponse(
  nodeId: string,
  variable: string,
  userResponse: string,
  edges: FlowEdge[]
): NodeResult {
  return {
    nextNodeId: findNextNodeId(edges, nodeId),
    stateUpdates: { [variable]: userResponse },
  };
}
```

- [ ] **Step 11: Implement action node**

Create `server/src/engine/nodes/action.ts`:
```ts
import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleActionNode(ctx: NodeContext): Promise<NodeResult> {
  const actionType = String(ctx.node.data.action_type ?? "");
  const stateUpdates: Record<string, unknown> = {};

  switch (actionType) {
    case "add_tag": {
      const tag = String(ctx.node.data.tag ?? "");
      const currentTags = (ctx.lead.state.tags ?? []) as string[];
      if (!currentTags.includes(tag)) {
        stateUpdates.tags = [...currentTags, tag];
      }
      break;
    }
    case "remove_tag": {
      const tag = String(ctx.node.data.tag ?? "");
      const currentTags = (ctx.lead.state.tags ?? []) as string[];
      stateUpdates.tags = currentTags.filter((t) => t !== tag);
      break;
    }
    case "set_variable": {
      const key = String(ctx.node.data.variable ?? "");
      const value = ctx.node.data.value;
      stateUpdates[key] = value;
      break;
    }
    // start_flow and stop_flow are handled at the flow processor level
    default:
      break;
  }

  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
    stateUpdates: Object.keys(stateUpdates).length > 0 ? stateUpdates : undefined,
  };
}
```

- [ ] **Step 12: Implement trigger node**

Create `server/src/engine/nodes/trigger.ts`:
```ts
import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

// Trigger node is the entry point — it doesn't send anything, just advances
export async function handleTriggerNode(ctx: NodeContext): Promise<NodeResult> {
  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
  };
}
```

- [ ] **Step 13: Commit**

```bash
git add server/src/engine/ server/tests/engine/
git commit -m "feat: implement all node handlers (text, image, button, delay, condition, input, action, trigger)"
```

---

## Task 5: Node executor (dispatcher)

**Files:**
- Create: `server/src/engine/node-executor.ts`
- Create: `server/tests/engine/node-executor.test.ts`

- [ ] **Step 1: Write node executor test**

Create `server/tests/engine/node-executor.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { executeNode } from "../../src/engine/node-executor.js";
import type { NodeContext } from "../../src/engine/types.js";

function makeContext(type: string, data: Record<string, unknown> = {}): NodeContext {
  return {
    node: { id: "n-1", type: type as any, data, position: { x: 0, y: 0 } },
    lead: {
      id: "l-1", tenant_id: "t-1", bot_id: "b-1", telegram_user_id: 123,
      first_name: "Test", username: null, tid: null, fbclid: null,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
      current_flow_id: "f-1", current_node_id: "n-1", state: {},
      created_at: "", updated_at: "",
    },
    edges: [{ id: "e1", source: "n-1", target: "n-2" }],
    telegram: { sendMessage: vi.fn(), sendPhoto: vi.fn() } as any,
    chatId: 123,
  };
}

describe("executeNode", () => {
  it("should dispatch text node correctly", async () => {
    const ctx = makeContext("text", { text: "Hello" });
    const result = await executeNode(ctx);
    expect(ctx.telegram.sendMessage).toHaveBeenCalled();
    expect(result.nextNodeId).toBe("n-2");
  });

  it("should dispatch trigger node correctly", async () => {
    const ctx = makeContext("trigger", { trigger: "command", command: "/start" });
    const result = await executeNode(ctx);
    expect(result.nextNodeId).toBe("n-2");
  });

  it("should dispatch condition node correctly", async () => {
    const ctx = makeContext("condition", { field: "paid", operator: "equals", value: "true" });
    ctx.edges = [
      { id: "e-t", source: "n-1", target: "n-yes", sourceHandle: "true" },
      { id: "e-f", source: "n-1", target: "n-no", sourceHandle: "false" },
    ];
    ctx.lead.state = { paid: false };
    const result = await executeNode(ctx);
    expect(result.nextNodeId).toBe("n-no");
  });

  it("should return null for unknown node type", async () => {
    const ctx = makeContext("unknown_type");
    const result = await executeNode(ctx);
    expect(result.nextNodeId).toBeNull();
  });
});
```

- [ ] **Step 2: Implement node executor**

Create `server/src/engine/node-executor.ts`:
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

export async function executeNode(ctx: NodeContext): Promise<NodeResult> {
  const handler = handlers[ctx.node.type];
  if (!handler) {
    console.warn(`Unknown node type: ${ctx.node.type}`);
    return { nextNodeId: null };
  }
  return handler(ctx);
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/engine/node-executor.ts server/tests/engine/node-executor.test.ts
git commit -m "feat: add node executor dispatcher for all node types"
```

---

## Task 6: Flow processor (core engine)

**Files:**
- Create: `server/src/engine/flow-processor.ts`
- Create: `server/tests/engine/flow-processor.test.ts`

- [ ] **Step 1: Write flow processor test**

Create `server/tests/engine/flow-processor.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowProcessor } from "../../src/engine/flow-processor.js";
import type { Flow, Lead, Bot } from "../../../lib/types/database.js";

const mockTelegram = {
  sendMessage: vi.fn(),
  sendPhoto: vi.fn(),
};

const mockLeadService = {
  findOrCreateLead: vi.fn(),
  updatePosition: vi.fn(),
  updateState: vi.fn(),
  getById: vi.fn(),
};

const mockDb = {
  from: vi.fn(),
};

const mockQueue = {
  addDelayedJob: vi.fn(),
};

function makeFlow(): Flow {
  return {
    id: "flow-1",
    tenant_id: "tenant-1",
    bot_id: "bot-1",
    name: "Welcome Flow",
    trigger_type: "command",
    trigger_value: "/start",
    flow_data: {
      nodes: [
        { id: "trigger-1", type: "trigger", data: { trigger: "command", command: "/start" }, position: { x: 0, y: 0 } },
        { id: "text-1", type: "text", data: { text: "Welcome {{first_name}}!" }, position: { x: 0, y: 100 } },
        { id: "text-2", type: "text", data: { text: "How can I help?" }, position: { x: 0, y: 200 } },
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "text-1" },
        { id: "e2", source: "text-1", target: "text-2" },
      ],
    },
    is_active: true,
    version: 1,
    created_at: "",
    updated_at: "",
  };
}

function makeLead(): Lead {
  return {
    id: "lead-1",
    tenant_id: "tenant-1",
    bot_id: "bot-1",
    telegram_user_id: 12345,
    first_name: "João",
    username: "joao",
    tid: null, fbclid: null,
    utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
    current_flow_id: null,
    current_node_id: null,
    state: {},
    created_at: "", updated_at: "",
  };
}

describe("FlowProcessor", () => {
  let processor: FlowProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new FlowProcessor(
      mockDb as any,
      mockLeadService as any,
      mockQueue as any,
    );
  });

  it("should execute a simple trigger → text → text flow", async () => {
    const flow = makeFlow();
    const lead = makeLead();

    await processor.executeFlow(flow, lead, mockTelegram as any, 12345);

    // Should send 2 text messages
    expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockTelegram.sendMessage).toHaveBeenNthCalledWith(1, {
      chatId: 12345,
      text: "Welcome João!",
    });
    expect(mockTelegram.sendMessage).toHaveBeenNthCalledWith(2, {
      chatId: 12345,
      text: "How can I help?",
    });

    // Should update position to null (flow ended)
    expect(mockLeadService.updatePosition).toHaveBeenCalledWith("lead-1", null, null);
  });

  it("should stop at 'wait' nodes (input, button)", async () => {
    const flow = makeFlow();
    flow.flow_data.nodes[2] = {
      id: "input-1", type: "input",
      data: { prompt: "Qual seu email?", variable: "email" },
      position: { x: 0, y: 200 },
    };
    flow.flow_data.edges[1] = { id: "e2", source: "text-1", target: "input-1" };

    const lead = makeLead();

    await processor.executeFlow(flow, lead, mockTelegram as any, 12345);

    // Should send text + input prompt
    expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(2);
    // Should save position at input node
    expect(mockLeadService.updatePosition).toHaveBeenCalledWith("lead-1", "flow-1", "input-1");
  });

  it("should schedule delayed execution for delay nodes", async () => {
    const flow = makeFlow();
    flow.flow_data.nodes.splice(1, 0, {
      id: "delay-1", type: "delay",
      data: { amount: 30, unit: "seconds" },
      position: { x: 0, y: 50 },
    });
    flow.flow_data.edges = [
      { id: "e1", source: "trigger-1", target: "delay-1" },
      { id: "e2", source: "delay-1", target: "text-1" },
      { id: "e3", source: "text-1", target: "text-2" },
    ];

    const lead = makeLead();

    await processor.executeFlow(flow, lead, mockTelegram as any, 12345);

    // Should NOT send messages (delay comes first after trigger)
    expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    // Should schedule delayed job
    expect(mockQueue.addDelayedJob).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        flowId: "flow-1",
        nodeId: "text-1",
        botId: "bot-1",
      }),
      30
    );
  });
});
```

- [ ] **Step 2: Implement flow processor**

Create `server/src/engine/flow-processor.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flow, Lead, FlowNode } from "../../lib/types/database.js";
import type { TelegramApi } from "../telegram/api.js";
import type { NodeContext } from "./types.js";
import { executeNode } from "./node-executor.js";
import { handleInputResponse } from "./nodes/input.js";
import type { LeadService } from "../services/lead-service.js";

interface DelayQueue {
  addDelayedJob(data: {
    leadId: string;
    flowId: string;
    nodeId: string;
    botId: string;
    tenantId: string;
    chatId: number;
  }, delaySeconds: number): Promise<void>;
}

export class FlowProcessor {
  constructor(
    private db: SupabaseClient,
    private leadService: LeadService,
    private delayQueue: DelayQueue,
  ) {}

  async executeFlow(
    flow: Flow,
    lead: Lead,
    telegram: TelegramApi,
    chatId: number,
    startNodeId?: string,
  ): Promise<void> {
    const { nodes, edges } = flow.flow_data;

    // Find starting node
    let currentNodeId = startNodeId ?? nodes.find((n) => n.type === "trigger")?.id;
    if (!currentNodeId) return;

    // Max iterations to prevent infinite loops
    const MAX_ITERATIONS = 50;
    let iterations = 0;

    while (currentNodeId && iterations < MAX_ITERATIONS) {
      iterations++;

      const node = nodes.find((n) => n.id === currentNodeId);
      if (!node) break;

      const nodeEdges = edges.filter((e) => e.source === currentNodeId);

      const ctx: NodeContext = {
        node,
        lead,
        edges: nodeEdges,
        telegram,
        chatId,
      };

      const result = await executeNode(ctx);

      // Update lead state if node produced state updates
      if (result.stateUpdates) {
        lead.state = { ...lead.state, ...result.stateUpdates };
        await this.leadService.updateState(lead.id, lead.state);
      }

      // Handle delay — schedule and stop
      if (result.delaySeconds && result.delaySeconds > 0 && result.nextNodeId) {
        await this.leadService.updatePosition(lead.id, flow.id, result.nextNodeId);
        await this.delayQueue.addDelayedJob(
          {
            leadId: lead.id,
            flowId: flow.id,
            nodeId: result.nextNodeId,
            botId: flow.bot_id,
            tenantId: flow.tenant_id,
            chatId,
          },
          result.delaySeconds,
        );
        return;
      }

      // Handle wait (input/button) — save position and stop
      if (result.nextNodeId === "wait") {
        await this.leadService.updatePosition(lead.id, flow.id, node.id);
        return;
      }

      // Flow ended
      if (result.nextNodeId === null) {
        await this.leadService.updatePosition(lead.id, null, null);
        return;
      }

      currentNodeId = result.nextNodeId;
    }

    // If we hit max iterations, end the flow
    await this.leadService.updatePosition(lead.id, null, null);
  }

  async handleIncomingMessage(
    bot: { id: string; tenant_id: string; telegram_token: string },
    lead: Lead,
    telegram: TelegramApi,
    chatId: number,
    messageText: string,
  ): Promise<void> {
    // If lead is at an input node, handle the response
    if (lead.current_flow_id && lead.current_node_id) {
      const { data: flow } = await this.db
        .from("flows")
        .select("*")
        .eq("id", lead.current_flow_id)
        .single();

      if (flow) {
        const currentNode = (flow as Flow).flow_data.nodes.find(
          (n) => n.id === lead.current_node_id
        );

        if (currentNode?.type === "input") {
          const variable = String(currentNode.data.variable ?? "");
          const edges = (flow as Flow).flow_data.edges.filter(
            (e) => e.source === currentNode.id
          );
          const result = handleInputResponse(currentNode.id, variable, messageText, edges);

          if (result.stateUpdates) {
            lead.state = { ...lead.state, ...result.stateUpdates };
            await this.leadService.updateState(lead.id, lead.state);
          }

          if (result.nextNodeId && result.nextNodeId !== "wait") {
            await this.executeFlow(flow as Flow, lead, telegram, chatId, result.nextNodeId);
          }
          return;
        }

        // If at a button node, the callback query handler deals with it
        // For any other waiting state, try to resume from next node
      }
    }

    // No active flow — try to match a trigger
    const { data: flows } = await this.db
      .from("flows")
      .select("*")
      .eq("bot_id", bot.id)
      .eq("is_active", true);

    if (!flows) return;

    for (const flow of flows as Flow[]) {
      const triggerNode = flow.flow_data.nodes.find((n) => n.type === "trigger");
      if (!triggerNode) continue;

      const triggerType = String(triggerNode.data.trigger ?? flow.trigger_type);
      const triggerValue = String(triggerNode.data.command ?? flow.trigger_value);

      if (triggerType === "command" && messageText === triggerValue) {
        await this.executeFlow(flow, lead, telegram, chatId);
        return;
      }

      if (triggerType === "first_contact" && !lead.current_flow_id) {
        await this.executeFlow(flow, lead, telegram, chatId);
        return;
      }
    }
  }

  async handleCallbackQuery(
    bot: { id: string; tenant_id: string },
    lead: Lead,
    telegram: TelegramApi,
    chatId: number,
    callbackData: string,
  ): Promise<void> {
    // callbackData format: "nodeId:targetNodeId"
    const [sourceNodeId, targetValue] = callbackData.split(":");
    if (!sourceNodeId || !targetValue) return;

    if (!lead.current_flow_id) return;

    const { data: flow } = await this.db
      .from("flows")
      .select("*")
      .eq("id", lead.current_flow_id)
      .single();

    if (!flow) return;

    // Find the edge that matches this button click
    const edge = (flow as Flow).flow_data.edges.find(
      (e) => e.source === sourceNodeId && (e.target === targetValue || e.sourceHandle === targetValue)
    );

    if (edge) {
      await this.executeFlow(flow as Flow, lead, telegram, chatId, edge.target);
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/engine/flow-processor.ts server/tests/engine/flow-processor.test.ts
git commit -m "feat: implement flow processor — core engine that executes flow graphs"
```

---

## Task 7: BullMQ queue setup

**Files:**
- Create: `server/src/queue.ts`

- [ ] **Step 1: Implement queue**

Create `server/src/queue.ts`:
```ts
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";
import { supabase } from "./db.js";
import { TelegramApi } from "./telegram/api.js";
import { FlowProcessor } from "./engine/flow-processor.js";
import { LeadService } from "./services/lead-service.js";

import type { Flow, Bot } from "../../lib/types/database.js";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

// === Delayed Messages Queue ===

interface DelayedJobData {
  leadId: string;
  flowId: string;
  nodeId: string;
  botId: string;
  tenantId: string;
  chatId: number;
}

export const delayedQueue = new Queue<DelayedJobData>("delayed-messages", {
  connection,
});

export async function addDelayedJob(data: DelayedJobData, delaySeconds: number): Promise<void> {
  await delayedQueue.add("resume-flow", data, {
    delay: delaySeconds * 1000,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

// === Workers ===

export function startWorkers(): void {
  const leadService = new LeadService(supabase);

  // Delayed message worker
  new Worker<DelayedJobData>(
    "delayed-messages",
    async (job: Job<DelayedJobData>) => {
      const { leadId, flowId, nodeId, botId, chatId } = job.data;

      // Get bot for telegram token
      const { data: bot } = await supabase
        .from("bots")
        .select("*")
        .eq("id", botId)
        .single();

      if (!bot) {
        console.error(`Bot not found: ${botId}`);
        return;
      }

      // Get flow
      const { data: flow } = await supabase
        .from("flows")
        .select("*")
        .eq("id", flowId)
        .single();

      if (!flow) {
        console.error(`Flow not found: ${flowId}`);
        return;
      }

      // Get lead
      const lead = await leadService.getById(leadId);
      if (!lead) {
        console.error(`Lead not found: ${leadId}`);
        return;
      }

      const telegram = new TelegramApi((bot as Bot).telegram_token);
      const processor = new FlowProcessor(
        supabase,
        leadService,
        { addDelayedJob },
      );

      await processor.executeFlow(flow as Flow, lead, telegram, chatId, nodeId);
    },
    {
      connection,
      concurrency: 10,
      limiter: { max: 30, duration: 1000 }, // Telegram rate limit
    },
  );

  console.log("BullMQ workers started");
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/queue.ts
git commit -m "feat: add BullMQ queue setup with delayed message worker"
```

---

## Task 8: Telegram webhook handler

**Files:**
- Create: `server/src/webhook/telegram.ts`

- [ ] **Step 1: Implement webhook handler**

Create `server/src/webhook/telegram.ts`:
```ts
import type { Request, Response } from "express";
import { supabase } from "../db.js";
import { TelegramApi } from "../telegram/api.js";
import { FlowProcessor } from "../engine/flow-processor.js";
import { LeadService } from "../services/lead-service.js";
import { addDelayedJob } from "../queue.js";
import type { Bot } from "../../../lib/types/database.js";

const leadService = new LeadService(supabase);

export async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
  const botId = req.params.botId;

  // Respond immediately to Telegram (they timeout at 60s)
  res.status(200).json({ ok: true });

  try {
    // Get bot
    const { data: bot } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .eq("is_active", true)
      .single();

    if (!bot) {
      console.error(`Bot not found or inactive: ${botId}`);
      return;
    }

    const typedBot = bot as Bot;
    const telegram = new TelegramApi(typedBot.telegram_token);
    const processor = new FlowProcessor(supabase, leadService, { addDelayedJob });

    const update = req.body;

    // Handle message
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const telegramUserId = msg.from.id;
      const firstName = msg.from.first_name ?? "";
      const username = msg.from.username ?? null;
      const text = msg.text ?? "";

      // Parse deep link for tracking: /start TID_abc123
      let tid: string | undefined;
      if (text.startsWith("/start ")) {
        const param = text.split(" ")[1];
        if (param?.startsWith("tid_") || param?.startsWith("TID_")) {
          tid = param;
        }
      }

      // Find or create lead
      let trackingData: Record<string, string | undefined> = {};
      if (tid) {
        // Look up tracking data from tracking_events
        const { data: trackingEvent } = await supabase
          .from("tracking_events")
          .select("*")
          .eq("tid", tid)
          .eq("event_type", "page_view")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (trackingEvent) {
          const utmParams = (trackingEvent.utm_params ?? {}) as Record<string, string>;
          trackingData = {
            fbclid: trackingEvent.fbclid ?? undefined,
            utmSource: utmParams.utm_source,
            utmMedium: utmParams.utm_medium,
            utmCampaign: utmParams.utm_campaign,
            utmContent: utmParams.utm_content,
            utmTerm: utmParams.utm_term,
          };
        }
      }

      const lead = await leadService.findOrCreateLead({
        botId: typedBot.id,
        tenantId: typedBot.tenant_id,
        telegramUserId,
        firstName,
        username,
        tid,
        ...trackingData,
      });

      // Register bot_start tracking event for new leads with tracking
      if (tid && lead.tid === tid) {
        await supabase.from("tracking_events").insert({
          tenant_id: typedBot.tenant_id,
          lead_id: lead.id,
          bot_id: typedBot.id,
          event_type: "bot_start",
          fbclid: lead.fbclid,
          tid: lead.tid,
          utm_params: {
            utm_source: lead.utm_source,
            utm_medium: lead.utm_medium,
            utm_campaign: lead.utm_campaign,
          },
        });
      }

      await processor.handleIncomingMessage(typedBot, lead, telegram, chatId, text);
    }

    // Handle callback query (button clicks)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const telegramUserId = cb.from.id;
      const callbackData = cb.data ?? "";

      if (!chatId) return;

      const lead = await leadService.findOrCreateLead({
        botId: typedBot.id,
        tenantId: typedBot.tenant_id,
        telegramUserId,
        firstName: cb.from.first_name ?? "",
        username: cb.from.username ?? null,
      });

      await processor.handleCallbackQuery(typedBot, lead, telegram, chatId, callbackData);
    }
  } catch (error) {
    console.error(`Error processing webhook for bot ${botId}:`, error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/webhook/telegram.ts
git commit -m "feat: add Telegram webhook handler with tracking and deep link support"
```

---

## Task 9: Express server (index.ts)

**Files:**
- Create: `server/src/index.ts`
- Modify: `server/README.md`

- [ ] **Step 1: Implement Express server**

Create `server/src/index.ts`:
```ts
import express from "express";
import { config } from "./config.js";
import { handleTelegramWebhook } from "./webhook/telegram.js";
import { startWorkers } from "./queue.js";
import { supabase } from "./db.js";
import { TelegramApi } from "./telegram/api.js";
import type { Bot } from "../../lib/types/database.js";

const app = express();

// Parse JSON bodies (Telegram sends JSON webhooks)
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "eaglebot-engine" });
});

// Telegram webhook endpoint
app.post("/webhook/:botId", handleTelegramWebhook);

// Register webhook for a bot (called from dashboard when bot is activated)
app.post("/api/bots/:botId/register-webhook", async (req, res) => {
  try {
    const { botId } = req.params;

    const { data: bot } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single();

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const typedBot = bot as Bot;
    const webhookUrl = `${config.baseWebhookUrl}/webhook/${botId}`;
    const telegram = new TelegramApi(typedBot.telegram_token);

    await telegram.setWebhook(webhookUrl);

    // Update webhook_url in database
    await supabase
      .from("bots")
      .update({ webhook_url: webhookUrl, is_active: true })
      .eq("id", botId);

    res.json({ success: true, webhook_url: webhookUrl });
  } catch (error) {
    console.error("Failed to register webhook:", error);
    res.status(500).json({ error: "Failed to register webhook" });
  }
});

// Start server
app.listen(config.port, () => {
  console.log(`EagleBot Engine running on port ${config.port}`);
  startWorkers();
});

export { app };
```

- [ ] **Step 2: Update server/README.md**

Replace content of `server/README.md`:
```markdown
# EagleBot — Bot Engine Server

Standalone Node.js server that processes Telegram bot interactions.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in values
3. Start Redis: `redis-server`
4. Start dev server: `npm run dev`

## Environment Variables

- `PORT` — Server port (default: 3001)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (NOT anon key)
- `REDIS_URL` — Redis connection URL (default: redis://localhost:6379)
- `BASE_WEBHOOK_URL` — Public URL for this server (e.g., https://your-domain.com)

## Endpoints

- `GET /health` — Health check
- `POST /webhook/:botId` — Telegram webhook receiver
- `POST /api/bots/:botId/register-webhook` — Register Telegram webhook for a bot

## Architecture

The engine receives Telegram updates via webhooks, looks up the lead and active flow,
then executes flow nodes sequentially. Delay nodes schedule future execution via BullMQ.
Input and button nodes pause execution until the user responds.
```

- [ ] **Step 3: Create `server/.env.example`**

```env
PORT=3001
SUPABASE_URL=https://rwqkxusjxdaiewrsvgvb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REDIS_URL=redis://localhost:6379
BASE_WEBHOOK_URL=https://your-domain.com
```

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts server/README.md server/.env.example
git commit -m "feat: add Express server with webhook routes and bot registration"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Verify all files exist**

```bash
find server/ -type f -not -path '*/node_modules/*' | sort
```

Expected files:
```
server/.env.example
server/README.md
server/package.json
server/tsconfig.json
server/vitest.config.ts
server/src/config.ts
server/src/db.ts
server/src/index.ts
server/src/queue.ts
server/src/engine/flow-processor.ts
server/src/engine/node-executor.ts
server/src/engine/types.ts
server/src/engine/nodes/action.ts
server/src/engine/nodes/button.ts
server/src/engine/nodes/condition.ts
server/src/engine/nodes/delay.ts
server/src/engine/nodes/image.ts
server/src/engine/nodes/input.ts
server/src/engine/nodes/text.ts
server/src/engine/nodes/trigger.ts
server/src/services/lead-service.ts
server/src/telegram/api.ts
server/src/webhook/telegram.ts
server/tests/setup.ts
server/tests/engine/flow-processor.test.ts
server/tests/engine/node-executor.test.ts
server/tests/engine/nodes/condition.test.ts
server/tests/engine/nodes/input.test.ts
server/tests/engine/nodes/text.test.ts
server/tests/services/lead-service.test.ts
```

- [ ] **Step 2: Verify TypeScript compiles (once npm install works)**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 3: Run tests (once npm install works)**

```bash
cd server && npm test
```

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "chore: Phase 2 Bot Engine complete"
```
