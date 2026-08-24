import { describe, expect, it } from "vitest";
import { validateAllocation } from "./allocation-engine";
import {
  DEFAULT_ALLOCATION,
  DEMO_PLATFORMS,
  DEMO_STRATEGIES,
} from "./demo-data";
import { DemoQuantDataProvider } from "./provider";

describe("V2 allocation engine", () => {
  it("accepts the balanced reference draft with visible non-blocking warnings", () => {
    const result = validateAllocation(
      DEFAULT_ALLOCATION,
      DEMO_PLATFORMS,
      DEMO_STRATEGIES,
    );
    expect(result.valid).toBe(true);
    expect(result.estimated.modeledDrawdownPct).toBeGreaterThan(0);
    expect(result.issues.some((item) => item.code === "DEMO_DATA")).toBe(true);
    expect(result.termsVersions).toHaveProperty("exness");
  });

  it("blocks a draft whose platform weights do not total 100 percent", () => {
    const draft = structuredClone(DEFAULT_ALLOCATION);
    draft.platformBuckets[0].capitalWeightPct = 20;
    const result = validateAllocation(draft, DEMO_PLATFORMS, DEMO_STRATEGIES);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((item) => item.code === "PLATFORM_WEIGHT_TOTAL"),
    ).toBe(true);
  });

  it("blocks an offline strategy even when every supported broker is compatible", () => {
    const draft = structuredClone(DEFAULT_ALLOCATION);
    draft.platformBuckets = [
      {
        platformId: "exness",
        capitalWeightPct: 100,
        strategies: [
          { strategyId: "bitcoin-core", weightPct: 100, riskMultiplier: 1 },
        ],
      },
    ];
    const result = validateAllocation(draft, DEMO_PLATFORMS, DEMO_STRATEGIES);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain("STRATEGY_OFFLINE");
  });

  it("returns a deterministic risk-aware recommendation", async () => {
    const provider = new DemoQuantDataProvider();
    const first = await provider.recommendAllocation({
      capital: { amount: "15000", currency: "USD" },
      riskProfile: "LOW",
    });
    const second = await provider.recommendAllocation({
      capital: { amount: "15000", currency: "USD" },
      riskProfile: "LOW",
    });
    expect(first).toEqual(second);
    expect(first.platformBuckets).toHaveLength(1);
    expect(first.riskBudget.maxDrawdownPct).toBe(8);
  });

  it("keeps explicit strategy and platform selections in the recommendation", async () => {
    const provider = new DemoQuantDataProvider();
    const result = await provider.recommendAllocation({
      capital: { amount: "50000", currency: "USD" },
      riskProfile: "MEDIUM",
      platformIds: ["exness", "ic-markets"],
      strategyIds: ["jingge-v51", "quantum-queen"],
    });

    expect(result.platformBuckets.map((bucket) => bucket.platformId)).toEqual([
      "exness",
      "ic-markets",
    ]);
    expect(
      Array.from(
        new Set(
          result.platformBuckets.flatMap((bucket) =>
            bucket.strategies.map((strategy) => strategy.strategyId),
          ),
        ),
      ).sort(),
    ).toEqual(["jingge-v51", "quantum-queen"]);
    expect(
      validateAllocation(result, DEMO_PLATFORMS, DEMO_STRATEGIES).valid,
    ).toBe(true);
  });
});
