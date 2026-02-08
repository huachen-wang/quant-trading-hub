import { describe, it, expect } from "vitest";
import * as db from "../server/db";

describe("Simplified API Tests", () => {
  it("should get strategies list", async () => {
    const strategies = await db.getStrategies({
      platform: undefined,
      orderBy: "latest",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(strategies)).toBe(true);
  });

  it("should filter strategies by platform", async () => {
    const mt4Strategies = await db.getStrategies({
      platform: "MT4",
      orderBy: "latest",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(mt4Strategies)).toBe(true);
    mt4Strategies.forEach((strategy) => {
      expect(strategy.platform).toBe("MT4");
    });
  });

  it("should search strategies", async () => {
    const results = await db.searchStrategies("test", 10);
    expect(Array.isArray(results)).toBe(true);
  });
});
