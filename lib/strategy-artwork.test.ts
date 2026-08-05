import { describe, expect, it } from "vitest";
import { getStrategyShortName, resolveStrategyArtwork } from "./strategy-artwork";

describe("strategy artwork resolver", () => {
  it("prioritizes grid and hedge behavior over the traded symbol", () => {
    const artwork = resolveStrategyArtwork({
      title: "EAXAU 黄金极限多空双开",
      tags: "黄金,对冲,多空,组合风控",
      pairs: "XAUUSD",
    });

    expect(artwork.kind).toBe("grid");
    expect(["/strategy-art-v2/grid-control.jpg", "/strategy-art/grid-hedge.jpg"]).toContain(artwork.image);
    expect(artwork.label).toBe("对冲组合");
    expect(artwork.detail).toBe("XAUUSD · 组合风控");
  });

  it("maps scalping and breakout strategies to the execution artwork", () => {
    expect(["/strategy-art-v2/breakout-execution.jpg", "/strategy-art/scalping-breakout.jpg", "/strategy-art/execution-engine.jpg"]).toContain(
      resolveStrategyArtwork({
        title: "Gold Breakout PRO",
        tags: "黄金,突破,短线",
      }).image,
    );
  });

  it("maps AI, multi-asset and digital-asset strategies to the intelligent artwork", () => {
    expect(
      resolveStrategyArtwork({
        title: "Quantum Bitcoin",
        tags: "数字货币,趋势,波动",
      }).label,
    ).toBe("数字资产");
    expect(
      resolveStrategyArtwork({
        title: "AI 深度学习交易指标",
        productType: "indicator",
      }).image,
    ).toBe("/strategy-art-v2/adaptive-signal.jpg");
  });

  it("uses the gold visual for gold strategies and the trend label elsewhere", () => {
    expect(resolveStrategyArtwork({ title: "Gold Trend X", pairs: "XAUUSD" }).label).toBe("黄金趋势");
    expect(resolveStrategyArtwork({ title: "Wave Rider", pairs: "EURUSD" }).label).toBe("趋势策略");
  });

  it("builds a short strategy-specific summary without repeating the title", () => {
    expect(
      resolveStrategyArtwork({
        title: "Adaptive Gold Scalper MT5",
        pairs: "XAUUSD",
        tags: "黄金,剥头皮,自适应",
      }).detail,
    ).toBe("XAUUSD · 自适应");

    expect(
      resolveStrategyArtwork({
        title: "Unknown Tool",
        productType: "tool",
      }).detail,
    ).toBe("多品种 · 参数工具 / 风险控制");
  });

  it("selects visual variants deterministically within busy categories", () => {
    const titles = ["SuperTrend EA", "Gold Trend X", "The Gold EA", "Silver Trend Trader"];
    const images = titles.map((title) => resolveStrategyArtwork({ title, pairs: "XAUUSD" }).image);

    expect(new Set(images).size).toBeGreaterThan(1);
    expect(resolveStrategyArtwork({ title: titles[0], pairs: "XAUUSD" }).image).toBe(images[0]);
  });

  it("separates common strategy mechanisms into distinct visual families", () => {
    const artworks = [
      resolveStrategyArtwork({ title: "Gold Momentum", pairs: "XAUUSD" }),
      resolveStrategyArtwork({
        title: "Range Mean Reversion",
        tags: "均值回归",
      }),
      resolveStrategyArtwork({ title: "Breakout Sniper", tags: "突破" }),
      resolveStrategyArtwork({ title: "V4 Grid Bot", tags: "网格" }),
      resolveStrategyArtwork({ title: "Liquidity Flow", tags: "订单流" }),
      resolveStrategyArtwork({
        title: "Multi Asset Portfolio",
        tags: "多资产",
      }),
      resolveStrategyArtwork({ title: "Adaptive AI", tags: "自适应" }),
      resolveStrategyArtwork({ title: "News Straddle", tags: "新闻" }),
    ];

    expect(new Set(artworks.map((artwork) => artwork.kind)).size).toBe(8);
    expect(new Set(artworks.map((artwork) => artwork.image)).size).toBe(8);
  });

  it("uses a memorable strategy keyword instead of repeating the full title", () => {
    expect(getStrategyShortName("金戈铁马 正版云控 V4.3")).toBe("金戈铁马");
    expect(getStrategyShortName("Pro Gold Lion EA v1.31 中文版")).toBe("Gold Lion");
    expect(getStrategyShortName("Quantum Queen X MT5")).toBe("Quantum Queen");
    expect(getStrategyShortName("TwisterPro Scalper EA")).toBe("TwisterPro");
    expect(getStrategyShortName("多货币网格交易机器人")).toBe("多货币网格");
    expect(getStrategyShortName("蓝狗对冲趋势加强版")).toBe("蓝狗对冲");
    expect(getStrategyShortName("恒鑫 EA 量化 v26 强化版")).toBe("恒鑫量化");
    expect(getStrategyShortName("莫奈灰优化-太极 MT5 v1.8")).toBe("莫奈灰");
    expect(getStrategyShortName("Night Hunter Pro 【夜间猎手】")).toBe("夜间猎手");
    expect(getStrategyShortName("Mad Turtle ML 【疯狂神龟】")).toBe("疯狂神龟");
    expect(getStrategyShortName("Gold House 2.0 黄金屋")).toBe("黄金屋");
    expect(getStrategyShortName("Waka WakaV4.59")).toBe("Waka Waka");
  });
});
