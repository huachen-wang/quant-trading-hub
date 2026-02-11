import { describe, it, expect } from "vitest";
import * as db from "../server/db";

describe("用户体验优化功能测试", () => {
  it("应该能够搜索EA策略", async () => {
    const results = await db.searchStrategies("黄金", 10);
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    // 验证搜索结果包含关键词
    if (results.length > 0) {
      const hasKeyword = results.some(
        (s: { title: string; description?: string | null; pairs: string }) =>
          s.title.includes("黄金") ||
          s.description?.includes("黄金") ||
          s.pairs.includes("GOLD") ||
          s.pairs.includes("XAU")
      );
      expect(hasKeyword).toBe(true);
    }
  });

  it("应该能够按平台筛选策略", async () => {
    const mt4Strategies = await db.getStrategies({ platform: "MT4" });
    const mt5Strategies = await db.getStrategies({ platform: "MT5" });
    
    expect(mt4Strategies).toBeDefined();
    expect(mt5Strategies).toBeDefined();
    
    // 验证筛选结果正确
    mt4Strategies.forEach((s: { platform: string }) => expect(s.platform).toBe("MT4"));
    mt5Strategies.forEach((s: { platform: string }) => expect(s.platform).toBe("MT5"));
  });

  it("应该能够按不同方式排序策略", async () => {
    const latestStrategies = await db.getStrategies({ orderBy: "latest" });
    const popularStrategies = await db.getStrategies({ orderBy: "popular" });
    const returnStrategies = await db.getStrategies({ orderBy: "return" });
    
    expect(latestStrategies).toBeDefined();
    expect(popularStrategies).toBeDefined();
    expect(returnStrategies).toBeDefined();
    
    // 验证排序结果
    if (latestStrategies.length > 1) {
      const first = new Date(latestStrategies[0].createdAt);
      const second = new Date(latestStrategies[1].createdAt);
      expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
    }
  });

  it("访客模式应该能够查看策略列表", async () => {
    // 不需要登录即可获取策略列表
    const strategies = await db.getStrategies({});
    expect(strategies).toBeDefined();
    expect(strategies.length).toBeGreaterThan(0);
  });

  it("访客模式应该能够查看策略详情", async () => {
    const strategies = await db.getStrategies({ limit: 1 });
    if (strategies.length > 0) {
      const detail = await db.getStrategyById(strategies[0].id);
      expect(detail).toBeDefined();
      expect(detail?.id).toBe(strategies[0].id);
    }
  });
});
