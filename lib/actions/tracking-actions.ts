"use server";

import { createClient } from "@/lib/supabase/server";

export async function getTrackingEvents(botId: string, page: number = 1) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify bot belongs to this tenant
  const { data: bot } = await supabase.from("bots").select("id").eq("id", botId).eq("tenant_id", user.id).single();
  if (!bot) throw new Error("Bot not found");

  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  const { data, count, error } = await supabase
    .from("tracking_events")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to fetch tracking events: ${error.message}`);
  return { events: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getTrackingFunnel(botId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify bot belongs to this tenant
  const { data: bot } = await supabase.from("bots").select("id").eq("id", botId).eq("tenant_id", user.id).single();
  if (!bot) throw new Error("Bot not found");

  const eventTypes = ["page_view", "bot_start", "view_offer", "checkout", "purchase"] as const;
  const counts: Record<string, number> = {};

  for (const eventType of eventTypes) {
    const { count } = await supabase
      .from("tracking_events")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", botId)
      .eq("event_type", eventType);

    counts[eventType] = count ?? 0;
  }

  return counts;
}

export async function getTrackingLeads(botId: string, page: number = 1) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: bot } = await supabase.from("bots").select("id").eq("id", botId).eq("tenant_id", user.id).single();
  if (!bot) throw new Error("Bot not found");

  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  const { data, count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to fetch leads: ${error.message}`);
  return { leads: data ?? [], total: count ?? 0, page, pageSize };
}
