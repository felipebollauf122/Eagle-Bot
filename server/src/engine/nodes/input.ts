import type { FlowEdge } from "../types.js";
import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleInputNode(ctx: NodeContext): Promise<NodeResult> {
  const prompt = String(ctx.node.data.prompt ?? "");

  const sent = await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: prompt,
  });

  return {
    nextNodeId: "wait",
    messageIds: sent ? [sent.message_id] : undefined,
  };
}

export function handleInputResponse(
  nodeId: string,
  variable: string,
  userResponse: string,
  edges: FlowEdge[]
): NodeResult {
  return {
    nextNodeId: findNextNodeId(edges, nodeId),
    stateUpdates: { [variable]: userResponse },
  };
}
