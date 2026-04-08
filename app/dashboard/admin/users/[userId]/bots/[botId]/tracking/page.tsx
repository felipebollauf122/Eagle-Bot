import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { TrackingStats } from "@/components/dashboard/tracking-stats";
import { getTrackingFunnel } from "@/lib/actions/tracking-actions";
import type { TrackingEvent, Lead } from "@/lib/types/database";

export default async function AdminBotTrackingPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const pageSize = 30;

  const [eventsResult, leadsResult, funnel] = await Promise.all([
    supabase
      .from("tracking_events")
      .select("*", { count: "exact" })
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })
      .range(0, pageSize - 1),
    supabase
      .from("leads")
      .select("*", { count: "exact" })
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })
      .range(0, pageSize - 1),
    getTrackingFunnel(botId),
  ]);

  return (
    <div className="p-8">
      <TrackingStats
        botId={botId}
        funnel={funnel}
        initialEvents={(eventsResult.data ?? []) as TrackingEvent[]}
        initialLeads={(leadsResult.data ?? []) as Lead[]}
        totalEvents={eventsResult.count ?? 0}
        totalLeads={leadsResult.count ?? 0}
        currentPage={1}
        pageSize={pageSize}
      />
    </div>
  );
}
