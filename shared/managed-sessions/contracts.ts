import { z } from "zod";

export const MANAGED_SESSION_TERMS = [30, 90, 180] as const;
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

export const managedSessionStatusSchema = z.enum(MANAGED_SESSION_STATUSES);
export const managedCapitalModeSchema = z.enum([
  "DIRECT_BROKER",
  "MANAGED_VAULT",
  "MIXED",
]);
export const managedFundingSourceSchema = z.enum([
  "DIRECT_BROKER",
  "MANAGED_VAULT",
]);
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

const decimalAmountSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/, "请输入最多 6 位小数的 USDT 金额")
  .refine((value) => Number(value) > 0, "资金规模必须大于 0")
  .refine(
    (value) => Number(value) <= 1_000_000_000_000,
    "资金规模超出系统上限",
  );

export const managedStrategySelectionSchema = z.object({
  strategyId: z.string().min(1).max(80),
  weightPct: z.number().positive().max(100),
  riskMultiplier: z.number().min(0.25).max(2),
});

export const managedExecutionSlotInputSchema = z.object({
  brokerId: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(80).optional(),
  capitalWeightPct: z.number().positive().max(100),
  fundingSource: managedFundingSourceSchema,
});

function nearlyEquals(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

export const managedSessionDraftInputSchema = z
  .object({
    termDays: z.union([z.literal(30), z.literal(90), z.literal(180)]),
    capitalMode: managedCapitalModeSchema,
    targetCapital: decimalAmountSchema,
    settlementAsset: z.literal("USDT").default("USDT"),
    riskProfile: managedRiskProfileSchema,
    maxDrawdownPct: z.number().min(1).max(18),
    exitMode: managedExitModeSchema,
    strategies: z.array(managedStrategySelectionSchema).length(6),
    executionSlots: z.array(managedExecutionSlotInputSchema).min(1).max(2),
  })
  .superRefine((input, ctx) => {
    const strategyIds = input.strategies.map((item) => item.strategyId);
    if (new Set(strategyIds).size !== 6) {
      ctx.addIssue({
        code: "custom",
        path: ["strategies"],
        message: "资管会话必须包含 6 款不重复策略",
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
        message: "6 款策略的权重合计必须为 100%",
      });
    }

    const brokerIds = input.executionSlots.map((item) => item.brokerId);
    if (new Set(brokerIds).size !== brokerIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["executionSlots"],
        message: "同一资管会话不能重复配置同一券商槽位",
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

    const sources = new Set(
      input.executionSlots.map((item) => item.fundingSource),
    );
    const validCapitalMode =
      (input.capitalMode === "DIRECT_BROKER" &&
        sources.size === 1 &&
        sources.has("DIRECT_BROKER")) ||
      (input.capitalMode === "MANAGED_VAULT" &&
        sources.size === 1 &&
        sources.has("MANAGED_VAULT")) ||
      (input.capitalMode === "MIXED" &&
        input.executionSlots.length === 2 &&
        sources.size === 2);
    if (!validCapitalMode) {
      ctx.addIssue({
        code: "custom",
        path: ["capitalMode"],
        message:
          "资金承载模式必须与券商槽位一致；MIXED 需同时包含券商直充与 Managed Vault 两个槽位",
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
export type ManagedCapitalMode = z.infer<typeof managedCapitalModeSchema>;
export type ManagedExitMode = z.infer<typeof managedExitModeSchema>;
