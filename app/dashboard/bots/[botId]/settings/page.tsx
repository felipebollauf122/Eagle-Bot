import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/actions/admin-actions";
import { BotSettingsForm } from "@/components/dashboard/bot-settings-form";
import { BlacklistManager } from "@/components/dashboard/blacklist-manager";
import type { Bot, BlacklistUser } from "@/lib/types/database";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();
  const admin = await isAdmin();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .single();

  if (!bot) notFound();

  let blacklist: BlacklistUser[] = [];
  if (admin) {
    const { data } = await supabase
      .from("blacklist_users")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false });
    blacklist = (data ?? []) as BlacklistUser[];
  }

  return (
    <div className="p-8">
      <BotSettingsForm bot={bot as Bot} isAdmin={admin} />
      {admin && (
        <div className="max-w-2xl">
          <BlacklistManager botId={botId} initialBlacklist={blacklist} />
        </div>
      )}
    </div>
  );
}
