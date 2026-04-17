"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { invalidateBotCache } from "@/lib/actions/cache-actions";

interface BotSettings {
  facebook_pixel_id: string;
  facebook_access_token: string;
  utmify_api_key: string;
  sigilopay_public_key: string;
  sigilopay_secret_key: string;
  tracking_mode: "redirect" | "prelander";
  prelander_headline: string;
  prelander_description: string;
  prelander_image_url: string;
  prelander_cta_text: string;
  redirect_display_name: string;
}

export async function saveBotSettings(botId: string, settings: BotSettings) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify bot belongs to this tenant (admins can access any bot)
  const admin = await isAdmin();
  let botQuery = supabase.from("bots").select("id").eq("id", botId);
  if (!admin) botQuery = botQuery.eq("tenant_id", user.id);
  const { data: bot } = await botQuery.single();
  if (!bot) throw new Error("Bot not found");

  const { error } = await supabase
    .from("bots")
    .update({
      facebook_pixel_id: settings.facebook_pixel_id || null,
      facebook_access_token: settings.facebook_access_token || null,
      utmify_api_key: settings.utmify_api_key || null,
      sigilopay_public_key: settings.sigilopay_public_key || null,
      sigilopay_secret_key: settings.sigilopay_secret_key || null,
      tracking_mode: settings.tracking_mode,
      prelander_headline: settings.prelander_headline || null,
      prelander_description: settings.prelander_description || null,
      prelander_image_url: settings.prelander_image_url || null,
      prelander_cta_text: settings.prelander_cta_text || null,
      redirect_display_name: settings.redirect_display_name || null,
    })
    .eq("id", botId);

  if (error) throw new Error(`Failed to save settings: ${error.message}`);
  invalidateBotCache(botId);
  return { success: true };
}

export async function updateBotAvatar(botId: string, avatarUrl: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let botQuery = supabase.from("bots").select("id").eq("id", botId);
  if (!admin) botQuery = botQuery.eq("tenant_id", user.id);
  const { data: bot } = await botQuery.single();
  if (!bot) throw new Error("Bot not found");

  const { error } = await supabase
    .from("bots")
    .update({ avatar_url: avatarUrl || null })
    .eq("id", botId);

  if (error) throw new Error(`Failed to update avatar: ${error.message}`);
  return { success: true };
}

export async function toggleBlackEnabled(botId: string, enabled: boolean) {
  const admin = await isAdmin();
  if (!admin) throw new Error("Unauthorized: admin only");

  const supabase = await createClient();

  const { error } = await supabase
    .from("bots")
    .update({ black_enabled: enabled })
    .eq("id", botId);

  if (error) throw new Error(`Failed to toggle black: ${error.message}`);
  return { success: true };
}
