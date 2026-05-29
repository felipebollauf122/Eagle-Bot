import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { isOwner } from "@/lib/actions/owner-actions";
import { BotSettingsForm } from "@/components/dashboard/bot-settings-form";
import { BlacklistManager } from "@/components/dashboard/blacklist-manager";
import { SettingsPasswordGate } from "@/components/dashboard/settings-password-gate";
import type { Bot, BlacklistUser } from "@/lib/types/database";

export default async function AdminBotSettingsPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");
  const owner = await isOwner();

  const { botId } = await params;
  const supabase = await createClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .single();

  if (!bot) notFound();

  const { data: blacklist } = await supabase
    .from("blacklist_users")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  return (
    <SettingsPasswordGate enabled={owner}>
      <div className="p-8">
        <BotSettingsForm bot={bot as Bot} isAdmin />
        <div className="max-w-2xl">
          <BlacklistManager botId={botId} initialBlacklist={(blacklist ?? []) as BlacklistUser[]} />
        </div>
      </div>
    </SettingsPasswordGate>
  );
}
