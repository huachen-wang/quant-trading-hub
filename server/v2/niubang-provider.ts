import { z } from "zod";
import type {
  AllocationDraft,
  AllocationRequest,
  CoreStrategy,
  DataMode,
  EquityPoint,
} from "../../shared/v2/contracts";
import {
  createDemoOverview,
  DEFAULT_ALLOCATION,
  DEMO_PLATFORMS,
  DEMO_STRATEGIES,
} from "./demo-data";
import { rebuildOverviewFromStrategies } from "./data-overrides";
import type { QuantDataProvider } from "./provider";

const chartPointSchema = z.object({
  time: z.string().datetime(),
  equityValue: z.number(),
  source: z.enum(["manual", "imported", "live"]).optional(),
});

const niubangDetailSchema = z.object({
  slug: z.string(),
  summary: z.string().optional().default(""),
  description: z.string().optional().default(""),
  coverImageUrl: z.string().optional().default(""),
  images: z.array(z.string()).optional().default([]),
  dataSource: z.string().optional().default("manual"),
  metrics: z.object({
    monthlyReturnPct: z.number(),
    totalReturnPct: z.number(),
    maxDrawdownPct: z.number(),
    winRatePct: z.number(),
    tradeCount: z.number().int().nonnegative(),
    accountEquityUsd: z.number().nonnegative(),
  }),
  fullEquityPoints: z.array(chartPointSchema).optional().default([]),
  currentPositions: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    symbol: z.string(),
    direction: z.enum(["BUY", "SELL", "多", "空"]),
    lots: z.number(),
    openPrice: z.number(),
    currentPrice: z.number(),
    floatingPnl: z.number(),
    openedAt: z.string().datetime(),
  })).optional().default([]),
  recentTrades: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    symbol: z.string(),
    direction: z.enum(["BUY", "SELL", "多", "空"]),
    lots: z.number().nullable().optional(),
    entryPrice: z.number().nullable().optional(),
    exitPrice: z.number().nullable().optional(),
    pnlUsd: z.number(),
    tradeTime: z.string().datetime(),
  })).optional().default([]),
  lastSyncedAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime(),
  historyHandoverAt: z.string().datetime().nullable().optional(),
});

export type NiubangSignalDetail = z.infer<typeof niubangDetailSchema>;

type NiubangProviderOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  strategyMap: Record<string, string>;
};

function returnOverPeriod(points: EquityPoint[], days: number) {
  const latest = points.at(-1);
  if (!latest) return null;
  const cutoff = Date.parse(latest.timestamp) - days * 86_400_000;
  const first = points.find((point) => Date.parse(point.timestamp) >= cutoff) ?? points[0];
  if (!first?.equity) return null;
  return ((latest.equity - first.equity) / first.equity) * 100;
}

function modeFor(detail: NiubangSignalDetail): DataMode {
  const sources = new Set(detail.fullEquityPoints.map((point) => point.source));
  if (detail.historyHandoverAt && sources.has("live")) return "HYBRID";
  if (sources.has("live") || detail.dataSource === "mt_readonly") return "LIVE";
  return "CUSTOM";
}

function freshnessFor(observedAt: string) {
  const ageSeconds = Math.max(0, (Date.now() - Date.parse(observedAt)) / 1_000);
  if (ageSeconds <= 15 * 60) return "FRESH" as const;
  if (ageSeconds <= 24 * 3_600) return "STALE" as const;
  return "OFFLINE" as const;
}

function normalizeDirection(direction: "BUY" | "SELL" | "多" | "空") {
  return direction === "BUY" || direction === "多" ? "BUY" as const : "SELL" as const;
}

function positiveOrFallback(value: number | null | undefined, fallback: number) {
  return value != null && Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveMediaUrl(raw: string, baseUrl?: string) {
  if (!raw || !baseUrl) return raw;
  try {
    return new URL(raw, `${baseUrl.replace(/\/$/, "")}/`).toString();
  } catch {
    return raw;
  }
}

export function mapNiubangDetailToStrategy(
  base: CoreStrategy,
  raw: unknown,
  assetBaseUrl?: string,
): CoreStrategy {
  const detail = niubangDetailSchema.parse(raw);
  const mode = modeFor(detail);
  const observedAt = detail.lastSyncedAt ?? detail.updatedAt;
  const equity = detail.fullEquityPoints.map((point) => ({
    timestamp: point.time,
    equity: point.equityValue,
    balance: point.equityValue,
    source: point.source === "live" ? "LIVE" as const : "CUSTOM" as const,
  }));
  const latestEquity = equity.at(-1)?.equity ?? detail.metrics.accountEquityUsd;
  const galleryImages = [detail.coverImageUrl, ...detail.images]
    .filter(Boolean)
    .map((url) => resolveMediaUrl(url, assetBaseUrl));
  const contentBlocks = galleryImages.length
    ? [
        ...base.contentBlocks.filter((block) => block.type !== "media_gallery"),
        {
          id: `${base.id}-niubang-gallery`,
          type: "media_gallery" as const,
          heading: "实盘资料",
          items: galleryImages.slice(0, 8).map((url, index) => ({
            id: `${base.id}-niubang-${index + 1}`,
            title: index === 0 ? "策略主图" : `资料 ${String(index + 1).padStart(2, "0")}`,
            caption: "来自已映射策略档案的展示资料，具体口径以图片说明和同步时间为准。",
            thumbnailUrl: url,
            fullUrl: url,
            alt: `${base.shortName} 实盘资料 ${index + 1}`,
          })),
        },
      ]
    : base.contentBlocks;

  return {
    ...base,
    description: detail.description || detail.summary || base.description,
    artwork: galleryImages[0] || base.artwork,
    metrics: {
      ...base.metrics,
      return30dPct: detail.metrics.monthlyReturnPct,
      return90dPct: returnOverPeriod(equity, 90),
      totalReturnPct: detail.metrics.totalReturnPct,
      todayPnlPct: returnOverPeriod(equity, 1),
      maxDrawdownPct: detail.metrics.maxDrawdownPct,
      winRatePct: detail.metrics.winRatePct,
      tradeCount: detail.metrics.tradeCount,
      balance: latestEquity,
      equity: latestEquity,
      floatingPnl: detail.currentPositions.reduce((sum, item) => sum + item.floatingPnl, 0),
    },
    equity,
    positions: detail.currentPositions.map((item) => ({
      id: String(item.id),
      symbol: item.symbol,
      side: normalizeDirection(item.direction),
      volume: positiveOrFallback(item.lots, 0.01),
      openPrice: positiveOrFallback(item.openPrice, 0.00001),
      currentPrice: positiveOrFallback(item.currentPrice, 0.00001),
      floatingPnl: item.floatingPnl,
      openedAt: item.openedAt,
    })),
    recentTrades: detail.recentTrades.map((item) => ({
      id: String(item.id),
      symbol: item.symbol,
      side: normalizeDirection(item.direction),
      volume: positiveOrFallback(item.lots, 0.01),
      openPrice: positiveOrFallback(item.entryPrice, 0.00001),
      closePrice: positiveOrFallback(item.exitPrice ?? item.entryPrice, 0.00001),
      pnl: item.pnlUsd,
      openedAt: item.tradeTime,
      closedAt: item.tradeTime,
    })),
    contentBlocks,
    source: {
      provider: "niubang.ai",
      label: mode === "HYBRID" ? "牛帮迁移历史 + 实盘" : mode === "LIVE" ? "牛帮实盘" : "牛帮自定义历史",
      observedAt,
      receivedAt: new Date().toISOString(),
      freshness: freshnessFor(observedAt),
      dataMode: mode,
      delaySeconds: Math.max(0, Math.round((Date.now() - Date.parse(observedAt)) / 1_000)),
      historyHandoverAt: detail.historyHandoverAt ?? null,
    },
  };
}

export class NiubangQuantDataProvider implements QuantDataProvider {
  readonly kind = "NIUBANG" as const;
  private readonly baseUrl: string;
  private readonly cache = new Map<string, { expiresAt: number; value: CoreStrategy }>();

  constructor(private readonly options: NiubangProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  private async detail(slug: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    const input = encodeURIComponent(JSON.stringify({ json: { slug } }));
    try {
      const response = await fetch(`${this.baseUrl}/api/trpc/signal.detail?input=${input}`, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`Niubang Data ${response.status}: ${slug}`);
      const payload = await response.json() as any;
      return payload?.result?.data?.json ?? payload?.result?.data ?? payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async hydrate(base: CoreStrategy): Promise<CoreStrategy> {
    const slug = this.options.strategyMap[base.id];
    if (!slug) return base;
    const cached = this.cache.get(base.id);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    try {
      const value = mapNiubangDetailToStrategy(base, await this.detail(slug), this.baseUrl);
      this.cache.set(base.id, { expiresAt: Date.now() + 20_000, value });
      return value;
    } catch (error) {
      console.error(`[v2-niubang] strategy=${base.id} slug=${slug} sync failed:`, error);
      return {
        ...base,
        source: {
          ...base.source,
          provider: "niubang.ai",
          label: "牛帮映射等待恢复",
          freshness: "OFFLINE" as const,
          delaySeconds: 0,
        },
      };
    }
  }

  async listStrategies() {
    return Promise.all(DEMO_STRATEGIES.map((strategy) => this.hydrate(strategy)));
  }

  async getStrategy(id: string) {
    const base = DEMO_STRATEGIES.find((strategy) => strategy.id === id);
    return base ? this.hydrate(base) : null;
  }

  async getOverview() {
    return rebuildOverviewFromStrategies(createDemoOverview(), await this.listStrategies());
  }

  async listPlatforms() {
    return DEMO_PLATFORMS;
  }

  async listAccounts() {
    return [];
  }

  async getAccount() {
    return null;
  }

  async recommendAllocation(input: AllocationRequest): Promise<AllocationDraft> {
    const modes = new Set((await this.listStrategies()).map((strategy) => strategy.source.dataMode));
    const dataMode: DataMode = modes.size === 1 ? [...modes][0] : "HYBRID";
    return {
      ...DEFAULT_ALLOCATION,
      id: `niubang-${input.riskProfile.toLowerCase()}-${input.capital.amount}`,
      capital: input.capital,
      riskBudget: {
        profile: input.riskProfile,
        maxDrawdownPct: input.riskProfile === "LOW" ? 8 : input.riskProfile === "HIGH" ? 18 : 12,
      },
      dataMode,
    };
  }
}
