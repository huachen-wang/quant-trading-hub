import type {
  AllocationBucket,
  AllocationDraft,
} from "./allocation-types";

export function equalWeights(count: number) {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function rebalanceDraft(draft: AllocationDraft): AllocationDraft {
  const platformWeights = equalWeights(draft.platformBuckets.length);
  return {
    ...draft,
    source: "CUSTOM",
    platformBuckets: draft.platformBuckets.map((bucket, bucketIndex) => {
      const strategyWeights = equalWeights(bucket.strategies.length);
      return {
        ...bucket,
        capitalWeightPct: platformWeights[bucketIndex],
        strategies: bucket.strategies.map((strategy, strategyIndex) => ({
          ...strategy,
          weightPct: strategyWeights[strategyIndex],
        })),
      };
    }),
  };
}

export function rebalanceBucket(bucket: AllocationBucket): AllocationBucket {
  const weights = equalWeights(bucket.strategies.length);
  return {
    ...bucket,
    strategies: bucket.strategies.map((strategy, index) => ({
      ...strategy,
      weightPct: weights[index],
    })),
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function appendStrategyToBucket(
  bucket: AllocationBucket,
  strategyId: string,
): AllocationBucket {
  return rebalanceBucket({
    ...bucket,
    strategies: [
      ...bucket.strategies,
      { strategyId, weightPct: 0, riskMultiplier: 0.8 },
    ],
  });
}

export type StrategyDropReason = "INCOMPATIBLE" | "OFFLINE" | "DUPLICATE";

export type StrategyDropVerdict =
  | { allowed: true }
  | { allowed: false; reason: StrategyDropReason };

export const STRATEGY_DROP_REASON_LABEL: Record<StrategyDropReason, string> = {
  INCOMPATIBLE: "该平台不支持此策略",
  OFFLINE: "策略数据连接中断，暂不可加入",
  DUPLICATE: "该策略已在此平台桶中",
};

export function evaluateStrategyDrop(input: {
  bucket: AllocationBucket;
  supportedStrategyIds: string[];
  strategyId: string;
  strategyOffline: boolean;
}): StrategyDropVerdict {
  if (!input.supportedStrategyIds.includes(input.strategyId)) {
    return { allowed: false, reason: "INCOMPATIBLE" };
  }
  if (input.strategyOffline) {
    return { allowed: false, reason: "OFFLINE" };
  }
  if (
    input.bucket.strategies.some((item) => item.strategyId === input.strategyId)
  ) {
    return { allowed: false, reason: "DUPLICATE" };
  }
  return { allowed: true };
}
