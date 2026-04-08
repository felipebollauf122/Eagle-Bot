import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { BotSettingsForm } from "@/components/dashboard/bot-settings-form";
import type { Bot } from "@/lib/types/database";

export default async function AdminBotSettingsPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .single();

  if (!bot) notFound();

  return (
    <div className="p-8">
      <BotSettingsForm bot={bot as Bot} />
    </div>
  );
}
