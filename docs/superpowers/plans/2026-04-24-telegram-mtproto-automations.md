# Automações Telegram (MTProto) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova página `/dashboard/automations` que permite conectar contas pessoais do Telegram via MTProto e disparar mensagens em massa distribuídas entre um pool de contas com delay aleatório.

**Architecture:** Next.js dashboard → Supabase (persistência) → BullMQ queue `mtproto` → novo worker Node (`mtproto-worker.ts`) que mantém conexões gramjs vivas, faz login, executa campanhas. Session strings guardadas em plaintext no DB (escolha explícita do usuário).

**Tech Stack:** Next.js 16, React 19, Supabase, BullMQ + Redis, gramjs (pacote npm `telegram`), Vitest.

**Spec:** `docs/superpowers/specs/2026-04-24-telegram-mtproto-automations-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/016_mtproto.sql` — schema + RLS
- `server/src/services/mtproto/client.ts` — wrapper gramjs (login, sendMessage)
- `server/src/services/mtproto/pool.ts` — AccountPool em memória
- `server/src/services/mtproto/campaign-runner.ts` — loop de envio por campaign
- `server/src/services/mtproto/target-parser.ts` — parse/normaliza lista colada → targets
- `server/src/workers/mtproto-worker.ts` — entrypoint do worker, consome fila
- `server/src/queue-mtproto.ts` — definição da fila BullMQ e enqueue helpers
- `app/dashboard/automations/page.tsx` — página principal (lista contas + lista campanhas)
- `app/dashboard/automations/new-campaign/page.tsx` — form de nova campanha
- `app/dashboard/automations/campaigns/[campaignId]/page.tsx` — detalhe + progresso
- `app/dashboard/automations/actions.ts` — server actions (criar conta, submit code, etc.)
- `components/dashboard/mtproto-accounts.tsx` — lista + modal de login
- `components/dashboard/mtproto-campaign-list.tsx`
- `components/dashboard/mtproto-campaign-form.tsx`
- `components/dashboard/mtproto-campaign-detail.tsx`
- `tests/services/mtproto/target-parser.test.ts`
- `tests/services/mtproto/pool.test.ts`
- `tests/services/mtproto/campaign-runner.test.ts`

**Modified files:**
- `server/package.json` — adicionar dep `telegram`
- `server/src/config.ts` — novas vars `telegramApiId`, `telegramApiHash`
- `server/src/index.ts` — iniciar worker mtproto junto dos outros
- `components/dashboard/sidebar.tsx` — adicionar item "Automações" no menu
- `.env.example` — documentar novas vars (se o repo tiver; senão ignorar)

---

## Task 1: Migration do schema

**Files:**
- Create: `supabase/migrations/016_mtproto.sql`

- [ ] **Step 1: Criar a migration**

Arquivo `supabase/migrations/016_mtproto.sql`:

```sql
-- mtproto_accounts: pool de contas Telegram via MTProto
create table mtproto_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  phone_number text not null,
  display_name text,
  session_string text,
  status text not null default 'pending',
  -- 'pending' | 'code_sent' | 'needs_password' | 'active' | 'flood_wait' | 'banned' | 'disconnected'
  flood_wait_until timestamptz,
  last_error text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone_number)
);

create table mtproto_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mtproto_accounts(id) on delete cascade,
  phone_code_hash text not null,
  needs_password boolean not null default false,
  created_at timestamptz not null default now()
);

create table mtproto_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  message_text text not null,
  delay_min_seconds int not null default 30,
  delay_max_seconds int not null default 90,
  status text not null default 'draft',
  -- 'draft' | 'running' | 'paused' | 'completed' | 'failed'
  total_targets int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table mtproto_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references mtproto_campaigns(id) on delete cascade,
  target_identifier text not null,
  target_type text not null,           -- 'username' | 'phone'
  status text not null default 'pending',  -- 'pending' | 'sent' | 'failed'
  account_id uuid references mtproto_accounts(id) on delete set null,
  error_message text,
  sent_at timestamptz
);

create index idx_mtproto_targets_campaign_status on mtproto_targets(campaign_id, status);
create index idx_mtproto_accounts_tenant_status on mtproto_accounts(tenant_id, status);

-- RLS
alter table mtproto_accounts enable row level security;
alter table mtproto_auth_sessions enable row level security;
alter table mtproto_campaigns enable row level security;
alter table mtproto_targets enable row level security;

create policy "tenant_own_accounts" on mtproto_accounts
  for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "tenant_own_auth_sessions" on mtproto_auth_sessions
  for all using (account_id in (select id from mtproto_accounts where tenant_id = auth.uid()))
  with check (account_id in (select id from mtproto_accounts where tenant_id = auth.uid()));

create policy "tenant_own_campaigns" on mtproto_campaigns
  for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "tenant_own_targets" on mtproto_targets
  for all using (campaign_id in (select id from mtproto_campaigns where tenant_id = auth.uid()))
  with check (campaign_id in (select id from mtproto_campaigns where tenant_id = auth.uid()));
```

- [ ] **Step 2: Aplicar a migration via Supabase MCP**

Aplicar usando `mcp__claude_ai_Supabase__apply_migration` com `name=016_mtproto` e o mesmo conteúdo acima. Se MCP não estiver disponível no ambiente, commitar e deixar pro user rodar localmente com Supabase CLI.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/016_mtproto.sql
git commit -m "feat: schema para automações MTProto (contas, campanhas, targets)"
```

---

## Task 2: Dependência gramjs + config

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/config.ts`

- [ ] **Step 1: Ver package.json atual do server**

Ler `server/package.json` pra saber a estrutura.

- [ ] **Step 2: Instalar gramjs**

```bash
cd server && npm install telegram
```

- [ ] **Step 3: Adicionar vars no config**

Modificar `server/src/config.ts` adicionando depois de `baseWebhookUrl`:

```ts
  telegramApiId: parseInt(env("TELEGRAM_API_ID"), 10),
  telegramApiHash: env("TELEGRAM_API_HASH"),
  mtprotoWorkerEnabled: envOptional("MTPROTO_WORKER_ENABLED", "true") === "true",
```

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/package-lock.json server/src/config.ts
git commit -m "feat: adicionar gramjs e vars TELEGRAM_API_ID/HASH"
```

---

## Task 3: target-parser (normaliza lista colada)

**Files:**
- Create: `server/src/services/mtproto/target-parser.ts`
- Create: `tests/services/mtproto/target-parser.test.ts`

- [ ] **Step 1: Escrever testes que falham**

`tests/services/mtproto/target-parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseTargets } from "../../../server/src/services/mtproto/target-parser.js";

describe("parseTargets", () => {
  it("parses @username", () => {
    const r = parseTargets("@joao");
    expect(r).toEqual([{ identifier: "joao", type: "username", valid: true }]);
  });

  it("parses username without @", () => {
    const r = parseTargets("joao_silva");
    expect(r).toEqual([{ identifier: "joao_silva", type: "username", valid: true }]);
  });

  it("parses +phone", () => {
    const r = parseTargets("+5511999998888");
    expect(r).toEqual([{ identifier: "+5511999998888", type: "phone", valid: true }]);
  });

  it("parses phone without +", () => {
    const r = parseTargets("5511999998888");
    expect(r).toEqual([{ identifier: "+5511999998888", type: "phone", valid: true }]);
  });

  it("splits by newlines and commas and semicolons", () => {
    const r = parseTargets("@a\n@b,@c;@d");
    expect(r.map((t) => t.identifier)).toEqual(["a", "b", "c", "d"]);
  });

  it("trims whitespace", () => {
    const r = parseTargets("  @joao  \n  @maria  ");
    expect(r.map((t) => t.identifier)).toEqual(["joao", "maria"]);
  });

  it("dedupes", () => {
    const r = parseTargets("@a\n@a\n@b");
    expect(r).toHaveLength(2);
  });

  it("marks invalid entries", () => {
    const r = parseTargets("!!!invalid!!!");
    expect(r[0].valid).toBe(false);
  });

  it("rejects usernames with spaces", () => {
    const r = parseTargets("joao silva");
    expect(r[0].valid).toBe(false);
  });

  it("ignores empty tokens", () => {
    const r = parseTargets("\n\n@a\n\n\n");
    expect(r).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

```bash
npm run test -- target-parser
```

Expected: FAIL (arquivo não existe).

- [ ] **Step 3: Implementar**

`server/src/services/mtproto/target-parser.ts`:

```ts
export interface ParsedTarget {
  identifier: string;
  type: "username" | "phone";
  valid: boolean;
}

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const PHONE_RE = /^\+?\d{8,15}$/;

export function parseTargets(raw: string): ParsedTarget[] {
  const tokens = raw
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: ParsedTarget[] = [];

  for (const token of tokens) {
    if (PHONE_RE.test(token)) {
      const identifier = token.startsWith("+") ? token : `+${token}`;
      if (seen.has(identifier)) continue;
      seen.add(identifier);
      out.push({ identifier, type: "phone", valid: true });
      continue;
    }

    const stripped = token.startsWith("@") ? token.slice(1) : token;
    const key = `@${stripped.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (USERNAME_RE.test(stripped)) {
      out.push({ identifier: stripped, type: "username", valid: true });
    } else {
      out.push({ identifier: token, type: "username", valid: false });
    }
  }

  return out;
}
```

- [ ] **Step 4: Rodar testes e verificar que passam**

```bash
npm run test -- target-parser
```

Expected: PASS em todos.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/mtproto/target-parser.ts tests/services/mtproto/target-parser.test.ts
git commit -m "feat(mtproto): target-parser para usernames e telefones"
```

---

## Task 4: MtprotoClient (wrapper gramjs)

**Files:**
- Create: `server/src/services/mtproto/client.ts`

Este arquivo isola toda interação com a lib `telegram` (gramjs). Sem testes unitários de fato — gramjs tem surface grande e mocking é frágil. Testamos via integração manual do login.

- [ ] **Step 1: Implementar**

`server/src/services/mtproto/client.ts`:

```ts
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

export interface SendCodeResult {
  phoneCodeHash: string;
}

export interface SignInResult {
  ok: boolean;
  needsPassword: boolean;
  sessionString?: string;
}

export class MtprotoClient {
  private client: TelegramClient;

  constructor(
    private apiId: number,
    private apiHash: string,
    sessionString: string = "",
  ) {
    this.client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
      connectionRetries: 3,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async sendCode(phoneNumber: string): Promise<SendCodeResult> {
    await this.client.connect();
    const result = await this.client.sendCode(
      { apiId: this.apiId, apiHash: this.apiHash },
      phoneNumber,
    );
    return { phoneCodeHash: result.phoneCodeHash };
  }

  async signIn(
    phoneNumber: string,
    phoneCodeHash: string,
    code: string,
  ): Promise<SignInResult> {
    try {
      await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        }),
      );
      const sessionString = (this.client.session as StringSession).save();
      return { ok: true, needsPassword: false, sessionString };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        return { ok: false, needsPassword: true };
      }
      throw err;
    }
  }

  async signInWithPassword(password: string): Promise<SignInResult> {
    await this.client.signInUser(
      { apiId: this.apiId, apiHash: this.apiHash },
      {
        phoneNumber: async () => "",
        phoneCode: async () => "",
        password: async () => password,
        onError: (e) => { throw e; },
      },
    );
    const sessionString = (this.client.session as StringSession).save();
    return { ok: true, needsPassword: false, sessionString };
  }

  async sendMessage(target: string, targetType: "username" | "phone", text: string): Promise<void> {
    await this.client.connect();

    let peer: unknown;
    if (targetType === "username") {
      peer = target;
    } else {
      const imported = await this.client.invoke(
        new Api.contacts.ImportContacts({
          contacts: [
            new Api.InputPhoneContact({
              clientId: BigInt(Date.now()) as unknown as bigint,
              phone: target,
              firstName: "lead",
              lastName: "",
            }),
          ],
        }),
      );
      const user = imported.users[0];
      if (!user) throw new Error("PHONE_NOT_ON_TELEGRAM");
      peer = user;
    }

    await this.client.sendMessage(peer as never, { message: text });
  }
}
```

- [ ] **Step 2: Commit (sem testes — wrapper de lib externa)**

```bash
git add server/src/services/mtproto/client.ts
git commit -m "feat(mtproto): MtprotoClient — wrapper gramjs (login + sendMessage)"
```

---

## Task 5: AccountPool

**Files:**
- Create: `server/src/services/mtproto/pool.ts`
- Create: `tests/services/mtproto/pool.test.ts`

- [ ] **Step 1: Escrever testes**

`tests/services/mtproto/pool.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { AccountPool, type PoolAccount } from "../../../server/src/services/mtproto/pool.js";

function makeAccount(id: string, status: PoolAccount["status"] = "active"): PoolAccount {
  return {
    id,
    phoneNumber: `+100000000${id}`,
    sessionString: `sess-${id}`,
    status,
    floodWaitUntil: null,
  };
}

describe("AccountPool", () => {
  let pool: AccountPool;

  beforeEach(() => {
    pool = new AccountPool();
  });

  it("round-robins across active accounts", () => {
    pool.load([makeAccount("a"), makeAccount("b"), makeAccount("c")]);
    expect(pool.next()?.id).toBe("a");
    expect(pool.next()?.id).toBe("b");
    expect(pool.next()?.id).toBe("c");
    expect(pool.next()?.id).toBe("a");
  });

  it("skips flood_wait accounts still in cooldown", () => {
    const flooded = makeAccount("a", "flood_wait");
    flooded.floodWaitUntil = new Date(Date.now() + 60_000);
    pool.load([flooded, makeAccount("b")]);
    expect(pool.next()?.id).toBe("b");
    expect(pool.next()?.id).toBe("b");
  });

  it("reconsiders flood_wait accounts once cooldown expires", () => {
    const flooded = makeAccount("a", "flood_wait");
    flooded.floodWaitUntil = new Date(Date.now() - 1000);
    pool.load([flooded, makeAccount("b")]);
    const seen = new Set<string>();
    seen.add(pool.next()!.id);
    seen.add(pool.next()!.id);
    expect(seen).toEqual(new Set(["a", "b"]));
  });

  it("returns null when pool is empty or all unavailable", () => {
    pool.load([makeAccount("a", "banned"), makeAccount("b", "disconnected")]);
    expect(pool.next()).toBeNull();
  });

  it("markFloodWait removes account from rotation until expiry", () => {
    pool.load([makeAccount("a"), makeAccount("b")]);
    pool.markFloodWait("a", 60);
    expect(pool.next()?.id).toBe("b");
    expect(pool.next()?.id).toBe("b");
  });

  it("markBanned removes permanently", () => {
    pool.load([makeAccount("a"), makeAccount("b")]);
    pool.markBanned("a");
    expect(pool.next()?.id).toBe("b");
    expect(pool.next()?.id).toBe("b");
  });
});
```

- [ ] **Step 2: Rodar e falhar**

```bash
npm run test -- pool
```

Expected: FAIL.

- [ ] **Step 3: Implementar**

`server/src/services/mtproto/pool.ts`:

```ts
export interface PoolAccount {
  id: string;
  phoneNumber: string;
  sessionString: string;
  status: "active" | "flood_wait" | "banned" | "disconnected";
  floodWaitUntil: Date | null;
}

export class AccountPool {
  private accounts: PoolAccount[] = [];
  private cursor = 0;

  load(accounts: PoolAccount[]): void {
    this.accounts = accounts.map((a) => ({ ...a }));
    this.cursor = 0;
  }

  private isAvailable(a: PoolAccount): boolean {
    if (a.status === "banned" || a.status === "disconnected") return false;
    if (a.status === "flood_wait") {
      if (!a.floodWaitUntil) return true;
      return a.floodWaitUntil.getTime() <= Date.now();
    }
    return a.status === "active";
  }

  next(): PoolAccount | null {
    if (this.accounts.length === 0) return null;
    for (let i = 0; i < this.accounts.length; i++) {
      const idx = (this.cursor + i) % this.accounts.length;
      const candidate = this.accounts[idx];
      if (this.isAvailable(candidate)) {
        this.cursor = (idx + 1) % this.accounts.length;
        return candidate;
      }
    }
    return null;
  }

  markFloodWait(id: string, seconds: number): void {
    const a = this.accounts.find((x) => x.id === id);
    if (!a) return;
    a.status = "flood_wait";
    a.floodWaitUntil = new Date(Date.now() + seconds * 1000);
  }

  markBanned(id: string): void {
    const a = this.accounts.find((x) => x.id === id);
    if (!a) return;
    a.status = "banned";
  }
}
```

- [ ] **Step 4: Testes passam**

```bash
npm run test -- pool
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/mtproto/pool.ts tests/services/mtproto/pool.test.ts
git commit -m "feat(mtproto): AccountPool com round-robin e flood-wait"
```

---

## Task 6: CampaignRunner

**Files:**
- Create: `server/src/services/mtproto/campaign-runner.ts`
- Create: `tests/services/mtproto/campaign-runner.test.ts`

- [ ] **Step 1: Escrever testes com mocks do pool e do client**

`tests/services/mtproto/campaign-runner.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { CampaignRunner, type CampaignTargetRow, type RunnerDeps } from "../../../server/src/services/mtproto/campaign-runner.js";
import { AccountPool, type PoolAccount } from "../../../server/src/services/mtproto/pool.js";

function pool(...ids: string[]): AccountPool {
  const p = new AccountPool();
  p.load(ids.map((id): PoolAccount => ({
    id,
    phoneNumber: `+${id}`,
    sessionString: `s-${id}`,
    status: "active",
    floodWaitUntil: null,
  })));
  return p;
}

function targets(...items: Array<{ id: string; identifier: string; type: "username" | "phone" }>): CampaignTargetRow[] {
  return items.map((i) => ({ id: i.id, identifier: i.identifier, type: i.type, status: "pending" }));
}

function makeDeps(overrides: Partial<RunnerDeps> = {}): RunnerDeps & { sends: Array<{ accountId: string; target: string }> } {
  const sends: Array<{ accountId: string; target: string }> = [];
  const base: RunnerDeps = {
    sendMessage: async (accountId, target) => {
      sends.push({ accountId, target: target.identifier });
    },
    markTargetSent: vi.fn(async () => {}),
    markTargetFailed: vi.fn(async () => {}),
    incrementCounters: vi.fn(async () => {}),
    setCampaignStatus: vi.fn(async () => {}),
    delay: async () => {}, // no-op in tests
    ...overrides,
  };
  return { ...base, sends };
}

describe("CampaignRunner", () => {
  it("sends to all pending targets distributing across the pool", async () => {
    const deps = makeDeps();
    const runner = new CampaignRunner(pool("a", "b"), deps, {
      campaignId: "c1",
      messageText: "oi",
      delayMinSeconds: 0,
      delayMaxSeconds: 0,
    });
    await runner.run(targets(
      { id: "t1", identifier: "u1", type: "username" },
      { id: "t2", identifier: "u2", type: "username" },
      { id: "t3", identifier: "u3", type: "username" },
    ));
    expect(deps.sends.map((s) => s.accountId)).toEqual(["a", "b", "a"]);
    expect(deps.markTargetSent).toHaveBeenCalledTimes(3);
  });

  it("on FloodWaitError marks the account and reuses another, target stays sendable", async () => {
    const pl = pool("a", "b");
    const deps = makeDeps({
      sendMessage: async (accountId) => {
        if (accountId === "a") {
          const e = new Error("FLOOD_WAIT") as Error & { seconds: number };
          e.seconds = 30;
          throw e;
        }
      },
    });
    const runner = new CampaignRunner(pl, deps, {
      campaignId: "c1", messageText: "x", delayMinSeconds: 0, delayMaxSeconds: 0,
    });
    await runner.run(targets({ id: "t1", identifier: "u1", type: "username" }));
    // target eventually sent via account b
    expect(deps.markTargetSent).toHaveBeenCalledWith("t1", "b");
  });

  it("marks target failed for non-retryable errors", async () => {
    const deps = makeDeps({
      sendMessage: async () => { throw new Error("USERNAME_NOT_OCCUPIED"); },
    });
    const runner = new CampaignRunner(pool("a"), deps, {
      campaignId: "c1", messageText: "x", delayMinSeconds: 0, delayMaxSeconds: 0,
    });
    await runner.run(targets({ id: "t1", identifier: "bad", type: "username" }));
    expect(deps.markTargetFailed).toHaveBeenCalledWith("t1", "a", expect.stringContaining("USERNAME_NOT_OCCUPIED"));
  });

  it("pauses campaign when no accounts are available", async () => {
    const p = new AccountPool();
    p.load([]);
    const deps = makeDeps();
    const runner = new CampaignRunner(p, deps, {
      campaignId: "c1", messageText: "x", delayMinSeconds: 0, delayMaxSeconds: 0,
    });
    await runner.run(targets({ id: "t1", identifier: "u", type: "username" }));
    expect(deps.setCampaignStatus).toHaveBeenCalledWith("c1", "paused");
  });

  it("completes the campaign when all targets are sent", async () => {
    const deps = makeDeps();
    const runner = new CampaignRunner(pool("a"), deps, {
      campaignId: "c1", messageText: "x", delayMinSeconds: 0, delayMaxSeconds: 0,
    });
    await runner.run(targets({ id: "t1", identifier: "u", type: "username" }));
    expect(deps.setCampaignStatus).toHaveBeenCalledWith("c1", "completed");
  });
});
```

- [ ] **Step 2: Rodar e falhar**

```bash
npm run test -- campaign-runner
```

Expected: FAIL.

- [ ] **Step 3: Implementar**

`server/src/services/mtproto/campaign-runner.ts`:

```ts
import type { AccountPool } from "./pool.js";

export interface CampaignTargetRow {
  id: string;
  identifier: string;
  type: "username" | "phone";
  status: "pending" | "sent" | "failed";
}

export interface RunnerDeps {
  sendMessage: (accountId: string, target: { identifier: string; type: "username" | "phone" }, text: string) => Promise<void>;
  markTargetSent: (targetId: string, accountId: string) => Promise<void>;
  markTargetFailed: (targetId: string, accountId: string | null, error: string) => Promise<void>;
  incrementCounters: (campaignId: string, kind: "sent" | "failed") => Promise<void>;
  setCampaignStatus: (campaignId: string, status: "running" | "paused" | "completed" | "failed") => Promise<void>;
  delay: (ms: number) => Promise<void>;
}

export interface CampaignConfig {
  campaignId: string;
  messageText: string;
  delayMinSeconds: number;
  delayMaxSeconds: number;
}

interface FloodWaitErrorLike {
  seconds?: number;
  message?: string;
}

function extractFloodWait(err: unknown): number | null {
  if (err && typeof err === "object") {
    const e = err as FloodWaitErrorLike;
    if (typeof e.seconds === "number" && /FLOOD|FLOOD_WAIT/i.test(e.message ?? "")) return e.seconds;
    if (typeof e.seconds === "number" && /FLOOD/i.test(String(e))) return e.seconds;
    if (/FLOOD_WAIT/i.test(e.message ?? "") && typeof e.seconds === "number") return e.seconds;
  }
  return null;
}

function isFatalAccountError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /AUTH_KEY|USER_DEACTIVATED|SESSION_REVOKED|PHONE_NUMBER_BANNED/i.test(msg);
}

export class CampaignRunner {
  constructor(
    private pool: AccountPool,
    private deps: RunnerDeps,
    private cfg: CampaignConfig,
  ) {}

  async run(targets: CampaignTargetRow[]): Promise<void> {
    await this.deps.setCampaignStatus(this.cfg.campaignId, "running");

    const pending = targets.filter((t) => t.status === "pending");
    for (const target of pending) {
      const account = this.pool.next();
      if (!account) {
        await this.deps.setCampaignStatus(this.cfg.campaignId, "paused");
        return;
      }

      try {
        await this.deps.sendMessage(
          account.id,
          { identifier: target.identifier, type: target.type },
          this.cfg.messageText,
        );
        await this.deps.markTargetSent(target.id, account.id);
        await this.deps.incrementCounters(this.cfg.campaignId, "sent");
      } catch (err) {
        const floodSeconds = extractFloodWait(err);
        if (floodSeconds !== null) {
          this.pool.markFloodWait(account.id, floodSeconds);
          // target volta pro loop (tentamos a próxima conta)
          const nextAccount = this.pool.next();
          if (!nextAccount) {
            await this.deps.setCampaignStatus(this.cfg.campaignId, "paused");
            return;
          }
          try {
            await this.deps.sendMessage(
              nextAccount.id,
              { identifier: target.identifier, type: target.type },
              this.cfg.messageText,
            );
            await this.deps.markTargetSent(target.id, nextAccount.id);
            await this.deps.incrementCounters(this.cfg.campaignId, "sent");
          } catch (err2) {
            if (isFatalAccountError(err2)) this.pool.markBanned(nextAccount.id);
            await this.deps.markTargetFailed(target.id, nextAccount.id, err2 instanceof Error ? err2.message : String(err2));
            await this.deps.incrementCounters(this.cfg.campaignId, "failed");
          }
        } else {
          if (isFatalAccountError(err)) this.pool.markBanned(account.id);
          await this.deps.markTargetFailed(target.id, account.id, err instanceof Error ? err.message : String(err));
          await this.deps.incrementCounters(this.cfg.campaignId, "failed");
        }
      }

      const min = this.cfg.delayMinSeconds * 1000;
      const max = this.cfg.delayMaxSeconds * 1000;
      const wait = min + Math.floor(Math.random() * Math.max(1, max - min + 1));
      if (wait > 0) await this.deps.delay(wait);
    }

    await this.deps.setCampaignStatus(this.cfg.campaignId, "completed");
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm run test -- campaign-runner
```

Expected: PASS em todos os 5.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/mtproto/campaign-runner.ts tests/services/mtproto/campaign-runner.test.ts
git commit -m "feat(mtproto): CampaignRunner com flood-wait e fallback"
```

---

## Task 7: Queue `mtproto` + enqueue helpers

**Files:**
- Create: `server/src/queue-mtproto.ts`

- [ ] **Step 1: Implementar**

`server/src/queue-mtproto.ts`:

```ts
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export type MtprotoJobData =
  | { kind: "auth.request-code"; accountId: string; phoneNumber: string }
  | { kind: "auth.sign-in"; accountId: string; phoneNumber: string; code: string }
  | { kind: "auth.submit-password"; accountId: string; password: string }
  | { kind: "campaign.run"; campaignId: string };

export const mtprotoQueue = new Queue<MtprotoJobData>("mtproto", { connection });

export async function enqueueMtproto(data: MtprotoJobData): Promise<void> {
  await mtprotoQueue.add(data.kind, data, {
    attempts: 2,
    backoff: { type: "fixed", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/queue-mtproto.ts
git commit -m "feat(mtproto): fila BullMQ e enqueue helpers"
```

---

## Task 8: Worker `mtproto-worker.ts`

**Files:**
- Create: `server/src/workers/mtproto-worker.ts`

Worker sem teste unitário — glue code entre fila, DB e serviços já testados. Testado via integração manual.

- [ ] **Step 1: Implementar**

`server/src/workers/mtproto-worker.ts`:

```ts
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";
import { supabase } from "../db.js";
import { MtprotoClient } from "../services/mtproto/client.js";
import { AccountPool, type PoolAccount } from "../services/mtproto/pool.js";
import { CampaignRunner, type CampaignTargetRow } from "../services/mtproto/campaign-runner.js";
import type { MtprotoJobData } from "../queue-mtproto.js";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

// Conexões vivas em memória por accountId (criadas quando conta faz login e
// reusadas durante campanhas).
const liveClients = new Map<string, MtprotoClient>();

async function getOrCreateClient(accountId: string, sessionString: string): Promise<MtprotoClient> {
  let client = liveClients.get(accountId);
  if (!client) {
    client = new MtprotoClient(config.telegramApiId, config.telegramApiHash, sessionString);
    await client.connect();
    liveClients.set(accountId, client);
  }
  return client;
}

async function updateAccount(accountId: string, patch: Record<string, unknown>): Promise<void> {
  await supabase.from("mtproto_accounts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", accountId);
}

async function handleRequestCode(accountId: string, phoneNumber: string): Promise<void> {
  const client = new MtprotoClient(config.telegramApiId, config.telegramApiHash);
  try {
    const { phoneCodeHash } = await client.sendCode(phoneNumber);
    await supabase.from("mtproto_auth_sessions").insert({ account_id: accountId, phone_code_hash: phoneCodeHash, needs_password: false });
    await updateAccount(accountId, { status: "code_sent", last_error: null });
    liveClients.set(accountId, client);
  } catch (err) {
    await updateAccount(accountId, { status: "disconnected", last_error: err instanceof Error ? err.message : String(err) });
    await client.disconnect();
    throw err;
  }
}

async function handleSignIn(accountId: string, phoneNumber: string, code: string): Promise<void> {
  const { data: session } = await supabase.from("mtproto_auth_sessions").select("*").eq("account_id", accountId).single();
  if (!session) throw new Error("auth session not found");
  const client = liveClients.get(accountId);
  if (!client) throw new Error("client not live — re-solicite o código");

  const result = await client.signIn(phoneNumber, session.phone_code_hash, code);
  if (result.ok) {
    await updateAccount(accountId, { status: "active", session_string: result.sessionString, last_error: null });
    await supabase.from("mtproto_auth_sessions").delete().eq("account_id", accountId);
  } else if (result.needsPassword) {
    await supabase.from("mtproto_auth_sessions").update({ needs_password: true }).eq("account_id", accountId);
    await updateAccount(accountId, { status: "needs_password" });
  }
}

async function handleSubmitPassword(accountId: string, password: string): Promise<void> {
  const client = liveClients.get(accountId);
  if (!client) throw new Error("client not live — re-solicite o código");
  const result = await client.signInWithPassword(password);
  if (result.ok) {
    await updateAccount(accountId, { status: "active", session_string: result.sessionString, last_error: null });
    await supabase.from("mtproto_auth_sessions").delete().eq("account_id", accountId);
  }
}

async function handleCampaignRun(campaignId: string): Promise<void> {
  const { data: campaign } = await supabase.from("mtproto_campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return;

  const { data: accountsRaw } = await supabase
    .from("mtproto_accounts")
    .select("*")
    .eq("tenant_id", campaign.tenant_id)
    .in("status", ["active", "flood_wait"]);

  const pool = new AccountPool();
  pool.load((accountsRaw ?? []).map((a): PoolAccount => ({
    id: a.id,
    phoneNumber: a.phone_number,
    sessionString: a.session_string ?? "",
    status: a.status,
    floodWaitUntil: a.flood_wait_until ? new Date(a.flood_wait_until) : null,
  })));

  const { data: targets } = await supabase
    .from("mtproto_targets")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const targetRows: CampaignTargetRow[] = (targets ?? []).map((t) => ({
    id: t.id,
    identifier: t.target_identifier,
    type: t.target_type,
    status: t.status,
  }));

  const runner = new CampaignRunner(pool, {
    sendMessage: async (accountId, target, text) => {
      const acc = (accountsRaw ?? []).find((a) => a.id === accountId);
      if (!acc) throw new Error("account missing");
      const client = await getOrCreateClient(accountId, acc.session_string ?? "");
      await client.sendMessage(target.identifier, target.type, text);
      await supabase.from("mtproto_accounts").update({ last_used_at: new Date().toISOString() }).eq("id", accountId);
    },
    markTargetSent: async (targetId, accountId) => {
      await supabase.from("mtproto_targets").update({ status: "sent", account_id: accountId, sent_at: new Date().toISOString() }).eq("id", targetId);
    },
    markTargetFailed: async (targetId, accountId, error) => {
      await supabase.from("mtproto_targets").update({ status: "failed", account_id: accountId, error_message: error }).eq("id", targetId);
    },
    incrementCounters: async (id, kind) => {
      const field = kind === "sent" ? "sent_count" : "failed_count";
      await supabase.rpc("increment_campaign_counter", { p_campaign_id: id, p_field: field }).then(() => {}, async () => {
        // fallback sem RPC: leitura + update
        const { data: c } = await supabase.from("mtproto_campaigns").select(field).eq("id", id).single();
        const current = (c as unknown as Record<string, number>)?.[field] ?? 0;
        await supabase.from("mtproto_campaigns").update({ [field]: current + 1 }).eq("id", id);
      });
    },
    setCampaignStatus: async (id, status) => {
      const patch: Record<string, unknown> = { status };
      if (status === "running" && !campaign.started_at) patch.started_at = new Date().toISOString();
      if (status === "completed" || status === "failed") patch.completed_at = new Date().toISOString();
      await supabase.from("mtproto_campaigns").update(patch).eq("id", id);
    },
    delay: (ms) => new Promise((r) => setTimeout(r, ms)),
  }, {
    campaignId,
    messageText: campaign.message_text,
    delayMinSeconds: campaign.delay_min_seconds,
    delayMaxSeconds: campaign.delay_max_seconds,
  });

  await runner.run(targetRows);
}

export function startMtprotoWorker(): void {
  if (!config.mtprotoWorkerEnabled) {
    console.log("[mtproto] worker disabled via env");
    return;
  }

  new Worker<MtprotoJobData>(
    "mtproto",
    async (job: Job<MtprotoJobData>) => {
      const d = job.data;
      switch (d.kind) {
        case "auth.request-code": return handleRequestCode(d.accountId, d.phoneNumber);
        case "auth.sign-in": return handleSignIn(d.accountId, d.phoneNumber, d.code);
        case "auth.submit-password": return handleSubmitPassword(d.accountId, d.password);
        case "campaign.run": return handleCampaignRun(d.campaignId);
      }
    },
    { connection, concurrency: 4 },
  );

  console.log("[mtproto] worker started");
}
```

- [ ] **Step 2: Iniciar worker no boot do server**

Modificar `server/src/index.ts`. Trocar:
```ts
app.listen(config.port, () => {
  console.log(`EagleBot Engine running on port ${config.port}`);
  startWorkers();
});
```

Por:
```ts
import { startMtprotoWorker } from "./workers/mtproto-worker.js";
// ...
app.listen(config.port, () => {
  console.log(`EagleBot Engine running on port ${config.port}`);
  startWorkers();
  startMtprotoWorker();
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/workers/mtproto-worker.ts server/src/index.ts
git commit -m "feat(mtproto): worker dedicado consumindo fila BullMQ"
```

---

## Task 9: Server actions do dashboard

**Files:**
- Create: `app/dashboard/automations/actions.ts`

- [ ] **Step 1: Implementar**

`app/dashboard/automations/actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { parseTargets } from "@/server/src/services/mtproto/target-parser";
import { enqueueMtproto } from "@/server/src/queue-mtproto";
import { revalidatePath } from "next/cache";

async function currentTenantId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

export async function startAddAccount(phoneNumber: string, displayName: string): Promise<{ accountId: string }> {
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mtproto_accounts")
    .insert({ tenant_id: tenantId, phone_number: phoneNumber, display_name: displayName, status: "pending" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await enqueueMtproto({ kind: "auth.request-code", accountId: data.id, phoneNumber });
  revalidatePath("/dashboard/automations");
  return { accountId: data.id };
}

export async function submitAuthCode(accountId: string, code: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from("mtproto_accounts").select("phone_number").eq("id", accountId).single();
  if (!data) throw new Error("account not found");
  await enqueueMtproto({ kind: "auth.sign-in", accountId, phoneNumber: data.phone_number, code });
  revalidatePath("/dashboard/automations");
}

export async function submitAuthPassword(accountId: string, password: string): Promise<void> {
  await enqueueMtproto({ kind: "auth.submit-password", accountId, password });
  revalidatePath("/dashboard/automations");
}

export async function removeAccount(accountId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("mtproto_accounts").delete().eq("id", accountId);
  revalidatePath("/dashboard/automations");
}

export async function createCampaign(input: {
  name: string;
  message: string;
  targetsRaw: string;
  delayMin: number;
  delayMax: number;
}): Promise<{ campaignId: string }> {
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  const parsed = parseTargets(input.targetsRaw);
  const valid = parsed.filter((t) => t.valid);
  const invalid = parsed.filter((t) => !t.valid);

  const { data: campaign, error: cErr } = await supabase
    .from("mtproto_campaigns")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      message_text: input.message,
      delay_min_seconds: input.delayMin,
      delay_max_seconds: input.delayMax,
      total_targets: parsed.length,
      status: "draft",
      failed_count: invalid.length,
    })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);

  const rows = [
    ...valid.map((t) => ({
      campaign_id: campaign.id,
      target_identifier: t.identifier,
      target_type: t.type,
      status: "pending" as const,
    })),
    ...invalid.map((t) => ({
      campaign_id: campaign.id,
      target_identifier: t.identifier,
      target_type: t.type,
      status: "failed" as const,
      error_message: "invalid_identifier",
    })),
  ];
  if (rows.length) await supabase.from("mtproto_targets").insert(rows);

  revalidatePath("/dashboard/automations");
  return { campaignId: campaign.id };
}

export async function launchCampaign(campaignId: string): Promise<void> {
  await enqueueMtproto({ kind: "campaign.run", campaignId });
  const supabase = await createClient();
  await supabase.from("mtproto_campaigns").update({ status: "running" }).eq("id", campaignId);
  revalidatePath("/dashboard/automations");
  revalidatePath(`/dashboard/automations/campaigns/${campaignId}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/automations/actions.ts
git commit -m "feat(dashboard): server actions para MTProto (contas + campanhas)"
```

---

## Task 10: Página de listagem + componente de contas

**Files:**
- Create: `app/dashboard/automations/page.tsx`
- Create: `components/dashboard/mtproto-accounts.tsx`
- Create: `components/dashboard/mtproto-campaign-list.tsx`

- [ ] **Step 1: Criar página server component**

`app/dashboard/automations/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { MtprotoAccounts } from "@/components/dashboard/mtproto-accounts";
import { MtprotoCampaignList } from "@/components/dashboard/mtproto-campaign-list";

export default async function AutomationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: accounts } = await supabase
    .from("mtproto_accounts")
    .select("*")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  const { data: campaigns } = await supabase
    .from("mtproto_campaigns")
    .select("*")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-1">Automações</h1>
      <p className="text-white/50 mb-8">
        Conecte contas pessoais do Telegram e dispare mensagens em massa.
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-3">Contas conectadas</h2>
        <MtprotoAccounts accounts={accounts ?? []} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Campanhas</h2>
          <a
            href="/dashboard/automations/new-campaign"
            className="px-3 py-1.5 rounded-md bg-(--accent) text-black text-sm font-medium hover:opacity-90"
          >
            Nova campanha
          </a>
        </div>
        <MtprotoCampaignList campaigns={campaigns ?? []} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Componente de contas (client)**

`components/dashboard/mtproto-accounts.tsx`:

```tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { startAddAccount, submitAuthCode, submitAuthPassword, removeAccount } from "@/app/dashboard/automations/actions";
import { createClient } from "@/lib/supabase/client";

interface Account {
  id: string;
  phone_number: string;
  display_name: string | null;
  status: string;
  last_error: string | null;
}

export function MtprotoAccounts({ accounts }: { accounts: Account[] }) {
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"form" | "code" | "password">("form");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Poll status da conta em login
  useEffect(() => {
    if (!pendingAccountId) return;
    const supabase = createClient();
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("mtproto_accounts")
        .select("status,last_error")
        .eq("id", pendingAccountId)
        .single();
      if (!data) return;
      if (data.status === "code_sent" && step === "form") setStep("code");
      if (data.status === "needs_password") setStep("password");
      if (data.status === "active") {
        clearInterval(interval);
        setAdding(false);
        setPendingAccountId(null);
        setStep("form");
        setPhone(""); setName(""); setCode(""); setPassword("");
        window.location.reload();
      }
      if (data.last_error) setError(data.last_error);
    }, 1200);
    return () => clearInterval(interval);
  }, [pendingAccountId, step]);

  function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const { accountId } = await startAddAccount(phone, name);
        setPendingAccountId(accountId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "erro");
      }
    });
  }

  function submitCodeStep(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingAccountId) return;
    startTransition(async () => {
      try { await submitAuthCode(pendingAccountId, code); }
      catch (err) { setError(err instanceof Error ? err.message : "erro"); }
    });
  }

  function submitPasswordStep(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingAccountId) return;
    startTransition(async () => {
      try { await submitAuthPassword(pendingAccountId, password); }
      catch (err) { setError(err instanceof Error ? err.message : "erro"); }
    });
  }

  return (
    <div className="space-y-3">
      {accounts.length === 0 && (
        <p className="text-white/40 text-sm">Nenhuma conta conectada ainda.</p>
      )}
      {accounts.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.02]">
          <div>
            <div className="text-white text-sm font-medium">{a.display_name || a.phone_number}</div>
            <div className="text-white/40 text-xs">{a.phone_number} · {a.status}</div>
            {a.last_error && <div className="text-red-400 text-xs mt-1">{a.last_error}</div>}
          </div>
          <button
            onClick={() => startTransition(() => removeAccount(a.id).then(() => window.location.reload()))}
            className="text-white/40 hover:text-red-400 text-xs"
          >
            Remover
          </button>
        </div>
      ))}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 rounded-md border border-white/15 text-white/80 text-sm hover:bg-white/5"
        >
          + Conectar conta
        </button>
      )}

      {adding && step === "form" && (
        <form onSubmit={submitPhone} className="p-4 rounded-lg border border-white/10 bg-white/[0.02] space-y-2">
          <input placeholder="Nome (ex: Conta principal)" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white" />
          <input placeholder="+5511999998888" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 rounded bg-(--accent) text-black text-sm">Pedir código</button>
            <button type="button" onClick={() => { setAdding(false); setError(null); }} className="px-3 py-1.5 text-white/60 text-sm">Cancelar</button>
          </div>
        </form>
      )}

      {adding && step === "code" && (
        <form onSubmit={submitCodeStep} className="p-4 rounded-lg border border-white/10 bg-white/[0.02] space-y-2">
          <p className="text-white/70 text-sm">Digite o código que chegou no seu Telegram:</p>
          <input value={code} onChange={(e) => setCode(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" className="px-3 py-1.5 rounded bg-(--accent) text-black text-sm">Entrar</button>
        </form>
      )}

      {adding && step === "password" && (
        <form onSubmit={submitPasswordStep} className="p-4 rounded-lg border border-white/10 bg-white/[0.02] space-y-2">
          <p className="text-white/70 text-sm">Sua conta tem 2FA — digite a senha:</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" className="px-3 py-1.5 rounded bg-(--accent) text-black text-sm">Entrar</button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Lista de campanhas**

`components/dashboard/mtproto-campaign-list.tsx`:

```tsx
interface Campaign {
  id: string;
  name: string;
  status: string;
  total_targets: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

export function MtprotoCampaignList({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return <p className="text-white/40 text-sm">Nenhuma campanha ainda.</p>;
  }
  return (
    <div className="space-y-2">
      {campaigns.map((c) => (
        <a
          key={c.id}
          href={`/dashboard/automations/campaigns/${c.id}`}
          className="block p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-sm font-medium">{c.name}</div>
              <div className="text-white/40 text-xs">
                {c.sent_count}/{c.total_targets} enviadas · {c.failed_count} falhas · {c.status}
              </div>
            </div>
            <div className="text-white/30 text-xs">
              {new Date(c.created_at).toLocaleDateString("pt-BR")}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/automations/page.tsx components/dashboard/mtproto-accounts.tsx components/dashboard/mtproto-campaign-list.tsx
git commit -m "feat(dashboard): página de automações com listagem de contas e campanhas"
```

---

## Task 11: Form de nova campanha

**Files:**
- Create: `app/dashboard/automations/new-campaign/page.tsx`
- Create: `components/dashboard/mtproto-campaign-form.tsx`

- [ ] **Step 1: Página wrapper**

`app/dashboard/automations/new-campaign/page.tsx`:

```tsx
import { MtprotoCampaignForm } from "@/components/dashboard/mtproto-campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="p-8 max-w-3xl">
      <a href="/dashboard/automations" className="text-white/40 hover:text-white text-sm">← Voltar</a>
      <h1 className="text-2xl font-bold text-white mt-4 mb-6">Nova campanha</h1>
      <MtprotoCampaignForm />
    </div>
  );
}
```

- [ ] **Step 2: Form client**

`components/dashboard/mtproto-campaign-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaign, launchCampaign } from "@/app/dashboard/automations/actions";

export function MtprotoCampaignForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [targetsRaw, setTargetsRaw] = useState("");
  const [delayMin, setDelayMin] = useState(30);
  const [delayMax, setDelayMax] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent, launch: boolean) {
    e.preventDefault();
    setError(null);
    if (delayMin > delayMax) {
      setError("Delay mínimo não pode ser maior que o máximo");
      return;
    }
    startTransition(async () => {
      try {
        const { campaignId } = await createCampaign({ name, message, targetsRaw, delayMin, delayMax });
        if (launch) await launchCampaign(campaignId);
        router.push(`/dashboard/automations/campaigns/${campaignId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "erro");
      }
    });
  }

  return (
    <form className="space-y-4">
      <div>
        <label className="text-white/70 text-sm block mb-1">Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white" />
      </div>
      <div>
        <label className="text-white/70 text-sm block mb-1">Mensagem</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4}
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white" />
      </div>
      <div>
        <label className="text-white/70 text-sm block mb-1">
          Lista de alvos (um por linha, pode ser @username ou +telefone)
        </label>
        <textarea value={targetsRaw} onChange={(e) => setTargetsRaw(e.target.value)} required rows={8}
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white font-mono text-sm" />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-white/70 text-sm block mb-1">Delay mín (s)</label>
          <input type="number" value={delayMin} onChange={(e) => setDelayMin(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white" />
        </div>
        <div className="flex-1">
          <label className="text-white/70 text-sm block mb-1">Delay máx (s)</label>
          <input type="number" value={delayMax} onChange={(e) => setDelayMax(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white" />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={(e) => submit(e, false)} disabled={pending}
          className="px-4 py-2 rounded border border-white/15 text-white/80 hover:bg-white/5">
          Salvar rascunho
        </button>
        <button onClick={(e) => submit(e, true)} disabled={pending}
          className="px-4 py-2 rounded bg-(--accent) text-black font-medium">
          Salvar e disparar
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/automations/new-campaign/page.tsx components/dashboard/mtproto-campaign-form.tsx
git commit -m "feat(dashboard): form de criação de campanha MTProto"
```

---

## Task 12: Detalhe da campanha com progresso

**Files:**
- Create: `app/dashboard/automations/campaigns/[campaignId]/page.tsx`
- Create: `components/dashboard/mtproto-campaign-detail.tsx`

- [ ] **Step 1: Página**

`app/dashboard/automations/campaigns/[campaignId]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { MtprotoCampaignDetail } from "@/components/dashboard/mtproto-campaign-detail";
import { notFound } from "next/navigation";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("mtproto_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (!campaign) notFound();

  return (
    <div className="p-8 max-w-4xl">
      <a href="/dashboard/automations" className="text-white/40 hover:text-white text-sm">← Voltar</a>
      <MtprotoCampaignDetail initialCampaign={campaign} campaignId={campaignId} />
    </div>
  );
}
```

- [ ] **Step 2: Componente client com polling 3s**

`components/dashboard/mtproto-campaign-detail.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { launchCampaign } from "@/app/dashboard/automations/actions";

interface Campaign {
  id: string;
  name: string;
  message_text: string;
  status: string;
  total_targets: number;
  sent_count: number;
  failed_count: number;
  delay_min_seconds: number;
  delay_max_seconds: number;
  started_at: string | null;
  completed_at: string | null;
}

interface Target {
  id: string;
  target_identifier: string;
  target_type: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
}

export function MtprotoCampaignDetail({ initialCampaign, campaignId }: { initialCampaign: Campaign; campaignId: string }) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [targets, setTargets] = useState<Target[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [{ data: c }, { data: ts }] = await Promise.all([
        supabase.from("mtproto_campaigns").select("*").eq("id", campaignId).single(),
        supabase.from("mtproto_targets").select("*").eq("campaign_id", campaignId).order("sent_at", { ascending: false, nullsFirst: false }).limit(200),
      ]);
      if (c) setCampaign(c as Campaign);
      if (ts) setTargets(ts as Target[]);
    }
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const progress = campaign.total_targets > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_targets) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <p className="text-white/40 text-sm mt-1">
            {campaign.sent_count}/{campaign.total_targets} enviadas · {campaign.failed_count} falhas · {campaign.status}
          </p>
        </div>
        {campaign.status === "draft" || campaign.status === "paused" ? (
          <button
            onClick={() => startTransition(() => launchCampaign(campaignId))}
            className="px-4 py-2 rounded bg-(--accent) text-black font-medium"
          >
            {campaign.status === "paused" ? "Retomar" : "Disparar"}
          </button>
        ) : null}
      </div>

      <div className="mt-6 w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-(--accent)" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-8">
        <h2 className="text-white/80 text-sm font-semibold mb-2">Mensagem</h2>
        <pre className="p-3 rounded bg-black/20 border border-white/10 text-white/80 text-sm whitespace-pre-wrap">{campaign.message_text}</pre>
      </div>

      <div className="mt-8">
        <h2 className="text-white/80 text-sm font-semibold mb-2">Alvos ({targets.length})</h2>
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {targets.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-2 rounded border border-white/5 text-sm">
              <span className="text-white/80">{t.target_identifier}</span>
              <span className={`text-xs ${t.status === "sent" ? "text-green-400" : t.status === "failed" ? "text-red-400" : "text-white/40"}`}>
                {t.status}{t.error_message ? ` · ${t.error_message}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/automations/campaigns/ components/dashboard/mtproto-campaign-detail.tsx
git commit -m "feat(dashboard): detalhe da campanha MTProto com progresso e polling"
```

---

## Task 13: Link no sidebar

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Adicionar item "Automações"**

Dentro do `<nav>`, depois do link "Meus Bots" e antes do bloco `{isAdmin && ...}`, inserir:

```tsx
        <a
          href="/dashboard/automations"
          className={`nav-item ${pathname.startsWith("/dashboard/automations") ? "active" : ""}`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pathname.startsWith("/dashboard/automations") ? "bg-(--accent)/15" : "bg-white/4"}`} style={pathname.startsWith("/dashboard/automations") ? { boxShadow: "0 0 12px -4px rgba(16,185,129,0.3)" } : {}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          Automações
        </a>
```

Também ajustar `isBotsActive` pra não matchar `/dashboard/automations`:

```tsx
  const isBotsActive = pathname === "/dashboard" || (pathname.startsWith("/dashboard/bots") && !pathname.startsWith("/dashboard/admin"));
```

(linha já existe, mas confirme que `automations` não cai no branch "Meus Bots" — não cai porque o check exige `startsWith("/dashboard/bots")`).

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat(dashboard): link de Automações no sidebar"
```

---

## Task 14: Build + verificação final

- [ ] **Step 1: Rodar typecheck/build**

```bash
npm run build
```

Expected: build passa. Se falhar por caminho relativo tsconfig pra `@/server/src/...`, adicionar path no `tsconfig.json` (`"@/server/*": ["./server/*"]`) e rodar de novo.

- [ ] **Step 2: Rodar testes**

```bash
npm run test
```

Expected: todos os testes mtproto passam + testes existentes continuam passando.

- [ ] **Step 3: Conferir que lint passa**

```bash
npm run lint
```

Expected: sem erros novos.

- [ ] **Step 4: Commit final (se algum fix necessário)**

Se houve pequenos fixes pra passar build/lint:

```bash
git commit -am "chore: ajustes de tipagem/paths pro MTProto"
```

---

## Self-review

- **Spec coverage:** escopo MVP (página, pool, login 3 passos, campanha com delay aleatório, histórico) está coberto pelas tasks 1–14. Schema da seção 3 do spec = task 1. Arquitetura da seção 2 = tasks 4–8. UI = tasks 9–12. Sidebar = task 13.
- **Placeholders:** sem TBDs nem "implement later". Cada step tem código ou comando concreto.
- **Consistência de tipos:** `PoolAccount.status` usa as mesmas strings que o enum do DB (`active`, `flood_wait`, `banned`, `disconnected`). `CampaignTargetRow.type` = `'username' | 'phone'`, bate com `mtproto_targets.target_type`. `MtprotoJobData.kind` é o discriminator usado no switch do worker.
- **Gaps conhecidos aceitos:**
  - Sem testes unitários de `MtprotoClient` e do worker — justificado (glue + lib externa). User valida via login manual.
  - Sem RPC `increment_campaign_counter` — código tem fallback inline, funciona sem criar função no DB.
  - `import Api` do gramjs tem surface grande; código cobre os caminhos principais (sendCode/signIn/signInWithPassword/sendMessage/importContacts). Edge cases do gramjs (ex: formato exato de `BigInt` pro `clientId`) podem precisar de ajuste na primeira execução — task 14 pega isso.
