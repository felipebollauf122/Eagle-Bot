"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";

export async function getLeads(botId: string, page: number = 1, search: string = "") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const admin = await isAdmin();
  let botQuery = supabase.from("bots").select("id").eq("id", botId);
  if (!admin) botQuery = botQuery.eq("tenant_id", user.id);
  const { data: bot } = await botQuery.single();
  if (!bot) throw new Error("Bot not found");

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to fetch leads: ${error.message}`);

  return { leads: data ?? [], total: count ?? 0, page, pageSize };
}
