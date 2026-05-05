import express from "express";
import { config } from "./config.js";
import { handleTelegramWebhook } from "./webhook/telegram.js";
import { handlePaymentWebhookGlobal, handlePaymentWebhook, handleEvPayWebhook } from "./webhook/payment.js";
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

// Parse JSON bodies (Telegram sends JSON webhooks).
// 'verify' guarda o buffer original em req.rawBody — necessário pra
// validar HMAC do webhook do Yvepay/EvPay (precisa do byte-stream cru).
app.use(
  express.json({
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "eaglebot-engine" });
});

// SigiloPay payment webhook — single global endpoint for the entire platform
app.post("/webhook/payment", handlePaymentWebhookGlobal);
// Legacy per-bot endpoint (kept for existing webhooks already registered at SigiloPay)
app.post("/webhook/payment/:botId", handlePaymentWebhook);
// EvPay payment webhook — global, valida HMAC com secret salvo por bot
app.post("/webhook/evpay", handleEvPayWebhook);

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

// Diagnóstico do webhook EvPay — lista os webhooks cadastrados no projeto
// pra você confirmar se o nosso URL realmente está lá.
app.get("/api/bots/:botId/evpay-webhook-status", async (req, res) => {
  try {
    const { botId } = req.params;
    const { data: bot } = await supabase
      .from("bots")
      .select("evpay_api_key, evpay_project_id, evpay_webhook_id, evpay_webhook_secret")
      .eq("id", botId)
      .single();
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
    const typedBot = bot as {
      evpay_api_key: string | null;
      evpay_project_id: string | null;
      evpay_webhook_id: string | null;
      evpay_webhook_secret: string | null;
    };
    if (!typedBot.evpay_api_key || !typedBot.evpay_project_id) {
      res.status(400).json({ error: "EvPay credentials missing" });
      return;
    }
    const { EvPay } = await import("./services/evpay.js");
    const evpay = new EvPay(typedBot.evpay_api_key, typedBot.evpay_project_id);
    const webhooks = await evpay.listWebhooks();
    const expectedUrl = `${config.baseWebhookUrl}/webhook/evpay`;
    const matching = webhooks.find((w) => w.url === expectedUrl);
    res.json({
      success: true,
      expectedUrl,
      hasSecret: !!typedBot.evpay_webhook_secret,
      savedWebhookId: typedBot.evpay_webhook_id,
      registeredAtYvepay: !!matching,
      matchingWebhook: matching ?? null,
      allWebhooks: webhooks,
    });
  } catch (error) {
    console.error("Failed to fetch EvPay webhook status:", error);
    const msg = error instanceof Error ? error.message : "unknown";
    res.status(500).json({ error: msg });
  }
});

// Setup EvPay webhook for a bot (called from dashboard when EvPay credentials are saved)
app.post("/api/bots/:botId/setup-evpay-webhook", async (req, res) => {
  try {
    const { botId } = req.params;

    const { data: bot } = await supabase
      .from("bots")
      .select("id, evpay_api_key, evpay_project_id, evpay_webhook_secret")
      .eq("id", botId)
      .single();
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const typedBot = bot as {
      id: string;
      evpay_api_key: string | null;
      evpay_project_id: string | null;
      evpay_webhook_secret: string | null;
    };

    if (!typedBot.evpay_api_key || !typedBot.evpay_project_id) {
      res.status(400).json({ error: "EvPay credentials missing" });
      return;
    }

    // Gera (ou reusa) o secret do webhook — mínimo 16 chars exigido pelo EvPay
    let secret = typedBot.evpay_webhook_secret;
    if (!secret || secret.length < 16) {
      const { randomBytes } = await import("crypto");
      secret = `whsec_${randomBytes(24).toString("hex")}`;
    }

    const { EvPay } = await import("./services/evpay.js");
    const evpay = new EvPay(typedBot.evpay_api_key, typedBot.evpay_project_id);
    const webhookUrl = `${config.baseWebhookUrl}/webhook/evpay`;

    const { webhookId } = await evpay.registerWebhook(webhookUrl, secret);

    await supabase
      .from("bots")
      .update({
        evpay_webhook_secret: secret,
        evpay_webhook_id: webhookId,
      })
      .eq("id", botId);

    botCache.invalidate(botId);
    res.json({ success: true, webhook_url: webhookUrl, webhook_id: webhookId });
  } catch (error) {
    console.error("Failed to setup EvPay webhook:", error);
    const msg = error instanceof Error ? error.message : "unknown";
    res.status(500).json({ error: `setup failed: ${msg}` });
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
