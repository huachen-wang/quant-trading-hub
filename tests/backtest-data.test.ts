import { describe, it, expect } from "vitest";
import * as db from "../server/db";

describe("Backtest Data Tests", () => {
  it("should get backtest data for a strategy", async () => {
    // 获取第一个策略
    const strategies = await db.getStrategies({ limit: 1 });
    expect(strategies.length).toBeGreaterThan(0);

    const strategyId = strategies[0].id;

    // 获取回测数据
    const backtestData = await db.getBacktestData(strategyId);
    
    expect(backtestData).toBeDefined();
    expect(Array.isArray(backtestData)).toBe(true);
    
    if (backtestData.length > 0) {
      const firstData = backtestData[0];
      expect(firstData).toHaveProperty("id");
      expect(firstData).toHaveProperty("strategyId");
      expect(firstData).toHaveProperty("date");
      expect(firstData).toHaveProperty("equity");
      expect(firstData).toHaveProperty("balance");
      expect(firstData).toHaveProperty("profit");
      expect(firstData).toHaveProperty("drawdown");
      expect(firstData).toHaveProperty("tradesCount");
    }
  });

  it("should have backtest data for all strategies", async () => {
    const strategies = await db.getStrategies({ limit: 100 });
    
    for (const strategy of strategies) {
      const backtestData = await db.getBacktestData(strategy.id);
      expect(backtestData.length).toBeGreaterThan(0);
    }
  });

  it("should return backtest data ordered by date", async () => {
    const strategies = await db.getStrategies({ limit: 1 });
    const strategyId = strategies[0].id;
    
    const backtestData = await db.getBacktestData(strategyId);
    
    if (backtestData.length > 1) {
      for (let i = 1; i < backtestData.length; i++) {
        const prevDate = new Date(backtestData[i - 1].date);
        const currDate = new Date(backtestData[i].date);
        expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
      }
    }
  });
});
