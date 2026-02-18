import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { adminAuthRouter } from "./routers/admin-auth";

// 管理员权限中间件
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return next();
});

export const appRouter = router({
  system: systemRouter,
  adminAuth: adminAuthRouter,
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
          orderBy: z.enum(["latest", "popular", "return", "hot"]).optional(),
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
            virtualSubscribers: z.number().optional(),
            virtualDownloads: z.number().optional(),
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
            virtualSubscribers: z.number().optional(),
            virtualDownloads: z.number().optional(),
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

      detail: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          // 管理后台专用接口，不增加浏览量
          const strategy = await db.getStrategyById(input.id);
          if (!strategy) throw new Error("Strategy not found");
          return strategy;
        }),
    }),

    // 回测数据管理
    backtestData: router({
      list: adminProcedure
        .input(z.object({ strategyId: z.number() }))
        .query(({ input }) => db.getBacktestData(input.strategyId)),
      create: adminProcedure
        .input(z.object({
          strategyId: z.number(),
          date: z.string(),
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

    listAll: adminProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => db.getAllAnonymousComments(input.limit, input.offset)),

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

    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.approveAnonymousComment(input.id)),

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

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteListingRequest(input.id)),
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

    // Admin管理
    adminList: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(({ input }) => db.getAllGroupBuys(input.limit, input.offset)),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        eaName: z.string().min(1),
        description: z.string().optional(),
        targetPrice: z.string(),
        targetParticipants: z.number().min(1),
        pricePerPerson: z.string(),
        contactInfo: z.string().min(1),
        status: z.enum(["active", "completed", "cancelled"]).optional(),
      }))
      .mutation(({ input }) => db.createGroupBuy(input as any)),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        eaName: z.string().optional(),
        description: z.string().optional(),
        targetPrice: z.string().optional(),
        currentParticipants: z.number().optional(),
        targetParticipants: z.number().optional(),
        pricePerPerson: z.string().optional(),
        contactInfo: z.string().optional(),
        status: z.enum(["active", "completed", "cancelled"]).optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateGroupBuy(id, data as any);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteGroupBuy(input.id)),
  }),

  // 邮箱订阅
  subscriptions: router({
    subscribe: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(({ input }) => db.createEmailSubscription(input.email)),

    list: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(({ input }) => db.getEmailSubscriptions(input.limit, input.offset)),

    count: publicProcedure.query(() => db.getEmailSubscriptionCount()),
  }),

  // 页面内容
  pageContents: router({
    get: publicProcedure
      .input(z.object({ pageKey: z.string() }))
      .query(({ input }) => db.getPageContents(input.pageKey)),

    getAll: adminProcedure
      .input(z.object({ pageKey: z.string().optional() }))
      .query(({ input }) => db.getAllPageContents(input.pageKey)),

    create: adminProcedure
      .input(z.object({
        pageKey: z.string(),
        sectionKey: z.string(),
        title: z.string(),
        content: z.string(),
        icon: z.string().optional(),
        sortOrder: z.number().optional(),
        isVisible: z.boolean().optional(),
      }))
      .mutation(({ input }) => db.createPageContent(input)),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        icon: z.string().optional(),
        sortOrder: z.number().optional(),
        isVisible: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updatePageContent(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deletePageContent(input.id)),
  }),

  // 通知/公告
  notifications: router({
    active: publicProcedure.query(() => db.getActiveNotifications()),

    list: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(({ input }) => db.getAllNotifications(input.limit, input.offset)),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        type: z.string().optional(),
        icon: z.string().optional(),
        link: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(({ input }) => db.createNotification(input)),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        type: z.string().optional(),
        icon: z.string().optional(),
        link: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateNotification(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteNotification(input.id)),
  }),

  // 站点设置（联系方式等）
  siteSettings: router({
    getAll: publicProcedure.query(() => db.getSiteSettings()),
    getContact: publicProcedure.query(() => db.getContactSettings()),

    update: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
        description: z.string().optional(),
      }))
      .mutation(({ input }) => db.upsertSiteSetting(input.key, input.value, input.description)),
  }),
});

export type AppRouter = typeof appRouter;
