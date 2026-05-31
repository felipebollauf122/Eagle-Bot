-- Monitoramento automático de canais MTProto.
-- Quando um canal vinculado a uma conta cai (canal banido OU conta frizada),
-- outro account ativo do tenant cria um canal substituto, populando com
-- template configurado (nome, descrição, mídias, mensagem de boas-vindas).

-- Template global por tenant: 1 set de mídias + textos reusado.
create table if not exists public.channel_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null default '',
  -- O que o canal novo vai chamar (ex: "Vazados HOT 🔥 V2")
  new_channel_title text not null,
  new_channel_about text default '',
  -- Foto de perfil do canal (URL pública ou Supabase Storage path)
  new_channel_photo_url text,
  -- Texto da primeira mensagem postada (HTML do Telegram)
  welcome_text text default '',
  -- Lista de URLs de mídias (Supabase Storage signed URLs ou URLs públicas).
  -- Cada item: { url, kind: 'photo'|'video', caption? }
  media_items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.channel_templates enable row level security;
create policy "owner manages own channel_templates" on public.channel_templates
  for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- Canais monitorados: liga (conta MTProto, peer do canal) a um template.
create table if not exists public.channel_monitors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  account_id uuid not null references public.mtproto_accounts(id) on delete cascade,
  template_id uuid not null references public.channel_templates(id) on delete cascade,
  -- Identidade do canal monitorado
  peer_channel_id text not null,
  peer_access_hash text,
  channel_title text,
  channel_username text,
  status text not null default 'active'
    check (status in ('active','paused','replaced','dead')),
  -- Última vez que o health check rodou
  last_checked_at timestamptz,
  last_check_error text,
  -- Quando detectamos morte do canal/conta
  detected_dead_at timestamptz,
  -- Resultado da substituição (se rolou)
  replacement_channel_id text,
  replacement_account_id uuid references public.mtproto_accounts(id) on delete set null,
  replacement_invite_link text,
  replaced_at timestamptz,
  replacement_error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_channel_monitors_tenant on public.channel_monitors(tenant_id);
create index if not exists idx_channel_monitors_active on public.channel_monitors(status) where status = 'active';
create unique index if not exists idx_channel_monitors_unique on public.channel_monitors(account_id, peer_channel_id);

alter table public.channel_monitors enable row level security;
create policy "owner manages own channel_monitors" on public.channel_monitors
  for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
