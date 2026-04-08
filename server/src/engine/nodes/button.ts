import type { NodeContext, NodeResult } from "../types.js";
import type { InlineKeyboardButton } from "../../telegram/api.js";

export async function handleButtonNode(ctx: NodeContext): Promise<NodeResult> {
  const text = String(ctx.node.data.text ?? "");
  const buttons = (ctx.node.data.buttons ?? []) as Array<{
    text: string;
    action: string;
    value: string;
  }>;

  const inlineKeyboard: InlineKeyboardButton[][] = buttons.map((btn) => {
    if (btn.action === "open_url") {
      return [{ text: btn.text, url: btn.value }];
    }
    return [{ text: btn.text, callback_data: `${ctx.node.id}:${btn.value}` }];
  });

  const sent = await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text,
    replyMarkup: { inline_keyboard: inlineKeyboard },
  });

  return {
    nextNodeId: "wait",
    messageIds: sent ? [sent.message_id] : undefined,
  };
}
