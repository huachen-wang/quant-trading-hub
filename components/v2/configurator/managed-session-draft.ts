import type { AllocationDraft, CoreStrategy } from "@/shared/v2/contracts";
import type { ManagedSessionDraftInput } from "@/shared/managed-sessions/contracts";
import type { ExitMode, FundingRoute, ManagedSessionDuration } from "./types";

const RISK_PROFILE_MAP: Record<
  Exclude<AllocationDraft["riskBudget"]["profile"], "CUSTOM">,
  ManagedSessionDraftInput["riskProfile"]
> = {
  LOW: "CONSERVATIVE",
  MEDIUM: "BALANCED",
  HIGH: "AGGRESSIVE",
};

function managedRiskProfile(
  profile: AllocationDraft["riskBudget"]["profile"],
  maxDrawdownPct: number,
): ManagedSessionDraftInput["riskProfile"] {
  if (profile !== "CUSTOM") return RISK_PROFILE_MAP[profile];
  return maxDrawdownPct <= 8
    ? "CONSERVATIVE"
    : maxDrawdownPct <= 12
      ? "BALANCED"
      : "AGGRESSIVE";
}

const EXIT_MODE_MAP: Record<ExitMode, ManagedSessionDraftInput["exitMode"]> = {
  CLOSE_NOW: "IMMEDIATE_CLOSE",
  NO_NEW_ENTRIES: "NATURAL_EXIT",
  HAND_BACK_POSITIONS: "HANDOVER_OPEN_POSITIONS",
};

function capitalModeFor(
  routes: FundingRoute[],
): ManagedSessionDraftInput["capitalMode"] {
  if (routes.includes("DIRECT_BROKER") && routes.includes("MANAGED_VAULT")) {
    return "MIXED";
  }
  return routes.includes("MANAGED_VAULT") ? "MANAGED_VAULT" : "DIRECT_BROKER";
}

function normalizePercent(values: number[]) {
  if (!values.length) return [];
  const positive = values.map((value) =>
    Number.isFinite(value) && value > 0 ? value : 1,
  );
  const total = positive.reduce((sum, value) => sum + value, 0);
  const normalized = positive.map((value) =>
    Number(((value / total) * 100).toFixed(2)),
  );
  normalized[normalized.length - 1] = Number(
    (
      100 - normalized.slice(0, -1).reduce((sum, value) => sum + value, 0)
    ).toFixed(2),
  );
  return normalized;
}

export function buildManagedSessionDraft({
  draft,
  strategies,
  durationDays,
  exitMode,
  fundingRoutes,
}: {
  draft: AllocationDraft;
  strategies: CoreStrategy[];
  durationDays: ManagedSessionDuration;
  exitMode: ExitMode;
  fundingRoutes: FundingRoute[];
}): ManagedSessionDraftInput {
  const orderedStrategies = [...strategies].sort(
    (left, right) => left.homeSlot - right.homeSlot,
  );
  if (orderedStrategies.length !== 6) {
    throw new Error("资管会话必须包含 6 款不重复策略。");
  }
  if (draft.platformBuckets.length < 1 || draft.platformBuckets.length > 2) {
    throw new Error("请配置 1–2 个券商执行槽。");
  }

  const capitalMode = capitalModeFor(fundingRoutes);
  if (capitalMode === "MIXED" && draft.platformBuckets.length !== 2) {
    throw new Error("混合路由需要 2 个券商执行槽。");
  }

  const strategyWeights = normalizePercent(
    orderedStrategies.map((strategy) => {
      const globalWeight = draft.platformBuckets.reduce((sum, bucket) => {
        const configured = bucket.strategies.find(
          (item) => item.strategyId === strategy.id,
        );
        return (
          sum +
          (configured
            ? (bucket.capitalWeightPct * configured.weightPct) / 100
            : 0)
        );
      }, 0);
      return globalWeight || 1;
    }),
  );
  const slotWeights = normalizePercent(
    draft.platformBuckets.map((bucket) => bucket.capitalWeightPct),
  );
  const maxDrawdownPct = draft.riskBudget.maxDrawdownPct;
  if (maxDrawdownPct == null || maxDrawdownPct < 1 || maxDrawdownPct > 18) {
    throw new Error("请将资管会话的最大回撤设为 1%–18%。");
  }

  return {
    termDays: durationDays,
    capitalMode,
    targetCapital: draft.capital.amount,
    settlementAsset: "USDT",
    riskProfile: managedRiskProfile(draft.riskBudget.profile, maxDrawdownPct),
    maxDrawdownPct,
    exitMode: EXIT_MODE_MAP[exitMode],
    strategies: orderedStrategies.map((strategy, index) => {
      const configured = draft.platformBuckets
        .flatMap((bucket) => bucket.strategies)
        .find((item) => item.strategyId === strategy.id);
      return {
        strategyId: strategy.id,
        weightPct: strategyWeights[index],
        riskMultiplier: configured?.riskMultiplier ?? 1,
      };
    }),
    executionSlots: draft.platformBuckets.map((bucket, index) => ({
      brokerId: bucket.platformId,
      label: `执行槽 ${index + 1}`,
      capitalWeightPct: slotWeights[index],
      fundingSource:
        capitalMode === "MIXED"
          ? index === 0
            ? "DIRECT_BROKER"
            : "MANAGED_VAULT"
          : capitalMode,
    })),
  };
}
