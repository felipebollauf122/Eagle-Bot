-- Trava de execução: garante que apenas 1 runner processe uma campanha por
-- vez. Workers usam CAS: try `update set is_processing=true where id=? and
-- is_processing=false`. Se rowcount=0, outro worker já tá processando.
-- Ao terminar, set is_processing=false. Se o worker crashar, um TTL via
-- processing_started_at é checado no início (>30min stale = força reset).

alter table public.mtproto_campaigns
  add column if not exists is_processing boolean not null default false,
  add column if not exists processing_started_at timestamptz;

create index if not exists idx_mtproto_campaigns_processing
  on public.mtproto_campaigns(is_processing)
  where is_processing = true;
