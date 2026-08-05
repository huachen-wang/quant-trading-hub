import { describe, expect, it } from "vitest";
import { filterAdminStrategies } from "./admin-strategy-search";

const strategies = [
  {
    id: 7,
    title: "金戈铁马 V5.1 永不爆仓版本",
    description: "黄金多品种策略",
    platform: "MT5",
    pairs: "XAUUSD",
    tags: "黄金,趋势",
    status: "published",
  },
  {
    id: 18,
    title: "TwisterPro Scalper EA",
    description: "低延迟短线策略",
    platform: "MT5",
    pairs: "EURUSD",
    tags: "剥头皮,短线",
    status: "archived",
  },
];

describe("filterAdminStrategies", () => {
  it("searches titles, ids, platforms, pairs and tags", () => {
    expect(filterAdminStrategies(strategies, "金戈 V5.1")).toEqual([
      strategies[0],
    ]);
    expect(filterAdminStrategies(strategies, "#7 XAUUSD")).toEqual([
      strategies[0],
    ]);
    expect(filterAdminStrategies(strategies, "twister mt5 短线")).toEqual([
      strategies[1],
    ]);
  });

  it("searches localized status labels", () => {
    expect(filterAdminStrategies(strategies, "已归档")).toEqual([
      strategies[1],
    ]);
  });

  it("returns the original collection for an empty query", () => {
    expect(filterAdminStrategies(strategies, "   ")).toBe(strategies);
  });
});
