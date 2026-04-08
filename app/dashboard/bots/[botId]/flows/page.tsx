import { createClient } from "@/lib/supabase/server";
import { FlowList } from "@/components/dashboard/flow-list";
import type { Flow } from "@/lib/types/database";

export default async function FlowsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  const allFlows = (flows ?? []) as Flow[];
  const visualFlow = allFlows.find((f) => f.name === "_visual_flow") ?? null;
  const otherFlows = allFlows.filter((f) => f.name !== "_visual_flow" && f.name !== "_black_flow");

  return (
    <FlowList
      flows={otherFlows}
      visualFlow={visualFlow}
      blackFlow={null}
      botId={botId}
      blackEnabled={false}
    />
  );
}
