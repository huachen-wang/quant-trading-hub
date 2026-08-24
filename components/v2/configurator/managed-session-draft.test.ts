import { describe, expect, it } from "vitest";
import type { AllocationDraft, CoreStrategy } from "@/shared/v2/contracts";
import { buildManagedSessionDraft } from "./managed-session-draft";

const strategies = Array.from({ length: 6 }, (_, index) => ({
  id: `strategy-${index + 1}`,
  homeSlot: index + 1,
})) as CoreStrategy[];

const allocation = {
  id: "allocation-test",
  version: 1,
  mode: "SELF_ALLOCATED",
  source: "CUSTOM",
  capital: { amount: "50000", currency: "USD" },
  riskBudget: { profile: "MEDIUM", maxDrawdownPct: 12 },
  platformBuckets: [
    {
      platformId: "broker-a",
      capitalWeightPct: 55,
      strategies: [],
    },
    {
      platformId: "broker-b",
      capitalWeightPct: 45,
      strategies: [],
    },
  ],
  dataMode: "DEMO",
} as AllocationDraft;

describe("buildManagedSessionDraft", () => {
  it("maps six strategies and two mixed execution slots into an inert create input", () => {
    const result = buildManagedSessionDraft({
      draft: allocation,
      strategies,
      durationDays: 90,
      exitMode: "NO_NEW_ENTRIES",
      fundingRoutes: ["DIRECT_BROKER", "MANAGED_VAULT"],
    });

    expect(result).toMatchObject({
      termDays: 90,
      capitalMode: "MIXED",
      settlementAsset: "USDT",
      riskProfile: "BALANCED",
      exitMode: "NATURAL_EXIT",
    });
    expect(result.strategies).toHaveLength(6);
    expect(
      result.strategies.reduce((sum, item) => sum + item.weightPct, 0),
    ).toBe(100);
    expect(result.executionSlots).toMatchObject([
      { brokerId: "broker-a", fundingSource: "DIRECT_BROKER" },
      { brokerId: "broker-b", fundingSource: "MANAGED_VAULT" },
    ]);
    expect(
      result.executionSlots.reduce(
        (sum, item) => sum + item.capitalWeightPct,
        0,
      ),
    ).toBe(100);
  });

  it("rejects mixed funding with only one broker slot", () => {
    expect(() =>
      buildManagedSessionDraft({
        draft: {
          ...allocation,
          platformBuckets: allocation.platformBuckets.slice(0, 1),
        },
        strategies,
        durationDays: 30,
        exitMode: "CLOSE_NOW",
        fundingRoutes: ["DIRECT_BROKER", "MANAGED_VAULT"],
      }),
    ).toThrow("混合路由需要 2 个券商执行槽");
  });
});
