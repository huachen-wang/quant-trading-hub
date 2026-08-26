import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { z } from "zod";
import {
  AI_QUANT_ALLIANCE_NAME,
  ALLIANCE_BROKERS,
  ALLIANCE_STRATEGY_IDS,
  BROKER_FUNDING_NETWORKS,
  BROKER_FUNDING_STATUSES,
  MANAGED_SESSION_STATUSES,
  allianceBrokerIdSchema,
  brokerFundingNetworkSchema,
  brokerFundingStatusSchema,
  brokerFundingTransactionReferenceSchema,
  isFundingTxHashValid,
  managedFundsRouteSchema,
  managedSessionDraftInputSchema,
  managedSessionStatusSchema,
  managedSessionUpdateDraftSchema,
  normalizeFundingTxHash,
  slotConnectionStatusSchema,
  tradeAuthorizationStatusSchema,
  usdtAmountSchema,
  type BrokerFundingStatus,
  type ManagedSessionStatus,
} from "../../shared/managed-sessions/contracts";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  isAdminTotpConfigured,
  matchAdminTotpStep,
} from "../_core/admin-totp";
import { getFundingCustodyProviderReadiness } from "../_core/payments/funding-custody-provider";
import * as db from "../db";
import {
  assertBrokerFundingTransition,
  assertManagedSessionTransition,
  generateBrokerFundingIntentNo,
  generateManagedSessionNo,
  timestampsForManagedTransition,
} from "../managed-sessions/state-machine";
import { getV2Provider } from "../v2/provider";
import { adminProcedure } from "./_admin";
import {
  assertSecurityAttemptAllowed,
  clearSecurityFailures,
  recordSecurityFailure,
  requestIp,
} from "../_core/admin-security-throttle";

const sessionRefSchema = z.object({
  sessionNo: z.string().min(1).max(64),
});

const fundingRefSchema = sessionRefSchema.extend({
  intentNo: z.string().min(1).max(64),
});

const collectionApprovalStatusSchema = z.enum([
  "NOT_APPROVED",
  "PENDING",
  "APPROVED",
  "SUSPENDED",
]);

const reconciliationResultSchema = z.enum([
  "MATCHED",
  "UNDERPAID",
  "OVERPAID",
  "WRONG_NETWORK",
  "LATE_RECEIPT",
  "DUPLICATE_TX",
  "REFUND_PENDING",
  "REFUNDED",
  "MANUAL_REVIEW",
]);

const screeningStatusSchema = z.enum([
  "PENDING",
  "CLEARED",
  "HELD",
  "REJECTED",
]);

function notFound(message = "AI量化联盟委托不存在。"): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

function conflict(error: unknown): never {
  throw new TRPCError({
    code: "CONFLICT",
    message: error instanceof Error ? error.message : "状态已发生变化。",
  });
}

function assertOwner(session: any, user: { id: number; role: string }) {
  if (session.userId !== user.id && user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "无权访问该委托。" });
  }
}

async function getOwnedSession(
  sessionNo: string,
  user: { id: number; role: string },
) {
  const session = await db.getManagedSessionByNo(sessionNo);
  if (!session) notFound();
  assertOwner(session, user);
  return session;
}

async function getOwnedFunding(
  sessionNo: string,
  intentNo: string,
  user: { id: number; role: string },
) {
  const session = await getOwnedSession(sessionNo, user);
  const funding = await db.getBrokerFundingIntentByNo(intentNo);
  if (!funding || funding.sessionId !== session.id) {
    notFound("券商入金记录不存在。");
  }
  return { session, funding };
}

function containsCredentialLikeText(value: string | null | undefined) {
  if (!value) return false;
  return /(password|passwd|private.?key|mnemonic|seed.?phrase|api.?key|secret|otp|\b\d{6}\b)/i.test(
    value,
  );
}

function hashExternalReference(value: string | null | undefined) {
  if (!value) return null;
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function parseNetworks(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function isCollectionApprovalCurrent(approval: any, amount?: string) {
  if (
    !approval ||
    approval.status !== "APPROVED" ||
    !approval.approvedEntity ||
    !approval.approvedRegion ||
    !approval.approvedChannelId ||
    !approval.validUntil ||
    new Date(approval.validUntil).getTime() <= Date.now() ||
    parseNetworks(approval.allowedNetworks).length === 0
  ) {
    return false;
  }
  if (!amount) return true;
  const value = toMicroUsdt(amount);
  if (
    approval.minimumAmount &&
    value < toMicroUsdt(approval.minimumAmount)
  ) {
    return false;
  }
  if (
    approval.maximumAmount &&
    value > toMicroUsdt(approval.maximumAmount)
  ) {
    return false;
  }
  return true;
}

function toMicroUsdt(value: string | number) {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
}

function formatMicroUsdt(value: bigint) {
  const whole = value / 1_000_000n;
  const fraction = String(value % 1_000_000n).padStart(6, "0");
  return `${whole}.${fraction}`;
}

function plannedSlotAmount(targetCapital: string, weightPct: string | number) {
  const basisPoints = BigInt(Math.round(Number(weightPct) * 100));
  const micro = (toMicroUsdt(targetCapital) * basisPoints + 5_000n) / 10_000n;
  return formatMicroUsdt(micro);
}

function assertFundingSetupReady(session: any, slot: any) {
  if (
    !["READY", "ACTIVE"].includes(session.status) ||
    session.tradeAuthorizationStatus !== "GRANTED"
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "委托与交易授权均达到 READY 后才能发放平台跟踪的入金指令。",
    });
  }
  if (
    slot?.connectionStatus !== "VERIFIED" ||
    slot?.tradePermission !== "GRANTED" ||
    !slot?.authorizationReference
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "对应客户券商账户、交易权与外部指令参考尚未全部核验，不能发放入金地址。",
    });
  }
}

function publicFundingEvent(event: any) {
  return {
    id: event.id,
    eventType: event.eventType,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    createdAt: event.createdAt,
  };
}

function safeFundingResumeStatus(funding: any) {
  const saved = String(funding.resumeStatus || "");
  const direct = [
    "WAITING_ACCOUNT",
    "WAITING_INSTRUCTIONS",
    "READY_TO_FUND",
    "TX_SUBMITTED",
  ];
  const collection = [...direct, "RECEIVED"];
  return funding.fundsRoute === "BROKER_DIRECT"
    ? direct.includes(saved)
      ? saved
      : "TX_SUBMITTED"
    : collection.includes(saved)
      ? saved
      : "RECEIVED";
}

function presentFunding(funding: any, session: any, admin = false) {
  const slot = session.executionSlots.find(
    (item: any) => item.id === funding.slotId,
  );
  const common = {
    id: funding.id,
    intentNo: funding.intentNo,
    sessionNo: session.sessionNo,
    slotKey: slot?.slotKey ?? null,
    brokerId: funding.brokerId,
    status: funding.status,
    asset: "USDT" as const,
    fundsRoute: funding.fundsRoute,
    custodyProvider: funding.custodyProvider ?? "MANUAL",
    automaticTransfer: false,
    network: funding.network,
    depositAddress: funding.depositAddress,
    depositTag: funding.depositTag,
    expectedAmount: funding.expectedAmount,
    declaredAmount: funding.declaredAmount,
    txHash: funding.txHash,
    receivedAmount: funding.receivedAmount,
    observedNetwork: funding.observedNetwork,
    confirmations: funding.confirmations,
    reconciliationResult: funding.reconciliationResult,
    complianceStatus:
      funding.fundsRoute === "PLATFORM_COLLECTION"
        ? funding.screeningStatus
        : null,
    payoutAmount: funding.payoutAmount,
    payoutNetwork: funding.payoutNetwork,
    payoutTxHash: funding.payoutTxHash,
    payoutApproved: Boolean(funding.payoutApprovedAt),
    refundAmount: funding.refundAmount,
    refundTxHash: funding.refundTxHash,
    creditedAmount: funding.creditedAmount,
    instructionsIssuedAt: funding.instructionsIssuedAt,
    instructionsExpireAt: funding.instructionsExpireAt,
    submittedAt: funding.submittedAt,
    receivedAt: funding.receivedAt,
    reconciledAt: funding.reconciledAt,
    creditedAt: funding.creditedAt,
    cancelledAt: funding.cancelledAt,
    createdAt: funding.createdAt,
    updatedAt: funding.updatedAt,
    events: admin
      ? funding.events
      : (funding.events ?? []).map(publicFundingEvent),
  };
  if (!admin) return common;
  return {
    ...common,
    userId: funding.userId,
    sessionId: funding.sessionId,
    slotId: funding.slotId,
    instructionSource: funding.instructionSource,
    collectionAddressId: funding.collectionAddressId,
    externalProviderRef: funding.externalProviderRef,
    payerWalletAddress: funding.payerWalletAddress,
    payerOwnershipAttestedAt: funding.payerOwnershipAttestedAt,
    customerEligibilityReferenceHash:
      funding.customerEligibilityReferenceHash,
    customerEligibilityAttestedBy:
      funding.customerEligibilityAttestedBy,
    customerEligibilityAttestedAt:
      funding.customerEligibilityAttestedAt,
    screeningStatus: funding.screeningStatus,
    screeningProviderRef: funding.screeningProviderRef,
    complianceNote: funding.complianceNote,
    clearedBy: funding.clearedBy,
    clearedAt: funding.clearedAt,
    payoutRequestedBy: funding.payoutRequestedBy,
    payoutRequestedAt: funding.payoutRequestedAt,
    payoutApprovedBy: funding.payoutApprovedBy,
    payoutApprovedAt: funding.payoutApprovedAt,
    payoutSubmittedAt: funding.payoutSubmittedAt,
    payoutDestination: funding.payoutDestination,
    payoutDestinationReferenceHash:
      funding.payoutDestinationReferenceHash,
    verifiedRefundAddress: funding.verifiedRefundAddress,
    refundAddressVerifiedBy: funding.refundAddressVerifiedBy,
    refundAddressVerifiedAt: funding.refundAddressVerifiedAt,
    brokerCreditReference: funding.brokerCreditReference,
    exceptionReason: funding.exceptionReason,
    resolutionNote: funding.resolutionNote,
    resumeStatus: funding.resumeStatus,
    safeResumeStatus: safeFundingResumeStatus(funding),
  };
}

async function collectionGate(brokerId: string, amount?: string) {
  if (!isAdminTotpConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "USDT 敏感操作需先配置 ADMIN_TOTP_SECRET_BASE32 动态验证；未就绪时不得发放入金地址。",
    });
  }
  const approval = await db.getBrokerCollectionApproval(brokerId);
  if (!approval || approval.status !== "APPROVED") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${brokerId} 的企业代收通道尚未完成书面批准，当前只能使用券商直入。`,
    });
  }
  if (!isCollectionApprovalCurrent(approval, amount)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${brokerId} 的企业代收批准缺少实体/地区/通道/允许网络或已过期。`,
    });
  }
  if (amount) {
    const value = toMicroUsdt(amount);
    if (
      approval.minimumAmount &&
      value < toMicroUsdt(approval.minimumAmount)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `代收金额低于已批准通道下限 ${approval.minimumAmount} USDT。`,
      });
    }
    if (
      approval.maximumAmount &&
      value > toMicroUsdt(approval.maximumAmount)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `代收金额高于已批准通道上限 ${approval.maximumAmount} USDT。`,
      });
    }
  }
  return approval;
}

const totpCodeSchema = z.string().trim().regex(/^\d{6}$/);

async function assertSensitiveTotp(
  adminId: number,
  code: string,
  action: string,
  ip = "unknown",
) {
  const principal = `admin:${adminId}`;
  try {
    assertSecurityAttemptAllowed("ADMIN_TOTP", principal, ip);
  } catch (error) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: error instanceof Error ? error.message : "动态验证尝试过多",
    });
  }
  const timeStep = matchAdminTotpStep(code);
  if (timeStep === null) {
    recordSecurityFailure("ADMIN_TOTP", principal, ip);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "动态码未配置、已过期或不正确。",
    });
  }
  clearSecurityFailures("ADMIN_TOTP", principal, ip);
  try {
    await db.consumeAdminTotpStep({ adminId, timeStep, action });
  } catch (error) {
    conflict(error);
  }
}

async function validateCatalogReferences(
  input: z.infer<typeof managedSessionDraftInputSchema>,
) {
  const provider = getV2Provider();
  const [strategies, platforms] = await Promise.all([
    provider.listStrategies(),
    provider.listPlatforms(),
  ]);
  const strategyIds = new Set(strategies.map((item) => item.id));
  const unknownStrategies = input.strategies
    .map((item) => item.strategyId)
    .filter((id) => !strategyIds.has(id));
  if (unknownStrategies.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `未知策略：${unknownStrategies.join("、")}`,
    });
  }
  const platformIds = new Set(platforms.map((item) => item.id));
  const unknownBrokers = input.executionSlots
    .map((item) => item.brokerId)
    .filter((id) => !platformIds.has(id));
  if (unknownBrokers.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `未知券商执行节点：${unknownBrokers.join("、")}`,
    });
  }
}

async function readinessFor(session: any) {
  const provider = getV2Provider();
  const [strategies, platforms] = await Promise.all([
    provider.listStrategies(),
    provider.listPlatforms(),
  ]);
  const selectedStrategyIds = session.strategies.map(
    (item: any) => item.strategyId,
  );
  const selectedPlatforms = platforms.filter((platform) =>
    session.executionSlots.some((slot: any) => slot.brokerId === platform.id),
  );
  const covered = new Set(
    selectedPlatforms.flatMap((platform) => platform.supportedStrategyIds),
  );
  const uncoveredStrategyIds = selectedStrategyIds.filter(
    (strategyId: string) => !covered.has(strategyId),
  );
  const selectedStrategies = strategies.filter((strategy) =>
    selectedStrategyIds.includes(strategy.id),
  );
  const currentStrategyIds = new Set(strategies.map((strategy) => strategy.id));
  const missingStrategyIds = selectedStrategyIds.filter(
    (strategyId: string) => !currentStrategyIds.has(strategyId),
  );
  const unavailableStrategyIds = selectedStrategies
    .filter((strategy) => strategy.source.freshness === "OFFLINE")
    .map((strategy) => strategy.id);
  const nonLiveStrategyIds = selectedStrategies
    .filter(
      (strategy) =>
        strategy.source.dataMode !== "LIVE" &&
        strategy.source.dataMode !== "HYBRID",
    )
    .map((strategy) => strategy.id);
  const unverifiedSlots = session.executionSlots
    .filter(
      (slot: any) =>
        slot.connectionStatus !== "VERIFIED" ||
        slot.tradePermission !== "GRANTED" ||
        !slot.authorizationReference,
    )
    .map((slot: any) => slot.slotKey);
  const fundingIntents = await db.listBrokerFundingIntents({
    sessionId: session.id,
  });
  const unfundedSlots = session.executionSlots
    .filter(
      (slot: any) => {
        const planned = plannedSlotAmount(
          String(session.targetCapital),
          slot.capitalWeightPct,
        );
        return !fundingIntents.some(
          (funding: any) =>
            funding.slotId === slot.id &&
            funding.status === "CREDITED" &&
            funding.creditedAmount &&
            toMicroUsdt(funding.creditedAmount) === toMicroUsdt(planned) &&
            toMicroUsdt(funding.expectedAmount) === toMicroUsdt(planned),
        );
      },
    )
    .map((slot: any) => slot.slotKey);
  const collectionApprovalBlockedBrokers: string[] = [];
  if (session.fundsRoute === "PLATFORM_COLLECTION") {
    for (const slot of session.executionSlots) {
      const approval = await db.getBrokerCollectionApproval(slot.brokerId);
      const slotAmount = plannedSlotAmount(
        String(session.targetCapital),
        slot.capitalWeightPct,
      );
      if (
        !isAdminTotpConfigured() ||
        !isCollectionApprovalCurrent(approval, slotAmount)
      ) {
        collectionApprovalBlockedBrokers.push(slot.brokerId);
      }
    }
  }
  const providerActivationBlocked = provider.kind === "DEMO";
  const strategyCountValid =
    session.strategies.length >= 1 &&
    session.strategies.length <= 6 &&
    new Set(selectedStrategyIds).size === selectedStrategyIds.length &&
    selectedStrategyIds.every((id: string) =>
      (ALLIANCE_STRATEGY_IDS as readonly string[]).includes(id),
    );

  return {
    canSubmitForReview: session.status === "DRAFT",
    canActivate:
      session.status === "READY" &&
      strategyCountValid &&
      uncoveredStrategyIds.length === 0 &&
      missingStrategyIds.length === 0 &&
      unavailableStrategyIds.length === 0 &&
      nonLiveStrategyIds.length === 0 &&
      unverifiedSlots.length === 0 &&
      unfundedSlots.length === 0 &&
      collectionApprovalBlockedBrokers.length === 0 &&
      !providerActivationBlocked &&
      session.tradeAuthorizationStatus === "GRANTED" &&
      session.withdrawalPermission === "NONE",
    uncoveredStrategyIds,
    missingStrategyIds,
    strategyCountValid,
    unavailableStrategyIds,
    nonLiveStrategyIds,
    unverifiedSlots,
    unfundedSlots,
    collectionApprovalBlockedBrokers,
    providerActivationBlocked,
    dataMode: provider.kind === "DEMO" ? "DEMO" : "CONNECTED_PROVIDER",
    notes: [
      "创建、修改和提交只保存方案，不下单、不调仓、不转移 USDT。",
      "交易权可独立授予；提现权始终为 NONE。",
      session.fundsRoute === "PLATFORM_COLLECTION"
        ? "企业代收仅在券商书面通道批准有效时可用，转出由外部企业钱包/托管商完成并要求 TOTP 分步复核。"
        : "券商直入地址必须从客户本人券商门户实时获取。",
    ],
  };
}

async function present(session: any, admin = false) {
  const {
    termDays: _legacyTermDays,
    capitalMode: _legacyCapitalMode,
    expiresAt: _legacyExpiresAt,
    events,
    executionSlots,
    ...safeSession
  } = session;
  return {
    ...safeSession,
    productName: AI_QUANT_ALLIANCE_NAME,
    hasTerm: false,
    executionSlots: executionSlots.map((slot: any) => {
      const {
        fundingSource: _legacyFundingSource,
        authorizationReference,
        ...safeSlot
      } = slot;
      if (admin) {
        return {
          ...safeSlot,
          authorizationReference,
          fundsRoute: session.fundsRoute,
        };
      }
      return { ...safeSlot, fundsRoute: session.fundsRoute };
    }),
    events: admin
      ? events
      : (events ?? []).map((event: any) => ({
          id: event.id,
          eventType: event.eventType,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          createdAt: event.createdAt,
        })),
    readiness: await readinessFor(session),
    permissionBoundary: {
      tradePermission: session.tradeAuthorizationStatus,
      withdrawalPermission: "NONE" as const,
    },
    executionContract: {
      draftHasExternalSideEffects: false,
      submitHasExternalSideEffects: false,
      activationRequiresAdmin: true,
      automaticTransfer: false,
    },
  };
}

function validateAddressForNetwork(address: string, network: string) {
  const value = address.trim();
  if (network === "TRON") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
  if (["ETHEREUM", "BSC", "ARBITRUM", "POLYGON"].includes(network)) {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  }
  if (network === "SOLANA") {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  }
  return value.length >= 8 && value.length <= 255 && !/\s/.test(value);
}

async function requireFundingTransition(
  funding: any,
  next: BrokerFundingStatus,
) {
  try {
    assertBrokerFundingTransition(funding.status, next);
  } catch (error) {
    conflict(error);
  }
}

export const managedSessionsRouter = router({
  capabilities: publicProcedure.query(async () => {
    const custodyProvider = getFundingCustodyProviderReadiness();
    const totpConfigured = isAdminTotpConfigured();
    const approvals = await db.listBrokerCollectionApprovals();
    const approvalByBroker = new Map<string, any>(
      approvals.map((item: any) => [item.brokerId, item]),
    );
    return {
      productName: AI_QUANT_ALLIANCE_NAME,
      version: "2026.08.2",
      strategyCount: 6,
      strategyIds: ALLIANCE_STRATEGY_IDS,
      executionSlots: { min: 1, max: 3 },
      brokers: ALLIANCE_BROKERS.map((broker) => {
        const approval = approvalByBroker.get(broker.id);
        const approvalCurrent = isCollectionApprovalCurrent(approval);
        return {
          ...broker,
          collectionApproval: approval?.status ?? "NOT_APPROVED",
          collectionOperational:
            totpConfigured && custodyProvider.ready && approvalCurrent,
        };
      }),
      onboardingModes: ["SELF_OPENED", "PLATFORM_ASSISTED"] as const,
      fundsRoutes: ["BROKER_DIRECT", "PLATFORM_COLLECTION"] as const,
      settlementAssets: ["USDT"] as const,
      fundingNetworks: BROKER_FUNDING_NETWORKS,
      fundingStatuses: BROKER_FUNDING_STATUSES,
      riskProfiles: ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const,
      statuses: MANAGED_SESSION_STATUSES,
      hasTerm: false,
      createsDraftOnly: true,
      withdrawalPermission: "NONE" as const,
      custodyProvider,
      collectionOperational: totpConfigured && custodyProvider.ready,
      usdtOperationsReady: totpConfigured,
      automaticTransfer: custodyProvider.automaticPayoutSigning,
      externalSideEffectsOnCreate: false,
    };
  }),

  create: protectedProcedure
    .input(managedSessionDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      await validateCatalogReferences(input);
      const session = await db.createManagedSessionDraft(
        ctx.user.id,
        generateManagedSessionNo(),
        input,
      );
      if (!session) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI量化联盟委托草案创建失败。",
        });
      }
      return present(session);
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await db.listManagedSessions(ctx.user.id);
    return Promise.all(sessions.map((session: any) => present(session)));
  }),

  byId: protectedProcedure
    .input(sessionRefSchema)
    .query(async ({ ctx, input }) =>
      present(await getOwnedSession(input.sessionNo, ctx.user)),
    ),

  status: protectedProcedure
    .input(sessionRefSchema)
    .query(async ({ ctx, input }) => {
      const session = await getOwnedSession(input.sessionNo, ctx.user);
      return {
        sessionNo: session.sessionNo,
        status: session.status,
        version: session.version,
        tradeAuthorizationStatus: session.tradeAuthorizationStatus,
        withdrawalPermission: "NONE" as const,
        executionEnabled: session.executionEnabled,
        hasTerm: false,
        readiness: await readinessFor(session),
        updatedAt: session.updatedAt,
      };
    }),

  updateDraft: protectedProcedure
    .input(managedSessionUpdateDraftSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await getOwnedSession(input.sessionNo, ctx.user);
      if (session.status !== "DRAFT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "只能修改 DRAFT 状态的委托草案。",
        });
      }
      await validateCatalogReferences(input.draft);
      const updated = await db.replaceManagedSessionDraft(
        input.sessionNo,
        input.draft,
      );
      if (!updated) notFound();
      return present(updated);
    }),

  submit: protectedProcedure
    .input(sessionRefSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await getOwnedSession(input.sessionNo, ctx.user);
      try {
        assertManagedSessionTransition(session.status, "PENDING_REVIEW");
      } catch (error) {
        conflict(error);
      }
      const updated = await db.transitionManagedSession(input.sessionNo, {
        actorUserId: ctx.user.id,
        expectedFrom: "DRAFT",
        toStatus: "PENDING_REVIEW",
        eventType: "SUBMITTED_FOR_REVIEW",
        executionEnabled: false,
        timestamps: timestampsForManagedTransition("PENDING_REVIEW"),
        eventPayload: { executionSideEffects: false },
      });
      if (!updated) notFound();
      return present(updated);
    }),

  cancel: protectedProcedure
    .input(sessionRefSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await getOwnedSession(input.sessionNo, ctx.user);
      try {
        assertManagedSessionTransition(session.status, "CANCELLED");
      } catch (error) {
        conflict(error);
      }
      const updated = await db.transitionManagedSession(input.sessionNo, {
        actorUserId: ctx.user.id,
        expectedFrom: session.status,
        toStatus: "CANCELLED",
        eventType: "MANDATE_CANCELLED",
        executionEnabled: false,
        tradeAuthorizationStatus:
          session.tradeAuthorizationStatus === "GRANTED"
            ? "REVOKED"
            : session.tradeAuthorizationStatus,
        timestamps: timestampsForManagedTransition("CANCELLED"),
      });
      if (!updated) notFound();
      return present(updated);
    }),

  requestExit: protectedProcedure
    .input(sessionRefSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await getOwnedSession(input.sessionNo, ctx.user);
      try {
        assertManagedSessionTransition(session.status, "EXIT_REQUESTED");
      } catch (error) {
        conflict(error);
      }
      const updated = await db.transitionManagedSession(input.sessionNo, {
        actorUserId: ctx.user.id,
        expectedFrom: "ACTIVE",
        toStatus: "EXIT_REQUESTED",
        eventType: "EXIT_REQUESTED",
        executionEnabled: false,
        timestamps: timestampsForManagedTransition("EXIT_REQUESTED"),
        eventPayload: { exitMode: session.exitMode, opensDisabled: true },
      });
      if (!updated) notFound();
      return present(updated);
    }),

  createFundingIntent: protectedProcedure
    .input(
      sessionRefSchema.extend({
        slotKey: z.string().min(1).max(64),
        expectedAmount: usdtAmountSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await getOwnedSession(input.sessionNo, ctx.user);
      if (
        ["DRAFT", "EXIT_REQUESTED", "WINDING_DOWN", "ENDED", "CANCELLED", "REJECTED"].includes(
          session.status,
        )
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "请先提交委托审核，且退出/终止阶段不能新建入金记录。",
        });
      }
      const slot = session.executionSlots.find(
        (item: any) => item.slotKey === input.slotKey,
      );
      if (!slot) notFound("券商执行槽位不存在。");
      const plannedAmount = plannedSlotAmount(
        String(session.targetCapital),
        slot.capitalWeightPct,
      );
      if (toMicroUsdt(input.expectedAmount) !== toMicroUsdt(plannedAmount)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `该券商槽位的计划入金为 ${plannedAmount} USDT，不能由客户改写。`,
        });
      }
      const existingFunding = await db.listBrokerFundingIntents({
        sessionId: session.id,
      });
      if (
        existingFunding.some(
          (item: any) =>
            item.slotId === slot.id && item.status !== "CANCELLED",
        )
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "该券商槽位已有未取消的入金记录，不得重复创建。",
        });
      }
      const funding = await db.createBrokerFundingIntent(
        session,
        slot,
        generateBrokerFundingIntentNo(),
        input.expectedAmount,
      );
      if (!funding) notFound("券商入金记录创建失败。");
      return presentFunding(funding, session);
    }),

  submitFundingIntent: protectedProcedure
    .input(fundingRefSchema)
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      const slot = session.executionSlots.find(
        (item: any) => item.id === funding.slotId,
      );
      assertFundingSetupReady(session, slot);
      const next = "WAITING_INSTRUCTIONS" as const;
      await requireFundingTransition(funding, next);
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        "DRAFT",
        next,
        ctx.user.id,
        "FUNDING_INTENT_SUBMITTED",
        {},
        { fundsRoute: funding.fundsRoute },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session);
    }),

  fundingIntents: protectedProcedure
    .input(sessionRefSchema)
    .query(async ({ ctx, input }) => {
      const session = await getOwnedSession(input.sessionNo, ctx.user);
      const rows = await db.listBrokerFundingIntents({
        userId: ctx.user.role === "admin" ? undefined : ctx.user.id,
        sessionId: session.id,
      });
      return rows.map((row: any) => presentFunding(row, session));
    }),

  fundingIntent: protectedProcedure
    .input(fundingRefSchema)
    .query(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      return presentFunding(funding, session);
    }),

  submitFundingTransaction: protectedProcedure
    .input(
      fundingRefSchema.extend({
        txHash: brokerFundingTransactionReferenceSchema,
        declaredAmount: usdtAmountSchema,
        payerWalletAddress: z.string().trim().min(8).max(255).optional(),
        payerOwnershipAttested: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      await requireFundingTransition(funding, "TX_SUBMITTED");
      if (!funding.network || !funding.depositAddress) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "入金网络与地址尚未完成核验。",
        });
      }
      if (!isFundingTxHashValid(input.txHash, funding.network)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Tx Hash 不符合 ${funding.network} 网络格式。`,
        });
      }
      if (
        funding.fundsRoute === "PLATFORM_COLLECTION" &&
        (!input.payerWalletAddress || !input.payerOwnershipAttested)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "券商入金需填写付款钱包地址并声明由本人或已授权主体控制。",
        });
      }
      if (
        input.payerWalletAddress &&
        !validateAddressForNetwork(input.payerWalletAddress, funding.network)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `付款钱包地址不符合 ${funding.network} 格式。`,
        });
      }
      if (
        toMicroUsdt(input.declaredAmount) !==
        toMicroUsdt(funding.expectedAmount)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "申报入金金额必须与该券商槽位的计划金额一致；差异不能作为已足额入金。",
        });
      }
      const txHash = normalizeFundingTxHash(input.txHash, funding.network);
      try {
        await db.reserveChainTransaction({
          network: funding.network,
          normalizedHash: txHash,
          usageType:
            funding.fundsRoute === "PLATFORM_COLLECTION"
              ? "COLLECTION_INBOUND"
              : "BROKER_DIRECT_INBOUND",
          referenceNo: funding.intentNo,
          actorUserId: ctx.user.id,
        });
      } catch (error) {
        conflict(error);
      }
      const now = new Date();
      const late =
        funding.instructionsExpireAt &&
        new Date(funding.instructionsExpireAt).getTime() < now.getTime();
      let updated;
      try {
        updated = await db.transitionBrokerFundingIntent(
          funding.intentNo,
          "READY_TO_FUND",
          "TX_SUBMITTED",
          ctx.user.id,
          "FUNDING_TX_SUBMITTED",
          {
            txHash,
            declaredAmount: input.declaredAmount,
            payerWalletAddress: input.payerWalletAddress ?? null,
            payerOwnershipAttestedAt: input.payerOwnershipAttested
              ? now
              : null,
            submittedAt: now,
            reconciliationResult: late ? "LATE_RECEIPT" : null,
          },
          { late, network: funding.network },
        );
      } catch (error) {
        await db.releaseChainTransactionReservation({
          network: funding.network,
          normalizedHash: txHash,
          usageType:
            funding.fundsRoute === "PLATFORM_COLLECTION"
              ? "COLLECTION_INBOUND"
              : "BROKER_DIRECT_INBOUND",
          referenceNo: funding.intentNo,
        });
        throw error;
      }
      if (!updated) {
        await db.releaseChainTransactionReservation({
          network: funding.network,
          normalizedHash: txHash,
          usageType:
            funding.fundsRoute === "PLATFORM_COLLECTION"
              ? "COLLECTION_INBOUND"
              : "BROKER_DIRECT_INBOUND",
          referenceNo: funding.intentNo,
        });
        notFound("券商入金记录不存在。");
      }
      return presentFunding(updated, session);
    }),

  cancelFundingIntent: protectedProcedure
    .input(fundingRefSchema)
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      await requireFundingTransition(funding, "CANCELLED");
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        funding.status,
        "CANCELLED",
        ctx.user.id,
        "FUNDING_CANCELLED",
        { cancelledAt: new Date() },
      );
      if (funding.collectionAddressId) {
        await db.markCollectionAddressUsed(funding.id);
      }
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session);
    }),

  adminList: adminProcedure.query(async () => {
    const sessions = await db.listManagedSessions();
    return Promise.all(sessions.map((session: any) => present(session, true)));
  }),

  adminReviewSlot: adminProcedure
    .input(
      sessionRefSchema.extend({
        slotKey: z.string().min(1).max(64),
        connectionStatus: slotConnectionStatusSchema,
        tradePermission: tradeAuthorizationStatusSchema,
        accountAlias: z.string().trim().max(80).nullable().optional(),
        authorizationReference: z.string().trim().max(120).nullable().optional(),
        totpCode: totpCodeSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await db.getManagedSessionByNo(input.sessionNo);
      if (!session) notFound();
      if (session.status === "DRAFT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "委托草案提交审核后才能登记券商授权。",
        });
      }
      if (["ENDED", "CANCELLED", "REJECTED"].includes(session.status)) {
        throw new TRPCError({ code: "CONFLICT", message: "终止状态不能修改券商授权。" });
      }
      if (
        (input.connectionStatus === "VERIFIED" ||
          input.tradePermission === "GRANTED") &&
        !input.authorizationReference
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "已核验的券商槽位必须提供外部授权参考号。",
        });
      }
      if (
        input.tradePermission === "GRANTED" &&
        input.connectionStatus !== "VERIFIED"
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "券商连接未核验时不能授予交易权。" });
      }
      if (
        input.connectionStatus === "VERIFIED" ||
        input.tradePermission === "GRANTED"
      ) {
        if (!input.totpCode) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "核验连接或授予交易权必须输入当前 6 位动态码。",
          });
        }
        await assertSensitiveTotp(
          ctx.user.id,
          input.totpCode,
          "REVIEW_BROKER_TRADE_AUTHORIZATION",
          requestIp(ctx.req),
        );
      }
      if (
        containsCredentialLikeText(input.accountAlias) ||
        containsCredentialLikeText(input.authorizationReference)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "只能保存脱敏别名和外部授权参考号，不得上传密码、OTP、API Key、私钥或令牌。",
        });
      }
      const updated = await db.updateManagedExecutionSlot(
        input.sessionNo,
        input.slotKey,
        {
          connectionStatus: input.connectionStatus,
          tradePermission: input.tradePermission,
          accountAlias: input.accountAlias,
          authorizationReference: hashExternalReference(
            input.authorizationReference,
          ),
          actorUserId: ctx.user.id,
        },
      );
      if (!updated) notFound();
      if (input.connectionStatus === "VERIFIED") {
        const slot = updated.executionSlots.find(
          (item: any) => item.slotKey === input.slotKey,
        );
        const waiting = await db.listBrokerFundingIntents({
          sessionId: updated.id,
          status: "WAITING_ACCOUNT",
        });
        for (const funding of waiting.filter(
          (item: any) => item.slotId === slot?.id,
        )) {
          await db.transitionBrokerFundingIntent(
            funding.intentNo,
            "WAITING_ACCOUNT",
            "WAITING_INSTRUCTIONS",
            ctx.user.id,
            "BROKER_ACCOUNT_VERIFIED",
          );
        }
      }
      return present(updated, true);
    }),

  adminTransition: adminProcedure
    .input(
      sessionRefSchema.extend({
        toStatus: managedSessionStatusSchema.exclude(["DRAFT"]),
        note: z.string().trim().max(500).optional(),
        totpCode: totpCodeSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (containsCredentialLikeText(input.note)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "状态备注不得包含凭据。" });
      }
      const session = await db.getManagedSessionByNo(input.sessionNo);
      if (!session) notFound();
      try {
        assertManagedSessionTransition(
          session.status as ManagedSessionStatus,
          input.toStatus,
        );
      } catch (error) {
        conflict(error);
      }
      if (input.toStatus === "READY") {
        const invalidSlots = session.executionSlots.filter(
          (slot: any) =>
            slot.connectionStatus !== "VERIFIED" ||
            slot.tradePermission !== "GRANTED" ||
            !slot.authorizationReference ||
            slot.withdrawalPermission !== "NONE",
        );
        if (invalidSlots.length) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "所有券商槽位都必须完成交易权核验，且提现权必须为 NONE。",
          });
        }
      }
      if (input.toStatus === "ACTIVE") {
        const readiness = await readinessFor(session);
        if (!readiness.canActivate) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: [
              "委托尚未满足启用条件。",
              readiness.uncoveredStrategyIds.length
                ? `券商未覆盖策略：${readiness.uncoveredStrategyIds.join("、")}`
                : "",
              readiness.unverifiedSlots.length
                ? `未核验槽位：${readiness.unverifiedSlots.join("、")}`
                : "",
              readiness.unfundedSlots.length
                ? `未确认券商入账槽位：${readiness.unfundedSlots.join("、")}`
                : "",
              readiness.collectionApprovalBlockedBrokers.length
                ? `代收通道未批准：${readiness.collectionApprovalBlockedBrokers.join("、")}`
                : "",
              readiness.providerActivationBlocked
                ? "DEMO 数据提供器不能启用真实委托。"
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          });
        }
        if (!input.totpCode) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "启用真实委托必须输入当前 6 位动态码。",
          });
        }
        await assertSensitiveTotp(
          ctx.user.id,
          input.totpCode,
          "ACTIVATE_MANAGED_SESSION",
          requestIp(ctx.req),
        );
      }
      const tradeAuthorizationStatus =
        input.toStatus === "PENDING_AUTHORIZATION"
          ? "PENDING"
          : input.toStatus === "READY"
            ? "GRANTED"
            : ["ENDED", "CANCELLED", "REJECTED"].includes(input.toStatus)
              ? "REVOKED"
              : session.tradeAuthorizationStatus;
      const updated = await db.transitionManagedSession(input.sessionNo, {
        actorUserId: ctx.user.id,
        expectedFrom: session.status as ManagedSessionStatus,
        toStatus: input.toStatus,
        eventType: `ADMIN_${input.toStatus}`,
        tradeAuthorizationStatus,
        executionEnabled: input.toStatus === "ACTIVE",
        timestamps: timestampsForManagedTransition(input.toStatus, new Date()),
        eventPayload: {
          note: input.note ?? null,
          externalTransferTriggered: false,
          externalOrderTriggered: false,
        },
      });
      if (!updated) notFound();
      return present(updated, true);
    }),

  adminFundingQueue: adminProcedure
    .input(
      z
        .object({
          status: brokerFundingStatusSchema.optional(),
          fundsRoute: managedFundsRouteSchema.optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const rows = await db.listBrokerFundingIntents({
        status: input?.status,
        fundsRoute: input?.fundsRoute,
        limit: input?.limit ?? 100,
      });
      const sessions = await db.listManagedSessions();
      const sessionById = new Map(
        sessions.map((session: any) => [session.id, session]),
      );
      return rows.map((funding: any) => {
        const session = sessionById.get(funding.sessionId);
        return session ? presentFunding(funding, session, true) : funding;
      });
    }),

  adminSetDirectFundingInstructions: adminProcedure
    .input(
      fundingRefSchema.extend({
        network: brokerFundingNetworkSchema,
        depositAddress: z.string().trim().min(8).max(255),
        depositTag: z.string().trim().max(120).nullable().optional(),
        instructionsExpireAt: z.coerce.date(),
        brokerPortalInstructionRef: z.string().trim().min(6).max(240),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (funding.fundsRoute !== "BROKER_DIRECT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该记录不是券商直入路由。" });
      }
      const slot = session.executionSlots.find(
        (item: any) => item.id === funding.slotId,
      );
      assertFundingSetupReady(session, slot);
      await requireFundingTransition(funding, "READY_TO_FUND");
      if (!validateAddressForNetwork(input.depositAddress, input.network)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `入金地址不符合 ${input.network} 格式。` });
      }
      const now = Date.now();
      const expiresAt = input.instructionsExpireAt.getTime();
      if (expiresAt < now + 5 * 60_000 || expiresAt > now + 24 * 60 * 60_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "券商直入指令有效期必须在当前时间 5 分钟至 24 小时之间。",
        });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "SET_DIRECT_BROKER_FUNDING_INSTRUCTIONS",
        requestIp(ctx.req),
      );
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        "WAITING_INSTRUCTIONS",
        "READY_TO_FUND",
        ctx.user.id,
        "BROKER_PORTAL_INSTRUCTIONS_RECORDED",
        {
          instructionSource: "BROKER_PORTAL",
          externalProviderRef: hashExternalReference(
            input.brokerPortalInstructionRef,
          ),
          network: input.network,
          depositAddress: input.depositAddress,
          depositTag: input.depositTag ?? null,
          instructionsIssuedAt: new Date(),
          instructionsExpireAt: input.instructionsExpireAt ?? null,
        },
        { network: input.network, source: "BROKER_PORTAL" },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminCreateCollectionAddress: adminProcedure
    .input(
      z.object({
        label: z.string().trim().min(1).max(80),
        network: brokerFundingNetworkSchema,
        address: z.string().trim().min(8).max(255),
        depositTag: z.string().trim().max(120).nullable().optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!validateAddressForNetwork(input.address, input.network)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `代收地址不符合 ${input.network} 格式。` });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "CREATE_COLLECTION_ADDRESS",
        requestIp(ctx.req),
      );
      try {
        const { totpCode: _totpCode, ...addressInput } = input;
        return await db.createCollectionAddress({
          ...addressInput,
          depositTag: input.depositTag ?? null,
          createdBy: ctx.user.id,
        });
      } catch (error) {
        conflict(error);
      }
    }),

  adminCollectionAddresses: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["AVAILABLE", "RESERVED", "USED", "DISABLED"]).optional(),
        })
        .optional(),
    )
    .query(({ input }) => db.listCollectionAddresses(input?.status)),

  adminAssignCollectionAddress: adminProcedure
    .input(
      fundingRefSchema.extend({
        addressId: z.number().int().positive(),
        instructionsExpireAt: z.coerce.date(),
        customerEligibilityReference: z.string().trim().min(6).max(240),
        scopeAttested: z.literal(true),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (funding.fundsRoute !== "PLATFORM_COLLECTION") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该记录不是企业代收路由。" });
      }
      const slot = session.executionSlots.find(
        (item: any) => item.id === funding.slotId,
      );
      assertFundingSetupReady(session, slot);
      const approval = await collectionGate(
        funding.brokerId,
        funding.expectedAmount,
      );
      const addresses = await db.listCollectionAddresses();
      const address = addresses.find((item: any) => item.id === input.addressId);
      if (!address) notFound("代收地址不存在。");
      const allowedNetworks = parseNetworks(approval.allowedNetworks);
      if (
        allowedNetworks.length &&
        !allowedNetworks.includes(address.network)
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `该券商批准通道不允许 ${address.network} 网络。`,
        });
      }
      const now = Date.now();
      const expiresAt = input.instructionsExpireAt.getTime();
      if (expiresAt < now + 5 * 60_000 || expiresAt > now + 24 * 60 * 60_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "企业代收指令有效期必须在当前时间 5 分钟至 24 小时之间。",
        });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "ASSIGN_COLLECTION_ADDRESS",
        requestIp(ctx.req),
      );
      try {
        const updated = await db.assignCollectionAddress(
          funding.intentNo,
          input.addressId,
          ctx.user.id,
          input.instructionsExpireAt,
          {
            referenceHash: hashExternalReference(
              input.customerEligibilityReference,
            )!,
            attestedAt: new Date(),
          },
        );
        if (!updated) notFound("入金记录或代收地址不存在。");
        return presentFunding(updated, session, true);
      } catch (error) {
        conflict(error);
      }
    }),

  adminRecordFundingReceipt: adminProcedure
    .input(
      fundingRefSchema.extend({
        receivedAmount: usdtAmountSchema,
        confirmations: z.number().int().min(1),
        observedNetwork: brokerFundingNetworkSchema,
        receivedAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (funding.fundsRoute !== "PLATFORM_COLLECTION") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "券商直入不经平台到账与转出对账。" });
      }
      await requireFundingTransition(funding, "RECEIVED");
      const receivedAt = input.receivedAt ?? new Date();
      const expected = toMicroUsdt(funding.expectedAmount);
      const received = toMicroUsdt(input.receivedAmount);
      const result =
        input.observedNetwork !== funding.network
          ? "WRONG_NETWORK"
          : received < expected
            ? "UNDERPAID"
            : received > expected
              ? "OVERPAID"
              : funding.instructionsExpireAt &&
                  receivedAt.getTime() >
                    new Date(funding.instructionsExpireAt).getTime()
                ? "LATE_RECEIPT"
                : "MATCHED";
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        "TX_SUBMITTED",
        "RECEIVED",
        ctx.user.id,
        "COLLECTION_RECEIPT_RECORDED",
        {
          receivedAmount: input.receivedAmount,
          confirmations: input.confirmations,
          observedNetwork: input.observedNetwork,
          reconciliationResult: result,
          receivedAt,
        },
        { result, confirmations: input.confirmations },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminScreenFunding: adminProcedure
    .input(
      fundingRefSchema.extend({
        screeningStatus: screeningStatusSchema,
        screeningProviderRef: z.string().trim().max(120).optional(),
        complianceNote: z.string().trim().max(1000).optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (funding.fundsRoute !== "PLATFORM_COLLECTION") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "仅企业代收需记录钱包筛查。" });
      }
      if (!funding.payerOwnershipAttestedAt) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "付款钱包归属声明尚未完成。" });
      }
      if (containsCredentialLikeText(input.complianceNote)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "合规备注不得包含密码、OTP、私钥或 API 凭据。" });
      }
      if (
        input.screeningStatus !== "PENDING" &&
        (!input.screeningProviderRef || !input.complianceNote)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CLEARED/HELD/REJECTED 必须登记外部筛查参考号与结论备注。",
        });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "UPDATE_WALLET_SCREENING",
        requestIp(ctx.req),
      );
      const updated = await db.appendBrokerFundingAuditEvent(
        funding.intentNo,
        ctx.user.id,
        "WALLET_SCREENING_UPDATED",
        {
          screeningStatus: input.screeningStatus,
          screeningProviderRef: hashExternalReference(
            input.screeningProviderRef,
          ),
          complianceNote: input.complianceNote ?? null,
          clearedBy:
            input.screeningStatus === "CLEARED" ? ctx.user.id : null,
          clearedAt:
            input.screeningStatus === "CLEARED" ? new Date() : null,
        },
        { screeningStatus: input.screeningStatus },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminReconcileFunding: adminProcedure
    .input(
      fundingRefSchema.extend({
        result: reconciliationResultSchema,
        note: z.string().trim().max(1000).optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (funding.fundsRoute !== "PLATFORM_COLLECTION") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该记录不需要平台代收对账。" });
      }
      if (
        !funding.receivedAmount ||
        !funding.observedNetwork ||
        !funding.receivedAt ||
        (funding.confirmations ?? 0) < 1
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "链上实收、网络、时间与确认数尚未完整登记。",
        });
      }
      const authoritativeResult =
        funding.observedNetwork !== funding.network
          ? "WRONG_NETWORK"
          : toMicroUsdt(funding.receivedAmount) <
              toMicroUsdt(funding.expectedAmount)
            ? "UNDERPAID"
            : toMicroUsdt(funding.receivedAmount) >
                toMicroUsdt(funding.expectedAmount)
              ? "OVERPAID"
              : funding.instructionsExpireAt &&
                  new Date(funding.receivedAt).getTime() >
                    new Date(funding.instructionsExpireAt).getTime()
                ? "LATE_RECEIPT"
                : "MATCHED";
      if (input.result !== authoritativeResult) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `客户端对账结论与服务端重算结果不一致；应为 ${authoritativeResult}。`,
        });
      }
      const matched = authoritativeResult === "MATCHED";
      const next = matched ? "RECONCILED" : "EXCEPTION";
      await requireFundingTransition(funding, next);
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "RECONCILE_COLLECTION_RECEIPT",
        requestIp(ctx.req),
      );
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        "RECEIVED",
        next,
        ctx.user.id,
        matched ? "COLLECTION_RECONCILED" : "COLLECTION_EXCEPTION_OPENED",
        {
          reconciliationResult: authoritativeResult,
          reconciledAt: new Date(),
          exceptionReason: matched
            ? null
            : input.note ?? `对账结果：${authoritativeResult}`,
          resumeStatus: matched ? null : "RECEIVED",
        },
        { result: authoritativeResult },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminRequestPayout: adminProcedure
    .input(
      fundingRefSchema.extend({
        payoutAmount: usdtAmountSchema,
        payoutNetwork: brokerFundingNetworkSchema,
        payoutDestination: z.string().trim().min(8).max(255),
        payoutDestinationReference: z.string().trim().min(6).max(240),
        note: z.string().trim().max(500).optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (funding.fundsRoute !== "PLATFORM_COLLECTION") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "券商直入不需要平台转出。" });
      }
      if (funding.screeningStatus !== "CLEARED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "钱包筛查未 CLEARED，不得申请转出。",
        });
      }
      await collectionGate(funding.brokerId, funding.expectedAmount);
      if (
        !funding.receivedAmount ||
        toMicroUsdt(input.payoutAmount) !==
          toMicroUsdt(funding.receivedAmount) ||
        toMicroUsdt(input.payoutAmount) !==
          toMicroUsdt(funding.expectedAmount)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "转入券商的 USDT 必须同时等于本次计划金额和已匹配实收金额；金额差异必须进入异常处理。",
        });
      }
      if (!validateAddressForNetwork(input.payoutDestination, input.payoutNetwork)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `券商入金目标不符合 ${input.payoutNetwork} 格式。` });
      }
      await requireFundingTransition(funding, "AWAITING_PAYOUT");
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "REQUEST_COLLECTION_PAYOUT",
        requestIp(ctx.req),
      );
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        "RECONCILED",
        "AWAITING_PAYOUT",
        ctx.user.id,
        "PAYOUT_REQUESTED",
        {
          payoutAmount: input.payoutAmount,
          payoutNetwork: input.payoutNetwork,
          payoutDestination: input.payoutDestination,
          payoutDestinationReferenceHash: hashExternalReference(
            input.payoutDestinationReference,
          ),
          payoutRequestedBy: ctx.user.id,
          payoutRequestedAt: new Date(),
          payoutApprovedBy: null,
          payoutApprovedAt: null,
        },
        { note: input.note ?? null, automaticTransfer: false },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminApprovePayout: adminProcedure
    .input(fundingRefSchema.extend({
      note: z.string().trim().max(500).optional(),
      totpCode: totpCodeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (funding.status !== "AWAITING_PAYOUT") {
        throw new TRPCError({ code: "CONFLICT", message: "该记录不在待转出审批状态。" });
      }
      if (funding.screeningStatus !== "CLEARED") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "钱包筛查状态已非 CLEARED，必须停止审批。" });
      }
      await collectionGate(funding.brokerId, funding.expectedAmount);
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "APPROVE_COLLECTION_PAYOUT",
        requestIp(ctx.req),
      );
      const updated = await db.appendBrokerFundingAuditEvent(
        funding.intentNo,
        ctx.user.id,
        "PAYOUT_APPROVED",
        { payoutApprovedBy: ctx.user.id, payoutApprovedAt: new Date() },
        { note: input.note ?? null, automaticTransfer: false },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminRecordPayout: adminProcedure
    .input(
      fundingRefSchema.extend({
        payoutTxHash: brokerFundingTransactionReferenceSchema,
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (!funding.payoutApprovedBy || !funding.payoutApprovedAt) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "转出申请尚未完成 TOTP 分步复核。" });
      }
      if (funding.screeningStatus !== "CLEARED") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "钱包筛查状态已非 CLEARED，不得登记转出。" });
      }
      await collectionGate(funding.brokerId, funding.expectedAmount);
      if (
        !funding.receivedAmount ||
        !funding.payoutAmount ||
        toMicroUsdt(funding.payoutAmount) > toMicroUsdt(funding.receivedAmount)
      ) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "转出金额超过实际代收到账金额。" });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "RECORD_COLLECTION_PAYOUT_TX",
        requestIp(ctx.req),
      );
      if (!funding.payoutNetwork || !isFundingTxHashValid(input.payoutTxHash, funding.payoutNetwork)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "转出 Tx Hash 与转出网络格式不匹配。" });
      }
      await requireFundingTransition(funding, "PAYOUT_SUBMITTED");
      const payoutTxHash = normalizeFundingTxHash(
        input.payoutTxHash,
        funding.payoutNetwork,
      );
      try {
        await db.reserveChainTransaction({
          network: funding.payoutNetwork,
          normalizedHash: payoutTxHash,
          usageType: "COLLECTION_PAYOUT",
          referenceNo: funding.intentNo,
          actorUserId: ctx.user.id,
        });
      } catch (error) {
        conflict(error);
      }
      let updated;
      try {
        updated = await db.transitionBrokerFundingIntent(
          funding.intentNo,
          "AWAITING_PAYOUT",
          "PAYOUT_SUBMITTED",
          ctx.user.id,
          "PAYOUT_TX_RECORDED",
          { payoutTxHash, payoutSubmittedAt: new Date() },
          { automaticTransfer: false, executionSystem: "EXTERNAL_WALLET_OR_CUSTODIAN" },
        );
      } catch (error) {
        await db.releaseChainTransactionReservation({
          network: funding.payoutNetwork,
          normalizedHash: payoutTxHash,
          usageType: "COLLECTION_PAYOUT",
          referenceNo: funding.intentNo,
        });
        throw error;
      }
      if (!updated) {
        await db.releaseChainTransactionReservation({
          network: funding.payoutNetwork,
          normalizedHash: payoutTxHash,
          usageType: "COLLECTION_PAYOUT",
          referenceNo: funding.intentNo,
        });
        notFound("券商入金记录不存在。");
      }
      return presentFunding(updated, session, true);
    }),

  adminMarkBrokerCreditPending: adminProcedure
    .input(
      fundingRefSchema.extend({
        confirmations: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      const expected =
        funding.fundsRoute === "PLATFORM_COLLECTION"
          ? "PAYOUT_SUBMITTED"
          : "TX_SUBMITTED";
      if (funding.status !== expected) {
        throw new TRPCError({ code: "CONFLICT", message: `当前路由需从 ${expected} 进入券商入账等待。` });
      }
      await requireFundingTransition(funding, "BROKER_CREDIT_PENDING");
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        expected,
        "BROKER_CREDIT_PENDING",
        ctx.user.id,
        "BROKER_CREDIT_PENDING",
        input.confirmations === undefined
          ? {}
          : { confirmations: input.confirmations },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminMarkFundingCredited: adminProcedure
    .input(
      fundingRefSchema.extend({
        creditedAmount: usdtAmountSchema,
        brokerCreditReference: z.string().trim().min(6).max(120),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      const allowed =
        funding.fundsRoute === "PLATFORM_COLLECTION"
          ? ["PAYOUT_SUBMITTED", "BROKER_CREDIT_PENDING"]
          : ["TX_SUBMITTED", "BROKER_CREDIT_PENDING"];
      if (!allowed.includes(funding.status)) {
        throw new TRPCError({ code: "CONFLICT", message: "当前状态不能标记券商已入账。" });
      }
      const creditedMicro = toMicroUsdt(input.creditedAmount);
      const maximumCreditable =
        funding.fundsRoute === "PLATFORM_COLLECTION"
          ? funding.payoutAmount
          : funding.declaredAmount ?? funding.expectedAmount;
      if (
        !maximumCreditable ||
        creditedMicro !== toMicroUsdt(maximumCreditable) ||
        creditedMicro !== toMicroUsdt(funding.expectedAmount)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "券商到账金额必须等于本账路计划且已申报/已批准转出的金额；差异需先进入异常处理。",
        });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "CONFIRM_BROKER_CREDIT",
        requestIp(ctx.req),
      );
      await requireFundingTransition(funding, "CREDITED");
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        allowed,
        "CREDITED",
        ctx.user.id,
        "BROKER_CREDIT_CONFIRMED",
        {
          creditedAmount: input.creditedAmount,
          brokerCreditReference: hashExternalReference(
            input.brokerCreditReference,
          ),
          creditedAt: new Date(),
        },
      );
      if (!updated) notFound("券商入金记录不存在。");
      if (funding.collectionAddressId) {
        await db.markCollectionAddressUsed(funding.id);
      }
      return presentFunding(updated, session, true);
    }),

  adminMarkFundingException: adminProcedure
    .input(fundingRefSchema.extend({ reason: z.string().trim().min(3).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      if (containsCredentialLikeText(input.reason)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "异常原因不得包含凭据。" });
      }
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (["CREDITED", "CANCELLED", "EXCEPTION"].includes(funding.status)) {
        throw new TRPCError({ code: "CONFLICT", message: "当前状态不能重复标记异常。" });
      }
      await requireFundingTransition(funding, "EXCEPTION");
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        funding.status,
        "EXCEPTION",
        ctx.user.id,
        "FUNDING_EXCEPTION_OPENED",
        { exceptionReason: input.reason, resumeStatus: funding.status },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminResolveFundingException: adminProcedure
    .input(
      fundingRefSchema.extend({
        resolutionNote: z.string().trim().min(3).max(1000),
        nextStatus: brokerFundingStatusSchema.exclude([
          "DRAFT",
          "CREDITED",
          "EXCEPTION",
        ]),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (containsCredentialLikeText(input.resolutionNote)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "解决备注不得包含凭据。" });
      }
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      const safeResume = safeFundingResumeStatus(funding);
      if (
        input.nextStatus !== "CANCELLED" &&
        input.nextStatus !== safeResume
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `异常只能恢复到安全检查点 ${safeResume} 或取消；不得跳过对账、CLEARED 和 TOTP 分步复核。`,
        });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "RESOLVE_FUNDING_EXCEPTION",
        requestIp(ctx.req),
      );
      await requireFundingTransition(funding, input.nextStatus);
      const resetsSensitiveWorkflow =
        funding.fundsRoute === "PLATFORM_COLLECTION" &&
        input.nextStatus === "RECEIVED";
      const updated = await db.transitionBrokerFundingIntent(
        funding.intentNo,
        "EXCEPTION",
        input.nextStatus,
        ctx.user.id,
        "FUNDING_EXCEPTION_RESOLVED",
        {
          resolutionNote: input.resolutionNote,
          exceptionReason: null,
          resumeStatus: null,
          ...(resetsSensitiveWorkflow
            ? {
                screeningStatus: "PENDING",
                screeningProviderRef: null,
                complianceNote: null,
                clearedBy: null,
                clearedAt: null,
                payoutAmount: null,
                payoutNetwork: null,
                payoutDestination: null,
                payoutTxHash: null,
                payoutRequestedBy: null,
                payoutRequestedAt: null,
                payoutApprovedBy: null,
                payoutApprovedAt: null,
                payoutSubmittedAt: null,
              }
            : {}),
          ...(input.nextStatus === "CANCELLED"
            ? { cancelledAt: new Date() }
            : {}),
        },
      );
      if (input.nextStatus === "CANCELLED" && funding.collectionAddressId) {
        await db.markCollectionAddressUsed(funding.id);
      }
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminVerifyRefundAddress: adminProcedure
    .input(
      fundingRefSchema.extend({
        address: z.string().trim().min(8).max(255),
        note: z.string().trim().max(500).optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (
        funding.fundsRoute !== "PLATFORM_COLLECTION" ||
        funding.status !== "EXCEPTION" ||
        !funding.network ||
        !funding.receivedAmount ||
        !funding.payerWalletAddress
      ) {
        throw new TRPCError({ code: "CONFLICT", message: "只能为异常入金核验退款地址。" });
      }
      if (!validateAddressForNetwork(input.address, funding.network)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "退款地址与入金网络不匹配。" });
      }
      if (input.address !== funding.payerWalletAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "退款地址必须与已声明并记录的原付款钱包地址一致。",
        });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "VERIFY_REFUND_ADDRESS",
        requestIp(ctx.req),
      );
      const updated = await db.appendBrokerFundingAuditEvent(
        funding.intentNo,
        ctx.user.id,
        "REFUND_ADDRESS_VERIFIED",
        {
          verifiedRefundAddress: input.address,
          refundAddressVerifiedBy: ctx.user.id,
          refundAddressVerifiedAt: new Date(),
          reconciliationResult: "REFUND_PENDING",
        },
        { note: input.note ?? null },
      );
      if (!updated) notFound("券商入金记录不存在。");
      return presentFunding(updated, session, true);
    }),

  adminRecordRefund: adminProcedure
    .input(
      fundingRefSchema.extend({
        refundAmount: usdtAmountSchema,
        refundTxHash: brokerFundingTransactionReferenceSchema,
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, funding } = await getOwnedFunding(
        input.sessionNo,
        input.intentNo,
        ctx.user,
      );
      if (!funding.verifiedRefundAddress || !funding.refundAddressVerifiedBy) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "退款地址尚未由管理员独立核验。" });
      }
      if (
        funding.fundsRoute !== "PLATFORM_COLLECTION" ||
        !funding.receivedAmount ||
        toMicroUsdt(input.refundAmount) > toMicroUsdt(funding.receivedAmount)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "退款仅适用于企业代收已到账记录，且退款金额不得超过实际到账金额。",
        });
      }
      if (!funding.network || !isFundingTxHashValid(input.refundTxHash, funding.network)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "退款 Tx Hash 与网络不匹配。" });
      }
      await requireFundingTransition(funding, "CANCELLED");
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "RECORD_COLLECTION_REFUND_TX",
        requestIp(ctx.req),
      );
      const refundTxHash = normalizeFundingTxHash(
        input.refundTxHash,
        funding.network,
      );
      try {
        await db.reserveChainTransaction({
          network: funding.network,
          normalizedHash: refundTxHash,
          usageType: "COLLECTION_REFUND",
          referenceNo: funding.intentNo,
          actorUserId: ctx.user.id,
        });
      } catch (error) {
        conflict(error);
      }
      let updated;
      try {
        updated = await db.transitionBrokerFundingIntent(
          funding.intentNo,
          "EXCEPTION",
          "CANCELLED",
          ctx.user.id,
          "REFUND_TX_RECORDED",
          {
            refundTxHash,
            refundAmount: input.refundAmount,
            reconciliationResult: "REFUNDED",
            cancelledAt: new Date(),
          },
          { automaticTransfer: false },
        );
      } catch (error) {
        await db.releaseChainTransactionReservation({
          network: funding.network,
          normalizedHash: refundTxHash,
          usageType: "COLLECTION_REFUND",
          referenceNo: funding.intentNo,
        });
        throw error;
      }
      if (!updated) {
        await db.releaseChainTransactionReservation({
          network: funding.network,
          normalizedHash: refundTxHash,
          usageType: "COLLECTION_REFUND",
          referenceNo: funding.intentNo,
        });
        notFound("券商入金记录不存在。");
      }
      if (funding.collectionAddressId) {
        await db.markCollectionAddressUsed(funding.id);
      }
      return presentFunding(updated, session, true);
    }),

  adminCollectionApprovals: adminProcedure.query(() =>
    db.listBrokerCollectionApprovals(),
  ),

  adminSetCollectionApproval: adminProcedure
    .input(
      z.object({
        brokerId: allianceBrokerIdSchema,
        status: collectionApprovalStatusSchema,
        approvalReference: z.string().trim().max(240).optional(),
        approvedEntity: z.string().trim().max(160).optional(),
        approvedRegion: z.string().trim().max(80).optional(),
        approvedChannelId: z.string().trim().max(120).optional(),
        validUntil: z.coerce.date().nullable().optional(),
        allowedNetworks: z.array(brokerFundingNetworkSchema).max(7).optional(),
        minimumAmount: usdtAmountSchema.nullable().optional(),
        maximumAmount: usdtAmountSchema.nullable().optional(),
        note: z.string().trim().max(1000).optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.status === "APPROVED" && !input.approvalReference) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "启用企业代收必须登记券商/通道书面批准参考号。",
        });
      }
      if (
        input.status === "APPROVED" &&
        (!input.approvedEntity ||
          !input.approvedRegion ||
          !input.approvedChannelId ||
          !input.allowedNetworks?.length ||
          !input.validUntil ||
          input.validUntil.getTime() <= Date.now())
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "启用企业代收必须登记获批实体、地区、通道 ID 与未来有效期。",
        });
      }
      if (
        input.minimumAmount &&
        input.maximumAmount &&
        toMicroUsdt(input.minimumAmount) > toMicroUsdt(input.maximumAmount)
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "代收金额下限不能高于上限。" });
      }
      if (containsCredentialLikeText(input.note)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "批准备注不得包含密码、OTP、私钥或 API 凭据。" });
      }
      await assertSensitiveTotp(
        ctx.user.id,
        input.totpCode,
        "SET_COLLECTION_APPROVAL",
        requestIp(ctx.req),
      );
      return db.upsertBrokerCollectionApproval({
        brokerId: input.brokerId,
        status: input.status,
        approvalReferenceHash: hashExternalReference(
          input.approvalReference,
        ),
        approvedEntity: input.approvedEntity ?? null,
        approvedRegion: input.approvedRegion ?? null,
        approvedChannelId: input.approvedChannelId ?? null,
        validUntil: input.validUntil ?? null,
        allowedNetworks: input.allowedNetworks
          ? JSON.stringify(input.allowedNetworks)
          : null,
        minimumAmount: input.minimumAmount ?? null,
        maximumAmount: input.maximumAmount ?? null,
        reviewedBy: ctx.user.id,
        approvedAt: input.status === "APPROVED" ? new Date() : null,
        note: input.note ?? null,
      });
    }),
});
