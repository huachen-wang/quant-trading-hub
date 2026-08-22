import { z } from "zod";

export const dataModeSchema = z.enum(["DEMO", "CUSTOM", "LIVE", "HYBRID"]);
export const freshnessSchema = z.enum(["FRESH", "STALE", "OFFLINE"]);
export const serviceModeSchema = z.enum([
  "MANAGED_CONTRACT",
  "SELF_ALLOCATED",
]);
export const allocationSourceSchema = z.enum([
  "RECOMMENDED",
  "CUSTOM",
  "OPERATOR",
]);
export const riskProfileSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]);

export const sourceMetaSchema = z.object({
  provider: z.string().min(1),
  label: z.string().min(1),
  observedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  freshness: freshnessSchema,
  dataMode: dataModeSchema,
  delaySeconds: z.number().nonnegative(),
  historyHandoverAt: z.string().datetime().nullable().optional(),
});

export const equityPointSchema = z.object({
  timestamp: z.string().datetime(),
  equity: z.number(),
  balance: z.number(),
  source: z.enum(["DEMO", "CUSTOM", "LIVE"]).optional(),
});

export const strategyPositionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  volume: z.number().positive(),
  openPrice: z.number().positive(),
  currentPrice: z.number().positive(),
  floatingPnl: z.number(),
  openedAt: z.string().datetime(),
});

export const strategyTradeSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  volume: z.number().positive(),
  openPrice: z.number().positive(),
  closePrice: z.number().positive(),
  pnl: z.number(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime(),
});

const richTextBlockSchema = z.object({
  id: z.string(),
  type: z.literal("rich_text"),
  heading: z.string(),
  paragraphs: z.array(z.string()),
  bullets: z.array(z.string()).default([]),
});

const evidenceBlockSchema = z.object({
  id: z.string(),
  type: z.literal("evidence"),
  heading: z.string(),
  items: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      status: z.enum(["VERIFIED", "PENDING", "DEMO"]),
      observedAt: z.string().datetime().optional(),
    }),
  ),
});

const timelineBlockSchema = z.object({
  id: z.string(),
  type: z.literal("timeline"),
  heading: z.string(),
  items: z.array(
    z.object({
      date: z.string(),
      title: z.string(),
      detail: z.string(),
    }),
  ),
});

const riskNoticeBlockSchema = z.object({
  id: z.string(),
  type: z.literal("risk_notice"),
  heading: z.string(),
  content: z.string(),
});

const faqBlockSchema = z.object({
  id: z.string(),
  type: z.literal("faq"),
  heading: z.string(),
  items: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const mediaGalleryBlockSchema = z.object({
  id: z.string(),
  type: z.literal("media_gallery"),
  heading: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      caption: z.string(),
      thumbnailUrl: z.string().min(1),
      fullUrl: z.string().min(1),
      alt: z.string(),
    }),
  ),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  richTextBlockSchema,
  evidenceBlockSchema,
  timelineBlockSchema,
  riskNoticeBlockSchema,
  faqBlockSchema,
  mediaGalleryBlockSchema,
]);

export const strategyMetricsSchema = z.object({
  return30dPct: z.number().nullable(),
  return90dPct: z.number().nullable(),
  totalReturnPct: z.number().nullable(),
  todayPnlPct: z.number().nullable(),
  maxDrawdownPct: z.number().nullable(),
  winRatePct: z.number().nullable(),
  tradeCount: z.number().int().nonnegative(),
  avgHoldingMinutes: z.number().nonnegative().nullable(),
  balance: z.number().nullable(),
  equity: z.number().nullable(),
  floatingPnl: z.number().nullable(),
});

export const coreStrategySchema = z.object({
  id: z.string().min(1),
  homeSlot: z.number().int().min(1).max(6),
  name: z.string(),
  shortName: z.string(),
  version: z.string(),
  tagline: z.string(),
  description: z.string(),
  style: z.string(),
  instruments: z.array(z.string()),
  terminals: z.array(z.enum(["MT4", "MT5"])),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  riskScore: z.number().min(1).max(5),
  accent: z.string(),
  artwork: z.string(),
  minimumCapital: z.number().nonnegative(),
  metrics: strategyMetricsSchema,
  equity: z.array(equityPointSchema),
  positions: z.array(strategyPositionSchema),
  recentTrades: z.array(strategyTradeSchema),
  compatiblePlatformIds: z.array(z.string()),
  contentBlocks: z.array(contentBlockSchema),
  source: sourceMetaSchema,
});

export const strategyDataOverrideSchema = z.object({
  strategyId: z.string().min(1).max(80),
  mode: z.enum(["CUSTOM", "HYBRID"]),
  historyHandoverAt: z.string().datetime().nullable(),
  note: z.string().max(500).default(""),
  metrics: strategyMetricsSchema.partial(),
  equity: z.array(equityPointSchema).max(365),
});

export const platformSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  entity: z.string(),
  regionLabel: z.string(),
  terminals: z.array(z.enum(["MT4", "MT5"])),
  minimumCapital: z.number().nonnegative(),
  accountType: z.string(),
  summary: z.string(),
  supportedStrategyIds: z.array(z.string()),
  commercialTerms: z.object({
    version: z.string(),
    effectiveFrom: z.string(),
    spreadLabel: z.string(),
    commissionLabel: z.string(),
    rebateLabel: z.string(),
    rebateEligibility: z.string(),
    withdrawalP50Hours: z.number().nonnegative().nullable(),
    withdrawalP95Hours: z.number().nonnegative().nullable(),
    withdrawalSampleSize: z.number().int().nonnegative(),
    executionLatencyMs: z.number().nonnegative().nullable(),
    slippagePoints: z.number().nullable(),
  }),
  source: sourceMetaSchema,
});

export const allocationStrategySchema = z.object({
  strategyId: z.string(),
  weightPct: z.number().min(0).max(100),
  riskMultiplier: z.number().min(0.25).max(2),
});

export const allocationBucketSchema = z.object({
  platformId: z.string(),
  capitalWeightPct: z.number().min(0).max(100),
  strategies: z.array(allocationStrategySchema).min(1),
});

export const allocationDraftSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  mode: z.literal("SELF_ALLOCATED"),
  source: allocationSourceSchema,
  capital: z.object({
    amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    currency: z.string().length(3),
  }),
  riskBudget: z.object({
    profile: riskProfileSchema,
    maxDrawdownPct: z.number().min(1).max(100).optional(),
  }),
  platformBuckets: z.array(allocationBucketSchema).min(1).max(3),
  dataMode: dataModeSchema,
});

export const allocationRequestSchema = z.object({
  capital: z.object({
    amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    currency: z.string().length(3).default("USD"),
  }),
  riskProfile: riskProfileSchema,
  platformIds: z.array(z.string()).min(1).max(3).optional(),
  strategyIds: z.array(z.string()).min(1).max(6).optional(),
});

export const validationIssueSchema = z.object({
  severity: z.enum(["ERROR", "WARNING", "INFO"]),
  code: z.string(),
  path: z.string(),
  message: z.string(),
  remediation: z.string().optional(),
});

export const allocationValidationSchema = z.object({
  valid: z.boolean(),
  normalizedDraft: allocationDraftSchema,
  issues: z.array(validationIssueSchema),
  estimated: z.object({
    annualizedKnownCosts: z
      .object({ amount: z.string(), currency: z.string().length(3) })
      .optional(),
    platformConcentrationPct: z.record(z.string(), z.number()),
    strategyConcentrationPct: z.record(z.string(), z.number()),
    modeledDrawdownPct: z.number().optional(),
  }),
  ruleSetVersion: z.string(),
  termsVersions: z.record(z.string(), z.string()),
  dataMode: dataModeSchema,
});

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  serviceMode: serviceModeSchema,
  contractStatus: z.enum(["ACTIVE", "PENDING", "NONE"]),
  platformIds: z.array(z.string()),
  strategyIds: z.array(z.string()),
  currency: z.string().length(3),
  balance: z.number().nullable(),
  equity: z.number().nullable(),
  floatingPnl: z.number().nullable(),
  todayPnl: z.number().nullable(),
  totalPnl: z.number().nullable(),
  totalPnlPct: z.number().nullable(),
  maxDrawdownPct: z.number().nullable(),
  connectionStatus: z.enum([
    "CONNECTED",
    "DEGRADED",
    "DISCONNECTED",
    "PENDING",
  ]),
  equitySeries: z.array(equityPointSchema),
  positions: z.array(strategyPositionSchema),
  recentTrades: z.array(strategyTradeSchema),
  allocation: allocationDraftSchema.nullable(),
  source: sourceMetaSchema,
});

export const overviewSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  portfolio: z.object({
    equity: z.number(),
    balance: z.number(),
    todayPnlPct: z.number(),
    return90dPct: z.number(),
    maxDrawdownPct: z.number(),
    activeStrategies: z.number().int().min(0).max(6),
    equitySeries: z.array(equityPointSchema),
  }),
  strategies: z.array(coreStrategySchema).length(6),
  platforms: z.array(platformSchema),
  source: sourceMetaSchema,
});

export type DataMode = z.infer<typeof dataModeSchema>;
export type Freshness = z.infer<typeof freshnessSchema>;
export type SourceMeta = z.infer<typeof sourceMetaSchema>;
export type EquityPoint = z.infer<typeof equityPointSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type CoreStrategy = z.infer<typeof coreStrategySchema>;
export type StrategyDataOverride = z.infer<typeof strategyDataOverrideSchema>;
export type PlatformProfile = z.infer<typeof platformSchema>;
export type AllocationDraft = z.infer<typeof allocationDraftSchema>;
export type AllocationRequest = z.infer<typeof allocationRequestSchema>;
export type AllocationValidation = z.infer<typeof allocationValidationSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ServiceAccount = z.infer<typeof accountSchema>;
export type V2Overview = z.infer<typeof overviewSchema>;
