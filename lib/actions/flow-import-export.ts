"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin-actions";
import { invalidateBotCache } from "@/lib/actions/cache-actions";
import type {
  Flow,
  FlowData,
  FlowNode,
  Product,
  ProductBundle,
  ProductBundleItem,
  TriggerType,
} from "@/lib/types/database";

const SCHEMA_VERSION = 1;

interface ExportedProduct {
  ref: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  ghost_name: string | null;
  ghost_description: string | null;
  is_active: boolean;
}

interface ExportedBundleItem {
  product_ref: string;
  sort_order: number;
}

interface ExportedBundle {
  ref: string;
  name: string;
  description: string;
  message_text: string;
  is_active: boolean;
  items: ExportedBundleItem[];
}

export interface FlowExport {
  schema_version: number;
  exported_at: string;
  flow: {
    name: string;
    trigger_type: TriggerType;
    trigger_value: string;
    flow_data: FlowData;
  };
  products: ExportedProduct[];
  bundles: ExportedBundle[];
}

function collectBundleIds(flowData: FlowData): string[] {
  const ids = new Set<string>();
  for (const node of flowData.nodes) {
    if (node.type === "payment_button") {
      const bundleId = (node.data as { bundle_id?: unknown }).bundle_id;
      if (typeof bundleId === "string" && bundleId.length > 0) {
        ids.add(bundleId);
      }
    }
  }
  return Array.from(ids);
}

export async function exportFlow(flowId: string): Promise<FlowExport> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let flowQuery = supabase.from("flows").select("*").eq("id", flowId);
  if (!admin) flowQuery = flowQuery.eq("tenant_id", user.id);
  const { data: flow } = await flowQuery.single();
  if (!flow) throw new Error("Fluxo não encontrado");

  const typedFlow = flow as Flow;
  const bundleIds = collectBundleIds(typedFlow.flow_data);

  const bundles: ExportedBundle[] = [];
  const productIds = new Set<string>();

  if (bundleIds.length > 0) {
    const { data: bundleRows } = await supabase
      .from("product_bundles")
      .select("*")
      .in("id", bundleIds);

    const { data: itemRows } = await supabase
      .from("product_bundle_items")
      .select("*")
      .in("bundle_id", bundleIds);

    const items = (itemRows ?? []) as ProductBundleItem[];
    for (const item of items) productIds.add(item.product_id);

    for (const b of (bundleRows ?? []) as ProductBundle[]) {
      const bundleItems = items
        .filter((it) => it.bundle_id === b.id)
        .map<ExportedBundleItem>((it) => ({
          product_ref: it.product_id,
          sort_order: it.sort_order,
        }));

      bundles.push({
        ref: b.id,
        name: b.name,
        description: b.description,
        message_text: b.message_text,
        is_active: b.is_active,
        items: bundleItems,
      });
    }
  }

  const products: ExportedProduct[] = [];
  if (productIds.size > 0) {
    const { data: productRows } = await supabase
      .from("products")
      .select("*")
      .in("id", Array.from(productIds));

    for (const p of (productRows ?? []) as Product[]) {
      products.push({
        ref: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency,
        description: p.description,
        ghost_name: p.ghost_name,
        ghost_description: p.ghost_description,
        is_active: p.is_active,
      });
    }
  }

  return {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    flow: {
      name: typedFlow.name,
      trigger_type: typedFlow.trigger_type,
      trigger_value: typedFlow.trigger_value,
      flow_data: typedFlow.flow_data,
    },
    products,
    bundles,
  };
}

export type ImportMode =
  | { kind: "new"; name: string }
  | { kind: "replace"; flowId: string };

export interface ImportResult {
  flowId: string;
}

function isFlowExport(payload: unknown): payload is FlowExport {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.schema_version !== "number") return false;
  if (!p.flow || typeof p.flow !== "object") return false;
  const flow = p.flow as Record<string, unknown>;
  if (typeof flow.name !== "string") return false;
  if (typeof flow.trigger_type !== "string") return false;
  if (!flow.flow_data || typeof flow.flow_data !== "object") return false;
  if (!Array.isArray(p.products)) return false;
  if (!Array.isArray(p.bundles)) return false;
  return true;
}

export async function importFlow(
  botId: string,
  payload: unknown,
  mode: ImportMode,
): Promise<ImportResult> {
  if (!isFlowExport(payload)) {
    throw new Error("Arquivo inválido ou corrompido");
  }
  if (payload.schema_version !== SCHEMA_VERSION) {
    throw new Error(`Versão de schema incompatível (${payload.schema_version})`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = await isAdmin();
  let botQuery = supabase.from("bots").select("id, tenant_id").eq("id", botId);
  if (!admin) botQuery = botQuery.eq("tenant_id", user.id);
  const { data: bot } = await botQuery.single();
  if (!bot) throw new Error("Bot não encontrado");
  const tenantId = (bot as { tenant_id: string }).tenant_id;

  // B1: sempre cria novos produtos/bundles. Mapa ref antigo → id novo.
  const productRefToNewId = new Map<string, string>();

  for (const p of payload.products) {
    const { data: inserted, error } = await supabase
      .from("products")
      .insert({
        tenant_id: tenantId,
        bot_id: botId,
        name: p.name,
        price: p.price,
        currency: p.currency,
        description: p.description,
        ghost_name: p.ghost_name,
        ghost_description: p.ghost_description,
        is_active: p.is_active,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      throw new Error(`Falha ao criar produto "${p.name}": ${error?.message ?? "unknown"}`);
    }
    productRefToNewId.set(p.ref, (inserted as { id: string }).id);
  }

  const bundleRefToNewId = new Map<string, string>();

  for (const b of payload.bundles) {
    const { data: inserted, error } = await supabase
      .from("product_bundles")
      .insert({
        tenant_id: tenantId,
        bot_id: botId,
        name: b.name,
        description: b.description,
        message_text: b.message_text,
        is_active: b.is_active,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      throw new Error(`Falha ao criar conjunto "${b.name}": ${error?.message ?? "unknown"}`);
    }
    const newBundleId = (inserted as { id: string }).id;
    bundleRefToNewId.set(b.ref, newBundleId);

    const itemsToInsert = b.items
      .map((it) => {
        const newProductId = productRefToNewId.get(it.product_ref);
        if (!newProductId) return null;
        return {
          bundle_id: newBundleId,
          product_id: newProductId,
          sort_order: it.sort_order,
        };
      })
      .filter((x): x is { bundle_id: string; product_id: string; sort_order: number } => x !== null);

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from("product_bundle_items")
        .insert(itemsToInsert);
      if (itemsError) {
        throw new Error(`Falha ao vincular produtos ao conjunto "${b.name}": ${itemsError.message}`);
      }
    }
  }

  // Remapeia bundle_id nos nodes do flow_data
  const remappedNodes: FlowNode[] = payload.flow.flow_data.nodes.map((node) => {
    if (node.type !== "payment_button") return node;
    const oldBundleId = (node.data as { bundle_id?: unknown }).bundle_id;
    if (typeof oldBundleId !== "string" || oldBundleId.length === 0) return node;
    const newBundleId = bundleRefToNewId.get(oldBundleId);
    return {
      ...node,
      data: { ...node.data, bundle_id: newBundleId ?? "" },
    };
  });

  const remappedFlowData: FlowData = {
    nodes: remappedNodes,
    edges: payload.flow.flow_data.edges,
  };

  let flowId: string;

  if (mode.kind === "replace") {
    let updateQuery = supabase
      .from("flows")
      .update({ flow_data: remappedFlowData })
      .eq("id", mode.flowId)
      .eq("bot_id", botId);
    if (!admin) updateQuery = updateQuery.eq("tenant_id", tenantId);

    const { error: updateError } = await updateQuery;
    if (updateError) throw new Error(`Falha ao substituir fluxo: ${updateError.message}`);
    flowId = mode.flowId;
  } else {
    const name = mode.name.trim();
    if (!name) throw new Error("Nome do fluxo é obrigatório");

    const { data: inserted, error: insertError } = await supabase
      .from("flows")
      .insert({
        tenant_id: tenantId,
        bot_id: botId,
        name,
        trigger_type: payload.flow.trigger_type,
        trigger_value: payload.flow.trigger_value,
        flow_data: remappedFlowData,
        is_active: false,
        version: 1,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(`Falha ao criar fluxo: ${insertError?.message ?? "unknown"}`);
    }
    flowId = (inserted as { id: string }).id;
  }

  invalidateBotCache(botId);
  return { flowId };
}
