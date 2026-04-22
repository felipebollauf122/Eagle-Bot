-- Indexes pra acelerar queries quentes do hot path do webhook / black flow.
-- Antes dessas adições o resolveFlowName levava ~3.8s no tracking_events lookup.

-- tracking_events: filtro por tid + event_type, ordena por created_at desc
create index if not exists idx_tracking_events_tid_type_date
  on public.tracking_events (tid, event_type, created_at desc);

-- blacklist_users: filtro por bot_id + telegram_user_id (consulta em todo /start)
create index if not exists idx_blacklist_bot_user
  on public.blacklist_users (bot_id, telegram_user_id);

-- bots: consulta por webhook token em cada webhook recebido
-- (pk já indexa id; este index ajuda lookups por token caso existam)
create index if not exists idx_bots_telegram_token
  on public.bots (telegram_token);
