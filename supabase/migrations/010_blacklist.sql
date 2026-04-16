-- Blacklist: Telegram users that always receive the white (visual) flow
-- Only admins can manage this list. Per-bot blacklist.
CREATE TABLE IF NOT EXISTS public.blacklist_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL,
  username text,
  first_name text,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (bot_id, telegram_user_id)
);

-- RLS
ALTER TABLE public.blacklist_users ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_blacklist_all" ON public.blacklist_users
  FOR ALL USING (public.is_admin());

-- Bot owners can read their own blacklist (view only)
CREATE POLICY "owner_blacklist_select" ON public.blacklist_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = blacklist_users.bot_id
        AND bots.tenant_id = auth.uid()
    )
  );

-- Index for fast lookup during flow routing
CREATE INDEX IF NOT EXISTS idx_blacklist_bot_telegram
  ON public.blacklist_users (bot_id, telegram_user_id);
