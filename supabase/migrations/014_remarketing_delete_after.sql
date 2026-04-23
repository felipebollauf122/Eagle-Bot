-- EagleBot: auto-delete remarketing messages after N minutes.
-- null = nao deleta (comportamento atual).

alter table public.remarketing_flows
  add column if not exists delete_after_minutes integer;
