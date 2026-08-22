import {
  strategyDataOverrideSchema,
  type CoreStrategy,
  type DataMode,
  type EquityPoint,
  type StrategyDataOverride,
  type V2Overview,
} from "../../shared/v2/contracts";
import * as db from "../db";
import type { PageContent } from "../../drizzle/schema";

const DATA_PAGE_KEY = "v2_strategy_data";

export type StoredStrategyDataOverride = {
  recordId: number;
  override: StrategyDataOverride;
};

function parseStoredOverride(row: PageContent) {
  try {
    return {
      recordId: row.id,
      override: strategyDataOverrideSchema.parse(JSON.parse(row.content)),
    } satisfies StoredStrategyDataOverride;
  } catch (error) {
    console.warn(`[v2-data] ignored invalid override row=${row.id}:`, error);
    return null;
  }
}

export async function listStoredStrategyDataOverrides() {
  const rows = await db.getAllPageContents(DATA_PAGE_KEY);
  const parsed = rows.map(parseStoredOverride).filter(Boolean) as StoredStrategyDataOverride[];
  return new Map(parsed.map((item) => [item.override.strategyId, item]));
}

export async function saveStoredStrategyDataOverride(input: StrategyDataOverride) {
  const override = strategyDataOverrideSchema.parse(input);
  const existing = (await db.getAllPageContents(DATA_PAGE_KEY) as PageContent[]).find(
    (row: PageContent) => row.sectionKey === override.strategyId,
  );
  const payload = {
    title: `${override.strategyId} strategy data`,
    content: JSON.stringify(override),
    icon: override.mode,
    sortOrder: existing?.sortOrder ?? 0,
    isVisible: true,
  };
  if (existing) return db.updatePageContent(existing.id, payload);
  return db.createPageContent({
    ...payload,
    pageKey: DATA_PAGE_KEY,
    sectionKey: override.strategyId,
  });
}

export async function deleteStoredStrategyDataOverride(strategyId: string) {
  const existing = (await db.getAllPageContents(DATA_PAGE_KEY) as PageContent[]).find(
    (row: PageContent) => row.sectionKey === strategyId,
  );
  if (!existing) return { success: true };
  return db.deletePageContent(existing.id);
}

export function createStrategyDataOverrideSample(
  strategy: CoreStrategy,
  mode: StrategyDataOverride["mode"] = "CUSTOM",
): StrategyDataOverride {
  const historyHandoverAt = mode === "HYBRID" ? new Date().toISOString() : null;
  return {
    strategyId: strategy.id,
    mode,
    historyHandoverAt,
    note: "由当前展示数据生成，可在接入实盘前继续编辑；切换为混合模式后，接管线之后只读取实盘点。",
    metrics: { ...strategy.metrics },
    equity: strategy.equity.map((point) => ({ ...point, source: "CUSTOM" })),
  };
}

function pointTime(point: EquityPoint) {
  return Date.parse(point.timestamp);
}

function sortedUnique(points: EquityPoint[]) {
  const byTimestamp = new Map<string, EquityPoint>();
  for (const point of [...points].sort((a, b) => pointTime(a) - pointTime(b))) {
    byTimestamp.set(point.timestamp, point);
  }
  return [...byTimestamp.values()];
}

function sourceMode(strategies: CoreStrategy[]): DataMode {
  const modes = new Set(strategies.map((strategy) => strategy.source.dataMode));
  if (modes.has("HYBRID") || (modes.has("LIVE") && modes.size > 1)) return "HYBRID";
  if (modes.has("LIVE")) return "LIVE";
  if (modes.has("CUSTOM")) return "CUSTOM";
  return "DEMO";
}

export function applyStrategyDataOverride(
  strategy: CoreStrategy,
  override?: StrategyDataOverride,
): CoreStrategy {
  if (!override) return strategy;

  const handover = override.historyHandoverAt
    ? Date.parse(override.historyHandoverAt)
    : Number.POSITIVE_INFINITY;
  const customPoints = override.equity
    .filter((point) => pointTime(point) < handover)
    .map((point) => ({ ...point, source: "CUSTOM" as const }));
  const upstreamIsLive = strategy.source.dataMode === "LIVE" || strategy.source.dataMode === "HYBRID";
  const livePoints = override.mode === "HYBRID" && upstreamIsLive
    ? strategy.equity
        .filter((point) => pointTime(point) >= handover)
        .map((point) => ({ ...point, source: "LIVE" as const }))
    : [];
  const mode: DataMode = livePoints.length ? "HYBRID" : "CUSTOM";
  const equity = sortedUnique(customPoints.length || livePoints.length
    ? [...customPoints, ...livePoints]
    : strategy.equity.map((point) => ({ ...point, source: "CUSTOM" as const })));
  const latest = equity.at(-1);

  return {
    ...strategy,
    metrics: {
      ...strategy.metrics,
      ...override.metrics,
      balance: override.metrics.balance ?? latest?.balance ?? strategy.metrics.balance,
      equity: override.metrics.equity ?? latest?.equity ?? strategy.metrics.equity,
    },
    equity,
    positions: mode === "HYBRID" ? strategy.positions : [],
    recentTrades: mode === "HYBRID" ? strategy.recentTrades : [],
    source: {
      ...strategy.source,
      provider: mode === "HYBRID"
        ? `${strategy.source.provider}+eaxau-custom`
        : "eaxau-custom",
      label: mode === "HYBRID" ? "自定义历史 + 实盘接管" : "后台自定义历史",
      dataMode: mode,
      freshness: mode === "HYBRID" ? strategy.source.freshness : "FRESH",
      delaySeconds: mode === "HYBRID" ? strategy.source.delaySeconds : 0,
      historyHandoverAt: override.historyHandoverAt,
    },
  };
}

function aggregateEquity(strategies: CoreStrategy[]) {
  const longest = Math.min(60, Math.max(0, ...strategies.map((item) => item.equity.length)));
  const points: EquityPoint[] = [];
  for (let offset = longest; offset > 0; offset -= 1) {
    const samples = strategies
      .map((strategy) => strategy.equity.at(-offset))
      .filter(Boolean) as EquityPoint[];
    if (!samples.length) continue;
    points.push({
      timestamp: samples.map((point) => point.timestamp).sort().at(-1)!,
      balance: samples.reduce((sum, point) => sum + point.balance, 0),
      equity: samples.reduce((sum, point) => sum + point.equity, 0),
      source: sourceMode(strategies) === "LIVE" ? "LIVE" : undefined,
    });
  }
  return points;
}

function maxDrawdownPct(points: EquityPoint[]) {
  let peak = 0;
  let maximum = 0;
  for (const point of points) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) maximum = Math.max(maximum, ((peak - point.equity) / peak) * 100);
  }
  return Math.round(maximum * 100) / 100;
}

export function rebuildOverviewFromStrategies(
  overview: V2Overview,
  strategies: CoreStrategy[],
): V2Overview {
  const equitySeries = aggregateEquity(strategies);
  const first = equitySeries[0];
  const previous = equitySeries.at(-2);
  const latest = equitySeries.at(-1);
  const mode = sourceMode(strategies);
  const freshnessRank = { FRESH: 0, STALE: 1, OFFLINE: 2 } as const;
  const freshness = strategies
    .map((strategy) => strategy.source.freshness)
    .sort((a, b) => freshnessRank[b] - freshnessRank[a])[0] ?? "OFFLINE";
  const observedAt = strategies
    .map((strategy) => strategy.source.observedAt)
    .sort()
    .at(-1) ?? overview.source.observedAt;

  return {
    ...overview,
    strategies,
    portfolio: {
      ...overview.portfolio,
      equity: latest?.equity ?? overview.portfolio.equity,
      balance: latest?.balance ?? overview.portfolio.balance,
      todayPnlPct: latest && previous && previous.equity
        ? ((latest.equity - previous.equity) / previous.equity) * 100
        : overview.portfolio.todayPnlPct,
      return90dPct: latest && first && first.equity
        ? ((latest.equity - first.equity) / first.equity) * 100
        : overview.portfolio.return90dPct,
      maxDrawdownPct: equitySeries.length
        ? maxDrawdownPct(equitySeries)
        : overview.portfolio.maxDrawdownPct,
      activeStrategies: strategies.filter((strategy) => strategy.source.freshness !== "OFFLINE").length,
      equitySeries: equitySeries.length ? equitySeries : overview.portfolio.equitySeries,
    },
    source: {
      ...overview.source,
      provider: mode === "DEMO" ? overview.source.provider : "eaxau-composite",
      label: mode === "DEMO" ? overview.source.label : "EAXAU 组合数据",
      observedAt,
      receivedAt: new Date().toISOString(),
      freshness,
      dataMode: mode,
      delaySeconds: Math.max(0, ...strategies.map((strategy) => strategy.source.delaySeconds)),
    },
  };
}
