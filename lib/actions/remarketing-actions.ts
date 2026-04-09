"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/actions/admin-actions";
import type { FlowData, RemarketingAudience } from "@/lib/types/database";

async function verifyBot(botId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let query = supabase.from("bots").select("id, tenant_id").eq("id", botId);
  if (!admin) query = query.eq("tenant_id", user.id);

  const { data: bot } = await query.single();
  if (!bot) throw new Error("Bot not found");
  return { supabase, userId: user.id, tenantId: bot.tenant_id, admin };
}

/** Get or create the remarketing config for a bot */
export async function getOrCreateConfig(botId: string) {
  const { supabase, tenantId } = await verifyBot(botId);

  const { data: existing } = await supabase
    .from("remarketing_configs")
    .select("*")
    .eq("bot_id", botId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("remarketing_configs")
    .insert({
      tenant_id: tenantId,
      bot_id: botId,
      is_active: false,
      interval_minutes: 30,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create config: ${error.message}`);
  return created;
}

/** Update remarketing config (interval, active) */
export async function updateConfig(
  configId: string,
  updates: { is_active?: boolean; interval_minutes?: number },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let query = supabase.from("remarketing_configs").update(updates).eq("id", configId);
  if (!admin) query = query.eq("tenant_id", user.id);

  const { error } = await query;
  if (error) throw new Error(`Failed to update config: ${error.message}`);
  return { success: true };
}

/** List all remarketing flows for a config, ordered */
export async function listFlows(configId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let query = supabase.from("remarketing_flows").select("*").eq("config_id", configId);
  if (!admin) query = query.eq("tenant_id", user.id);
  query = query.order("sort_order", { ascending: true });

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list flows: ${error.message}`);
  return data ?? [];
}

/** Create a new remarketing flow */
export async function createRemarketingFlow(
  botId: string,
  configId: string,
  name: string,
  audience: RemarketingAudience,
  sortOrder: number,
) {
  const { supabase, tenantId } = await verifyBot(botId);

  const defaultFlowData: FlowData = {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        data: { trigger: "remarketing" },
        position: { x: 250, y: 50 },
      },
    ],
    edges: [],
  };

  const { data: flow, error } = await supabase
    .from("remarketing_flows")
    .insert({
      tenant_id: tenantId,
      config_id: configId,
      bot_id: botId,
      name,
      sort_order: sortOrder,
      audience,
      flow_data: defaultFlowData,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create flow: ${error.message}`);

  redirect(`/dashboard/bots/${botId}/remarketing/${flow.id}/editor`);
}

/** Update remarketing flow metadata */
export async function updateRemarketingFlow(
  flowId: string,
  updates: { name?: string; audience?: RemarketingAudience; sort_order?: number; is_active?: boolean },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let query = supabase.from("remarketing_flows").update(updates).eq("id", flowId);
  if (!admin) query = query.eq("tenant_id", user.id);

  const { error } = await query;
  if (error) throw new Error(`Failed to update flow: ${error.message}`);
  return { success: true };
}

/** Save remarketing flow data (nodes/edges) */
export async function saveRemarketingFlowData(flowId: string, flowData: FlowData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let query = supabase.from("remarketing_flows").update({ flow_data: flowData }).eq("id", flowId);
  if (!admin) query = query.eq("tenant_id", user.id);

  const { error } = await query;
  if (error) throw new Error(`Failed to save flow data: ${error.message}`);
  return { success: true };
}

/** Delete a remarketing flow */
export async function deleteRemarketingFlow(flowId: string, botId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let query = supabase.from("remarketing_flows").delete().eq("id", flowId);
  if (!admin) query = query.eq("tenant_id", user.id);

  const { error } = await query;
  if (error) throw new Error(`Failed to delete flow: ${error.message}`);

  redirect(`/dashboard/bots/${botId}/remarketing`);
}

/** Reorder remarketing flows */
export async function reorderFlows(flowOrders: { id: string; sort_order: number }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  for (const item of flowOrders) {
    let query = supabase.from("remarketing_flows").update({ sort_order: item.sort_order }).eq("id", item.id);
    if (!admin) query = query.eq("tenant_id", user.id);
    await query;
  }

  return { success: true };
}
