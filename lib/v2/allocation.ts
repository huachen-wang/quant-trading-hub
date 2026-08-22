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
