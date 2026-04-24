import { describe, it, expect, beforeEach } from "vitest";
import { AccountPool, type PoolAccount } from "../../src/services/mtproto/pool.js";

function makeAccount(id: string, status: PoolAccount["status"] = "active"): PoolAccount {
  return {
    id,
    phoneNumber: `+100000000${id}`,
    sessionString: `sess-${id}`,
    status,
    floodWaitUntil: null,
  };
}

describe("AccountPool", () => {
  let pool: AccountPool;

  beforeEach(() => {
    pool = new AccountPool();
  });

  it("round-robins across active accounts", () => {
    pool.load([makeAccount("a"), makeAccount("b"), makeAccount("c")]);
    expect(pool.next()?.id).toBe("a");
    expect(pool.next()?.id).toBe("b");
    expect(pool.next()?.id).toBe("c");
    expect(pool.next()?.id).toBe("a");
  });

  it("skips flood_wait accounts still in cooldown", () => {
    const flooded = makeAccount("a", "flood_wait");
    flooded.floodWaitUntil = new Date(Date.now() + 60_000);
    pool.load([flooded, makeAccount("b")]);
    expect(pool.next()?.id).toBe("b");
    expect(pool.next()?.id).toBe("b");
  });

  it("reconsiders flood_wait accounts once cooldown expires", () => {
    const flooded = makeAccount("a", "flood_wait");
    flooded.floodWaitUntil = new Date(Date.now() - 1000);
    pool.load([flooded, makeAccount("b")]);
    const seen = new Set<string>();
    seen.add(pool.next()!.id);
    seen.add(pool.next()!.id);
    expect(seen).toEqual(new Set(["a", "b"]));
  });

  it("returns null when pool is empty or all unavailable", () => {
    pool.load([makeAccount("a", "banned"), makeAccount("b", "disconnected")]);
    expect(pool.next()).toBeNull();
  });

  it("markFloodWait removes account from rotation until expiry", () => {
    pool.load([makeAccount("a"), makeAccount("b")]);
    pool.markFloodWait("a", 60);
    expect(pool.next()?.id).toBe("b");
    expect(pool.next()?.id).toBe("b");
  });

  it("markBanned removes permanently", () => {
    pool.load([makeAccount("a"), makeAccount("b")]);
    pool.markBanned("a");
    expect(pool.next()?.id).toBe("b");
    expect(pool.next()?.id).toBe("b");
  });
});
