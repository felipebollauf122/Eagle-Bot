-- Bots que servem como "front-end" pra login de contas MTProto pelo Telegram.
-- Quando is_mtproto_login_bot=true, o webhook do bot ignora o flow processor
-- e roda uma máquina de estado dedicada: pede número, código, senha 2FA.
-- A conta logada fica vinculada ao tenant dono do bot (não cria novo tenant).

alter table public.bots
  add column if not exists is_mtproto_login_bot boolean not null default false;

-- Sessões de login em andamento (uma por chat_id de bot).
-- Estados: awaiting_phone, awaiting_code, awaiting_password, done, error
create table if not exists public.mtproto_login_sessions (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  tenant_id uuid not null,
  chat_id bigint not null,
  telegram_user_id bigint not null,
  state text not null default 'awaiting_phone'
    check (state in ('awaiting_phone','awaiting_code','awaiting_password','done','error')),
  phone_number text,
  code_buffer text default '',
  account_id uuid references public.mtproto_accounts(id) on delete set null,
  last_error text,
  numpad_message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_mtproto_login_sessions_bot_chat
  on public.mtproto_login_sessions(bot_id, chat_id);

-- Rastreio: quando uma conta foi criada via um bot de login, guarda referência
alter table public.mtproto_accounts
  add column if not exists created_via_bot_id uuid references public.bots(id) on delete set null,
  add column if not exists created_for_telegram_user_id bigint;
