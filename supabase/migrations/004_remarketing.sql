-- EagleBot: Remarketing system

-- Remarketing configuration per bot
create table public.remarketing_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  is_active boolean not null default false,
  interval_minutes integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bot_id)
);
alter table public.remarketing_configs enable row level security;
create policy "Tenants can manage own remarketing configs" on public.remarketing_configs for all using (tenant_id = auth.uid());

-- Individual remarketing flows (sequence steps)
create table public.remarketing_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  config_id uuid not null references public.remarketing_configs(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  audience text not null default 'all' check (audience in ('all', 'no_purchase', 'pending_payment')),
  flow_data jsonb not null default '{"nodes": [], "edges": []}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.remarketing_flows enable row level security;
create policy "Tenants can manage own remarketing flows" on public.remarketing_flows for all using (tenant_id = auth.uid());
create index idx_remarketing_flows_config on public.remarketing_flows (config_id, sort_order);

-- Track remarketing progress per lead
create table public.remarketing_progress (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  config_id uuid not null references public.remarketing_configs(id) on delete cascade,
  last_flow_order integer not null default -1,
  last_sent_at timestamptz,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(config_id, lead_id)
);
alter table public.remarketing_progress enable row level security;
create policy "Tenants can view own remarketing progress" on public.remarketing_progress for select using (
  exists (select 1 from public.bots b where b.id = bot_id and b.tenant_id = auth.uid())
);
create index idx_remarketing_progress_pending on public.remarketing_progress (config_id, is_completed, last_sent_at)
  where is_completed = false;

-- updated_at triggers
create trigger set_updated_at before update on public.remarketing_configs
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.remarketing_flows
  for each row execute function public.update_updated_at();
