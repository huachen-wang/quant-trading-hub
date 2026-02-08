import { describe, it, expect } from "vitest";
import * as db from "../server/db";

describe("Admin Functions Tests", () => {
  it("should create a new strategy", async () => {
    const newStrategy = {
      title: "Test EA Strategy",
      description: "Test description",
      platform: "MT4" as const,
      pairs: "EURUSD,GBPUSD",
      timeframe: "H1",
      totalReturn: "15.50",
      winRate: "65.00",
      isFree: true,
      status: "published" as const,
    };

    const result = await db.createStrategy(newStrategy);
    expect(result).toBeDefined();
  });

  it("should get all strategies", async () => {
    const strategies = await db.getAllStrategies({
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(strategies)).toBe(true);
  });

  it("should filter strategies by status", async () => {
    const publishedStrategies = await db.getAllStrategies({
      status: "published",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(publishedStrategies)).toBe(true);
    publishedStrategies.forEach((strategy) => {
      expect(strategy.status).toBe("published");
    });
  });

  it("should get admin stats", async () => {
    const stats = await db.getAdminStats();

    expect(stats).toBeDefined();
    expect(typeof stats?.totalStrategies).toBe("number");
    expect(typeof stats?.publishedStrategies).toBe("number");
    expect(typeof stats?.totalDownloads).toBe("number");
    expect(typeof stats?.totalPurchases).toBe("number");
    expect(typeof stats?.totalComments).toBe("number");
  });

  it("should get all comments", async () => {
    const comments = await db.getAllComments(10, 0);
    expect(Array.isArray(comments)).toBe(true);
  });
});
