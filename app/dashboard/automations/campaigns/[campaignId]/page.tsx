import { createClient } from "@/lib/supabase/server";
import { MtprotoCampaignDetail } from "@/components/dashboard/mtproto-campaign-detail";
import { notFound } from "next/navigation";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("mtproto_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (!campaign) notFound();

  return (
    <div className="p-8 max-w-4xl">
      <a href="/dashboard/automations" className="text-white/40 hover:text-white text-sm">
        ← Voltar
      </a>
      <MtprotoCampaignDetail initialCampaign={campaign} campaignId={campaignId} />
    </div>
  );
}
