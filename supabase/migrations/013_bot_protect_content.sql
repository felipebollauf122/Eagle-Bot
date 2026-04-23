-- EagleBot: Protect content flag per bot.
-- Quando ativado, todas as mensagens enviadas pelo bot usam protect_content=true
-- (Telegram impede encaminhar / copiar texto / salvar midia).

alter table public.bots
  add column if not exists protect_content boolean not null default true;
