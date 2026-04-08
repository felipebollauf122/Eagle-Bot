import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleActionNode(ctx: NodeContext): Promise<NodeResult> {
  const actionType = String(ctx.node.data.action_type ?? "");
  const stateUpdates: Record<string, unknown> = {};

  switch (actionType) {
    case "add_tag": {
      const tag = String(ctx.node.data.tag ?? "");
      const currentTags = (ctx.lead.state.tags ?? []) as string[];
      if (!currentTags.includes(tag)) {
        stateUpdates.tags = [...currentTags, tag];
      }
      break;
    }
    case "remove_tag": {
      const tag = String(ctx.node.data.tag ?? "");
      const currentTags = (ctx.lead.state.tags ?? []) as string[];
      stateUpdates.tags = currentTags.filter((t) => t !== tag);
      break;
    }
    case "set_variable": {
      const key = String(ctx.node.data.variable ?? "");
      const value = ctx.node.data.value;
      stateUpdates[key] = value;
      break;
    }
    default:
      break;
  }

  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
    stateUpdates: Object.keys(stateUpdates).length > 0 ? stateUpdates : undefined,
  };
}
