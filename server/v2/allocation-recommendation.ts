import type {
  AllocationDraft,
  AllocationRequest,
  CoreStrategy,
  PlatformProfile,
} from "../../shared/v2/contracts";

function equalWeights(count: number) {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function riskMultiplier(
  profile: AllocationRequest["riskProfile"],
  strategy: CoreStrategy,
) {
  const profileBase =
    profile === "LOW" ? 0.65 : profile === "HIGH" ? 1.1 : 0.85;
  const strategyAdjustment =
    strategy.riskLevel === "HIGH"
      ? 0.82
      : strategy.riskLevel === "LOW"
        ? 1.06
        : 1;
  return Math.max(
    0.25,
    Math.min(2, Number((profileBase * strategyAdjustment).toFixed(2))),
  );
}

export function buildSelectionAwareAllocation(input: {
  request: AllocationRequest;
  base: AllocationDraft;
  strategies: CoreStrategy[];
  platforms: PlatformProfile[];
  idPrefix: string;
  dataMode?: AllocationDraft["dataMode"];
}) {
  const { request, base, strategies, platforms } = input;
  const strategyById = new Map(
    strategies.map((strategy) => [strategy.id, strategy]),
  );
  const platformById = new Map(
    platforms.map((platform) => [platform.id, platform]),
  );
  const defaultStrategyIds = Array.from(
    new Set(
      base.platformBuckets.flatMap((bucket) =>
        bucket.strategies.map((strategy) => strategy.strategyId),
      ),
    ),
  );
  const requestedStrategyIds = request.strategyIds?.length
    ? request.strategyIds
    : defaultStrategyIds;
  const requestedPlatformIds = request.platformIds?.length
    ? request.platformIds
    : base.platformBuckets.map((bucket) => bucket.platformId);
  const selectedStrategies = requestedStrategyIds
    .map((id) => strategyById.get(id))
    .filter(
      (strategy): strategy is CoreStrategy =>
        Boolean(strategy) && strategy?.source.freshness !== "OFFLINE",
    );
  const selectedPlatforms = requestedPlatformIds
    .map((id) => platformById.get(id))
    .filter((platform): platform is PlatformProfile => Boolean(platform))
    .slice(0, 3);

  const assigned = new Map<string, string[]>(
    selectedPlatforms.map((platform) => [platform.id, []]),
  );

  for (const strategy of selectedStrategies) {
    const compatible = selectedPlatforms
      .filter((platform) => platform.supportedStrategyIds.includes(strategy.id))
      .sort(
        (left, right) =>
          (assigned.get(left.id)?.length ?? 0) -
          (assigned.get(right.id)?.length ?? 0),
      );
    const target = compatible[0];
    if (target) assigned.get(target.id)?.push(strategy.id);
  }

  for (const platform of selectedPlatforms) {
    const current = assigned.get(platform.id) ?? [];
    if (current.length) continue;
    const fallback = selectedStrategies.find((strategy) =>
      platform.supportedStrategyIds.includes(strategy.id),
    );
    if (fallback) current.push(fallback.id);
  }

  const activePlatforms = selectedPlatforms.filter(
    (platform) => (assigned.get(platform.id)?.length ?? 0) > 0,
  );
  const platformWeights = equalWeights(activePlatforms.length);
  const platformBuckets = activePlatforms.map((platform, platformIndex) => {
    const strategyIds = assigned.get(platform.id) ?? [];
    const strategyWeights = equalWeights(strategyIds.length);
    return {
      platformId: platform.id,
      capitalWeightPct: platformWeights[platformIndex],
      strategies: strategyIds.map((strategyId, strategyIndex) => {
        const strategy = strategyById.get(strategyId)!;
        return {
          strategyId,
          weightPct: strategyWeights[strategyIndex],
          riskMultiplier: riskMultiplier(request.riskProfile, strategy),
        };
      }),
    };
  });

  const maxDrawdownPct =
    request.riskProfile === "LOW"
      ? 8
      : request.riskProfile === "HIGH"
        ? 18
        : 12;

  return {
    ...base,
    id: `${input.idPrefix}-${request.riskProfile.toLowerCase()}-${request.capital.amount}`,
    capital: request.capital,
    platformBuckets: platformBuckets.length
      ? platformBuckets
      : base.platformBuckets,
    riskBudget: {
      profile: request.riskProfile,
      maxDrawdownPct,
    },
    dataMode: input.dataMode ?? base.dataMode,
  } satisfies AllocationDraft;
}
