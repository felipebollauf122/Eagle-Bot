"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions/admin-actions";
import type { BlacklistUser } from "@/lib/types/database";

export async function getBlacklist(botId: string): Promise<BlacklistUser[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blacklist_users")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch blacklist: ${error.message}`);
  return (data ?? []) as BlacklistUser[];
}

export async function addToBlacklist(
  botId: string,
  telegramUserId: number,
  username: string | null,
  firstName: string | null,
  note?: string,
): Promise<BlacklistUser> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blacklist_users")
    .upsert(
      {
        bot_id: botId,
        telegram_user_id: telegramUserId,
        username,
        first_name: firstName,
        note: note || null,
      },
      { onConflict: "bot_id,telegram_user_id" },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to add to blacklist: ${error.message}`);
  return data as BlacklistUser;
}

export async function removeFromBlacklist(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("blacklist_users")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to remove from blacklist: ${error.message}`);
}
