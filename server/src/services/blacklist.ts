import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifica se um telegram_user_id está na blacklist do bot.
 * Blacklisted users não devem receber NENHUM fluxo (nem visual, nem black,
 * nem remarketing, nem mensagens pós-pagamento). O bot trata como se eles
 * não existissem — silêncio total. Útil pra excluir reviewers/moderadores
 * do Telegram que poderiam derrubar o bot ao ver o conteúdo.
 */
export async function isBlacklisted(
  db: SupabaseClient,
  botId: string,
  telegramUserId: number,
): Promise<boolean> {
  const { data } = await db
    .from("blacklist_users")
    .select("id")
    .eq("bot_id", botId)
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  return !!data;
}
