-- Permite criar transação sem flow_id (necessário pra pagamentos via
-- remarketing, onde o "flow" não está em `flows` mas em `remarketing_flows`).
alter table public.transactions
  alter column flow_id drop not null;
