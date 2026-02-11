/**
 * 管理后台数据添加/编辑测试
 * 验证admin专用接口和数据路径一致性
 */
import { describe, it, expect } from "vitest";
import * as db from "../server/db";

describe("Admin Data Management", () => {
  it("should be able to create a new strategy via admin interface", async () => {
    const newStrategy = {
      title: "测试策略-" + Date.now(),
      description: "这是一个测试策略",
      platform: "MT4" as const,
      pairs: "EURUSD",
      timeframe: "H1",
      totalReturn: "+150.00",
      maxDrawdown: "15.00",
      sharpeRatio: "2.50",
      winRate: "65.00",
      price: "299.00",
      isFree: false,
      status: "draft" as const,
    };

    const created = await db.createStrategy(newStrategy);
    expect(created).toBeDefined();
    expect(created.id).toBeGreaterThan(0);
    expect(created.title).toBe(newStrategy.title);
    expect(created.status).toBe("draft");

    // 清理测试数据
    if (created.id) {
      await db.deleteStrategy(created.id);
    }
  });

  it("should be able to get strategy detail without incrementing view count", async () => {
    // 创建测试策略
    const newStrategy = {
      title: "测试策略-ViewCount-" + Date.now(),
      description: "测试浏览量不增加",
      platform: "MT5" as const,
      pairs: "GBPUSD",
      timeframe: "M15",
      totalReturn: "+200.00",
      maxDrawdown: "10.00",
      sharpeRatio: "3.00",
      winRate: "70.00",
      price: "399.00",
      isFree: false,
      status: "published" as const,
    };

    const created = await db.createStrategy(newStrategy);
    expect(created).toBeDefined();
    expect(created.id).toBeGreaterThan(0);

    // 获取初始浏览量
    const initialViews = created.viewCount || 0;

    // 通过admin接口获取详情（不应增加浏览量）
    const detail = await db.getStrategyById(created.id);
    expect(detail).toBeDefined();
    expect(detail?.viewCount).toBe(initialViews);

    // 清理测试数据
    if (created.id) {
      await db.deleteStrategy(created.id);
    }
  });

  it("should be able to update strategy via admin interface", async () => {
    // 创建测试策略
    const newStrategy = {
      title: "测试策略-Update-" + Date.now(),
      description: "原始描述",
      platform: "MT4" as const,
      pairs: "USDJPY",
      timeframe: "H4",
      totalReturn: "+100.00",
      maxDrawdown: "20.00",
      sharpeRatio: "1.80",
      winRate: "60.00",
      price: "199.00",
      isFree: false,
      status: "draft" as const,
    };

    const created = await db.createStrategy(newStrategy);
    expect(created).toBeDefined();

    // 更新策略
    const updated = await db.updateStrategy(created.id, {
      description: "更新后的描述",
      status: "published" as const,
      price: "299.00",
    });

    expect(updated).toBeDefined();
    expect(updated.description).toBe("更新后的描述");
    expect(updated.status).toBe("published");
    expect(updated.price).toBe("299.00");

    // 清理测试数据
    if (created.id) {
      await db.deleteStrategy(created.id);
    }
  });

  it("should be able to list all strategies with status filter", async () => {
    const allStrategies = await db.getAllStrategies({});
    expect(Array.isArray(allStrategies)).toBe(true);

    const draftStrategies = await db.getAllStrategies({ status: "draft" });
    expect(Array.isArray(draftStrategies)).toBe(true);
    draftStrategies.forEach((s: { status: string }) => {
      expect(s.status).toBe("draft");
    });

    const publishedStrategies = await db.getAllStrategies({ status: "published" });
    expect(Array.isArray(publishedStrategies)).toBe(true);
    publishedStrategies.forEach((s: { status: string }) => {
      expect(s.status).toBe("published");
    });
  });
});
