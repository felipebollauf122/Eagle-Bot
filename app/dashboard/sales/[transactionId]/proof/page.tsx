import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ProofView } from "@/components/dashboard/proof-view";

export default async function ProofPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS já garante que só veja transações do próprio tenant
  const { data: tx } = await supabase
    .from("transactions")
    .select(`
      id, external_id, amount, currency, status, gateway, paid_at, created_at,
      lead_id, bot_id, product_id, flow_id,
      products(id, name, ghost_name, ghost_description, description),
      leads(id, telegram_user_id, first_name, last_name, username, tid, fbclid,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            state, created_at, updated_at),
      bots(bot_username, telegram_token)
    `)
    .eq("id", transactionId)
    .single();

  if (!tx) notFound();

  // Tracking event (IP/UA) se houver
  let trackingEvent: Record<string, unknown> | null = null;
  const leadTid = (tx.leads as unknown as { tid: string | null })?.tid;
  if (leadTid) {
    const { data } = await supabase
      .from("tracking_events")
      .select("event_data, created_at, event_type")
      .eq("tid", leadTid)
      .eq("event_type", "page_view")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    trackingEvent = data ?? null;
  }

  // Outras transações do mesmo lead — útil pra mostrar histórico de compras
  const leadId = (tx.leads as unknown as { id: string }).id;
  const { data: otherTxs } = await supabase
    .from("transactions")
    .select("id, status, amount, currency, created_at, paid_at, products(name, ghost_name)")
    .eq("lead_id", leadId)
    .neq("id", transactionId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <ProofView
      transaction={tx as unknown as Parameters<typeof ProofView>[0]["transaction"]}
      trackingEvent={trackingEvent as unknown as Parameters<typeof ProofView>[0]["trackingEvent"]}
      otherTransactions={(otherTxs ?? []) as unknown as Parameters<typeof ProofView>[0]["otherTransactions"]}
    />
  );
}
