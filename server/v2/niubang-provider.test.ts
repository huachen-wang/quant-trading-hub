import { describe, expect, it } from "vitest";
import { DEMO_STRATEGIES } from "./demo-data";
import { mapNiubangDetailToStrategy } from "./niubang-provider";

describe("Niubang V2 read adapter", () => {
  it("maps imported history and live points into a hybrid strategy", () => {
    const mapped = mapNiubangDetailToStrategy(DEMO_STRATEGIES[0], {
      slug: "jingge",
      summary: "mapped",
      description: "来自牛帮的策略说明",
      coverImageUrl: "/cover.jpg",
      images: ["/evidence.jpg"],
      dataSource: "mt_readonly",
      metrics: {
        monthlyReturnPct: 4.2,
        totalReturnPct: 20,
        maxDrawdownPct: 7.8,
        winRatePct: 66,
        tradeCount: 90,
        accountEquityUsd: 12000,
      },
      fullEquityPoints: [
        { time: "2026-08-01T00:00:00.000Z", equityValue: 10000, source: "imported" },
        { time: "2026-08-20T00:00:00.000Z", equityValue: 12000, source: "live" },
      ],
      currentPositions: [{
        id: 10,
        symbol: "XAUUSD",
        direction: "多",
        lots: 0.1,
        openPrice: 2400,
        currentPrice: 2410,
        floatingPnl: 100,
        openedAt: "2026-08-20T00:00:00.000Z",
      }],
      recentTrades: [{
        id: 9,
        symbol: "XAUUSD",
        direction: "空",
        lots: 0.1,
        entryPrice: 2420,
        exitPrice: 2410,
        pnlUsd: 100,
        tradeTime: "2026-08-19T00:00:00.000Z",
      }],
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      historyHandoverAt: "2026-08-15T00:00:00.000Z",
    }, "https://niubang.example/api");

    expect(mapped.source.dataMode).toBe("HYBRID");
    expect(mapped.source.provider).toBe("niubang.ai");
    expect(mapped.equity.map((point) => point.source)).toEqual(["CUSTOM", "LIVE"]);
    expect(mapped.positions[0]?.side).toBe("BUY");
    expect(mapped.recentTrades[0]?.side).toBe("SELL");
    expect(mapped.artwork).toBe("https://niubang.example/cover.jpg");
    expect(mapped.contentBlocks.some((block) => block.type === "media_gallery")).toBe(true);
  });
});
