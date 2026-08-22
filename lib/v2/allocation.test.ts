import { describe, expect, it } from "vitest";
import { DEFAULT_ALLOCATION } from "../../server/v2/demo-data";
import {
  appendStrategyToBucket,
  equalWeights,
  evaluateStrategyDrop,
  rebalanceDraft,
} from "./allocation";

describe("allocation editor helpers", () => {
  it("always distributes integer weights to exactly 100", () => {
    for (let count = 1; count <= 6; count += 1) {
      const weights = equalWeights(count);
      expect(weights).toHaveLength(count);
      expect(weights.reduce((sum, value) => sum + value, 0)).toBe(100);
    }
  });

  it("rebalances platforms and every strategy bucket", () => {
    const draft = structuredClone(DEFAULT_ALLOCATION);
    draft.platformBuckets[0].capitalWeightPct = 91;
    draft.platformBuckets[0].strategies[0].weightPct = 10;
    const result = rebalanceDraft(draft);
    expect(result.platformBuckets.reduce((sum, item) => sum + item.capitalWeightPct, 0)).toBe(100);
    for (const bucket of result.platformBuckets) {
      expect(bucket.strategies.reduce((sum, item) => sum + item.weightPct, 0)).toBe(100);
    }
    expect(result.source).toBe("CUSTOM");
  });
});

describe("strategy drop shortcut", () => {
  const bucket = () => structuredClone(DEFAULT_ALLOCATION.platformBuckets[0]);

  it("accepts a compatible, fresh, new strategy", () => {
    const verdict = evaluateStrategyDrop({
      bucket: bucket(),
      supportedStrategyIds: ["incoming-strategy"],
      strategyId: "incoming-strategy",
      strategyOffline: false,
    });
    expect(verdict).toEqual({ allowed: true });
  });

  it("rejects a strategy the platform does not support", () => {
    const verdict = evaluateStrategyDrop({
      bucket: bucket(),
      supportedStrategyIds: [],
      strategyId: "incoming-strategy",
      strategyOffline: false,
    });
    expect(verdict).toEqual({ allowed: false, reason: "INCOMPATIBLE" });
  });

  it("rejects an offline strategy even when compatible", () => {
    const verdict = evaluateStrategyDrop({
      bucket: bucket(),
      supportedStrategyIds: ["incoming-strategy"],
      strategyId: "incoming-strategy",
      strategyOffline: true,
    });
    expect(verdict).toEqual({ allowed: false, reason: "OFFLINE" });
  });

  it("rejects a strategy already present in the bucket", () => {
    const target = bucket();
    const existingId = target.strategies[0].strategyId;
    const verdict = evaluateStrategyDrop({
      bucket: target,
      supportedStrategyIds: [existingId],
      strategyId: existingId,
      strategyOffline: false,
    });
    expect(verdict).toEqual({ allowed: false, reason: "DUPLICATE" });
  });

  it("appends via the same action as the add button and keeps weights at 100", () => {
    const target = bucket();
    const before = target.strategies.length;
    const result = appendStrategyToBucket(target, "incoming-strategy");
    expect(result.strategies).toHaveLength(before + 1);
    expect(result.strategies.at(-1)).toMatchObject({
      strategyId: "incoming-strategy",
      riskMultiplier: 0.8,
    });
    expect(result.strategies.reduce((sum, item) => sum + item.weightPct, 0)).toBe(100);
  });
});
