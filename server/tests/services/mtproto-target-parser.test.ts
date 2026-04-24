import { describe, it, expect } from "vitest";
import { parseTargets } from "../../src/services/mtproto/target-parser.js";

describe("parseTargets", () => {
  it("parses @username", () => {
    const r = parseTargets("@joao");
    expect(r).toEqual([{ identifier: "joao", type: "username", valid: true }]);
  });

  it("parses username without @", () => {
    const r = parseTargets("joao_silva");
    expect(r).toEqual([{ identifier: "joao_silva", type: "username", valid: true }]);
  });

  it("parses +phone", () => {
    const r = parseTargets("+5511999998888");
    expect(r).toEqual([{ identifier: "+5511999998888", type: "phone", valid: true }]);
  });

  it("parses phone without +", () => {
    const r = parseTargets("5511999998888");
    expect(r).toEqual([{ identifier: "+5511999998888", type: "phone", valid: true }]);
  });

  it("splits by newlines and commas and semicolons", () => {
    const r = parseTargets("@a_xy\n@b_xy,@c_xy;@d_xy");
    expect(r.map((t) => t.identifier)).toEqual(["a_xy", "b_xy", "c_xy", "d_xy"]);
  });

  it("trims whitespace", () => {
    const r = parseTargets("  @joao  \n  @maria  ");
    expect(r.map((t) => t.identifier)).toEqual(["joao", "maria"]);
  });

  it("dedupes", () => {
    const r = parseTargets("@joao\n@joao\n@maria");
    expect(r).toHaveLength(2);
  });

  it("marks invalid entries", () => {
    const r = parseTargets("!!!invalid!!!");
    expect(r[0].valid).toBe(false);
  });

  it("rejects usernames with spaces", () => {
    const r = parseTargets("joao silva");
    expect(r[0].valid).toBe(false);
  });

  it("ignores empty tokens", () => {
    const r = parseTargets("\n\n@joao\n\n\n");
    expect(r).toHaveLength(1);
  });
});
