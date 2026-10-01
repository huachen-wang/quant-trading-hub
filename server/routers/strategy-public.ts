import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  assessFreeClaim,
  classifyStrategyDelivery,
  FREE_CLAIM_MESSAGES,
} from "../_core/delivery-gate";
import {
  DOWNLOAD_TOKEN_TTL_MS,
  secureDownloadPath,
  signDownloadToken,
} from "../_core/secure-download";

export function toPublicStrategy(strategy: Record<string, any>): any {
  const { downloadUrl: _privateAssetUrl, ...publicFields } = strategy;
  // "有一行 downloadUrl" 不等于"这行是可交付的文件"。开户推荐链接
  // （kaibb.co / *.co/register/trader?link_id=&referrer_id=）配在这个字段里时，
  // 交付要走人工确认，不能在详情页显示成"付款后解锁"。
  // 详情页的 downloadRequiresContact 直接取 !downloadAvailable，所以判定要在这里做完。
  // 判定规则与 orders.create / payments.initiate / 下载路由共用 delivery-gate：
  // 这个 DTO 只是同一条规则的投影，服务端门禁不依赖它。
  return {
    ...publicFields,
    downloadAvailable:
      classifyStrategyDelivery({ downloadUrl: _privateAssetUrl }).mode === "file",
  };
}

export const strategiesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        platform: z.enum(["MT4", "MT5"]).optional(),
        orderBy: z.enum(["latest", "popular", "return", "hot"]).optional(),
        tag: z.string().optional(),
        productType: z.string().optional(),
        saleMode: z.enum(["direct", "inquiry"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ input }) => {
      const rows = await db.getStrategies(input);
      return rows.map((row: any) => toPublicStrategy(row));
    }),

  detail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const strategy = await db.getStrategyById(input.id);
      if (!strategy) throw new Error("Strategy not found");
      await db.incrementStrategyViewCount(input.id);
      return toPublicStrategy(strategy);
    }),

  backtestData: publicProcedure
    .input(z.object({ strategyId: z.number() }))
    .query(({ input }) => db.getBacktestData(input.strategyId)),

  search: publicProcedure
    .input(z.object({ keyword: z.string().min(1), limit: z.number().optional() }))
    .query(async ({ input }) => {
      const rows = await db.searchStrategies(input.keyword, input.limit);
      return rows.map((row: any) => toPublicStrategy(row));
    }),
});

export const commentsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        strategyId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(({ input }) => db.getComments(input.strategyId, input.limit, input.offset)),

  create: protectedProcedure
    .input(
      z.object({
        strategyId: z.number(),
        content: z.string().min(1).max(1000),
      }),
    )
    .mutation(({ ctx, input }) => {
      return db.createComment({
        userId: ctx.user.id,
        strategyId: input.strategyId,
        content: input.content,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => db.deleteComment(input.id, ctx.user.id)),
});

export const tradesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        strategyId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(({ input }) => db.getTrades(input.strategyId, input.limit, input.offset)),

  stats: publicProcedure
    .input(z.object({ strategyId: z.number() }))
    .query(({ input }) => db.getTradeStats(input.strategyId)),
});

export const purchasesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.getUserPurchases(ctx.user.id);
    return rows.map((row: any) => ({
      ...row,
      strategy: row.strategy ? toPublicStrategy(row.strategy) : null,
    }));
  }),

  hasPurchased: protectedProcedure
    .input(z.object({ strategyId: z.number() }))
    .query(({ ctx, input }) => db.hasUserPurchased(ctx.user.id, input.strategyId)),
});

export const downloadsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.getUserDownloads(ctx.user.id);
    return rows.map((row: any) => ({
      ...row,
      strategy: row.strategy ? toPublicStrategy(row.strategy) : null,
    }));
  }),

  /**
   * 免费商品的交付入口（需登录）。
   * - 已发布 + 直购 + isFree + 真文件 → 签发与付费下载同一条受控路由的 token。
   *   不建订单、不写付款记录；审计落在下载完成时的 downloads 表（recordDownload）。
   * - 缺文件 / 开户链接 → 返回 contact，由前端转人工咨询；不签 token、不伪造付款。
   * - 付费 / 未发布 / 仅咨询 → 直接拒绝，绕过前端的调用方同样拿不到 token。
   */
  claimFree: protectedProcedure
    .input(z.object({ strategyId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const strategy = await db.getStrategyById(input.strategyId);
      const claim = assessFreeClaim(strategy);
      if (!claim.ok) {
        if (claim.reason === "no_file" || claim.reason === "broker_link") {
          return { delivery: "contact" as const, reason: claim.reason };
        }
        throw new TRPCError({
          code: claim.reason === "unpublished" ? "NOT_FOUND" : "PRECONDITION_FAILED",
          message: FREE_CLAIM_MESSAGES[claim.reason],
        });
      }
      let token: string;
      try {
        token = signDownloadToken({
          userId: ctx.user.id,
          productKind: "strategy",
          productId: input.strategyId,
          orderId: "free",
        });
      } catch {
        // 签名密钥未配置：如实告知不可用，不把配置细节回给客户端。
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "下载链接暂时无法生成，请稍后重试或联系客服",
        });
      }
      return {
        delivery: "file" as const,
        downloadUrl: secureDownloadPath(token),
        expiresInMinutes: DOWNLOAD_TOKEN_TTL_MS / 60_000,
      };
    }),
});
