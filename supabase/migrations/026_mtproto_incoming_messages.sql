-- Mensagens recebidas pelas contas MTProto (foco: Telegram oficial 777000)
-- Usado pra exibir códigos de login/alertas no dashboard do cliente quando
-- ele perde acesso ao Telegram mas mantém a conta conectada aqui.
-- Retenção: 7 dias (cleanup diário no server).

create table if not exists public.mtproto_incoming_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mtproto_accounts(id) on delete cascade,
  tg_message_id bigint not null,
  from_peer_id text not null,
  from_peer_name text,
  text text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_mtproto_incoming_msgs_unique
  on public.mtproto_incoming_messages(account_id, tg_message_id);

create index if not exists idx_mtproto_incoming_msgs_account_received
  on public.mtproto_incoming_messages(account_id, received_at desc);

alter table public.mtproto_incoming_messages enable row level security;

-- RLS: cliente só vê msgs das próprias contas
create policy "tenants read own incoming msgs"
  on public.mtproto_incoming_messages
  for select
  using (
    account_id in (
      select id from public.mtproto_accounts
      where tenant_id = auth.uid()
    )
  );
