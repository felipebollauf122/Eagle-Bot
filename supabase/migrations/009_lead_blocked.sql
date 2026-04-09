ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS blocked boolean DEFAULT false;
