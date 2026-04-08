import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleTriggerNode(ctx: NodeContext): Promise<NodeResult> {
  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
  };
}
