import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  allocationDraftSchema,
  allocationRequestSchema,
  contentBlockSchema,
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
  providerKind: "DEMO" | "HTTP",
  user: unknown,
) {
  if (providerKind === "HTTP" && !user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "账户数据需要登录并完成数据授权。",
    });
  }
}

export const v2Router = router({
  status: publicProcedure.query(() => {
    const provider = getV2Provider();
    return {
      enabled: process.env.EAXAU_V2_ENABLED !== "false",
      provider: provider.kind,
      contractVersion: "2026.08.1",
      previewPath: "/v2-preview",
    } as const;
  }),

  overview: enabledProcedure.query(async () => {
    const overview = await getV2Provider().getOverview();
    return {
      ...overview,
      strategies: await Promise.all(
        overview.strategies.map(withStoredStrategyContent),
      ),
    };
  }),

  strategies: router({
    list: enabledProcedure.query(async () => {
      const strategies = await getV2Provider().listStrategies();
      return Promise.all(strategies.map(withStoredStrategyContent));
    }),
    byId: enabledProcedure
      .input(z.object({ id: z.string().min(1).max(80) }))
      .query(async ({ input }) => {
        const strategy = await getV2Provider().getStrategy(input.id);
        if (!strategy) {
          throw new TRPCError({ code: "NOT_FOUND", message: "核心策略不存在。" });
        }
        return withStoredStrategyContent(strategy);
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
        const [platforms, strategies] = await Promise.all([
          provider.listPlatforms(),
          provider.listStrategies(),
        ]);
        return validateAllocation(input, platforms, strategies);
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
