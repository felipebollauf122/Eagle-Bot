import { createClient } from "@/lib/supabase/server";
import { ProductList } from "@/components/dashboard/product-list";
import type { Product } from "@/lib/types/database";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <ProductList
        botId={botId}
        initialProducts={(products ?? []) as Product[]}
        blackEnabled={false}
      />
    </div>
  );
}
