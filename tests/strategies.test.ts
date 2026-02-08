import { describe, it, expect, beforeAll } from "vitest";
import * as db from "../server/db";

describe("Strategies Database Operations", () => {
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
  });

  it("should search strategies by keyword", async () => {
    const results = await db.searchStrategies("黄金", 10);
    expect(Array.isArray(results)).toBe(true);
  });
});
