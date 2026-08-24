import { describe, expect, it } from "vitest";
import { managedSessionDraftInputSchema } from "../../shared/managed-sessions/contracts";

const sixStrategies = [
  "jingge-v51",
  "night-hunter",
  "quantum-queen",
  "gold-reaper",
  "black-aura",
  "bitcoin-core",
].map((strategyId, index) => ({
  strategyId,
  weightPct: index === 5 ? 15 : 17,
  riskMultiplier: 1,
}));

describe("managed session draft contract", () => {
  it("accepts a six-strategy mixed direct broker and vault draft", () => {
    const parsed = managedSessionDraftInputSchema.parse({
      termDays: 90,
      capitalMode: "MIXED",
      targetCapital: "50000",
      settlementAsset: "USDT",
      riskProfile: "BALANCED",
      maxDrawdownPct: 12,
      exitMode: "NATURAL_EXIT",
      strategies: sixStrategies,
      executionSlots: [
        {
          brokerId: "atlas-prime",
          capitalWeightPct: 60,
          fundingSource: "DIRECT_BROKER",
        },
        {
          brokerId: "vertex",
          capitalWeightPct: 40,
          fundingSource: "MANAGED_VAULT",
        },
      ],
    });

    expect(parsed.strategies).toHaveLength(6);
    expect(parsed.executionSlots).toHaveLength(2);
    expect(parsed.settlementAsset).toBe("USDT");
  });

  it("rejects duplicate strategies and inconsistent mixed funding", () => {
    const result = managedSessionDraftInputSchema.safeParse({
      termDays: 30,
      capitalMode: "MIXED",
      targetCapital: "10000",
      riskProfile: "CONSERVATIVE",
      maxDrawdownPct: 8,
      exitMode: "IMMEDIATE_CLOSE",
      strategies: sixStrategies.map((item, index) => ({
        ...item,
        strategyId: index === 5 ? sixStrategies[0].strategyId : item.strategyId,
      })),
      executionSlots: [
        {
          brokerId: "atlas-prime",
          capitalWeightPct: 50,
          fundingSource: "DIRECT_BROKER",
        },
        {
          brokerId: "vertex",
          capitalWeightPct: 50,
          fundingSource: "DIRECT_BROKER",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.map((issue) => issue.message).join(" "),
      ).toMatch(/6 款不重复策略.*MIXED/);
    }
  });
});
