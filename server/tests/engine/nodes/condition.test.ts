import { describe, it, expect, vi } from "vitest";
import { handleConditionNode } from "../../../src/engine/nodes/condition.js";
import type { NodeContext } from "../../../src/engine/types.js";

function makeContext(state: Record<string, unknown>, edges: NodeContext["edges"]): NodeContext {
  return {
    node: {
      id: "cond-1", type: "condition",
      data: { field: "paid", operator: "equals", value: "true" },
      position: { x: 0, y: 0 },
    },
    lead: {
      id: "lead-1", tenant_id: "t-1", bot_id: "b-1", telegram_user_id: 123,
      first_name: "João", username: null, tid: null, fbclid: null,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
      current_flow_id: "f-1", current_node_id: "cond-1", state,
      created_at: "", updated_at: "",
    },
    edges,
    telegram: { sendMessage: vi.fn() } as any,
    chatId: 123,
  };
}

describe("handleConditionNode", () => {
  it("should follow 'true' edge when condition matches", async () => {
    const ctx = makeContext({ paid: true }, [
      { id: "e-true", source: "cond-1", target: "node-paid", sourceHandle: "true" },
      { id: "e-false", source: "cond-1", target: "node-unpaid", sourceHandle: "false" },
    ]);
    const result = await handleConditionNode(ctx);
    expect(result.nextNodeId).toBe("node-paid");
  });

  it("should follow 'false' edge when condition does not match", async () => {
    const ctx = makeContext({ paid: false }, [
      { id: "e-true", source: "cond-1", target: "node-paid", sourceHandle: "true" },
      { id: "e-false", source: "cond-1", target: "node-unpaid", sourceHandle: "false" },
    ]);
    const result = await handleConditionNode(ctx);
    expect(result.nextNodeId).toBe("node-unpaid");
  });

  it("should handle 'exists' operator", async () => {
    const ctx = makeContext({ email: "j@test.com" }, [
      { id: "e-true", source: "cond-1", target: "node-a", sourceHandle: "true" },
      { id: "e-false", source: "cond-1", target: "node-b", sourceHandle: "false" },
    ]);
    ctx.node.data = { field: "email", operator: "exists", value: "" };
    const result = await handleConditionNode(ctx);
    expect(result.nextNodeId).toBe("node-a");
  });
});
