-- Cor do botão de pagamento de cada produto (Bot API 8.x+).
-- Valores aceitos: 'danger' (vermelho), 'success' (verde), 'primary' (azul).
-- NULL = cor padrão do tema do cliente.
alter table public.products
  add column button_style text
    check (button_style in ('danger', 'success', 'primary'));
