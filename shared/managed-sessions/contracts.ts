import { z } from "zod";

export const AI_QUANT_ALLIANCE_NAME = "AI量化联盟" as const;

export const ALLIANCE_BROKERS = [
  {
    id: "exness",
    name: "Exness",
    openAccountUrl: "https://my.exness.com/accounts/sign-up?lng=zh",
    managerUrl:
      "https://portfolio-management.exness.help/hc/en-us/articles/6787235670418-Joining-a-fund",
    usdtPublicStatus: "CHECK_IN_PORTAL",
  },
  {
    id: "ic-markets",
    name: "IC Markets",
    openAccountUrl: "https://www.ic.com/cn/open-trading-account/live",
    managerUrl: "https://www.icmarketspartners.com/en/apply",
    usdtPublicStatus: "CONFIRMED_BUT_TERMS_DYNAMIC",
  },
  {
    id: "blueberry-markets",
    name: "Blueberry Markets",
    openAccountUrl: "https://portal.blueberrymarkets.com/en/sign-up",
    managerUrl: "https://portal.blueberrypartners.com/en/signup",
    usdtPublicStatus: "CONFIRMED_BUT_TERMS_DYNAMIC",
  },
] as const;

export const ALLIANCE_BROKER_IDS = [
  "exness",
  "ic-markets",
  "blueberry-markets",
] as const;

export const ALLIANCE_STRATEGY_IDS = [
  "jingge-v51",
  "night-hunter",
  "quantum-queen",
  "gold-reaper",
  "black-aura",
  "bitcoin-core",
] as const;

export const MANAGED_SESSION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PENDING_AUTHORIZATION",
  "READY",
  "ACTIVE",
  "EXIT_REQUESTED",
  "WINDING_DOWN",
  "ENDED",
  "CANCELLED",
  "REJECTED",
] as const;

export const BROKER_FUNDING_STATUSES = [
  "DRAFT",
  "WAITING_ACCOUNT",
  "WAITING_INSTRUCTIONS",
  "READY_TO_FUND",
  "TX_SUBMITTED",
  "RECEIVED",
  "RECONCILED",
  "AWAITING_PAYOUT",
  "PAYOUT_SUBMITTED",
  "BROKER_CREDIT_PENDING",
  "CREDITED",
  "EXCEPTION",
  "CANCELLED",
] as const;

export const BROKER_FUNDING_NETWORKS = [
  "TRON",
  "ETHEREUM",
  "BSC",
  "ARBITRUM",
  "POLYGON",
  "SOLANA",
  "OTHER",
] as const;

export const managedSessionStatusSchema = z.enum(MANAGED_SESSION_STATUSES);
export const allianceBrokerIdSchema = z.enum(ALLIANCE_BROKER_IDS);
export const managedOnboardingModeSchema = z.enum([
  "SELF_OPENED",
  "PLATFORM_ASSISTED",
]);
export const managedFundsRouteSchema = z.enum([
  "BROKER_DIRECT",
  "PLATFORM_COLLECTION",
]);
export const brokerFundingStatusSchema = z.enum(BROKER_FUNDING_STATUSES);
export const brokerFundingNetworkSchema = z.enum(BROKER_FUNDING_NETWORKS);
export const managedRiskProfileSchema = z.enum([
  "CONSERVATIVE",
  "BALANCED",
  "AGGRESSIVE",
]);
export const managedExitModeSchema = z.enum([
  "IMMEDIATE_CLOSE",
  "NATURAL_EXIT",
  "HANDOVER_OPEN_POSITIONS",
]);
export const tradeAuthorizationStatusSchema = z.enum([
  "NOT_REQUESTED",
  "PENDING",
  "GRANTED",
  "REVOKED",
]);
export const slotConnectionStatusSchema = z.enum([
  "UNLINKED",
  "PENDING",
  "VERIFIED",
  "REVOKED",
]);

export const usdtAmountSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/, "请输入最多 6 位小数的 USDT 金额")
  .refine((value) => Number(value) > 0, "USDT 金额必须大于 0")
  .refine(
    (value) => Number(value) <= 1_000_000_000_000,
    "USDT 金额超出系统上限",
  );

export const brokerFundingTransactionReferenceSchema = z
  .string()
  .trim()
  .min(16)
  .max(160)
  .regex(/^[A-Za-z0-9:_-]+$/, "交易参考号包含不支持的字符");

export function normalizeFundingTxHash(value: string, network: BrokerFundingNetwork) {
  const trimmed = value.trim();
  if (network === "SOLANA") return trimmed;
  if (network === "OTHER") return trimmed;
  return trimmed.replace(/^0x/i, "").toLowerCase();
}

export function isFundingTxHashValid(value: string, network: BrokerFundingNetwork) {
  const trimmed = value.trim();
  if (network === "SOLANA") {
    return /^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(trimmed);
  }
  if (network === "OTHER") {
    return /^[A-Za-z0-9:_-]{16,160}$/.test(trimmed);
  }
  return /^(?:0x)?[a-fA-F0-9]{64}$/.test(trimmed);
}

export const managedStrategySelectionSchema = z.object({
  strategyId: z.enum(ALLIANCE_STRATEGY_IDS),
  weightPct: z.number().positive().max(100),
  riskMultiplier: z.number().min(0.25).max(2),
});

export const managedExecutionSlotInputSchema = z.object({
  brokerId: allianceBrokerIdSchema,
  label: z.string().trim().min(1).max(80).optional(),
  capitalWeightPct: z.number().positive().max(100),
});

function nearlyEquals(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

/**
 * AI 量化联盟委托配置。这里没有期限或 Vault 选项：
 * 两种 onboardingMode 只区分客户是自主开户，还是由平台协助接入。
 * 资金可直入客户本人券商账户，或在平台协助接入时经企业代收地址对账后转入。
 */
export const managedSessionDraftInputSchema = z
  .object({
    onboardingMode: managedOnboardingModeSchema,
    fundsRoute: managedFundsRouteSchema.default("BROKER_DIRECT"),
    targetCapital: usdtAmountSchema,
    settlementAsset: z.literal("USDT").default("USDT"),
    riskProfile: managedRiskProfileSchema,
    maxDrawdownPct: z.number().min(1).max(18),
    // 退出执行方式是风控底层参数，前端可不展示，默认自然退出。
    exitMode: managedExitModeSchema.default("NATURAL_EXIT"),
    strategies: z.array(managedStrategySelectionSchema).min(1).max(6),
    executionSlots: z.array(managedExecutionSlotInputSchema).min(1).max(3),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (
      input.fundsRoute === "PLATFORM_COLLECTION" &&
      input.onboardingMode !== "PLATFORM_ASSISTED"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fundsRoute"],
        message: "平台代收仅适用于平台协助接入模式",
      });
    }
    const strategyIds = input.strategies.map((item) => item.strategyId);
    if (new Set(strategyIds).size !== strategyIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["strategies"],
        message: "已选策略不得重复",
      });
    }

    const strategyWeight = input.strategies.reduce(
      (sum, item) => sum + item.weightPct,
      0,
    );
    if (!nearlyEquals(strategyWeight, 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["strategies"],
        message: "已选策略的权重合计必须为 100%",
      });
    }

    const brokerIds = input.executionSlots.map((item) => item.brokerId);
    if (new Set(brokerIds).size !== brokerIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["executionSlots"],
        message: "同一委托不能重复配置同一券商",
      });
    }

    const slotWeight = input.executionSlots.reduce(
      (sum, item) => sum + item.capitalWeightPct,
      0,
    );
    if (!nearlyEquals(slotWeight, 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["executionSlots"],
        message: "券商执行槽位的资金权重合计必须为 100%",
      });
    }

    const profileLimit = {
      CONSERVATIVE: 8,
      BALANCED: 12,
      AGGRESSIVE: 18,
    }[input.riskProfile];
    if (input.maxDrawdownPct > profileLimit) {
      ctx.addIssue({
        code: "custom",
        path: ["maxDrawdownPct"],
        message: `${input.riskProfile} 档的最大回撤上限为 ${profileLimit}%`,
      });
    }
  });

export const managedSessionUpdateDraftSchema = z.object({
  sessionNo: z.string().min(1).max(64),
  draft: managedSessionDraftInputSchema,
});

export type ManagedSessionStatus = z.infer<typeof managedSessionStatusSchema>;
export type ManagedSessionDraftInput = z.infer<
  typeof managedSessionDraftInputSchema
>;
export type ManagedOnboardingMode = z.infer<
  typeof managedOnboardingModeSchema
>;
export type ManagedExitMode = z.infer<typeof managedExitModeSchema>;
export type BrokerFundingStatus = z.infer<typeof brokerFundingStatusSchema>;
export type BrokerFundingNetwork = z.infer<typeof brokerFundingNetworkSchema>;
