-- Campanhas MTProto recorrentes.
-- Quando recurrence_hours está setado, a campanha vira um loop:
-- ao terminar (status='completed'), o poller reseta os targets de 'sent'
-- pra 'pending' e enfileira de novo. Mínimo 6h entre execuções (anti-ban).
alter table public.mtproto_campaigns
  add column recurrence_hours int
    check (recurrence_hours is null or recurrence_hours >= 6),
  add column last_run_at timestamptz,
  add column next_run_at timestamptz;

create index idx_mtproto_campaigns_next_run
  on public.mtproto_campaigns(next_run_at)
  where recurrence_hours is not null;
