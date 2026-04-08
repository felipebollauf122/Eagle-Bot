-- EagleBot Phase 1: Full Database Schema

create extension if not exists "pgcrypto";

-- TENANTS
create table public.tenants (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  plan text,
  created_at timestamptz not null default now()
);
alter table public.tenants enable row level security;
create policy "Tenants can view own data" on public.tenants for select using (id = auth.uid());
create policy "Tenants can update own data" on public.tenants for update using (id = auth.uid());

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

-- BOTS
create table public.bots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  telegram_token text not null,
  bot_username text not null,
  webhook_url text default '',
  is_active boolean not null default false,
  facebook_pixel_id text,
  facebook_access_token text,
  utmify_api_key text,
  sigilopay_public_key text,
  sigilopay_secret_key text,
  tracking_mode text not null default 'redirect' check (tracking_mode in ('redirect', 'prelander')),
  prelander_headline text,
  prelander_description text,
  prelander_image_url text,
  prelander_cta_text text,
  created_at timestamptz not null default now()
);
alter table public.bots enable row level security;
create policy "Tenants can manage own bots" on public.bots for all using (tenant_id = auth.uid());

-- PRODUCTS
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
create policy "Tenants can manage own products" on public.products for all using (tenant_id = auth.uid());

-- PRODUCT BUNDLES (conjuntos)
create table public.product_bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null,
  description text not null default '',
  message_text text not null default 'Escolha um produto para comprar:',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.product_bundles enable row level security;
create policy "Tenants can manage own bundles" on public.product_bundles for all using (tenant_id = auth.uid());

-- BUNDLE ITEMS
create table public.product_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.product_bundles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(bundle_id, product_id)
);
alter table public.product_bundle_items enable row level security;
create policy "Tenants can manage bundle items" on public.product_bundle_items for all using (
  exists (select 1 from public.product_bundles pb where pb.id = bundle_id and pb.tenant_id = auth.uid())
);

-- FLOWS
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
create policy "Tenants can manage own flows" on public.flows for all using (tenant_id = auth.uid());
create index idx_flows_bot_trigger on public.flows (bot_id, trigger_type, is_active);

-- LEADS
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
create policy "Tenants can manage own leads" on public.leads for all using (tenant_id = auth.uid());
create unique index idx_leads_bot_telegram on public.leads (tenant_id, bot_id, telegram_user_id);
create index idx_leads_tid on public.leads (tid);

-- TRANSACTIONS
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
create policy "Tenants can manage own transactions" on public.transactions for all using (tenant_id = auth.uid());
create index idx_transactions_status on public.transactions (tenant_id, status, created_at);

-- TRACKING EVENTS
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
create policy "Tenants can manage own tracking events" on public.tracking_events for all using (tenant_id = auth.uid());
create index idx_tracking_events_bot_date on public.tracking_events (tenant_id, bot_id, created_at);

-- updated_at trigger
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
