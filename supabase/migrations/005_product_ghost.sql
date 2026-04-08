-- EagleBot: Product ghost name for black flow

alter table public.products
  add column ghost_name text,
  add column ghost_description text;
