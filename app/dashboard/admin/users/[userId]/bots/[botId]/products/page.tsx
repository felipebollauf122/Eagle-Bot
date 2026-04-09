import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { ProductList } from "@/components/dashboard/product-list";
import type { Product } from "@/lib/types/database";

export default async function AdminBotProductsPage({
  params,
}: {
  params: Promise<{ userId: string; botId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { botId } = await params;
  const supabase = await createClient();

  const [{ data: products }, { data: bot }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bots")
      .select("black_enabled")
      .eq("id", botId)
      .single(),
  ]);

  return (
    <div className="p-8">
      <ProductList
        botId={botId}
        initialProducts={(products ?? []) as Product[]}
        blackEnabled={bot?.black_enabled ?? false}
        isAdmin
      />
    </div>
  );
}
