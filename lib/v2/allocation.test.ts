import { describe, expect, it } from "vitest";
import { DEFAULT_ALLOCATION } from "../../server/v2/demo-data";
import { equalWeights, rebalanceDraft } from "./allocation";

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
