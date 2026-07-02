import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

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
    .query(({ input }) => db.getStrategies(input)),

  detail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const strategy = await db.getStrategyById(input.id);
      if (!strategy) throw new Error("Strategy not found");
      await db.incrementStrategyViewCount(input.id);
      return strategy;
    }),

  backtestData: publicProcedure
    .input(z.object({ strategyId: z.number() }))
    .query(({ input }) => db.getBacktestData(input.strategyId)),

  search: publicProcedure
    .input(z.object({ keyword: z.string().min(1), limit: z.number().optional() }))
    .query(({ input }) => db.searchStrategies(input.keyword, input.limit)),
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
  create: protectedProcedure
    .input(
      z.object({
        strategyId: z.number(),
        price: z.string(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return db.createPurchase({
        userId: ctx.user.id,
        strategyId: input.strategyId,
        price: input.price,
      });
    }),

  list: protectedProcedure.query(({ ctx }) => db.getUserPurchases(ctx.user.id)),

  hasPurchased: protectedProcedure
    .input(z.object({ strategyId: z.number() }))
    .query(({ ctx, input }) => db.hasPurchased(ctx.user.id, input.strategyId)),
});

export const downloadsRouter = router({
  create: protectedProcedure
    .input(z.object({ strategyId: z.number() }))
    .mutation(({ ctx, input }) => {
      return db.createDownload({
        userId: ctx.user.id,
        strategyId: input.strategyId,
      });
    }),

  list: protectedProcedure.query(({ ctx }) => db.getUserDownloads(ctx.user.id)),
});
