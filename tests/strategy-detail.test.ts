import { describe, it, expect } from "vitest";
import * as db from "../server/db";

describe("Strategy Detail and Comments Tests", () => {
  it("should get strategy by ID", async () => {
    const strategies = await db.getAllStrategies({ limit: 1, offset: 0 });
    const testStrategyId = strategies[0]?.id || 1;

    const strategy = await db.getStrategyById(testStrategyId);

    expect(strategy).toBeDefined();
    expect(strategy?.id).toBe(testStrategyId);
    expect(strategy?.title).toBeDefined();
    expect(strategy?.platform).toMatch(/^(MT4|MT5)$/);
  });

  it("should list comments for a strategy", async () => {
    const strategies = await db.getAllStrategies({ limit: 1, offset: 0 });
    const testStrategyId = strategies[0]?.id || 1;

    const comments = await db.getComments(testStrategyId);
    expect(Array.isArray(comments)).toBe(true);
  });

  it("should create a comment", async () => {
    const strategies = await db.getAllStrategies({ limit: 1, offset: 0 });
    const testStrategyId = strategies[0]?.id || 1;

    const result = await db.createComment({
      strategyId: testStrategyId,
      userId: 1,
      content: "这是一个测试备注说明",
    });

    expect(result).toBeDefined();
  });
});
