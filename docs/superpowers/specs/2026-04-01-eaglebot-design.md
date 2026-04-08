# EagleBot — Design Spec

**Date:** 2026-04-01
**Status:** Approved
**Author:** Dary + Claude

## Overview

EagleBot is a SaaS platform for Brazilian infopreneurs (infoprodutores) to create and manage Telegram sales bots with full tracking integration for Facebook Ads and Utmify. Users configure message flows through a visual drag-and-drop editor, accept payments via SigiloPay, and track the complete customer journey from ad click to purchase.

## Target Audience

Brazilian infopreneurs selling digital products (courses, ebooks, mentoring programs) through Telegram. They need configurable sales funnels, payment processing, and attribution tracking to optimize their Facebook Ads spend.

## Architecture

### Three-Layer Architecture

1. **Next.js 16 Frontend (Dashboard)** — user-facing admin panel with flow builder, bot management, analytics. Already bootstrapped with React 19, Tailwind 4, TypeScript.

2. **Node.js Bot Engine Server** — standalone server handling Telegram webhooks, flow execution, payment webhooks, message queuing, and Facebook Conversions API event dispatching. Must have low latency and no cold starts.

3. **Supabase (Postgres + Auth)** — database with Row Level Security for multi-tenant isolation. Handles user authentication and all persistent data storage.

Additionally, a **tracking page** (Next.js route) serves as the bridge between Facebook Ads and the Telegram bot.

### Key Architectural Decisions

- **Monorepo:** Frontend + bot server in the same repository with shared packages (types, utils, DB client).
- **Flows as JSON:** Each flow is a directed graph stored as JSONB in Postgres. The flow builder serializes/deserializes it; the bot engine interprets and executes it.
- **Multi-tenancy via RLS:** Supabase Row Level Security policies on all tables ensure tenant isolation. Every table includes a `tenant_id` column with policy `tenant_id = auth.uid()`.
- **Webhook-first:** Both Telegram and SigiloPay communicate via webhooks to the bot engine server.
- **Configurations per bot:** All integration API keys (Facebook Pixel, Conversions API token, Utmify, SigiloPay) are configured per bot, not globally. Each bot may sell different products and use different tracking pixels.

### Message Queue

Redis + BullMQ for message delays, scheduled sends, and Telegram rate limit compliance (30 messages/second). Redis is required infrastructure from day one.

## Database Schema

### Tables

**`tenants`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Matches Supabase auth.uid() |
| email | text | Tenant email |
| name | text | Display name |
| plan | text | Future billing plan (nullable) |
| created_at | timestamptz | Account creation |

**`bots`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| tenant_id | uuid (FK → tenants) | Owner |
| telegram_token | text (encrypted) | Bot API token |
| bot_username | text | @username of the bot |
| webhook_url | text | Auto-generated webhook URL |
| is_active | boolean | Whether bot is receiving messages |
| facebook_pixel_id | text | Facebook Pixel ID for this bot |
| facebook_access_token | text (encrypted) | Conversions API access token |
| utmify_api_key | text (encrypted) | Utmify API key |
| sigilopay_api_key | text (encrypted) | SigiloPay API key |
| tracking_mode | text | "redirect" or "prelander" |
| prelander_headline | text | Pre-lander headline (nullable) |
| prelander_description | text | Pre-lander description (nullable) |
| prelander_image_url | text | Pre-lander image URL (nullable) |
| prelander_cta_text | text | Pre-lander CTA button text (nullable) |
| created_at | timestamptz | |

**`products`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| tenant_id | uuid (FK → tenants) | Owner |
| bot_id | uuid (FK → bots) | Associated bot |
| name | text | Product name |
| price | integer | Price in cents |
| currency | text | BRL default |
| description | text | |
| is_active | boolean | |
| created_at | timestamptz | |

**`flows`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| tenant_id | uuid (FK → tenants) | Owner |
| bot_id | uuid (FK → bots) | Associated bot |
| name | text | Flow name |
| trigger_type | text | command, first_contact, callback, payment_event |
| trigger_value | text | e.g., "/start" for command triggers |
| flow_data | jsonb | Complete directed graph (nodes + edges) |
| is_active | boolean | |
| version | integer | Auto-increment on save |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`leads`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| tenant_id | uuid (FK → tenants) | Owner |
| bot_id | uuid (FK → bots) | Which bot they interacted with |
| telegram_user_id | bigint | Telegram user ID |
| first_name | text | From Telegram |
| username | text | From Telegram |
| tid | text | Tracking ID (from tracking page) |
| fbclid | text | Facebook click ID |
| utm_source | text | |
| utm_medium | text | |
| utm_campaign | text | |
| utm_content | text | |
| utm_term | text | |
| current_flow_id | uuid (FK → flows) | Active flow |
| current_node_id | text | Current node in flow |
| state | jsonb | Dynamic data (inputs, tags, custom vars) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`transactions`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| tenant_id | uuid (FK → tenants) | Owner |
| lead_id | uuid (FK → leads) | Who paid |
| bot_id | uuid (FK → bots) | |
| flow_id | uuid (FK → flows) | Which flow generated this |
| product_id | uuid (FK → products) | What was purchased |
| gateway | text | "sigilopay" (extensible) |
| external_id | text | Gateway transaction ID |
| amount | integer | In cents |
| currency | text | |
| status | text | pending, approved, refused, refunded |
| paid_at | timestamptz | |
| created_at | timestamptz | |

**`tracking_events`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| tenant_id | uuid (FK → tenants) | Owner |
| lead_id | uuid (FK → leads, nullable) | Associated lead (null for page_view before bot) |
| bot_id | uuid (FK → bots) | |
| event_type | text | page_view, bot_start, view_offer, checkout, purchase |
| fbclid | text | Facebook click ID |
| tid | text | Tracking ID |
| utm_params | jsonb | All UTM parameters |
| event_data | jsonb | Additional event-specific data (value, currency, etc.) |
| sent_to_facebook | boolean | Whether CAPI event was dispatched |
| sent_to_utmify | boolean | Whether event was sent to Utmify |
| created_at | timestamptz | |

### RLS Policies

All tables: `CREATE POLICY tenant_isolation ON <table> USING (tenant_id = auth.uid())` for SELECT, INSERT, UPDATE, DELETE.

### Indexes

- `leads`: composite index on `(tenant_id, bot_id, telegram_user_id)` for fast lead lookup
- `leads`: index on `tid` for tracking page → bot association
- `tracking_events`: index on `(tenant_id, bot_id, created_at)` for analytics queries
- `transactions`: index on `(tenant_id, status, created_at)` for revenue queries
- `flows`: index on `(bot_id, trigger_type, is_active)` for flow matching

## Bot Engine

### Overview

Standalone Node.js server (not Next.js API routes). Communicates with Supabase for data, Redis/BullMQ for queuing, and external APIs (Telegram, SigiloPay, Facebook CAPI).

### Components

**Webhook Receiver**
- HTTP endpoint at `/webhook/:botId` for Telegram updates
- HTTP endpoint at `/webhook/payment/:botId` for SigiloPay payment notifications
- Validates webhook signatures for security
- Routes to appropriate handler based on update type

**Flow Processor**
- Core engine that interprets flow_data JSON graphs
- On receiving a Telegram update:
  1. Identify lead (by telegram_user_id + bot_id) or create new lead
  2. Determine current position in flow (current_flow_id + current_node_id)
  3. If no active flow, match incoming message against flow triggers
  4. Execute current node, advance to next node via edges
  5. Handle branching (condition nodes) and waiting states (input nodes, delay nodes)

**Node Types and Execution Logic**

| Node Type | Behavior |
|-----------|----------|
| trigger | Entry point. Matches command, first_contact, callback, or payment_event. |
| text | Send text message via Telegram API. Supports variable interpolation (`{{name}}`, `{{email}}`, etc. from lead.state). |
| image | Send photo via Telegram API with optional caption. Image URL stored in node data. |
| button | Send message with InlineKeyboardMarkup. Each button has text + action (go_to_node, open_url, callback_data). |
| payment_button | Generate SigiloPay checkout link for configured product, send as inline button. Two outgoing edges: "paid" and "not_paid". |
| delay | Schedule next node execution via BullMQ delayed job. Duration in seconds/minutes/hours. |
| condition | Evaluate expression against lead.state (e.g., `state.paid === true`, `state.utm_source === "facebook"`). Two outgoing edges: "true" and "false". |
| input | Send prompt message, then wait for user response. Save response to lead.state under configured key. |
| action | Silent operations: add_tag, remove_tag, start_flow, stop_flow, send_webhook. No message sent to user. |

**Message Queue (BullMQ + Redis)**
- Queue: `bot-messages` — for sending messages with rate limiting (30/sec per bot token)
- Queue: `delayed-messages` — for delay nodes, scheduled sends
- Queue: `tracking-events` — for async dispatching to Facebook CAPI and Utmify
- Workers process jobs with retry logic and error handling

**Payment Webhook Handler**
- Receives SigiloPay webhook on payment status change
- Updates transaction status in database
- If approved: updates lead.state (e.g., `paid: true`), resumes flow on "paid" edge of payment_button node
- Dispatches Purchase event to Facebook CAPI with fbclid + value

**Tracking Dispatcher**
- Async worker that sends events to Facebook Conversions API
- Uses lead's fbclid for attribution
- Events: PageView (from tracking page), Lead (bot_start), InitiateCheckout, Purchase
- Also forwards events to Utmify when configured
- Marks events as `sent_to_facebook: true` / `sent_to_utmify: true` after successful dispatch

## Flow Builder (Visual Editor)

### Technology

React Flow (reactflow.dev) as the base library for the node-based graph editor. Runs within the Next.js dashboard.

### Editor Layout

- **Left sidebar:** Node palette — draggable node types organized by category (Messages, Logic, Actions, Payment)
- **Center canvas:** React Flow canvas with zoom, pan, minimap
- **Right panel:** Node configuration — opens when a node is selected, shows type-specific form fields
- **Top bar:** Flow name, save button, activate/deactivate toggle, preview button

### Node Types in Editor

Each node type has a custom React component with distinct visual styling (color-coded by category) and a configuration panel:

- **Trigger** (green) — select trigger type, configure value
- **Text** (blue) — rich text editor with variable picker (`{{name}}`, etc.)
- **Image** (blue) — image upload + caption field
- **Button** (blue) — message text + button builder (add/remove buttons, set text + action per button)
- **Payment Button** (gold) — select product from configured products, customize button text
- **Delay** (gray) — duration picker (number + unit)
- **Condition** (orange) — condition builder (field, operator, value)
- **Input** (purple) — prompt message + variable name to save response as
- **Action** (gray) — action type selector + configuration

### Flow Data Format

```json
{
  "nodes": [
    {
      "id": "node_1",
      "type": "trigger",
      "data": {
        "trigger": "command",
        "command": "/start"
      },
      "position": { "x": 0, "y": 0 }
    },
    {
      "id": "node_2",
      "type": "text",
      "data": {
        "text": "Olá {{first_name}}! Bem-vindo ao nosso bot."
      },
      "position": { "x": 0, "y": 150 }
    },
    {
      "id": "node_3",
      "type": "payment_button",
      "data": {
        "product_id": "prod_xxx",
        "button_text": "Comprar Agora - R$97"
      },
      "position": { "x": 0, "y": 300 }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "node_1", "target": "node_2" },
    { "id": "e2-3", "source": "node_2", "target": "node_3" },
    { "id": "e3-paid", "source": "node_3", "target": "node_4", "sourceHandle": "paid" },
    { "id": "e3-notpaid", "source": "node_3", "target": "node_5", "sourceHandle": "not_paid" }
  ]
}
```

### Preview Mode

A simulation mode where the infoproducer can test the flow as if they were a lead. Shows a mock Telegram chat interface on the right side of the editor. No actual messages are sent — the flow processor runs locally in the browser against mock data.

## Tracking System

### Full Tracking Flow

1. **Facebook Ad → Tracking Page**
   - Infoproducer creates Facebook Ad campaign with URL: `https://<domain>/t/<bot_tracking_code>`
   - Tracking page is a Next.js route at `/t/[code]`

2. **Tracking Page Execution**
   - Captures from URL: `fbclid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, plus any Utmify-specific parameters
   - Generates unique TID (Tracking ID): `tid_<nanoid>`
   - Saves to `tracking_events` table: event_type = `page_view`, with all captured params
   - Two modes (configurable per bot):
     - **Redirect mode:** Immediately redirects to `https://t.me/<bot_username>?start=<TID>`
     - **Pre-lander mode:** Renders a customizable page (headline, image/video, description, CTA button) before the redirect. Content configured in bot settings.

3. **Lead Enters Bot**
   - Bot receives `/start <TID>` command
   - Flow processor extracts TID from deep link parameter
   - Looks up tracking_events with that TID to retrieve fbclid + UTMs
   - Creates lead with all tracking data associated
   - Registers `bot_start` tracking event

4. **Funnel Progression**
   - Key events (view_offer, checkout initiation) are tracked automatically based on flow node execution
   - Each event is saved to `tracking_events`

5. **Purchase Event**
   - SigiloPay webhook confirms payment
   - Transaction recorded with `approved` status
   - `purchase` tracking event created with value + currency
   - Facebook CAPI event dispatched:
     - Endpoint: `https://graph.facebook.com/v18.0/<pixel_id>/events`
     - Event: `Purchase` with `event_name`, `event_time`, `user_data.fbc` (fbclid), `custom_data.value`, `custom_data.currency`
   - Utmify event dispatched if configured

### Per-Bot Configuration

Each bot has its own tracking configuration in the `bots` table:
- `facebook_pixel_id` — which pixel to fire events to
- `facebook_access_token` — Conversions API token
- `utmify_api_key` — Utmify integration key
- Tracking page content (for pre-lander mode): headline, description, image_url, cta_text

## Dashboard

### Pages

All pages follow the existing "Dark Operator" visual style (dark theme, purple/cyan accents).

**Global:**
- **Login / Register** — Supabase Auth (email/password)
- **Home / Overview** — aggregate metrics across all bots: total leads, conversions, revenue, active bots

**Per-Bot (after selecting a bot):**
- **Bot Dashboard** — metrics for this specific bot
- **Flows** — list flows, create/duplicate/activate/deactivate, open flow builder
- **Flow Builder** — full-screen visual editor (described in Flow Builder section)
- **Leads** — searchable/filterable list of leads with details (conversation history, tracking data, transactions)
- **Transactions** — payment list with status filters, date range, totals
- **Tracking** — view tracking events, conversion funnel visualization
- **Bot Settings** — all configuration for this bot:
  - Telegram token and bot info
  - SigiloPay API key and products
  - Facebook Pixel ID and Conversions API token
  - Utmify API key
  - Tracking page settings (mode: redirect/pre-lander, pre-lander content)
  - Custom domain for tracking page

**Global Settings:**
- Profile (name, email, password change)
- Future: billing/subscription management

## Build Phases (Bottom-Up)

### Phase 1: Core Platform
Auth (Supabase), database schema with all tables and RLS, monorepo setup (shared types/utils), basic API layer.

### Phase 2: Bot Engine
Telegram webhook handling, flow processor, message sending, BullMQ setup, all node type execution. Basic bot management (register token, set webhook).

### Phase 3: Flow Builder
React Flow editor, all node types with configuration panels, flow serialization/deserialization, save/load from database, preview/simulation mode.

### Phase 4: Tracking & Analytics
Tracking page (redirect + pre-lander modes), TID generation, fbclid/UTM capture, Facebook Conversions API integration, Utmify integration, tracking event pipeline.

### Phase 5: Payments & Dashboard
SigiloPay integration (checkout link generation, webhook handling), payment flow in bot, full dashboard with all pages, per-bot settings, analytics views.

## Error Handling

- **Telegram API errors:** Retry with exponential backoff via BullMQ. Log failures. Alert tenant if bot token is invalid.
- **SigiloPay webhook failures:** Idempotent processing (deduplicate by external_id). Retry queue for CAPI dispatch failures.
- **Flow execution errors:** Catch per-node, log error, send fallback message to lead ("Desculpe, ocorreu um erro. Tente novamente."). Never crash the bot engine.
- **Rate limiting:** BullMQ rate limiter for Telegram API (30 msg/sec per token). Queue overflow → backpressure, not dropped messages.

## Testing Strategy

- **Unit tests:** Flow processor logic, node type execution, tracking event generation, condition evaluation
- **Integration tests:** Webhook receive → flow execution → message sent (mocked Telegram API)
- **E2E tests:** Full flow from tracking page → bot interaction → payment → CAPI event
- **Load tests:** Simulate concurrent leads across multiple bots to verify rate limiting and queue behavior

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind 4, TypeScript |
| Flow Editor | React Flow |
| Bot Engine | Node.js, TypeScript |
| Database | Supabase Postgres with RLS |
| Auth | Supabase Auth |
| Queue | Redis + BullMQ |
| Payments | SigiloPay API |
| Tracking | Facebook Conversions API, Utmify API |
| Bot API | Telegram Bot API (grammy or telegraf) |
