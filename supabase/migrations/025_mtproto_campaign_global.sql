-- Campanhas globais: cada conta MTProto do tenant dispara pra todos os
-- próprios contatos/DMs/grupos admin/canais owner. Quando is_global=true,
-- os targets já vêm com account_id pré-atribuído (a conta dona do dialog).
alter table public.mtproto_campaigns
  add column is_global boolean not null default false;
