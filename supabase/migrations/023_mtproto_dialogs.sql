-- Dialogs (contatos, DMs, grupos, canais) da conta MTProto.
-- Sincronizados sob demanda pelo worker via messages.GetDialogs +
-- contacts.GetContacts. Permite criar campanhas selecionando alvos
-- do próprio Telegram em vez de colar lista manual.
create table mtproto_dialogs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mtproto_accounts(id) on delete cascade,
  peer_id text not null,             -- ID Telegram do peer (user_id / chat_id / channel_id)
  peer_type text not null            -- tipo do peer pra construir InputPeer no gramjs
    check (peer_type in ('user', 'chat', 'channel')),
  peer_access_hash text,             -- exigido pra channels e users; chat (grupo legacy) não usa
  kind text not null                 -- categoriza pro filtro de UI / risco
    check (kind in (
      'contact',                     -- está na agenda mas sem DM aberto
      'dm',                          -- DM aberto com user
      'group_member',                -- grupo onde só participa (RISCO ALTO)
      'group_admin',                 -- grupo onde é admin
      'channel_subscriber',          -- canal que assina (não consegue postar)
      'channel_owner',               -- canal que administra (broadcast)
      'bot',                         -- bot — não dispara
      'self'                         -- "Saved Messages" — não dispara
    )),
  title text,                        -- nome exibido
  username text,                     -- @username quando tiver
  is_bot boolean not null default false,
  last_synced_at timestamptz not null default now(),
  unique (account_id, peer_id, peer_type)
);

create index idx_mtproto_dialogs_account on mtproto_dialogs(account_id);
create index idx_mtproto_dialogs_account_kind on mtproto_dialogs(account_id, kind);

alter table mtproto_dialogs enable row level security;

create policy "tenant_own_mtproto_dialogs" on mtproto_dialogs
  for all
  using (account_id in (select id from mtproto_accounts where tenant_id = auth.uid()))
  with check (account_id in (select id from mtproto_accounts where tenant_id = auth.uid()));

-- targets pode apontar pra um dialog em vez de carregar identifier solto.
-- Quando dialog_id está setado, o runner resolve o peer direto da tabela.
alter table mtproto_targets
  add column dialog_id uuid references mtproto_dialogs(id) on delete set null;

create index idx_mtproto_targets_dialog on mtproto_targets(dialog_id);
