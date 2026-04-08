import { getOrCreateConfig, listFlows } from "@/lib/actions/remarketing-actions";
import { RemarketingDashboard } from "@/components/dashboard/remarketing-dashboard";
import type { RemarketingConfig, RemarketingFlow } from "@/lib/types/database";

export default async function RemarketingPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;

  const config = (await getOrCreateConfig(botId)) as RemarketingConfig;
  const flows = (await listFlows(config.id)) as RemarketingFlow[];

  return (
    <div className="p-8">
      <RemarketingDashboard
        botId={botId}
        config={config}
        flows={flows}
      />
    </div>
  );
}
