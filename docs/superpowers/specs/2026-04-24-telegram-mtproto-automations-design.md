# Design — Automações Telegram (MTProto) no EagleBot

**Data:** 2026-04-24
**Status:** Aprovado, MVP
**Autor:** Dary + Claude

## Contexto

EagleBot hoje opera com **bot tokens** do Telegram (via `@BotFather`). Bots têm limitações: não conseguem iniciar conversa com usuários que não iniciaram com eles, não têm acesso irrestrito a grupos/canais, não fazem disparo em massa pra terceiros.

Esta feature adiciona uma camada paralela: automações usando **contas pessoais** via MTProto (mesma API que o Telegram Desktop/Mobile usa). Com login por número + código SMS, o sistema passa a operar como se fosse o próprio usuário.

## Riscos conhecidos (aceitos pelo usuário)

1. **Ban da conta.** Telegram detecta automação; disparo em massa é o vetor mais comum de ban. Usuário ciente.
2. **Session string em plaintext no DB.** Qualquer um com acesso ao Supabase sequestra a conta. Escolha explícita do usuário pra simplicidade.
3. **Queima de número.** Operações em massa podem levar ao bloqueio do número de telefone.

## Escopo do MVP

**Dentro:**
- Página `/dashboard/automations` (nova rota)
- Conectar múltiplas contas Telegram via MTProto (número → código → 2FA opcional)
- Pool de contas com status (pending, active, flood_wait, banned, disconnected)
- Criar campanha de disparo: mensagem + lista colada de alvos (@username ou +telefone) + delay min/max
- Execução: distribui alvos round-robin entre contas ativas, delay aleatório, registra resultado por alvo
- Histórico e progresso em tempo real (ou por polling)

**Fora (fase 2):**
- Scraping de membros de grupo/canal
- Adicionar usuários em grupos
- Auto-resposta de DM (fluxo tipo bot em conta pessoal)
- Gerenciamento (kick/ban/pin/agendar posts)
- Integração do MTProto dentro do fluxo atual do EagleBot
- Aquecimento (ramp-up) automático de contas novas
- Rate-limit diário / anti-flood inteligente

## Arquitetura

```
┌─────────────────────┐        ┌──────────────────────┐
│ Next.js (dashboard) │        │ MTProto Worker (node)│
│                     │        │  - gramjs clients    │
│ /dashboard/         │        │  - pool manager      │
│   automations       │        │  - campaign runner   │
└──────────┬──────────┘        └──────────┬───────────┘
           │                              │
           │  Server Actions              │  socket MTProto
           │                              │  (api.telegram.org)
           ▼                              ▼
┌─────────────────────┐        ┌──────────────────────┐
│ Supabase (Postgres) │◄───────┤  BullMQ + Redis      │
│  - mtproto_accounts │        │  queue: mtproto      │
│  - mtproto_campaigns│        └──────────────────────┘
│  - mtproto_targets  │
└─────────────────────┘
```

### Componentes

- **`MtprotoClient`** (`server/src/services/mtproto/client.ts`) — wrapper fino em torno de `gramjs` expondo `sendCode`, `signIn`, `sendMessage`, `disconnect`. Encapsula `StringSession`, `api_id`, `api_hash`.
- **`AccountPool`** (`server/src/services/mtproto/pool.ts`) — mantém clients em memória, lazy-load de sessão do DB, round-robin entre contas `active`, marca `flood_wait` + `flood_wait_until` ao receber `FloodWaitError` do Telegram.
- **`CampaignRunner`** (`server/src/services/mtproto/campaign-runner.ts`) — itera targets `pending` de uma campaign, pede conta ao pool, aplica delay aleatório entre `delay_min_seconds` e `delay_max_seconds`, envia, persiste resultado no target, atualiza contadores da campaign.
- **`mtproto-worker`** (`server/src/workers/mtproto-worker.ts`) — processo Node dedicado. Consome BullMQ `mtproto` com jobs: `auth.request-code`, `auth.sign-in`, `auth.submit-password`, `campaign.run`, `campaign.cancel`. Mantém conexões vivas; não desconecta entre jobs.
- **Página Next.js** (`app/dashboard/automations/page.tsx`) — lista contas do pool, botão "conectar nova", modal de login (passos: número → código → 2FA se pedir), lista de campanhas, botão "nova campanha", tela de criação (textarea alvos + textarea mensagem + inputs delay), detalhe da campanha com progresso.

### Fluxo de login (3 passos de UI)

1. User digita número → Server Action cria linha em `mtproto_accounts` com `status='pending'` e enfileira job `auth.request-code` → worker instancia `MtprotoClient`, chama `sendCode`, salva `phone_code_hash` em `mtproto_auth_sessions`, atualiza conta para `status='code_sent'`.
2. User digita código → Server Action enfileira `auth.sign-in` com `code` + `phone_code_hash` (carregado do `mtproto_auth_sessions` pelo worker) → worker chama `signIn`. Se OK: salva `session_string`, marca conta `active`, deleta `auth_sessions` row. Se pediu 2FA: marca `needs_password=true` na `auth_sessions` e conta `status='needs_password'`.
3. Se 2FA: user digita senha → `auth.submit-password` → worker chama `signInWithPassword` → mesma conclusão do passo 2.

UI faz polling em `mtproto_accounts.status` + `mtproto_auth_sessions.needs_password` pra avançar entre passos (polling de 1s durante o login é ok; não vale Realtime pra tão pouco).

### Fluxo de disparo

1. User preenche form → Server Action cria `mtproto_campaigns` row + insere N rows em `mtproto_targets` (status `pending`) → enfileira job `campaign.run` com `campaign_id`.
2. Worker (CampaignRunner):
   - carrega campaign + pool ativo (snapshot)
   - loop `while (pending target)`: pega próximo target, pede conta (round-robin, skipando `flood_wait`), resolve identifier (`@username` via `resolveUsername`; telefone via `importContacts` que adiciona contato temporário e retorna o peer), chama `sendMessage` com o peer resolvido
   - sucesso → target `sent`, `sent_at=now()`, `sent_count++` na campaign
   - falha → target `failed`, `error_message`, `failed_count++`
   - se `FloodWaitError(N)` → marca conta `flood_wait` com `flood_wait_until=now()+N`, target **volta pra `pending`** (será reprocessado), pega próxima conta
   - se `PhoneNumberBannedError` / `UserDeactivatedError` / `AuthKeyError` → conta `banned`/`disconnected`, target volta pra `pending`
   - delay aleatório `[delay_min, delay_max]` entre envios **por conta** (não global)
3. Quando não sobra target `pending` ou todas as contas estão indisponíveis: campaign vira `completed` (ou `paused` se não tem conta utilizável).

### UI — polling vs realtime

MVP usa **polling de 3s** na tela de detalhe da campanha (suficiente pra progresso; Realtime do Supabase adiciona complexidade sem valor aqui).

## Schema (migration `016_mtproto.sql`)

```sql
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
  target_type text not null,                    -- 'username' | 'phone'
  status text not null default 'pending',       -- 'pending' | 'sent' | 'failed'
  account_id uuid references mtproto_accounts(id) on delete set null,
  error_message text,
  sent_at timestamptz
);

create index idx_mtproto_targets_campaign_status on mtproto_targets(campaign_id, status);
create index idx_mtproto_accounts_tenant_status on mtproto_accounts(tenant_id, status);

alter table mtproto_accounts enable row level security;
alter table mtproto_campaigns enable row level security;
alter table mtproto_targets enable row level security;
alter table mtproto_auth_sessions enable row level security;
-- políticas por tenant (espelham o padrão existente em 007_admin_rls.sql)
```

## Config / env

Novas variáveis (`server/src/config.ts` + `.env`):
- `TELEGRAM_API_ID` — obtido em https://my.telegram.org (app do usuário)
- `TELEGRAM_API_HASH` — idem
- `MTPROTO_WORKER_ENABLED` — liga/desliga o worker no boot

`api_id` e `api_hash` são **globais do app**, não por conta. Compartilhados por todas as sessões.

## Dependências

- `telegram` (npm — pacote oficial do gramjs)
- `input` (helper do gramjs pra prompts; só usado em tooling offline se precisarmos)

## Testes

- `MtprotoClient`: testes unitários com mock da lib `telegram` (sendCode, signIn, sendMessage retornos e erros típicos).
- `AccountPool`: testes unitários — round-robin, skip de `flood_wait`, lazy-load.
- `CampaignRunner`: testes unitários com pool e client mockados — sucesso, FloodWait (target volta pra pending, conta sai do pool temporariamente), erro de ban.
- E2E manual do login + disparo em 1 conta real com 2-3 targets (eu não consigo fazer isso, user testa).

## Decisões arquiteturais tomadas autonomamente

Estas são decisões de implementação que o user pediu pra tomar sem confirmar:

- **gramjs** (pacote `telegram`) como lib MTProto. Alternativas: `telegraf` (só bot), `mtproto-core` (menos maduro). gramjs é o padrão JS.
- **Worker como processo separado** com entrypoint próprio (`server/src/workers/mtproto-worker.ts`), iniciado por script npm `worker:mtproto`. Não compartilha processo com HTTP do Next.
- **BullMQ** pra fila (já está no stack).
- **Polling de 3s** na UI, não Realtime.
- **Sem rate-limit por dia nem ramp-up** — só delay aleatório (user pediu opção A na pergunta 8).
- **`session_string` em plaintext** (user pediu opção A na pergunta 5).
- **Round-robin simples** no pool, não weighted.
- **Normalização de alvos** no momento da criação da campaign: detecta `@username` (começa com @ ou letras) vs `+telefone` (começa com + ou dígitos). Invalidos viram target com `status=failed` imediatamente e `error_message='invalid_identifier'`.

## Out of scope (reforço)

Nada de scraping, nada de add-to-group, nada de DM auto-reply, nada de integração com o flow engine atual. Tudo isso é fase 2.
