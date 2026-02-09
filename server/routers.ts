import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

// 管理员权限中间件
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 策略相关
  strategies: router({
    list: publicProcedure
      .input(
        z.object({
          platform: z.enum(["MT4", "MT5"]).optional(),
          orderBy: z.enum(["latest", "popular", "return"]).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
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
  }),

  // 评论相关(策略备注)
  comments: router({
    list: publicProcedure
      .input(
        z.object({
          strategyId: z.number(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => db.getComments(input.strategyId, input.limit, input.offset)),

    create: protectedProcedure
      .input(
        z.object({
          strategyId: z.number(),
          content: z.string().min(1).max(1000),
        })
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
  }),

  // 交易记录
  trades: router({
    list: publicProcedure
      .input(
        z.object({
          strategyId: z.number(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => db.getTrades(input.strategyId, input.limit, input.offset)),

    stats: publicProcedure.input(z.object({ strategyId: z.number() })).query(({ input }) => db.getTradeStats(input.strategyId)),
  }),

  // 购买相关
  purchases: router({
    create: protectedProcedure
      .input(
        z.object({
          strategyId: z.number(),
          price: z.string(),
        })
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
  }),

  // 下载相关
  downloads: router({
    create: protectedProcedure
      .input(z.object({ strategyId: z.number() }))
      .mutation(({ ctx, input }) => {
        return db.createDownload({
          userId: ctx.user.id,
          strategyId: input.strategyId,
        });
      }),

    list: protectedProcedure.query(({ ctx }) => db.getUserDownloads(ctx.user.id)),
  }),

  // 管理员API
  admin: router({
    // 策略管理
    strategies: router({
      create: adminProcedure
        .input(
          z.object({
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
            isFree: z.boolean().optional(),
            telegramGroup: z.string().optional(),
            qqGroup: z.string().optional(),
            status: z.enum(["draft", "published", "archived"]).optional(),
          })
        )
        .mutation(({ input }) => db.createStrategy(input)),

      update: adminProcedure
        .input(
          z.object({
            id: z.number(),
            title: z.string().min(1).optional(),
            description: z.string().optional(),
            platform: z.enum(["MT4", "MT5"]).optional(),
            pairs: z.string().optional(),
            timeframe: z.string().optional(),
            coverImage: z.string().optional(),
            totalReturn: z.string().optional(),
            maxDrawdown: z.string().optional(),
            sharpeRatio: z.string().optional(),
            winRate: z.string().optional(),
            downloadUrl: z.string().optional(),
            price: z.string().optional(),
            isFree: z.boolean().optional(),
            telegramGroup: z.string().optional(),
            qqGroup: z.string().optional(),
            status: z.enum(["draft", "published", "archived"]).optional(),
          })
        )
        .mutation(({ input }) => db.updateStrategy(input.id, input)),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => db.deleteStrategy(input.id)),

      list: adminProcedure
        .input(
          z.object({
            status: z.enum(["draft", "published", "archived"]).optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
          })
        )
        .query(({ input }) => db.getAllStrategies(input)),
    }),

    // 评论管理
    comments: router({
      list: adminProcedure
        .input(
          z.object({
            limit: z.number().optional(),
            offset: z.number().optional(),
          })
        )
        .query(({ input }) => db.getAllComments(input.limit, input.offset)),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => db.deleteCommentByAdmin(input.id)),
    }),

    // 数据统计
    stats: router({
      overview: adminProcedure.query(() => db.getAdminStats()),
    }),
  }),

  // 匿名留言相关
  anonymousComments: router({
    list: publicProcedure
      .input(
        z.object({
          strategyId: z.number(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => db.getAnonymousComments(input.strategyId, input.limit, input.offset)),

    create: publicProcedure
      .input(
        z.object({
          strategyId: z.number(),
          nickname: z.string().max(100).optional(),
          content: z.string().min(1).max(1000),
        })
      )
      .mutation(({ input }) => {
        return db.createAnonymousComment({
          strategyId: input.strategyId,
          nickname: input.nickname || null,
          content: input.content,
        });
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteAnonymousComment(input.id)),
  }),

  // 上架EA申请相关
  listingRequests: router({
    create: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          contact: z.string().min(1).max(255),
          eaName: z.string().min(1).max(255),
          eaDescription: z.string().max(2000).optional(),
        })
      )
      .mutation(({ input }) => {
        return db.createListingRequest({
          name: input.name,
          contact: input.contact,
          eaName: input.eaName,
          eaDescription: input.eaDescription || null,
        });
      }),

    list: adminProcedure
      .input(
        z.object({
          status: z.enum(["pending", "contacted", "rejected"]).optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => db.getListingRequests(input.status, input.limit, input.offset)),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "contacted", "rejected"]),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.updateListingRequestStatus(input.id, input.status, input.notes)),
  }),

  // 合购相关
  groupBuys: router({
    list: publicProcedure
      .input(
        z.object({
          status: z.enum(["active", "completed", "cancelled"]).optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => db.getGroupBuys(input.status, input.limit, input.offset)),

    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getGroupBuyDetail(input.id)),

    requestGroupBuy: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          contact: z.string().min(1).max(255),
          eaName: z.string().min(1).max(255),
          eaDescription: z.string().max(2000).optional(),
        })
      )
      .mutation(({ input }) => {
        return db.createGroupBuyRequest({
          name: input.name,
          contact: input.contact,
          eaName: input.eaName,
          eaDescription: input.eaDescription || null,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
