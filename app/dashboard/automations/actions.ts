"use server";

import { createClient } from "@/lib/supabase/server";
import { parseTargets } from "@/lib/mtproto/target-parser";
import { revalidatePath } from "next/cache";

type MtprotoJob =
  | { kind: "auth.request-code"; accountId: string; phoneNumber: string }
  | { kind: "auth.sign-in"; accountId: string; phoneNumber: string; code: string }
  | { kind: "auth.submit-password"; accountId: string; password: string }
  | { kind: "campaign.run"; campaignId: string }
  | { kind: "account.sync-dialogs"; accountId: string };

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
  dialogIds?: string[];
  recurrenceHours?: number | null;
}): Promise<{ campaignId: string }> {
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  const parsed = parseTargets(input.targetsRaw || "");
  const valid = parsed.filter((t) => t.valid);
  const invalid = parsed.filter((t) => !t.valid);

  // Resolve dialog rows (com peer info) e garante que pertencem ao tenant.
  let dialogRows: Array<{ id: string; title: string | null; username: string | null }> = [];
  if (input.dialogIds && input.dialogIds.length > 0) {
    const { data, error } = await supabase
      .from("mtproto_dialogs")
      .select("id, title, username, mtproto_accounts!inner(tenant_id)")
      .in("id", input.dialogIds)
      .eq("mtproto_accounts.tenant_id", tenantId);
    if (error) throw new Error(`Failed to load dialogs: ${error.message}`);
    dialogRows = (data ?? []) as typeof dialogRows;
  }

  const totalTargets = valid.length + invalid.length + dialogRows.length;
  if (totalTargets === 0) {
    throw new Error("Campanha sem alvos: cole uma lista ou selecione contatos/grupos.");
  }

  // Valida recurrence: se setado, mínimo 6h (anti-ban). null = não recorrente.
  let recurrenceHours: number | null = null;
  if (input.recurrenceHours != null && input.recurrenceHours > 0) {
    if (input.recurrenceHours < 6) {
      throw new Error("Mínimo 6 horas entre execuções (anti-ban).");
    }
    recurrenceHours = Math.floor(input.recurrenceHours);
  }

  const { data: campaign, error: cErr } = await supabase
    .from("mtproto_campaigns")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      message_text: input.message,
      delay_min_seconds: input.delayMin,
      delay_max_seconds: input.delayMax,
      total_targets: totalTargets,
      status: "draft",
      failed_count: invalid.length,
      recurrence_hours: recurrenceHours,
    })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);

  const rows: Array<Record<string, unknown>> = [
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
    ...dialogRows.map((d) => ({
      campaign_id: campaign.id,
      target_identifier: d.username ?? d.title ?? d.id,
      target_type: "username" as const, // ignorado pelo runner quando dialog_id está setado
      status: "pending" as const,
      dialog_id: d.id,
    })),
  ];
  if (rows.length) await supabase.from("mtproto_targets").insert(rows);

  revalidatePath("/dashboard/automations");
  return { campaignId: campaign.id };
}

export async function syncAccountDialogs(accountId: string): Promise<void> {
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("mtproto_accounts")
    .select("id, tenant_id")
    .eq("id", accountId)
    .eq("tenant_id", tenantId)
    .single();
  if (!account) throw new Error("Conta não encontrada");
  await enqueueJob({ kind: "account.sync-dialogs", accountId });
  revalidatePath("/dashboard/automations");
}

export async function listAccountDialogs(
  accountId: string,
  filter?: { kinds?: string[]; search?: string },
): Promise<Array<{
  id: string;
  title: string | null;
  username: string | null;
  kind: string;
  peer_type: string;
  is_bot: boolean;
}>> {
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  // Garante que a conta pertence ao tenant
  const { data: account } = await supabase
    .from("mtproto_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("tenant_id", tenantId)
    .single();
  if (!account) return [];

  let q = supabase
    .from("mtproto_dialogs")
    .select("id, title, username, kind, peer_type, is_bot")
    .eq("account_id", accountId)
    .order("title", { ascending: true, nullsFirst: false })
    .limit(2000);

  if (filter?.kinds && filter.kinds.length > 0) {
    q = q.in("kind", filter.kinds);
  }
  if (filter?.search && filter.search.trim()) {
    q = q.ilike("title", `%${filter.search.trim()}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    title: string | null;
    username: string | null;
    kind: string;
    peer_type: string;
    is_bot: boolean;
  }>;
}

export async function listActiveAccounts(): Promise<Array<{
  id: string;
  display_name: string | null;
  phone_number: string;
}>> {
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mtproto_accounts")
    .select("id, display_name, phone_number")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; display_name: string | null; phone_number: string }>;
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
