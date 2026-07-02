import { z } from "zod";
import { router } from "../_core/trpc";
import * as db from "../db";
import { adminProcedure } from "./_admin";

const strategyCreateInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  platform: z.enum(["MT4", "MT5"]),
  pairs: z.string(),
  timeframe: z.string().optional(),
  coverImage: z.string().optional(),
  totalReturn: z.string().optional(),
  maxDrawdown: z.string().optional(),
  sharpeRatio: z.string().optional(),
  winRate: z.string().optional(),
  downloadUrl: z.string().optional(),
  price: z.string().optional(),
  originalPrice: z.string().optional(),
  isFree: z.boolean().optional(),
  productType: z.string().optional(),
  tags: z.string().optional(),
  galleryImages: z.string().optional(),
  isFeatured: z.boolean().optional(),
  featuredLink: z.string().optional(),
  telegramGroup: z.string().optional(),
  qqGroup: z.string().optional(),
  virtualSubscribers: z.number().optional(),
  virtualDownloads: z.number().optional(),
  saleMode: z.enum(["direct", "inquiry"]).optional(),
  richDescription: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const adminRouter = router({
  strategies: router({
    create: adminProcedure
      .input(strategyCreateInput)
      .mutation(({ input }) => db.createStrategy(input)),

    update: adminProcedure
      .input(strategyCreateInput.partial().extend({ id: z.number() }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateStrategy(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteStrategy(input.id)),

    list: adminProcedure
      .input(
        z.object({
          status: z.enum(["draft", "published", "archived"]).optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }),
      )
      .query(({ input }) => db.getAllStrategies(input)),

    detail: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const strategy = await db.getStrategyById(input.id);
        if (!strategy) throw new Error("Strategy not found");
        return strategy;
      }),
  }),

  backtestData: router({
    list: adminProcedure
      .input(z.object({ strategyId: z.number() }))
      .query(({ input }) => db.getBacktestData(input.strategyId)),
    create: adminProcedure
      .input(z.object({
        strategyId: z.number(),
        date: z.coerce.date(),
        equity: z.string(),
        balance: z.string(),
        profit: z.string(),
        drawdown: z.string(),
        tradesCount: z.number().optional(),
      }))
      .mutation(({ input }) => db.createBacktestData(input)),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteBacktestData(input.id)),
    deleteAll: adminProcedure
      .input(z.object({ strategyId: z.number() }))
      .mutation(({ input }) => db.deleteAllBacktestData(input.strategyId)),
  }),

  comments: router({
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        }),
      )
      .query(({ input }) => db.getAllComments(input.limit, input.offset)),

    create: adminProcedure
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

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteCommentByAdmin(input.id)),
  }),

  stats: router({
    overview: adminProcedure.query(() => db.getAdminStats()),
  }),
});
