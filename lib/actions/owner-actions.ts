"use server";

import { createClient } from "@/lib/supabase/server";

export async function isOwner(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("is_owner")
    .eq("id", user.id)
    .single();

  return tenant?.is_owner === true;
}

export async function requireOwner(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("is_owner")
    .eq("id", user.id)
    .single();

  if (tenant?.is_owner !== true) throw new Error("Forbidden: owner only");
  return user.id;
}
