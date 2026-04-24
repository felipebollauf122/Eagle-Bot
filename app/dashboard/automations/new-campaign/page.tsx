import { MtprotoCampaignForm } from "@/components/dashboard/mtproto-campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="p-8 max-w-3xl">
      <a href="/dashboard/automations" className="text-white/40 hover:text-white text-sm">
        ← Voltar
      </a>
      <h1 className="text-2xl font-bold text-white mt-4 mb-6">Nova campanha</h1>
      <MtprotoCampaignForm />
    </div>
  );
}
