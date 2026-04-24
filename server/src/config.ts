import { strict as assert } from "node:assert";

function env(key: string): string {
  const value = process.env[key];
  assert(value, `Missing environment variable: ${key}`);
  return value;
}

function envOptional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(envOptional("PORT", "3001"), 10),
  supabaseUrl: env("SUPABASE_URL"),
  supabaseServiceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  redisUrl: envOptional("REDIS_URL", "redis://localhost:6379"),
  baseWebhookUrl: env("BASE_WEBHOOK_URL"), // e.g. https://your-domain.com
  telegramApiId: parseInt(envOptional("TELEGRAM_API_ID", "0"), 10),
  telegramApiHash: envOptional("TELEGRAM_API_HASH", ""),
  mtprotoWorkerEnabled: envOptional("MTPROTO_WORKER_ENABLED", "true") === "true",
} as const;
