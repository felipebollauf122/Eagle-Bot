import { createClient } from "@/lib/supabase/server";
import { MtprotoAccounts } from "@/components/dashboard/mtproto-accounts";
import { MtprotoCampaignList } from "@/components/dashboard/mtproto-campaign-list";

export default async function AutomationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: accounts } = await supabase
    .from("mtproto_accounts")
    .select("id, phone_number, display_name, status, last_error")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  const { data: campaigns } = await supabase
    .from("mtproto_campaigns")
    .select("id, name, status, total_targets, sent_count, failed_count, created_at")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-1">Automações</h1>
      <p className="text-white/50 mb-8">
        Conecte contas pessoais do Telegram e dispare mensagens em massa.
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-3">Contas conectadas</h2>
        <MtprotoAccounts accounts={accounts ?? []} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Campanhas</h2>
          <a
            href="/dashboard/automations/new-campaign"
            className="px-3 py-1.5 rounded-md bg-(--accent) text-black text-sm font-medium hover:opacity-90"
          >
            Nova campanha
          </a>
        </div>
        <MtprotoCampaignList campaigns={campaigns ?? []} />
      </section>
    </div>
  );
}
