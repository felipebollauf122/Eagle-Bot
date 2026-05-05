-- Toggle por bot: pedir e-mail do cliente após pagamento.
-- Quando false (padrão), o bot dispara Purchase + libera produto imediatamente.
-- Quando true, o bot pede e-mail no Telegram e só dispara Purchase
-- quando o cliente responder (ou após 2h via timeout).
alter table public.bots
  add column collect_email_after_payment boolean not null default false;
