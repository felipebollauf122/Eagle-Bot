import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleVideoNode(ctx: NodeContext): Promise<NodeResult> {
  const video = String(ctx.node.data.video_url ?? "");
  const caption = ctx.node.data.caption ? String(ctx.node.data.caption) : undefined;

  const sent = await ctx.telegram.sendVideo({
    chatId: ctx.chatId,
    video,
    caption,
  });

  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
    messageIds: sent ? [sent.message_id] : undefined,
  };
}
