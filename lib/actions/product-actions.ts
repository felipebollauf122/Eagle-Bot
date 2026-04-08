"use server";

import { createClient } from "@/lib/supabase/server";

export async function createProduct(botId: string, name: string, price: number, currency: string, description: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("products").insert({
    tenant_id: user.id,
    bot_id: botId,
    name,
    price,
    currency,
    description,
    is_active: true,
  });

  if (error) throw new Error(`Failed to create product: ${error.message}`);
  return { success: true };
}

export async function updateProduct(productId: string, data: { name?: string; price?: number; description?: string; is_active?: boolean; ghost_name?: string | null; ghost_description?: string | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("products").update(data).eq("id", productId).eq("tenant_id", user.id);
  if (error) throw new Error(`Failed to update product: ${error.message}`);
  return { success: true };
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("products").delete().eq("id", productId).eq("tenant_id", user.id);
  if (error) throw new Error(`Failed to delete product: ${error.message}`);
  return { success: true };
}
