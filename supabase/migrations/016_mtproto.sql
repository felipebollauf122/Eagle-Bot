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
