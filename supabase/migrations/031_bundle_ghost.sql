-- Bundle ghost_name: usado no Facebook ViewContent (ViewOffer) quando o
-- lead vê o conjunto de produtos pela primeira vez, ANTES de selecionar
-- um produto específico. Mesma regra dos produtos: cliente vê o name real,
-- tudo que sai pra fora (FB CAPI) recebe o ghost.

alter table public.product_bundles
  add column if not exists ghost_name text;
