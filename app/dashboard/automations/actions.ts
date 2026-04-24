"use server";

import { createClient } from "@/lib/supabase/server";
import { parseTargets } from "@/lib/mtproto/target-parser";
import { revalidatePath } from "next/cache";

type MtprotoJob =
  | { kind: "auth.request-code"; accountId: string; phoneNumber: string }
  | { kind: "auth.sign-in"; accountId: string; phoneNumber: string; code: string }
  | { kind: "auth.submit-password"; accountId: string; password: string }
  | { kind: "campaign.run"; campaignId: string };

async function enqueueJob(job: MtprotoJob): Promise<void> {
  const serverUrl = (process.env.NEXT_PUBLIC_BOT_SERVER_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  const res = await fetch(`${serverUrl}/api/mtproto/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  });
  if (!res.ok) {
    throw new Error(`Falha ao enfileirar job (${res.status})`);
  }
}

async function currentTenantId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

export async function startAddAccount(
  phoneNumber: string,
  displayName: string,
): Promise<{ accountId: string }> {
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mtproto_accounts")
    .insert({
      tenant_id: tenantId,
      phone_number: phoneNumber,
      display_name: displayName || null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await enqueueJob({ kind: "auth.request-code", accountId: data.id, phoneNumber });
  revalidatePath("/dashboard/automations");
  return { accountId: data.id };
}

export async function submitAuthCode(accountId: string, code: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mtproto_accounts")
    .select("phone_number")
    .eq("id", accountId)
    .single();
  if (!data) throw new Error("account not found");
  await enqueueJob({
    kind: "auth.sign-in",
    accountId,
    phoneNumber: data.phone_number,
    code,
  });
  revalidatePath("/dashboard/automations");
}

export async function submitAuthPassword(
  accountId: string,
  password: string,
): Promise<void> {
  await enqueueJob({ kind: "auth.submit-password", accountId, password });
  revalidatePath("/dashboard/automations");
}

export async function removeAccount(accountId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("mtproto_accounts").delete().eq("id", accountId);
  revalidatePath("/dashboard/automations");
}

export async function createCampaign(input: {
  name: string;
  message: string;
  targetsRaw: string;
  delayMin: number;
  delayMax: number;
}): Promise<{ campaignId: string }> {
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  const parsed = parseTargets(input.targetsRaw);
  const valid = parsed.filter((t) => t.valid);
  const invalid = parsed.filter((t) => !t.valid);

  const { data: campaign, error: cErr } = await supabase
    .from("mtproto_campaigns")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      message_text: input.message,
      delay_min_seconds: input.delayMin,
      delay_max_seconds: input.delayMax,
      total_targets: parsed.length,
      status: "draft",
      failed_count: invalid.length,
    })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);

  const rows = [
    ...valid.map((t) => ({
      campaign_id: campaign.id,
      target_identifier: t.identifier,
      target_type: t.type,
      status: "pending" as const,
    })),
    ...invalid.map((t) => ({
      campaign_id: campaign.id,
      target_identifier: t.identifier,
      target_type: t.type,
      status: "failed" as const,
      error_message: "invalid_identifier",
    })),
  ];
  if (rows.length) await supabase.from("mtproto_targets").insert(rows);

  revalidatePath("/dashboard/automations");
  return { campaignId: campaign.id };
}

export async function launchCampaign(campaignId: string): Promise<void> {
  await enqueueJob({ kind: "campaign.run", campaignId });
  const supabase = await createClient();
  await supabase
    .from("mtproto_campaigns")
    .update({ status: "running" })
    .eq("id", campaignId);
  revalidatePath("/dashboard/automations");
  revalidatePath(`/dashboard/automations/campaigns/${campaignId}`);
}
