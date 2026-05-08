-- last_name do Telegram. O Telegram passa last_name no payload (opcional)
-- e o Meta CAPI aceita ln no user_data (hash SHA-256). Adicionar isso
-- aumenta cobertura/match quality do pixel.
alter table public.leads
  add column last_name text;
