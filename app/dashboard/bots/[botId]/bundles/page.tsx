import { createClient } from "@/lib/supabase/server";
import { BundleList } from "@/components/dashboard/bundle-list";

export default async function BundlesPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = await createClient();

  const { data: bundles } = await supabase
    .from("product_bundles")
    .select("*, product_bundle_items(*, products(id, name, price, currency, is_active))")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, currency, is_active")
    .eq("bot_id", botId)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="p-8">
      <BundleList
        botId={botId}
        initialBundles={(bundles ?? []) as any}
        products={(products ?? []) as any}
      />
    </div>
  );
}
