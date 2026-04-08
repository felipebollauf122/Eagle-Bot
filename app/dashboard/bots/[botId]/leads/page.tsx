import { createClient } from "@/lib/supabase/server";
import { LeadsTable } from "@/components/dashboard/leads-table";
import type { Lead } from "@/lib/types/database";

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const pageSize = 20;
  const { data: leads, count } = await supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(0, pageSize - 1);

  return (
    <div className="p-8">
      <LeadsTable
        botId={botId}
        initialLeads={(leads ?? []) as Lead[]}
        total={count ?? 0}
        currentPage={1}
        pageSize={pageSize}
      />
    </div>
  );
}
