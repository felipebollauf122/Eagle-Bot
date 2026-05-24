-- Corrige owner: era felipe_t_maciel@estudante.sesisenai.org.br, agora é
-- nozzicroche@gmail.com. Idempotente — pode rodar várias vezes sem efeito
-- colateral. Funciona mesmo se a 028 ainda não tiver sido aplicada (a
-- coluna is_owner é garantida via `add column if not exists`).

alter table public.tenants
  add column if not exists is_owner boolean not null default false;

-- O unique index não permite 2 owners ao mesmo tempo, então temos que:
-- 1) tirar o owner antigo
-- 2) marcar o novo
-- Ordem importa, senão o index reclama.

update public.tenants
   set is_owner = false
 where email = 'felipe_t_maciel@estudante.sesisenai.org.br'
   and is_owner = true;

update public.tenants
   set is_owner = true
 where email = 'nozzicroche@gmail.com';
