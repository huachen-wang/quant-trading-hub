import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { z } from "zod";
import {
  MANAGED_SESSION_STATUSES,
  MANAGED_SESSION_TERMS,
  managedSessionDraftInputSchema,
  managedSessionStatusSchema,
  managedSessionUpdateDraftSchema,
  slotConnectionStatusSchema,
  tradeAuthorizationStatusSchema,
  type ManagedSessionStatus,
} from "../../shared/managed-sessions/contracts";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  assertManagedSessionTransition,
  generateManagedSessionNo,
  managedSessionExpiresAt,
  timestampsForManagedTransition,
} from "../managed-sessions/state-machine";
import { getV2Provider } from "../v2/provider";
import { adminProcedure } from "./_admin";

const sessionRefSchema = z.object({
  sessionNo: z.string().min(1).max(64),
});

function notFound(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "资管会话不存在。" });
}

function assertOwner(session: any, user: { id: number; role: string }) {
  if (session.userId !== user.id && user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "无权访问该资管会话。" });
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
  const vaultActivationEnabled =
    process.env.MANAGED_VAULT_ENABLED?.trim().toLowerCase() === "true";
  const vaultActivationBlocked =
    session.capitalMode !== "DIRECT_BROKER" && !vaultActivationEnabled;
  const providerActivationBlocked = provider.kind === "DEMO";
  const strategyCountValid =
    session.strategies.length === 6 && new Set(selectedStrategyIds).size === 6;

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
      !vaultActivationBlocked &&
      !providerActivationBlocked &&
      session.tradeAuthorizationStatus === "GRANTED" &&
      session.withdrawalPermission === "NONE",
    uncoveredStrategyIds,
    missingStrategyIds,
    strategyCountValid,
    unavailableStrategyIds,
    nonLiveStrategyIds,
    unverifiedSlots,
    vaultActivationEnabled,
    vaultActivationBlocked,
    providerActivationBlocked,
    dataMode: provider.kind === "DEMO" ? "DEMO" : "CONNECTED_PROVIDER",
    notes: [
      "创建、修改和提交只保存方案，不下单、不调仓、不转移 USDT。",
      "交易权可独立授予；提现权始终为 NONE。",
      ...(session.capitalMode !== "DIRECT_BROKER"
        ? [
            vaultActivationEnabled
              ? "Managed Vault 功能开关已开启，仍需逐槽完成托管、合规与链上合约审核。"
              : "Managed Vault 目前只可生成草案；完成托管、合规与链上合约审核前不可激活。",
          ]
        : []),
    ],
  };
}

async function present(session: any) {
  return {
    ...session,
    readiness: await readinessFor(session),
    permissionBoundary: {
      tradePermission: session.tradeAuthorizationStatus,
      withdrawalPermission: "NONE" as const,
    },
    executionContract: {
      draftHasExternalSideEffects: false,
      submitHasExternalSideEffects: false,
      activationRequiresAdmin: true,
    },
  };
}

function transitionError(error: unknown): never {
  throw new TRPCError({
    code: "CONFLICT",
    message: error instanceof Error ? error.message : "资管会话状态冲突。",
  });
}

function containsCredentialLikeText(value: string | null | undefined) {
  if (!value) return false;
  return /(password|passwd|private.?key|mnemonic|seed.?phrase|api.?key|secret|token|\b\d{6,}\b)/i.test(
    value,
  );
}

function hashExternalReference(value: string | null | undefined) {
  if (!value) return null;
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

export const managedSessionsRouter = router({
  capabilities: publicProcedure.query(() => ({
    version: "2026.08.1",
    strategyCount: 6,
    executionSlots: { min: 1, max: 2 },
    termDays: MANAGED_SESSION_TERMS,
    capitalModes: ["DIRECT_BROKER", "MANAGED_VAULT", "MIXED"] as const,
    settlementAssets: ["USDT"] as const,
    riskProfiles: ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const,
    exitModes: [
      "IMMEDIATE_CLOSE",
      "NATURAL_EXIT",
      "HANDOVER_OPEN_POSITIONS",
    ] as const,
    statuses: MANAGED_SESSION_STATUSES,
    createsDraftOnly: true,
    withdrawalPermission: "NONE" as const,
    externalSideEffectsOnCreate: false,
    vaultActivationEnabled:
      process.env.MANAGED_VAULT_ENABLED?.trim().toLowerCase() === "true",
  })),

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
          message: "资管草案创建失败。",
        });
      }
      return present(session);
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await db.listManagedSessions(ctx.user.id);
    return Promise.all(sessions.map(present));
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
        expiresAt: session.expiresAt,
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
          message: "只能修改 DRAFT 状态的资管会话。",
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
        transitionError(error);
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
        transitionError(error);
      }
      const updated = await db.transitionManagedSession(input.sessionNo, {
        actorUserId: ctx.user.id,
        expectedFrom: session.status,
        toStatus: "CANCELLED",
        eventType: "SESSION_CANCELLED",
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
        transitionError(error);
      }
      const updated = await db.transitionManagedSession(input.sessionNo, {
        actorUserId: ctx.user.id,
        expectedFrom: "ACTIVE",
        toStatus: "EXIT_REQUESTED",
        eventType: "EXIT_REQUESTED",
        // 一键退出立即禁止新执行；旧仓依 exitMode 由独立执行系统处理。
        executionEnabled: false,
        timestamps: timestampsForManagedTransition("EXIT_REQUESTED"),
        eventPayload: { exitMode: session.exitMode, opensDisabled: true },
      });
      if (!updated) notFound();
      return present(updated);
    }),

  adminList: adminProcedure.query(async () => {
    const sessions = await db.listManagedSessions();
    return Promise.all(sessions.map(present));
  }),

  adminReviewSlot: adminProcedure
    .input(
      sessionRefSchema.extend({
        slotKey: z.string().min(1).max(64),
        connectionStatus: slotConnectionStatusSchema,
        tradePermission: tradeAuthorizationStatusSchema,
        accountAlias: z.string().trim().max(80).nullable().optional(),
        authorizationReference: z
          .string()
          .trim()
          .max(120)
          .nullable()
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await db.getManagedSessionByNo(input.sessionNo);
      if (!session) notFound();
      if (session.status === "DRAFT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "资管草案提交审核后才能登记券商授权。",
        });
      }
      if (["ENDED", "CANCELLED", "REJECTED"].includes(session.status)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "终止状态的资管会话不能再修改券商授权。",
        });
      }
      if (session.status === "ACTIVE") {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "请先将 ACTIVE 会话切换为 EXIT_REQUESTED，关闭新执行后再变更槽位授权。",
        });
      }
      if (
        ["EXIT_REQUESTED", "WINDING_DOWN"].includes(session.status) &&
        (input.connectionStatus !== "REVOKED" ||
          input.tradePermission !== "REVOKED")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "退出阶段只允许撤销券商连接与交易权。",
        });
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "券商连接未核验时不能标记交易权已授予。",
        });
      }
      if (
        containsCredentialLikeText(input.accountAlias) ||
        containsCredentialLikeText(input.authorizationReference)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "只能保存脱敏别名和外部授权参考号，不得上传账号、密码、API Key、私钥或令牌。",
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
      return present(updated);
    }),

  adminTransition: adminProcedure
    .input(
      sessionRefSchema.extend({
        toStatus: managedSessionStatusSchema.exclude(["DRAFT"]),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (containsCredentialLikeText(input.note)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "状态备注不得包含账号、密码、API Key、私钥或令牌。",
        });
      }
      const session = await db.getManagedSessionByNo(input.sessionNo);
      if (!session) notFound();
      try {
        assertManagedSessionTransition(
          session.status as ManagedSessionStatus,
          input.toStatus,
        );
      } catch (error) {
        transitionError(error);
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
      if (
        input.toStatus === "ACTIVE" &&
        session.tradeAuthorizationStatus !== "GRANTED"
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "交易授权未完成，不能启用资管会话。",
        });
      }
      if (input.toStatus === "ACTIVE") {
        const readiness = await readinessFor(session);
        if (!readiness.canActivate) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: [
              "资管会话尚未满足激活条件。",
              readiness.uncoveredStrategyIds.length
                ? `券商未覆盖策略：${readiness.uncoveredStrategyIds.join("、")}`
                : "",
              !readiness.strategyCountValid
                ? "资管会话必须保持 6 款不重复策略。"
                : "",
              readiness.missingStrategyIds.length
                ? `策略目录已缺失：${readiness.missingStrategyIds.join("、")}`
                : "",
              readiness.unavailableStrategyIds.length
                ? `不可用策略：${readiness.unavailableStrategyIds.join("、")}`
                : "",
              readiness.nonLiveStrategyIds.length
                ? `未接入实时/混合数据的策略：${readiness.nonLiveStrategyIds.join("、")}`
                : "",
              readiness.unverifiedSlots.length
                ? `未核验槽位：${readiness.unverifiedSlots.join("、")}`
                : "",
              readiness.vaultActivationBlocked
                ? "Managed Vault 仅开放草案，激活开关未开启。"
                : "",
              readiness.providerActivationBlocked
                ? "DEMO 数据提供器不能激活真实资管会话。"
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          });
        }
      }

      const tradeAuthorizationStatus =
        input.toStatus === "PENDING_AUTHORIZATION"
          ? "PENDING"
          : input.toStatus === "READY"
            ? "GRANTED"
            : ["ENDED", "CANCELLED", "REJECTED"].includes(input.toStatus)
              ? "REVOKED"
              : session.tradeAuthorizationStatus;
      const executionEnabled = input.toStatus === "ACTIVE";
      const transitionAt = new Date();
      const transitionTimestamps = timestampsForManagedTransition(
        input.toStatus,
        transitionAt,
      );
      if (input.toStatus === "ACTIVE") {
        transitionTimestamps.expiresAt = managedSessionExpiresAt(
          session.termDays,
          transitionAt,
        );
      }
      const updated = await db.transitionManagedSession(input.sessionNo, {
        actorUserId: ctx.user.id,
        expectedFrom: session.status as ManagedSessionStatus,
        toStatus: input.toStatus,
        eventType: `ADMIN_${input.toStatus}`,
        tradeAuthorizationStatus,
        executionEnabled,
        timestamps: transitionTimestamps,
        eventPayload: {
          note: input.note ?? null,
          externalTransferTriggered: false,
          externalOrderTriggered: false,
        },
      });
      if (!updated) notFound();
      return present(updated);
    }),
});
