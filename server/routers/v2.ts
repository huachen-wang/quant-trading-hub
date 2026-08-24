import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  allocationDraftSchema,
  allocationRequestSchema,
  contentBlockSchema,
  strategyDataOverrideSchema,
} from "../../shared/v2/contracts";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { adminProcedure } from "./_admin";
import { validateAllocation } from "../v2/allocation-engine";
import {
  contentBlockHeading,
  listStrategyContentForAdmin,
  strategyContentPageKey,
  withStoredStrategyContent,
} from "../v2/content-store";
import { getV2Provider } from "../v2/provider";
import {
  applyStrategyDataOverride,
  createStrategyDataOverrideSample,
  deleteStoredStrategyDataOverride,
  listStoredStrategyDataOverrides,
  rebuildOverviewFromStrategies,
  saveStoredStrategyDataOverride,
} from "../v2/data-overrides";
import { getNiubangPublicPulse } from "../v2/niubang-public-pulse";
import { managedSessionsRouter } from "./managed-sessions";

function assertV2Enabled() {
  if (process.env.EAXAU_V2_ENABLED === "false") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "EAXAU V2 预览当前未启用。",
    });
  }
}

const enabledProcedure = publicProcedure.use(async ({ next }) => {
  assertV2Enabled();
  return next();
});

const enabledAdminProcedure = adminProcedure.use(async ({ next }) => {
  assertV2Enabled();
  return next();
});

function requirePrivateProviderUser(
  providerKind: "DEMO" | "HTTP" | "NIUBANG",
  user: unknown,
) {
  if (providerKind !== "DEMO" && !user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "账户数据需要完成身份验证和数据授权。",
    });
  }
  if (providerKind !== "DEMO") {
    // 当前上游接口只有全量 /accounts，没有 user/tenant scope。
    // 在券商适配器提供用户级隔离前必须 fail closed，避免跨客户暴露。
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "真实账户快照尚未完成用户级数据隔离；请先通过资管会话提交脱敏券商授权。",
    });
  }
}

export const v2Router = router({
  status: publicProcedure.query(() => {
    const provider = getV2Provider();
    return {
      enabled: process.env.EAXAU_V2_ENABLED !== "false",
      provider: provider.kind,
      contractVersion: "2026.08.2",
      previewPath: "/",
    } as const;
  }),

  livePulse: enabledProcedure.query(() => getNiubangPublicPulse()),

  managedSessions: managedSessionsRouter,

  overview: enabledProcedure.query(async () => {
    const [overview, overrides] = await Promise.all([
      getV2Provider().getOverview(),
      listStoredStrategyDataOverrides(),
    ]);
    const strategies = await Promise.all(
      overview.strategies.map((strategy) => withStoredStrategyContent(
        applyStrategyDataOverride(strategy, overrides.get(strategy.id)?.override),
      )),
    );
    return rebuildOverviewFromStrategies(overview, strategies);
  }),

  strategies: router({
    list: enabledProcedure.query(async () => {
      const [strategies, overrides] = await Promise.all([
        getV2Provider().listStrategies(),
        listStoredStrategyDataOverrides(),
      ]);
      return Promise.all(strategies.map((strategy) => withStoredStrategyContent(
        applyStrategyDataOverride(strategy, overrides.get(strategy.id)?.override),
      )));
    }),
    byId: enabledProcedure
      .input(z.object({ id: z.string().min(1).max(80) }))
      .query(async ({ input }) => {
        const strategy = await getV2Provider().getStrategy(input.id);
        if (!strategy) {
          throw new TRPCError({ code: "NOT_FOUND", message: "核心策略不存在。" });
        }
        const overrides = await listStoredStrategyDataOverrides();
        return withStoredStrategyContent(
          applyStrategyDataOverride(strategy, overrides.get(strategy.id)?.override),
        );
      }),
  }),

  adminData: router({
    list: enabledAdminProcedure.query(async () => {
      const [strategies, overrides] = await Promise.all([
        getV2Provider().listStrategies(),
        listStoredStrategyDataOverrides(),
      ]);
      return strategies.map((strategy) => {
        const stored = overrides.get(strategy.id);
        return {
          strategy: applyStrategyDataOverride(strategy, stored?.override),
          override: stored?.override ?? null,
          recordId: stored?.recordId ?? null,
        };
      });
    }),
    sample: enabledAdminProcedure
      .input(z.object({
        strategyId: z.string().min(1).max(80),
        mode: z.enum(["CUSTOM", "HYBRID"]).default("CUSTOM"),
      }))
      .query(async ({ input }) => {
        const strategy = await getV2Provider().getStrategy(input.strategyId);
        if (!strategy) throw new TRPCError({ code: "NOT_FOUND", message: "核心策略不存在。" });
        return createStrategyDataOverrideSample(strategy, input.mode);
      }),
    save: enabledAdminProcedure
      .input(strategyDataOverrideSchema)
      .mutation(async ({ input }) => {
        const strategy = await getV2Provider().getStrategy(input.strategyId);
        if (!strategy) throw new TRPCError({ code: "NOT_FOUND", message: "核心策略不存在。" });
        const result = await saveStoredStrategyDataOverride(input);
        if (!result) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "数据库未连接，当前环境不能保存自定义数据。",
          });
        }
        return { ok: true };
      }),
    delete: enabledAdminProcedure
      .input(z.object({ strategyId: z.string().min(1).max(80) }))
      .mutation(async ({ input }) => {
        const result = await deleteStoredStrategyDataOverride(input.strategyId);
        if (!result) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "数据库未连接，当前环境不能移除自定义数据。",
          });
        }
        return { ok: true };
      }),
  }),

  adminContent: router({
    list: enabledAdminProcedure
      .input(z.object({ strategyId: z.string().min(1).max(80) }))
      .query(async ({ input }) => {
        const strategy = await getV2Provider().getStrategy(input.strategyId);
        if (!strategy) {
          throw new TRPCError({ code: "NOT_FOUND", message: "核心策略不存在。" });
        }
        return listStrategyContentForAdmin(strategy);
      }),
    save: enabledAdminProcedure
      .input(
        z.object({
          recordId: z.number().int().positive().nullable().optional(),
          strategyId: z.string().min(1).max(80),
          block: contentBlockSchema,
          sortOrder: z.number().int().min(0).max(999),
          isVisible: z.boolean(),
        }),
      )
      .mutation(async ({ input }) => {
        const strategy = await getV2Provider().getStrategy(input.strategyId);
        if (!strategy) {
          throw new TRPCError({ code: "NOT_FOUND", message: "核心策略不存在。" });
        }
        const payload = {
          title: contentBlockHeading(input.block),
          content: JSON.stringify(input.block),
          icon: input.block.type,
          sortOrder: input.sortOrder,
          isVisible: input.isVisible,
        };
        const result = input.recordId
          ? await db.updatePageContent(input.recordId, payload)
          : await db.createPageContent({
              ...payload,
              pageKey: strategyContentPageKey(input.strategyId),
              sectionKey: input.block.id,
            });
        if (!result) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "数据库未连接，当前环境不能保存内容。",
          });
        }
        return { ok: true };
      }),
    reorder: enabledAdminProcedure
      .input(
        z.object({
          strategyId: z.string().min(1).max(80),
          blockIds: z
            .array(z.string().min(1).max(120))
            .min(1)
            .max(50)
            .refine((ids) => new Set(ids).size === ids.length, {
              message: "内容区块不能重复。",
            }),
        }),
      )
      .mutation(async ({ input }) => {
        const strategy = await getV2Provider().getStrategy(input.strategyId);
        if (!strategy) {
          throw new TRPCError({ code: "NOT_FOUND", message: "核心策略不存在。" });
        }
        const items = await listStrategyContentForAdmin(strategy);
        const byId = new Map(items.map((item) => [item.block.id, item]));
        if (
          input.blockIds.length !== items.length ||
          input.blockIds.some((id) => !byId.has(id))
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "内容列表已变化，请刷新后重新排序。",
          });
        }

        const result = await db.reorderPageContents(
          strategyContentPageKey(input.strategyId),
          input.blockIds.map((blockId, index) => {
            const item = byId.get(blockId)!;
            return {
              recordId: item.recordId,
              sectionKey: item.block.id,
              title: contentBlockHeading(item.block),
              content: JSON.stringify(item.block),
              icon: item.block.type,
              sortOrder: (index + 1) * 10,
              isVisible: item.isVisible,
            };
          }),
        );
        if (!result) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "数据库未连接，当前环境不能调整顺序。",
          });
        }
        return { ok: true };
      }),
    delete: enabledAdminProcedure
      .input(z.object({ recordId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const result = await db.deletePageContent(input.recordId);
        if (!result) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "数据库未连接，当前环境不能删除内容。",
          });
        }
        return { ok: true };
      }),
  }),

  platforms: router({
    list: enabledProcedure.query(() => getV2Provider().listPlatforms()),
  }),

  allocation: router({
    recommend: enabledProcedure
      .input(allocationRequestSchema)
      .mutation(({ input }) => getV2Provider().recommendAllocation(input)),
    validate: enabledProcedure
      .input(allocationDraftSchema)
      .mutation(async ({ input }) => {
        const provider = getV2Provider();
        const [platforms, strategies, overrides] = await Promise.all([
          provider.listPlatforms(),
          provider.listStrategies(),
          listStoredStrategyDataOverrides(),
        ]);
        return validateAllocation(
          input,
          platforms,
          strategies.map((strategy) => applyStrategyDataOverride(
            strategy,
            overrides.get(strategy.id)?.override,
          )),
        );
      }),
  }),

  accounts: router({
    list: enabledProcedure.query(({ ctx }) => {
      const provider = getV2Provider();
      requirePrivateProviderUser(provider.kind, ctx.user);
      return provider.listAccounts();
    }),
    byId: enabledProcedure
      .input(z.object({ id: z.string().min(1).max(80) }))
      .query(async ({ ctx, input }) => {
        const provider = getV2Provider();
        requirePrivateProviderUser(provider.kind, ctx.user);
        const account = await provider.getAccount(input.id);
        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND", message: "账户不存在。" });
        }
        return account;
      }),
  }),
});
