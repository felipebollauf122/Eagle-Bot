import { createClient } from "@/lib/supabase/server";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { getTransactionStats } from "@/lib/actions/transaction-actions";

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const pageSize = 20;
  const { data: transactions, count } = await supabase
    .from("transactions")
    .select("*, products(name)", { count: "exact" })
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .range(0, pageSize - 1);

  const stats = await getTransactionStats(botId);

  return (
    <div className="p-8">
      <TransactionsTable
        botId={botId}
        initialTransactions={(transactions ?? []) as Array<{ id: string; external_id: string; amount: number; currency: string; status: string; created_at: string; paid_at: string | null; products: { name: string } | null }>}
        total={count ?? 0}
        currentPage={1}
        pageSize={pageSize}
        stats={stats}
      />
    </div>
  );
}
