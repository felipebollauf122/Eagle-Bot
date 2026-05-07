-- Identidade de lead unificada por tenant.
-- Permite que o mesmo telegram_user_id, ao circular entre múltiplos bots
-- do mesmo vendedor (tenant), mantenha a atribuição de campanha
-- (tid, fbclid, UTMs) que ele teve na primeira vez que clicou num
-- anúncio. Bots de tenants diferentes ficam isolados — mesmo lead
-- entrando no bot do vendedor A e no bot do vendedor B vai ter
-- registros separados, com atribuições independentes (como deve ser).
create table public.tenant_lead_identity (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  telegram_user_id bigint not null,
  tid text,
  fbclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  first_bot_id uuid references public.bots(id) on delete set null,
  last_bot_id uuid references public.bots(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  primary key (tenant_id, telegram_user_id)
);

create index idx_tenant_lead_identity_tid on public.tenant_lead_identity(tid);

alter table public.tenant_lead_identity enable row level security;
create policy "tenant_owns_identity"
  on public.tenant_lead_identity
  for all
  using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid());
