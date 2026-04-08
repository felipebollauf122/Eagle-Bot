import type { NodeContext, NodeResult } from "../types.js";

function interpolate(template: string, lead: NodeContext["lead"]): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in lead) {
      return String((lead as unknown as Record<string, unknown>)[key] ?? "");
    }
    if (lead.state && key in lead.state) {
      return String(lead.state[key] ?? "");
    }
    return "";
  });
}

export function findNextNodeId(edges: NodeContext["edges"], currentNodeId: string, handle?: string): string | null {
  const edge = edges.find(
    (e) => e.source === currentNodeId && (handle ? e.sourceHandle === handle : true)
  );
  return edge?.target ?? null;
}

export async function handleTextNode(ctx: NodeContext): Promise<NodeResult> {
  const text = interpolate(String(ctx.node.data.text ?? ""), ctx.lead);

  const sent = await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text,
  });

  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
    messageIds: sent ? [sent.message_id] : undefined,
  };
}
