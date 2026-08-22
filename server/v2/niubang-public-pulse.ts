import { z } from "zod";
import type { SourceMeta } from "../../shared/v2/contracts";

const DEFAULT_NIUBANG_PUBLIC_URL = "https://niubang.ai";
const CACHE_TTL_MS = 8_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ITEMS = 6;

const chartPointSchema = z.object({
  time: z.string().datetime(),
  equityValue: z.number(),
  source: z.string().optional(),
});

const publicSignalSchema = z.object({
  id: z.union([z.number(), z.string()]),
  slug: z.string().min(1),
  name: z.string().min(1),
  type: z.string(),
  brokerName: z.string().nullable().optional(),
  isVerified: z.boolean(),
  dataSource: z.string(),
  metrics: z.object({
    monthlyReturnPct: z.number().nullable().optional(),
    totalReturnPct: z.number().nullable().optional(),
    maxDrawdownPct: z.number().nullable().optional(),
    winRatePct: z.number().nullable().optional(),
    accountEquityUsd: z.number().nullable().optional(),
  }),
  chartPoints: z.array(chartPointSchema).default([]),
});

const publicListSchema = z.object({
  items: z.array(publicSignalSchema),
});

export type NiubangPublicPulseItem = {
  id: string;
  slug: string;
  name: string;
  brokerName: string | null;
  equity: number;
  monthlyReturnPct: number | null;
  totalReturnPct: number | null;
  maxDrawdownPct: number | null;
  winRatePct: number | null;
  observedAt: string;
  url: string;
};

export type NiubangPublicPulse = {
  items: NiubangPublicPulseItem[];
  source: SourceMeta;
};

let cache: { expiresAt: number; value: NiubangPublicPulse } | undefined;
let lastSuccessful: NiubangPublicPulse | undefined;

function freshnessForPulse(observedAt: string): SourceMeta["freshness"] {
  const ageSeconds = Math.max(0, (Date.now() - Date.parse(observedAt)) / 1_000);
  if (ageSeconds <= 36 * 3_600) return "FRESH";
  if (ageSeconds <= 7 * 24 * 3_600) return "STALE";
  return "OFFLINE";
}

function latestObservation(
  signal: z.infer<typeof publicSignalSchema>,
): string | null {
  return (
    signal.chartPoints
      .filter((point) => point.source === "live")
      .map((point) => point.time)
      .sort()
      .at(-1) ?? null
  );
}

function unwrapPayload(raw: unknown) {
  const payload = raw as any;
  return payload?.result?.data?.json ?? payload?.result?.data ?? payload;
}

function emptyPulse(receivedAt: string): NiubangPublicPulse {
  return {
    items: [],
    source: {
      provider: "niubang.ai",
      label: "牛帮公开实盘暂不可用",
      observedAt: receivedAt,
      receivedAt,
      freshness: "OFFLINE",
      dataMode: "LIVE",
      delaySeconds: 0,
    },
  };
}

function mapPulse(raw: unknown, baseUrl: string): NiubangPublicPulse {
  const receivedAt = new Date().toISOString();
  const parsed = publicListSchema.parse(unwrapPayload(raw));
  const items = parsed.items
    .filter(
      (signal) =>
        signal.isVerified &&
        signal.dataSource === "mt_readonly" &&
        (signal.metrics.accountEquityUsd ?? 0) > 0 &&
        signal.chartPoints.some((point) => point.source === "live"),
    )
    .map((signal) => {
      const observedAt = latestObservation(signal);
      if (!observedAt) return null;
      return {
        id: String(signal.id),
        slug: signal.slug,
        name: signal.name,
        brokerName: signal.brokerName ?? null,
        equity: signal.metrics.accountEquityUsd!,
        monthlyReturnPct: signal.metrics.monthlyReturnPct ?? null,
        totalReturnPct: signal.metrics.totalReturnPct ?? null,
        maxDrawdownPct: signal.metrics.maxDrawdownPct ?? null,
        winRatePct: signal.metrics.winRatePct ?? null,
        observedAt,
        url: `${baseUrl}/signals/${encodeURIComponent(signal.slug)}`,
      } satisfies NiubangPublicPulseItem;
    })
    .filter((item): item is NiubangPublicPulseItem => Boolean(item))
    .filter((item) => freshnessForPulse(item.observedAt) !== "OFFLINE")
    .sort(
      (left, right) =>
        Date.parse(right.observedAt) - Date.parse(left.observedAt),
    )
    .slice(0, MAX_ITEMS);

  if (!items.length) return emptyPulse(receivedAt);
  const observedAt = items[0].observedAt;
  return {
    items,
    source: {
      provider: "niubang.ai",
      label: "牛帮公开实盘观察",
      observedAt,
      receivedAt,
      freshness: freshnessForPulse(observedAt),
      dataMode: "LIVE",
      delaySeconds: Math.max(
        0,
        Math.round((Date.now() - Date.parse(observedAt)) / 1_000),
      ),
    },
  };
}

export async function getNiubangPublicPulse(): Promise<NiubangPublicPulse> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const baseUrl = (
    process.env.NIUBANG_PUBLIC_URL ||
    process.env.NIUBANG_DATA_URL ||
    DEFAULT_NIUBANG_PUBLIC_URL
  ).replace(/\/$/, "");
  const input = encodeURIComponent(JSON.stringify({ json: {} }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${baseUrl}/api/trpc/signal.list?input=${input}`,
      {
        signal: controller.signal,
        headers: { accept: "application/json" },
      },
    );
    if (!response.ok) {
      throw new Error(`Niubang public pulse ${response.status}`);
    }
    const value = mapPulse(await response.json(), baseUrl);
    if (value.items.length) lastSuccessful = value;
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  } catch (error) {
    console.warn("[v2-niubang-pulse] public feed unavailable:", error);
    const receivedAt = new Date().toISOString();
    const retainedItems =
      lastSuccessful?.items.filter(
        (item) => freshnessForPulse(item.observedAt) !== "OFFLINE",
      ) ?? [];
    const value =
      lastSuccessful && retainedItems.length
        ? {
            ...lastSuccessful,
            items: retainedItems,
            source: {
              ...lastSuccessful.source,
              observedAt: retainedItems[0].observedAt,
              receivedAt,
              freshness: "STALE" as const,
              delaySeconds: Math.max(
                0,
                Math.round(
                  (Date.now() - Date.parse(retainedItems[0].observedAt)) /
                    1_000,
                ),
              ),
            },
          }
        : emptyPulse(receivedAt);
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

export function resetNiubangPublicPulseForTests() {
  cache = undefined;
  lastSuccessful = undefined;
}
