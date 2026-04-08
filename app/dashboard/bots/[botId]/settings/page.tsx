import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BotSettingsForm } from "@/components/dashboard/bot-settings-form";
import type { Bot } from "@/lib/types/database";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
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
