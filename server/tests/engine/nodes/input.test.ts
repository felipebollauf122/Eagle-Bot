import { describe, it, expect, vi } from "vitest";
import { handleInputNode, handleInputResponse } from "../../../src/engine/nodes/input.js";
import type { NodeContext } from "../../../src/engine/types.js";

function makeContext(): NodeContext {
  return {
    node: {
      id: "input-1", type: "input",
      data: { prompt: "Qual seu email?", variable: "email" },
      position: { x: 0, y: 0 },
    },
    lead: {
      id: "lead-1", tenant_id: "t-1", bot_id: "b-1", telegram_user_id: 123,
      first_name: "João", username: null, tid: null, fbclid: null,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
      current_flow_id: "f-1", current_node_id: "input-1", state: {},
      created_at: "", updated_at: "",
    },
    edges: [{ id: "e1", source: "input-1", target: "node-next" }],
    telegram: { sendMessage: vi.fn() } as any,
    chatId: 123,
  };
}

describe("handleInputNode", () => {
  it("should send prompt and wait", async () => {
    const ctx = makeContext();
    const result = await handleInputNode(ctx);
    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith({ chatId: 123, text: "Qual seu email?" });
    expect(result.nextNodeId).toBe("wait");
  });
});

describe("handleInputResponse", () => {
  it("should save user response to state and advance", () => {
    const result = handleInputResponse(
      "input-1", "email", "joao@test.com",
      [{ id: "e1", source: "input-1", target: "node-next" }]
    );
    expect(result.stateUpdates).toEqual({ email: "joao@test.com" });
    expect(result.nextNodeId).toBe("node-next");
  });
});
