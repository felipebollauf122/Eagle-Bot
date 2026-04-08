import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { BotSidebar } from "@/components/dashboard/bot-sidebar";
import type { Bot } from "@/lib/types/database";

export default async function AdminBotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { userId, botId } = await params;
  const supabase = await createClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .eq("tenant_id", userId)
    .single();

  if (!bot) notFound();

  const typedBot = bot as Bot;

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <BotSidebar
        botId={botId}
        botUsername={typedBot.bot_username}
        basePath={`/dashboard/admin/users/${userId}/bots/${botId}`}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
