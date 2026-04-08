"use server";

/**
 * Invalidate the bot engine's in-memory cache when bot settings or flows change.
 * Fire-and-forget: doesn't throw on failure (cache will expire naturally via TTL).
 */
export async function invalidateBotCache(botId: string): Promise<void> {
  const serverUrl = process.env.NEXT_PUBLIC_BOT_SERVER_URL ?? "http://localhost:3001";
  try {
    await fetch(`${serverUrl}/api/bots/${botId}/invalidate-cache`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Silent fail — cache TTL will expire naturally
  }
}
