import type { NodeContext, NodeResult } from "../types.js";

function evaluateCondition(
  state: Record<string, unknown>,
  field: string,
  operator: string,
  value: string
): boolean {
  const actual = state[field];

  switch (operator) {
    case "equals":
      return String(actual) === value;
    case "not_equals":
      return String(actual) !== value;
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "not_exists":
      return actual === undefined || actual === null || actual === "";
    case "contains":
      return String(actual ?? "").includes(value);
    case "greater_than":
      return Number(actual) > Number(value);
    case "less_than":
      return Number(actual) < Number(value);
    default:
      return false;
  }
}

export async function handleConditionNode(ctx: NodeContext): Promise<NodeResult> {
  const field = String(ctx.node.data.field ?? "");
  const operator = String(ctx.node.data.operator ?? "equals");
  const value = String(ctx.node.data.value ?? "");

  const result = evaluateCondition(ctx.lead.state, field, operator, value);
  const handle = result ? "true" : "false";

  const edge = ctx.edges.find(
    (e) => e.source === ctx.node.id && e.sourceHandle === handle
  );

  return {
    nextNodeId: edge?.target ?? null,
  };
}
