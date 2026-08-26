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
  const baseDraft = {
    onboardingMode: "SELF_OPENED" as const,
    fundsRoute: "BROKER_DIRECT" as const,
    targetCapital: "10000",
    riskProfile: "CONSERVATIVE" as const,
    maxDrawdownPct: 8,
    executionSlots: [
      { brokerId: "exness" as const, capitalWeightPct: 100 },
    ],
  };

  it.each([
    [[{ strategyId: "jingge-v51", weightPct: 100, riskMultiplier: 1 }]],
    [[
      { strategyId: "jingge-v51", weightPct: 34, riskMultiplier: 1 },
      { strategyId: "night-hunter", weightPct: 33, riskMultiplier: 1 },
      { strategyId: "quantum-queen", weightPct: 33, riskMultiplier: 1 },
    ]],
    [sixStrategies],
  ])("accepts a selectable 1–6 strategy subset", (strategies) => {
    expect(
      managedSessionDraftInputSchema.parse({ ...baseDraft, strategies })
        .strategies,
    ).toHaveLength(strategies.length);
  });

  it("accepts the fixed six strategies with broker-direct onboarding", () => {
    const parsed = managedSessionDraftInputSchema.parse({
      onboardingMode: "SELF_OPENED",
      fundsRoute: "BROKER_DIRECT",
      targetCapital: "50000",
      settlementAsset: "USDT",
      riskProfile: "BALANCED",
      maxDrawdownPct: 12,
      exitMode: "NATURAL_EXIT",
      strategies: sixStrategies,
      executionSlots: [
        {
          brokerId: "exness",
          capitalWeightPct: 60,
        },
        {
          brokerId: "ic-markets",
          capitalWeightPct: 40,
        },
      ],
    });

    expect(parsed.strategies).toHaveLength(6);
    expect(parsed.executionSlots).toHaveLength(2);
    expect(parsed.settlementAsset).toBe("USDT");
  });

  it("rejects duplicate strategies and platform collection without assisted onboarding", () => {
    const result = managedSessionDraftInputSchema.safeParse({
      onboardingMode: "SELF_OPENED",
      fundsRoute: "PLATFORM_COLLECTION",
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
          brokerId: "exness",
          capitalWeightPct: 50,
        },
        {
          brokerId: "ic-markets",
          capitalWeightPct: 50,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages.some((message) => /已选策略不得重复/.test(message))).toBe(true);
      expect(messages.some((message) => /平台代收仅适用/.test(message))).toBe(true);
    }
  });

  it("rejects strategies outside the fixed six-item catalog", () => {
    expect(
      managedSessionDraftInputSchema.safeParse({
        ...baseDraft,
        strategies: [
          { strategyId: "unknown-strategy", weightPct: 100, riskMultiplier: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects the removed term and vault fields instead of silently accepting them", () => {
    const result = managedSessionDraftInputSchema.safeParse({
      onboardingMode: "PLATFORM_ASSISTED",
      fundsRoute: "BROKER_DIRECT",
      targetCapital: "10000",
      riskProfile: "CONSERVATIVE",
      maxDrawdownPct: 8,
      strategies: sixStrategies,
      executionSlots: [{ brokerId: "blueberry-markets", capitalWeightPct: 100 }],
      termDays: 90,
      capitalMode: "MANAGED_VAULT",
    });
    expect(result.success).toBe(false);
  });
});
