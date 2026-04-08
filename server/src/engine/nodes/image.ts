import type { NodeContext, NodeResult } from "../types.js";
import { findNextNodeId } from "./text.js";

export async function handleImageNode(ctx: NodeContext): Promise<NodeResult> {
  const photo = String(ctx.node.data.image_url ?? ctx.node.data.photo ?? "");
  const caption = ctx.node.data.caption ? String(ctx.node.data.caption) : undefined;

  const sent = await ctx.telegram.sendPhoto({
    chatId: ctx.chatId,
    photo,
    caption,
  });

  return {
    nextNodeId: findNextNodeId(ctx.edges, ctx.node.id),
    messageIds: sent ? [sent.message_id] : undefined,
  };
}
