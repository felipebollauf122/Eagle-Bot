import type { SupabaseClient } from "@supabase/supabase-js";
import { TelegramApi } from "../telegram/api.js";
import { FlowProcessor } from "../engine/flow-processor.js";
import { LeadService } from "../services/lead-service.js";
import { SigiloPay } from "../services/sigilopay.js";
import { addDelayedJob } from "../queue.js";
import { config } from "../config.js";
import type { Flow } from "../engine/flow-processor.js";
import type { Lead } from "../engine/types.js";

interface RemarketingConfig {
  id: string;
  tenant_id: string;
  bot_id: string;
  is_active: boolean;
  interval_minutes: number;
}

interface RemarketingFlow {
  id: string;
  config_id: string;
  bot_id: string;
  name: string;
  sort_order: number;
  audience: "all" | "no_purchase" | "pending_payment";
  flow_data: Flow["flow_data"];
  is_active: boolean;
}

interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
  sigilopay_public_key: string | null;
  sigilopay_secret_key: string | null;
}

interface RemarketingProgress {
  id: string;
  lead_id: string;
  config_id: string;
  last_flow_order: number;
  last_sent_at: string | null;
  is_completed: boolean;
}

/**
 * Process remarketing for all active configs.
 * Called on interval from queue.ts.
 */
export async function processRemarketing(db: SupabaseClient): Promise<void> {
  // Get all active remarketing configs
  const { data: configs } = await db
    .from("remarketing_configs")
    .select("*")
    .eq("is_active", true);

  if (!configs || configs.length === 0) return;

  for (const rawConfig of configs) {
    const cfg = rawConfig as RemarketingConfig;
    try {
      await processConfig(db, cfg);
    } catch (error) {
      console.error(`[remarketing] Error processing config ${cfg.id}:`, error);
    }
  }
}

async function processConfig(db: SupabaseClient, cfg: RemarketingConfig): Promise<void> {
  // Get bot
  const { data: bot } = await db
    .from("bots")
    .select("id, tenant_id, telegram_token, sigilopay_public_key, sigilopay_secret_key")
    .eq("id", cfg.bot_id)
    .eq("is_active", true)
    .single();

  if (!bot) return;

  const typedBot = bot as Bot;

  // Get all active remarketing flows, ordered
  const { data: flows } = await db
    .from("remarketing_flows")
    .select("*")
    .eq("config_id", cfg.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!flows || flows.length === 0) return;

  const typedFlows = flows as RemarketingFlow[];

  // Get all leads for this bot (skip blocked ones)
  const { data: leads } = await db
    .from("leads")
    .select("*")
    .eq("bot_id", cfg.bot_id)
    .neq("blocked", true);

  if (!leads || leads.length === 0) return;

  const leadService = new LeadService(db);
  const telegram = new TelegramApi(typedBot.telegram_token);
  const sigiloPay = new SigiloPay(typedBot.sigilopay_public_key ?? "", typedBot.sigilopay_secret_key ?? "");
  const processor = new FlowProcessor(db, leadService, { addDelayedJob }, {
    sigiloPay,
    baseWebhookUrl: config.baseWebhookUrl,
  });

  const now = new Date();

  for (const lead of leads as Lead[]) {
    try {
      await processLeadRemarketing(db, cfg, typedFlows, lead, processor, telegram, now);
    } catch (error) {
      console.error(`[remarketing] Error for lead ${lead.id}:`, error);
    }
  }
}

async function processLeadRemarketing(
  db: SupabaseClient,
  cfg: RemarketingConfig,
  flows: RemarketingFlow[],
  lead: Lead,
  processor: FlowProcessor,
  telegram: TelegramApi,
  now: Date,
): Promise<void> {
  // Get or create progress for this lead
  let { data: progress } = await db
    .from("remarketing_progress")
    .select("*")
    .eq("config_id", cfg.id)
    .eq("lead_id", lead.id)
    .maybeSingle();

  if (!progress) {
    const { data: created } = await db
      .from("remarketing_progress")
      .insert({
        bot_id: cfg.bot_id,
        lead_id: lead.id,
        config_id: cfg.id,
        last_flow_order: -1,
        last_sent_at: null,
        is_completed: false,
      })
      .select("*")
      .single();

    if (!created) return;
    progress = created;
  }

  const typedProgress = progress as RemarketingProgress;

  // Check interval — enough time passed since last send?
  if (typedProgress.last_sent_at) {
    const lastSent = new Date(typedProgress.last_sent_at);
    const elapsedMs = now.getTime() - lastSent.getTime();
    const intervalMs = cfg.interval_minutes * 60 * 1000;
    if (elapsedMs < intervalMs) return;
  }

  // Find next flow in sequence
  let nextFlow = flows.find((f) => f.sort_order > typedProgress.last_flow_order);

  if (!nextFlow) {
    // All flows sent — loop back to the first flow
    await db
      .from("remarketing_progress")
      .update({ last_flow_order: -1, is_completed: false })
      .eq("id", typedProgress.id);

    nextFlow = flows.find((f) => f.sort_order > -1);
    if (!nextFlow) return;
  }

  // Check audience filter
  const shouldSend = await checkAudience(db, nextFlow.audience, lead, cfg.bot_id);
  if (!shouldSend) {
    // Skip this flow, advance to the next one
    await db
      .from("remarketing_progress")
      .update({
        last_flow_order: nextFlow.sort_order,
        last_sent_at: now.toISOString(),
      })
      .eq("id", typedProgress.id);
    return;
  }

  // Execute the remarketing flow
  console.log(`[remarketing] Sending flow "${nextFlow.name}" to lead ${lead.id}`);

  const flowForProcessor: Flow = {
    id: nextFlow.id,
    tenant_id: cfg.tenant_id,
    bot_id: cfg.bot_id,
    name: nextFlow.name,
    trigger_type: "remarketing",
    trigger_value: "",
    flow_data: nextFlow.flow_data,
    is_active: true,
    version: 1,
    created_at: "",
    updated_at: "",
  };

  const flowResult = await processor.executeFlow(flowForProcessor, lead, telegram, lead.telegram_user_id);

  // If user blocked the bot, mark lead so we skip them in future remarketing
  if (flowResult.blocked) {
    console.log(`[remarketing] Lead ${lead.id} blocked the bot, marking as blocked`);
    await db.from("leads").update({ blocked: true }).eq("id", lead.id);
    return;
  }

  // Update progress
  await db
    .from("remarketing_progress")
    .update({
      last_flow_order: nextFlow.sort_order,
      last_sent_at: now.toISOString(),
    })
    .eq("id", typedProgress.id);
}

/**
 * Check if a lead matches the audience filter for a remarketing flow.
 */
async function checkAudience(
  db: SupabaseClient,
  audience: string,
  lead: Lead,
  botId: string,
): Promise<boolean> {
  if (audience === "all") return true;

  if (audience === "no_purchase") {
    // Has no approved transactions
    const { count } = await db
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("bot_id", botId)
      .eq("status", "approved");

    return (count ?? 0) === 0;
  }

  if (audience === "pending_payment") {
    // Has a pending transaction (generated pix but didn't pay)
    const { count } = await db
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("bot_id", botId)
      .eq("status", "pending");

    return (count ?? 0) > 0;
  }

  return true;
}
