-- Display name shown on the redirect landing page (/t)
-- Used so the user sees a friendly brand/bot name instead of the raw @username
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS redirect_display_name text;
