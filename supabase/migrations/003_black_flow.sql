-- EagleBot: Flow Black support

-- Flag to enable black flow on a bot
alter table public.bots
  add column black_enabled boolean not null default false;

-- Track which named flow the lead is currently in (_visual_flow or _black_flow)
alter table public.leads
  add column active_flow_name text;

-- Queue for auto-deleting black flow messages after 30 minutes
create table public.message_delete_queue (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  bot_token text not null,
  chat_id bigint not null,
  message_id bigint not null,
  delete_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'deleted', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.message_delete_queue enable row level security;
create policy "Tenants can view own delete queue" on public.message_delete_queue for select using (
  exists (select 1 from public.bots b where b.id = bot_id and b.tenant_id = auth.uid())
);

-- Index for the worker: find pending messages that are due for deletion
create index idx_message_delete_queue_pending
  on public.message_delete_queue (status, delete_at)
  where status = 'pending';
