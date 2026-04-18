import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";
import { supabase } from "./db.js";
import { TelegramApi } from "./telegram/api.js";
import { FlowProcessor } from "./engine/flow-processor.js";
import { LeadService } from "./services/lead-service.js";
import { SigiloPay } from "./services/sigilopay.js";
import { ensureBotPaymentKeys } from "./services/bot-loader.js";
import { botCache, flowByIdCache } from "./cache.js";

import type { Flow } from "./engine/flow-processor.js";
import { processRemarketing } from "./workers/remarketing-worker.js";

interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
  sigilopay_public_key: string | null;
  sigilopay_secret_key: string | null;
}

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

interface DelayedJobData {
  leadId: string;
  flowId: string;
  nodeId: string;
  botId: string;
  tenantId: string;
  chatId: number;
}

export const delayedQueue = new Queue<DelayedJobData>("delayed-messages", {
  connection,
});

export async function addDelayedJob(data: DelayedJobData, delaySeconds: number): Promise<void> {
  await delayedQueue.add("resume-flow", data, {
    delay: delaySeconds * 1000,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

// Payment timeout: fires "not_paid" edge if payment wasn't confirmed in time
interface PaymentTimeoutData {
  leadId: string;
  flowId: string;
  paymentNodeId: string;
  externalTransactionId: string;
  botId: string;
  tenantId: string;
  chatId: number;
}

export const paymentTimeoutQueue = new Queue<PaymentTimeoutData>("payment-timeout", {
  connection,
});

export async function addPaymentTimeoutJob(data: PaymentTimeoutData, delaySeconds: number): Promise<void> {
  await paymentTimeoutQueue.add("check-payment", data, {
    delay: delaySeconds * 1000,
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  });
}

/**
 * Process pending message deletions from the message_delete_queue.
 * Called on interval — picks up messages where delete_at has passed.
 */
async function processMessageDeletions(): Promise<void> {
  const now = new Date().toISOString();

  const { data: messages, error } = await supabase
    .from("message_delete_queue")
    .select("*")
    .eq("status", "pending")
    .lte("delete_at", now)
    .limit(50);

  if (error || !messages || messages.length === 0) return;

  console.log(`[black-delete] Processing ${messages.length} pending deletions`);

  for (const msg of messages) {
    const telegram = new TelegramApi(msg.bot_token);
    const success = await telegram.deleteMessage(msg.chat_id, msg.message_id);

    if (success) {
      await supabase
        .from("message_delete_queue")
        .update({ status: "deleted" })
        .eq("id", msg.id);
    } else {
      await supabase
        .from("message_delete_queue")
        .update({
          status: "failed",
          error_message: "Failed to delete message via Telegram API",
        })
        .eq("id", msg.id);
    }
  }
}

export function startWorkers(): void {
  const leadService = new LeadService(supabase);

  // Delayed message worker (for delay nodes in flows)
  new Worker<DelayedJobData>(
    "delayed-messages",
    async (job: Job<DelayedJobData>) => {
      const { leadId, flowId, nodeId, botId, chatId } = job.data;

      // Check cache first, then DB
      let bot = botCache.get(botId) as Bot | undefined;
      if (!bot) {
        const { data } = await supabase.from("bots").select("*").eq("id", botId).single();
        if (!data) { console.error(`Bot not found: ${botId}`); return; }
        bot = data as Bot;
        botCache.set(botId, data);
      }

      let flow = flowByIdCache.get(flowId) as unknown as Flow | undefined;
      if (!flow) {
        const { data } = await supabase.from("flows").select("*").eq("id", flowId).single();
        if (!data) { console.error(`Flow not found: ${flowId}`); return; }
        flow = data as Flow;
        flowByIdCache.set(flowId, data);
      }

      const lead = await leadService.getById(leadId);
      if (!lead) {
        console.error(`Lead not found: ${leadId}`);
        return;
      }

      const freshBot = await ensureBotPaymentKeys(botId, bot);
      const telegram = new TelegramApi(freshBot.telegram_token);
      const sigiloPay = new SigiloPay(freshBot.sigilopay_public_key ?? "", freshBot.sigilopay_secret_key ?? "");
      const processor = new FlowProcessor(
        supabase,
        leadService,
        { addDelayedJob },
        { sigiloPay, baseWebhookUrl: config.baseWebhookUrl },
      );

      const isBlack = lead.active_flow_name === "_black_flow";
      await processor.executeFlow(flow as Flow, lead, telegram, chatId, nodeId, isBlack);
    },
    {
      connection,
      concurrency: 10,
      limiter: { max: 30, duration: 1000 },
    },
  );

  // Payment timeout worker — fires "not_paid" edge if payment wasn't confirmed
  new Worker<PaymentTimeoutData>(
    "payment-timeout",
    async (job: Job<PaymentTimeoutData>) => {
      const { leadId, flowId, paymentNodeId, externalTransactionId, botId, chatId } = job.data;

      // Check if payment was already approved
      const { data: tx } = await supabase
        .from("transactions")
        .select("status")
        .eq("external_id", externalTransactionId)
        .single();

      if (tx?.status === "approved") {
        console.log(`[payment-timeout] Payment ${externalTransactionId} already approved, skipping timeout`);
        return;
      }

      console.log(`[payment-timeout] Payment ${externalTransactionId} not paid — executing not_paid edge`);

      let bot = botCache.get(botId) as Bot | undefined;
      if (!bot) {
        const { data } = await supabase.from("bots").select("*").eq("id", botId).single();
        if (!data) return;
        bot = data as Bot;
        botCache.set(botId, data);
      }

      let flow = flowByIdCache.get(flowId) as unknown as Flow | undefined;
      if (!flow) {
        const { data } = await supabase.from("flows").select("*").eq("id", flowId).single();
        if (!data) return;
        flow = data as Flow;
        flowByIdCache.set(flowId, data);
      }

      const lead = await leadService.getById(leadId);
      if (!lead) return;

      // Find the "not_paid" edge from the payment node
      const notPaidEdge = flow.flow_data.edges.find(
        (e) => e.source === paymentNodeId && e.sourceHandle === "not_paid",
      );

      if (!notPaidEdge) {
        console.log(`[payment-timeout] No not_paid edge found for node ${paymentNodeId}`);
        return;
      }

      const freshBot = await ensureBotPaymentKeys(botId, bot as Bot);
      const telegram = new TelegramApi(freshBot.telegram_token);
      const sigiloPay = new SigiloPay(freshBot.sigilopay_public_key ?? "", freshBot.sigilopay_secret_key ?? "");
      const processor = new FlowProcessor(
        supabase,
        leadService,
        { addDelayedJob },
        { sigiloPay, baseWebhookUrl: config.baseWebhookUrl },
      );

      const isBlack = lead.active_flow_name === "_black_flow";
      await processor.executeFlow(flow, lead, telegram, chatId, notPaidEdge.target, isBlack);
    },
    {
      connection,
      concurrency: 10,
    },
  );

  // Black flow message deletion — poll every 30 seconds
  setInterval(() => {
    processMessageDeletions().catch((err) =>
      console.error("[black-delete] Error:", err)
    );
  }, 30_000);

  // Run once at startup to catch any overdue deletions
  processMessageDeletions().catch((err) =>
    console.error("[black-delete] Startup error:", err)
  );

  // Remarketing worker — poll every 60 seconds
  setInterval(() => {
    processRemarketing(supabase).catch((err) =>
      console.error("[remarketing] Error:", err)
    );
  }, 60_000);

  console.log("BullMQ workers + black deletion + remarketing started");
}
