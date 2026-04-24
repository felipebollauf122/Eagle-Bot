import express from "express";
import { config } from "./config.js";
import { handleTelegramWebhook } from "./webhook/telegram.js";
import { handlePaymentWebhookGlobal, handlePaymentWebhook } from "./webhook/payment.js";
import { startWorkers } from "./queue.js";
import { startMtprotoWorker } from "./workers/mtproto-worker.js";
import { enqueueMtproto, type MtprotoJobData } from "./queue-mtproto.js";
import { supabase } from "./db.js";
import { TelegramApi } from "./telegram/api.js";
import { botCache, flowCache, flowByIdCache } from "./cache.js";

interface Bot {
  id: string;
  tenant_id: string;
  telegram_token: string;
}

const app = express();

// ngrok free tier requires this header to skip browser warning page
app.use((_req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

// CORS — allow dashboard (Next.js) to call the API
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// Parse JSON bodies (Telegram sends JSON webhooks)
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "eaglebot-engine" });
});

// SigiloPay payment webhook — single global endpoint for the entire platform
app.post("/webhook/payment", handlePaymentWebhookGlobal);
// Legacy per-bot endpoint (kept for existing webhooks already registered at SigiloPay)
app.post("/webhook/payment/:botId", handlePaymentWebhook);

// Telegram webhook endpoint
app.post("/webhook/:botId", handleTelegramWebhook);

// Register webhook for a bot (called from dashboard when bot is activated)
app.post("/api/bots/:botId/register-webhook", async (req, res) => {
  try {
    const { botId } = req.params;

    const { data: bot } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single();

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const typedBot = bot as Bot;
    const webhookUrl = `${config.baseWebhookUrl}/webhook/${botId}`;
    const telegram = new TelegramApi(typedBot.telegram_token);
    await telegram.setWebhook(webhookUrl);

    // Update webhook_url in database
    await supabase
      .from("bots")
      .update({ webhook_url: webhookUrl, is_active: true })
      .eq("id", botId);

    botCache.invalidate(botId);
    res.json({ success: true, webhook_url: webhookUrl });
  } catch (error) {
    console.error("Failed to register webhook:", error);
    res.status(500).json({ error: "Failed to register webhook" });
  }
});

// MTProto job enqueue — called from dashboard server actions
app.post("/api/mtproto/enqueue", async (req, res) => {
  try {
    const job = req.body as MtprotoJobData;
    if (!job?.kind) {
      res.status(400).json({ error: "invalid job" });
      return;
    }
    await enqueueMtproto(job);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to enqueue mtproto job:", error);
    res.status(500).json({ error: "enqueue failed" });
  }
});

// Cache invalidation — called from dashboard when bot settings or flows are saved
app.post("/api/bots/:botId/invalidate-cache", (_req, res) => {
  const { botId } = _req.params;
  botCache.invalidate(botId);
  flowCache.invalidate(botId);
  console.log(`[cache] Invalidated cache for bot ${botId}`);
  res.json({ success: true });
});

// Deactivate bot (remove webhook)
app.post("/api/bots/:botId/deactivate", async (req, res) => {
  try {
    const { botId } = req.params;

    const { data: bot } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single();

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const typedBot = bot as Bot;
    const telegram = new TelegramApi(typedBot.telegram_token);
    await telegram.deleteWebhook();

    await supabase
      .from("bots")
      .update({ webhook_url: null, is_active: false })
      .eq("id", botId);

    botCache.invalidate(botId);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to deactivate bot:", error);
    res.status(500).json({ error: "Failed to deactivate bot" });
  }
});

// Start server
app.listen(config.port, () => {
  console.log(`EagleBot Engine running on port ${config.port}`);
  startWorkers();
  startMtprotoWorker();
});

export { app };
