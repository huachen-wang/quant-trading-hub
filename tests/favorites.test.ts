import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock AsyncStorage for testing
const storage: Record<string, string> = {};
const AsyncStorage = {
  getItem: vi.fn(async (key: string) => storage[key] || null),
  setItem: vi.fn(async (key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: vi.fn(async (key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(async () => {
    Object.keys(storage).forEach((key) => delete storage[key]);
  }),
};

const FAVORITES_KEY = "@quant_trading_hub:favorites";

describe("收藏功能测试", () => {
  beforeEach(async () => {
    // 清空收藏数据
    await AsyncStorage.removeItem(FAVORITES_KEY);
  });

  it("应该能够添加收藏", async () => {
    const strategy = {
      id: 1,
      title: "测试策略",
      platform: "MT4",
      totalReturn: "+50.00",
      winRate: "65.00",
      price: "299.00",
      isFree: false,
      addedAt: new Date().toISOString(),
    };

    // 保存收藏
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([strategy]));

    // 读取收藏
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    const favorites = data ? JSON.parse(data) : [];

    expect(favorites).toHaveLength(1);
    expect(favorites[0].id).toBe(1);
    expect(favorites[0].title).toBe("测试策略");
  });

  it("应该能够移除收藏", async () => {
    const strategies = [
      {
        id: 1,
        title: "策略1",
        platform: "MT4",
        totalReturn: "+50.00",
        winRate: "65.00",
        price: "299.00",
        isFree: false,
        addedAt: new Date().toISOString(),
      },
      {
        id: 2,
        title: "策略2",
        platform: "MT5",
        totalReturn: "+80.00",
        winRate: "70.00",
        price: "399.00",
        isFree: false,
        addedAt: new Date().toISOString(),
      },
    ];

    // 保存两个收藏
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(strategies));

    // 移除第一个
    const newFavorites = strategies.filter((s) => s.id !== 1);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));

    // 读取收藏
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    const favorites = data ? JSON.parse(data) : [];

    expect(favorites).toHaveLength(1);
    expect(favorites[0].id).toBe(2);
  });

  it("应该能够检查是否已收藏", async () => {
    const strategies = [
      {
        id: 1,
        title: "策略1",
        platform: "MT4",
        totalReturn: "+50.00",
        winRate: "65.00",
        price: "299.00",
        isFree: false,
        addedAt: new Date().toISOString(),
      },
    ];

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(strategies));

    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    const favorites = data ? JSON.parse(data) : [];

    const isFavorite = (id: number) => favorites.some((fav: any) => fav.id === id);

    expect(isFavorite(1)).toBe(true);
    expect(isFavorite(2)).toBe(false);
  });

  it("应该能够清空所有收藏", async () => {
    const strategies = [
      {
        id: 1,
        title: "策略1",
        platform: "MT4",
        totalReturn: "+50.00",
        winRate: "65.00",
        price: "299.00",
        isFree: false,
        addedAt: new Date().toISOString(),
      },
      {
        id: 2,
        title: "策略2",
        platform: "MT5",
        totalReturn: "+80.00",
        winRate: "70.00",
        price: "399.00",
        isFree: false,
        addedAt: new Date().toISOString(),
      },
    ];

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(strategies));

    // 清空
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([]));

    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    const favorites = data ? JSON.parse(data) : [];

    expect(favorites).toHaveLength(0);
  });
});
