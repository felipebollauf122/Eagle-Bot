import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MtprotoInbox } from "@/components/dashboard/mtproto-inbox";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase
    .from("mtproto_accounts")
    .select("id, display_name, phone_number, status")
    .eq("id", accountId)
    .eq("tenant_id", user.id)
    .single();
  if (!account) notFound();

  return (
    <div className="p-8 max-w-3xl">
      <a href="/dashboard/automations" className="text-white/40 hover:text-white text-sm">
        ← Voltar
      </a>
      <h1 className="text-2xl font-bold text-white mt-4">
        Mensagens — {account.display_name || account.phone_number}
      </h1>
      <p className="text-white/50 text-sm mt-1 mb-6">
        Mensagens recebidas da conta oficial &quot;Telegram&quot; (códigos de login,
        alertas de segurança). Retenção de 7 dias.
      </p>
      <MtprotoInbox accountId={accountId} />
    </div>
  );
}
