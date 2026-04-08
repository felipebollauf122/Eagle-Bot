# Phase 1: Core Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the monorepo structure, Supabase integration (auth + database schema with RLS), shared TypeScript types, and a basic authenticated dashboard shell that proves the full stack works end-to-end.

**Architecture:** Next.js 16 frontend talks to Supabase for auth and data. A `lib/` directory holds shared code (Supabase client, types, utils). The bot engine server folder (`server/`) is scaffolded but not implemented until Phase 2. All database tables from the spec are created with RLS policies. The dashboard has login/register, a bot listing page, and bot creation — enough to validate that auth + multi-tenancy work.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Supabase (Postgres + Auth), @supabase/supabase-js, @supabase/ssr

**Spec reference:** `docs/superpowers/specs/2026-04-01-eaglebot-design.md`

---

## File Structure

```
eaglebot/
├── .env.local                          # Supabase URL + keys (gitignored)
├── lib/
│   ├── types/
│   │   └── database.ts                 # All DB row types + enums
│   ├── supabase/
│   │   ├── client.ts                   # Browser Supabase client
│   │   ├── server.ts                   # Server-side Supabase client (cookies)
│   │   └── middleware.ts               # Auth middleware helper
│   └── utils/
│       └── constants.ts                # App-wide constants
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # All tables, RLS, indexes
├── app/
│   ├── layout.tsx                      # (modify) Add Supabase provider
│   ├── page.tsx                        # (modify) Landing page → redirect if authed
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx                # Login page
│   │   └── register/
│   │       └── page.tsx                # Register page
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                # Supabase auth callback handler
│   └── dashboard/
│       ├── layout.tsx                  # Dashboard shell (sidebar, auth guard)
│       ├── page.tsx                    # Overview / bot list
│       └── bots/
│           └── new/
│               └── page.tsx            # Create new bot form
├── components/
│   ├── auth/
│   │   └── auth-form.tsx               # Shared login/register form
│   └── dashboard/
│       ├── sidebar.tsx                 # Dashboard sidebar navigation
│       ├── bot-card.tsx                # Bot card for the listing
│       └── create-bot-form.tsx         # Bot creation form
├── middleware.ts                        # Next.js middleware for auth redirects
├── server/                             # Bot engine (scaffolded, Phase 2)
│   └── README.md                       # Placeholder explaining Phase 2
└── tests/
    ├── lib/
    │   └── types.test.ts               # Type validation tests
    └── setup.ts                        # Test setup (vitest)
```

---

## Task 1: Install dependencies and configure environment

**Files:**
- Modify: `package.json`
- Create: `.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: Install Supabase packages**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Install dev dependencies for testing**

Run:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Create `.env.local` with placeholder values**

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 4: Add `.superpowers/` to `.gitignore`**

Append to `.gitignore`:
```
# superpowers brainstorm artifacts
.superpowers/
```

- [ ] **Step 5: Add vitest config to `package.json`**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Create `tests/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Verify install works**

Run:
```bash
npm run build
```
Expected: Build succeeds (may have warnings, no errors).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts .gitignore
git commit -m "chore: add Supabase, vitest, and testing dependencies"
```

---

## Task 2: Define TypeScript types for all database tables

**Files:**
- Create: `lib/types/database.ts`
- Create: `tests/lib/types.test.ts`

- [ ] **Step 1: Write type validation test**

Create `tests/lib/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type {
  Tenant,
  Bot,
  Product,
  Flow,
  Lead,
  Transaction,
  TrackingEvent,
  FlowData,
  FlowNode,
  FlowEdge,
  TransactionStatus,
  TriggerType,
  TrackingEventType,
  TrackingMode,
  NodeType,
} from "@/lib/types/database";

describe("Database types", () => {
  it("should allow creating a valid Tenant object", () => {
    const tenant: Tenant = {
      id: "uuid-123",
      email: "test@example.com",
      name: "Test User",
      plan: null,
      created_at: new Date().toISOString(),
    };
    expect(tenant.id).toBe("uuid-123");
    expect(tenant.plan).toBeNull();
  });

  it("should allow creating a valid Bot object", () => {
    const bot: Bot = {
      id: "bot-uuid",
      tenant_id: "tenant-uuid",
      telegram_token: "123:ABC",
      bot_username: "testbot",
      webhook_url: "https://example.com/webhook/bot-uuid",
      is_active: true,
      facebook_pixel_id: null,
      facebook_access_token: null,
      utmify_api_key: null,
      sigilopay_api_key: null,
      tracking_mode: "redirect",
      prelander_headline: null,
      prelander_description: null,
      prelander_image_url: null,
      prelander_cta_text: null,
      created_at: new Date().toISOString(),
    };
    expect(bot.is_active).toBe(true);
    expect(bot.tracking_mode).toBe("redirect");
  });

  it("should allow creating a valid FlowData object", () => {
    const flowData: FlowData = {
      nodes: [
        {
          id: "node_1",
          type: "trigger",
          data: { trigger: "command", command: "/start" },
          position: { x: 0, y: 0 },
        },
        {
          id: "node_2",
          type: "text",
          data: { text: "Hello {{first_name}}!" },
          position: { x: 0, y: 150 },
        },
      ],
      edges: [
        { id: "e1-2", source: "node_1", target: "node_2" },
      ],
    };
    expect(flowData.nodes).toHaveLength(2);
    expect(flowData.edges).toHaveLength(1);
    expect(flowData.nodes[0].type).toBe("trigger");
  });

  it("should allow creating a valid Lead object", () => {
    const lead: Lead = {
      id: "lead-uuid",
      tenant_id: "tenant-uuid",
      bot_id: "bot-uuid",
      telegram_user_id: 123456789,
      first_name: "João",
      username: "joao",
      tid: "tid_abc123",
      fbclid: "fb.1.123",
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: "launch",
      utm_content: null,
      utm_term: null,
      current_flow_id: null,
      current_node_id: null,
      state: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(lead.telegram_user_id).toBe(123456789);
    expect(lead.utm_content).toBeNull();
  });

  it("should allow creating a valid Transaction object", () => {
    const tx: Transaction = {
      id: "tx-uuid",
      tenant_id: "tenant-uuid",
      lead_id: "lead-uuid",
      bot_id: "bot-uuid",
      flow_id: "flow-uuid",
      product_id: "product-uuid",
      gateway: "sigilopay",
      external_id: "ext-123",
      amount: 9700,
      currency: "BRL",
      status: "approved",
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    expect(tx.amount).toBe(9700);
    expect(tx.status).toBe("approved");
  });

  it("should allow creating a valid TrackingEvent object", () => {
    const event: TrackingEvent = {
      id: "event-uuid",
      tenant_id: "tenant-uuid",
      lead_id: null,
      bot_id: "bot-uuid",
      event_type: "page_view",
      fbclid: "fb.1.123",
      tid: "tid_abc123",
      utm_params: { utm_source: "facebook", utm_medium: "cpc" },
      event_data: {},
      sent_to_facebook: false,
      sent_to_utmify: false,
      created_at: new Date().toISOString(),
    };
    expect(event.lead_id).toBeNull();
    expect(event.sent_to_facebook).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/types.test.ts`
Expected: FAIL — cannot resolve `@/lib/types/database`

- [ ] **Step 3: Write the types**

Create `lib/types/database.ts`:
```ts
// === Enums ===

export type TransactionStatus = "pending" | "approved" | "refused" | "refunded";
export type TriggerType = "command" | "first_contact" | "callback" | "payment_event";
export type TrackingEventType = "page_view" | "bot_start" | "view_offer" | "checkout" | "purchase";
export type TrackingMode = "redirect" | "prelander";
export type NodeType =
  | "trigger"
  | "text"
  | "image"
  | "button"
  | "payment_button"
  | "delay"
  | "condition"
  | "input"
  | "action";

// === Flow Data (JSONB structure) ===

export interface FlowNode {
  id: string;
  type: NodeType;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// === Database Row Types ===

export interface Tenant {
  id: string;
  email: string;
  name: string;
  plan: string | null;
  created_at: string;
}

export interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
  bot_username: string;
  webhook_url: string;
  is_active: boolean;
  facebook_pixel_id: string | null;
  facebook_access_token: string | null;
  utmify_api_key: string | null;
  sigilopay_api_key: string | null;
  tracking_mode: TrackingMode;
  prelander_headline: string | null;
  prelander_description: string | null;
  prelander_image_url: string | null;
  prelander_cta_text: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  bot_id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface Flow {
  id: string;
  tenant_id: string;
  bot_id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_value: string;
  flow_data: FlowData;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
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

export interface Transaction {
  id: string;
  tenant_id: string;
  lead_id: string;
  bot_id: string;
  flow_id: string;
  product_id: string;
  gateway: string;
  external_id: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paid_at: string | null;
  created_at: string;
}

export interface TrackingEvent {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  bot_id: string;
  event_type: TrackingEventType;
  fbclid: string | null;
  tid: string | null;
  utm_params: Record<string, string>;
  event_data: Record<string, unknown>;
  sent_to_facebook: boolean;
  sent_to_utmify: boolean;
  created_at: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/types.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/types/database.ts tests/lib/types.test.ts
git commit -m "feat: define TypeScript types for all database tables"
```

---

## Task 3: Create Supabase migration with full schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migrations directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Write the migration SQL**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- EagleBot Phase 1: Full Database Schema
-- Run against Supabase Postgres

-- ============================================
-- Enable required extensions
-- ============================================
create extension if not exists "pgcrypto";

-- ============================================
-- TENANTS
-- ============================================
create table public.tenants (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  plan text,
  created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;

create policy "Tenants can view own data"
  on public.tenants for select
  using (id = auth.uid());

create policy "Tenants can update own data"
  on public.tenants for update
  using (id = auth.uid());

-- Insert trigger: auto-create tenant row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.tenants (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- BOTS
-- ============================================
create table public.bots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  telegram_token text not null,
  bot_username text not null,
  webhook_url text not null default '',
  is_active boolean not null default false,
  facebook_pixel_id text,
  facebook_access_token text,
  utmify_api_key text,
  sigilopay_api_key text,
  tracking_mode text not null default 'redirect' check (tracking_mode in ('redirect', 'prelander')),
  prelander_headline text,
  prelander_description text,
  prelander_image_url text,
  prelander_cta_text text,
  created_at timestamptz not null default now()
);

alter table public.bots enable row level security;

create policy "Tenants can manage own bots"
  on public.bots for all
  using (tenant_id = auth.uid());

-- ============================================
-- PRODUCTS
-- ============================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null,
  price integer not null,
  currency text not null default 'BRL',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Tenants can manage own products"
  on public.products for all
  using (tenant_id = auth.uid());

-- ============================================
-- FLOWS
-- ============================================
create table public.flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('command', 'first_contact', 'callback', 'payment_event')),
  trigger_value text not null default '',
  flow_data jsonb not null default '{"nodes": [], "edges": []}',
  is_active boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flows enable row level security;

create policy "Tenants can manage own flows"
  on public.flows for all
  using (tenant_id = auth.uid());

create index idx_flows_bot_trigger on public.flows (bot_id, trigger_type, is_active);

-- ============================================
-- LEADS
-- ============================================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  telegram_user_id bigint not null,
  first_name text not null default '',
  username text,
  tid text,
  fbclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  current_flow_id uuid references public.flows(id) on delete set null,
  current_node_id text,
  state jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "Tenants can manage own leads"
  on public.leads for all
  using (tenant_id = auth.uid());

create unique index idx_leads_bot_telegram on public.leads (tenant_id, bot_id, telegram_user_id);
create index idx_leads_tid on public.leads (tid);

-- ============================================
-- TRANSACTIONS
-- ============================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  flow_id uuid not null references public.flows(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  gateway text not null default 'sigilopay',
  external_id text not null,
  amount integer not null,
  currency text not null default 'BRL',
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Tenants can manage own transactions"
  on public.transactions for all
  using (tenant_id = auth.uid());

create index idx_transactions_status on public.transactions (tenant_id, status, created_at);

-- ============================================
-- TRACKING EVENTS
-- ============================================
create table public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  bot_id uuid not null references public.bots(id) on delete cascade,
  event_type text not null check (event_type in ('page_view', 'bot_start', 'view_offer', 'checkout', 'purchase')),
  fbclid text,
  tid text,
  utm_params jsonb not null default '{}',
  event_data jsonb not null default '{}',
  sent_to_facebook boolean not null default false,
  sent_to_utmify boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tracking_events enable row level security;

create policy "Tenants can manage own tracking events"
  on public.tracking_events for all
  using (tenant_id = auth.uid());

create index idx_tracking_events_bot_date on public.tracking_events (tenant_id, bot_id, created_at);

-- ============================================
-- updated_at trigger function
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.flows
  for each row execute function public.update_updated_at();

create trigger set_updated_at before update on public.leads
  for each row execute function public.update_updated_at();
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase migration with full schema, RLS, and indexes"
```

---

## Task 4: Create Supabase client utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `lib/utils/constants.ts`

- [ ] **Step 1: Read Supabase SSR docs for Next.js patterns**

Check `@supabase/ssr` package README for the correct client creation pattern. The key patterns are:
- Browser client: `createBrowserClient(url, anonKey)`
- Server client: `createServerClient(url, anonKey, { cookies })` using Next.js `cookies()` API
- Middleware client: `createServerClient(url, anonKey, { cookies })` using middleware request/response

- [ ] **Step 2: Create constants**

Create `lib/utils/constants.ts`:
```ts
export const APP_NAME = "EagleBot";
export const DEFAULT_CURRENCY = "BRL";
export const TELEGRAM_RATE_LIMIT = 30; // messages per second per bot
```

- [ ] **Step 3: Create browser Supabase client**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Create server Supabase client**

Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` is called from a Server Component.
            // This can be ignored if middleware refreshes sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Create middleware Supabase client helper**

Create `lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except public routes)
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register") ||
    request.nextUrl.pathname.startsWith("/auth/callback");
  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/t/"); // tracking pages are public

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/ lib/utils/constants.ts
git commit -m "feat: add Supabase client utilities (browser, server, middleware)"
```

---

## Task 5: Create Next.js middleware for auth

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create the middleware**

Create `middleware.ts` (project root):
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (SVGs, images)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify build still works**

Run:
```bash
npm run build
```
Expected: Build succeeds. The middleware is registered.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Next.js middleware for Supabase auth session management"
```

---

## Task 6: Create auth callback route handler

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create the auth callback route**

Create `app/auth/callback/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat: add Supabase auth callback route handler"
```

---

## Task 7: Create login and register pages

**Files:**
- Create: `components/auth/auth-form.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`

- [ ] **Step 1: Create the shared auth form component**

Create `components/auth/auth-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold text-white">
        {mode === "login" ? "Entrar" : "Criar conta"}
      </h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {mode === "register" && (
        <input
          type="text"
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500 transition"
        />
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500 transition"
      />

      <input
        type="password"
        placeholder="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500 transition"
      />

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition"
      >
        {loading
          ? "Carregando..."
          : mode === "login"
            ? "Entrar"
            : "Criar conta"}
      </button>

      <p className="text-white/50 text-sm text-center">
        {mode === "login" ? (
          <>
            Não tem conta?{" "}
            <a href="/register" className="text-purple-400 hover:underline">
              Criar conta
            </a>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <a href="/login" className="text-purple-400 hover:underline">
              Entrar
            </a>
          </>
        )}
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Create login page**

Create `app/(auth)/login/page.tsx`:
```tsx
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <AuthForm mode="login" />
    </div>
  );
}
```

- [ ] **Step 3: Create register page**

Create `app/(auth)/register/page.tsx`:
```tsx
import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <AuthForm mode="register" />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/auth/auth-form.tsx app/\(auth\)/login/page.tsx app/\(auth\)/register/page.tsx
git commit -m "feat: add login and register pages with shared auth form"
```

---

## Task 8: Create dashboard layout with sidebar and auth guard

**Files:**
- Create: `components/dashboard/sidebar.tsx`
- Create: `app/dashboard/layout.tsx`

- [ ] **Step 1: Create sidebar component**

Create `components/dashboard/sidebar.tsx`:
```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Visão Geral", href: "/dashboard", icon: "📊" },
  { label: "Meus Bots", href: "/dashboard", icon: "🤖" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="w-64 min-h-screen bg-[#0d0d14] border-r border-white/5 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">
          <span className="text-purple-400">Eagle</span>Bot
        </h1>
      </div>

      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition ${
                isActive
                  ? "bg-purple-600/10 text-purple-400"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-red-500/5 transition"
        >
          <span>🚪</span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create dashboard layout with auth guard**

Create `app/dashboard/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/sidebar.tsx app/dashboard/layout.tsx
git commit -m "feat: add dashboard layout with sidebar and server-side auth guard"
```

---

## Task 9: Create dashboard overview page with bot listing

**Files:**
- Create: `components/dashboard/bot-card.tsx`
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Create bot card component**

Create `components/dashboard/bot-card.tsx`:
```tsx
import type { Bot } from "@/lib/types/database";

interface BotCardProps {
  bot: Bot;
}

export function BotCard({ bot }: BotCardProps) {
  return (
    <a
      href={`/dashboard/bots/${bot.id}`}
      className="block p-5 bg-white/[0.02] border border-white/5 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/[0.02] transition group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="text-white font-semibold group-hover:text-purple-300 transition">
              @{bot.bot_username}
            </h3>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            bot.is_active
              ? "bg-green-500/10 text-green-400"
              : "bg-white/5 text-white/40"
          }`}
        >
          {bot.is_active ? "Ativo" : "Inativo"}
        </span>
      </div>
      <div className="flex gap-4 text-xs text-white/30">
        <span>
          Tracking: {bot.facebook_pixel_id ? "Configurado" : "Não configurado"}
        </span>
        <span>
          Pagamento: {bot.sigilopay_api_key ? "Configurado" : "Não configurado"}
        </span>
      </div>
    </a>
  );
}
```

- [ ] **Step 2: Create dashboard overview page**

Create `app/dashboard/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { BotCard } from "@/components/dashboard/bot-card";
import type { Bot } from "@/lib/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: bots, error } = await supabase
    .from("bots")
    .select("*")
    .order("created_at", { ascending: false });

  const botList = (bots ?? []) as Bot[];

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

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/bot-card.tsx app/dashboard/page.tsx
git commit -m "feat: add dashboard overview page with bot listing"
```

---

## Task 10: Create bot creation page

**Files:**
- Create: `components/dashboard/create-bot-form.tsx`
- Create: `app/dashboard/bots/new/page.tsx`

- [ ] **Step 1: Create bot creation form component**

Create `components/dashboard/create-bot-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function CreateBotForm() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate token format (basic check: contains ":")
      if (!token.includes(":")) {
        throw new Error(
          "Token inválido. O token do Telegram Bot deve estar no formato 123456:ABC-DEF..."
        );
      }

      // Extract bot username by calling Telegram getMe API
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getMe`
      );
      const data = await response.json();

      if (!data.ok) {
        throw new Error(
          "Token inválido. Verifique se o token está correto e tente novamente."
        );
      }

      const botUsername = data.result.username;

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Não autenticado.");
      }

      // Create bot in database
      const { error: insertError } = await supabase.from("bots").insert({
        tenant_id: user.id,
        telegram_token: token,
        bot_username: botUsername,
        is_active: false,
      });

      if (insertError) throw insertError;

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar bot.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-white/70 text-sm mb-2">
          Token do Bot do Telegram
        </label>
        <input
          type="text"
          placeholder="123456789:ABCdefGhIjKlmNoPqRsTuVwXyZ"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500 transition font-mono text-sm"
        />
        <p className="text-white/30 text-xs mt-2">
          Obtenha o token criando um bot com o{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline"
          >
            @BotFather
          </a>{" "}
          no Telegram.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !token}
        className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition"
      >
        {loading ? "Validando token..." : "Criar Bot"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the new bot page**

Create `app/dashboard/bots/new/page.tsx`:
```tsx
import { CreateBotForm } from "@/components/dashboard/create-bot-form";

export default function NewBotPage() {
  return (
    <div>
      <div className="mb-8">
        <a
          href="/dashboard"
          className="text-white/40 hover:text-white text-sm transition"
        >
          ← Voltar
        </a>
        <h1 className="text-2xl font-bold text-white mt-4">Novo Bot</h1>
        <p className="text-white/50 mt-1">
          Conecte seu bot do Telegram para começar a vender
        </p>
      </div>
      <CreateBotForm />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/create-bot-form.tsx app/dashboard/bots/new/page.tsx
git commit -m "feat: add bot creation page with Telegram token validation"
```

---

## Task 11: Scaffold bot engine server directory

**Files:**
- Create: `server/README.md`

- [ ] **Step 1: Create server directory with README**

```bash
mkdir -p server
```

Create `server/README.md`:
```markdown
# EagleBot — Bot Engine Server

This directory will contain the standalone Node.js bot engine server (Phase 2).

## Planned Components

- **Webhook Receiver** — HTTP endpoints for Telegram and SigiloPay webhooks
- **Flow Processor** — Interprets and executes flow JSON graphs
- **Message Queue** — BullMQ + Redis for delays and rate limiting
- **Tracking Dispatcher** — Sends events to Facebook CAPI and Utmify

## Tech Stack

- Node.js + TypeScript
- BullMQ + Redis
- Shared types from `../lib/types/`

## Status

Scaffolded in Phase 1. Implementation starts in Phase 2.
```

- [ ] **Step 2: Commit**

```bash
git add server/README.md
git commit -m "chore: scaffold bot engine server directory for Phase 2"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Run all tests**

Run:
```bash
npm test
```
Expected: All type tests pass.

- [ ] **Step 2: Run build**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run lint**

Run:
```bash
npm run lint
```
Expected: No lint errors.

- [ ] **Step 4: Verify file structure matches plan**

Run:
```bash
find . -type f -not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' -not -path './.superpowers/*' | sort
```

Expected: All files from the file structure section exist.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git status
# If there are unstaged changes from fixes:
git add -A && git commit -m "fix: address verification issues from Phase 1 review"
```
