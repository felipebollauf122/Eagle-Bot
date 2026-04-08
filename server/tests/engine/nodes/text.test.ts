import { describe, it, expect, vi } from "vitest";
import { handleTextNode } from "../../../src/engine/nodes/text.js";
import type { NodeContext } from "../../../src/engine/types.js";

function makeContext(overrides: Partial<NodeContext> = {}): NodeContext {
  return {
    node: {
      id: "node-1",
      type: "text",
      data: { text: "Hello {{first_name}}!" },
      position: { x: 0, y: 0 },
    },
    lead: {
      id: "lead-1", tenant_id: "t-1", bot_id: "b-1", telegram_user_id: 123,
      first_name: "João", username: "joao", tid: null, fbclid: null,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
      current_flow_id: "f-1", current_node_id: "node-1",
      state: { custom_var: "test" },
      created_at: "", updated_at: "",
    },
    edges: [{ id: "e1", source: "node-1", target: "node-2" }],
    telegram: { sendMessage: vi.fn() } as any,
    chatId: 123,
    ...overrides,
  };
}

describe("handleTextNode", () => {
  it("should send interpolated text and return next node", async () => {
    const ctx = makeContext();
    const result = await handleTextNode(ctx);
    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith({ chatId: 123, text: "Hello João!" });
    expect(result.nextNodeId).toBe("node-2");
  });

  it("should interpolate state variables", async () => {
    const ctx = makeContext({
      node: { id: "n1", type: "text", data: { text: "Value: {{custom_var}}" }, position: { x: 0, y: 0 } },
      edges: [{ id: "e1", source: "n1", target: "node-2" }],
    });
    const result = await handleTextNode(ctx);
    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith({ chatId: 123, text: "Value: test" });
    expect(result.nextNodeId).toBe("node-2");
  });

  it("should return null nextNodeId when no outgoing edge", async () => {
    const ctx = makeContext({ edges: [] });
    const result = await handleTextNode(ctx);
    expect(result.nextNodeId).toBeNull();
  });
});
