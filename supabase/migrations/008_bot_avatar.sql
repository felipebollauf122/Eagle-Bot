-- EagleBot: Bot profile avatar
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS avatar_url text;
