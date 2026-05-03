import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { generateOrderNo, getOrderExpiresAt, isOrderExpired } from "./_core/order-utils";
import { getGatewayForMethod, getPublicPaymentMethods } from "./_core/payments";
import { signDownloadToken } from "./_core/secure-download";
import { hashPassword, verifyPassword } from "./_core/password";
import { adminAuthRouter } from "./routers/admin-auth";
import { createVerificationCode, verifyCode } from "./_core/verification";
import { sendVerificationCodeEmail } from "./_core/email";
import { getPublicFeatureFlags } from "../constants/features";
import { ONE_YEAR_MS } from "../shared/const.js";
import { sdk } from "./_core/sdk";

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
      return { success: true } as const;
    }),
    // A.1: 发送邮箱验证码
    sendEmailCode: publicProcedure
      .input(z.object({
        email: z.string().email("邮箱格式不正确"),
        purpose: z.enum(["register","login","reset_password","bind_email","verify_email"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const ip = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || ctx.req.socket.remoteAddress || undefined;
        if (input.purpose === "register") {
          const existing = await db.getUserByEmail(email);
          if (existing) throw new Error("该邮箱已注册，请直接登录");
        }
        if (input.purpose === "reset_password" || input.purpose === "login") {
          const existing = await db.getUserByEmail(email);
          if (!existing) throw new Error("该邮箱未注册");
        }
        if (input.purpose === "verify_email" || input.purpose === "bind_email") {
          if (!ctx.user) throw new Error("请先登录");
        }
        const result = await createVerificationCode({ target: email, targetType: "email", purpose: input.purpose, ip });
        if (!result.ok) throw new Error(result.error || "验证码发送失败");
        const sendResult = await sendVerificationCodeEmail(email, result.code!, input.purpose);
        if (!sendResult.ok) throw new Error(`邮件发送失败：${sendResult.error || "请稍后再试"}`);
        return { ok: true, message: "验证码已发送，5 分钟内有效" };
      }),
    // A.1: 发送验证码（别名，供前端兼容）
    sendVerificationCode: publicProcedure
      .input(z.object({
        email: z.string().email(),
        purpose: z.enum(["register","login","reset_password","bind_email","verify_email"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const ip = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || ctx.req.socket.remoteAddress || undefined;
        const result = await createVerificationCode({ target: email, targetType: "email", purpose: input.purpose, ip });
        if (!result.ok) throw new Error(result.error || "验证码发送失败");
        const sendResult = await sendVerificationCodeEmail(email, result.code!, input.purpose);
        if (!sendResult.ok) throw new Error(`邮件发送失败：${sendResult.error || "请稍后再试"}`);
        return { ok: true, message: "验证码已发送" };
      }),
    // A.1: 验证邮箱
    verifyEmail: protectedProcedure
      .input(z.object({ code: z.string().min(4).max(10) }))
      .mutation(async ({ input, ctx }) => {
        const email = ctx.user.email;
        if (!email) throw new Error("当前账号未绑定邮箱");
        const result = await verifyCode({ target: email.toLowerCase(), purpose: "verify_email", code: input.code });
        if (!result.ok) throw new Error(result.error || "验证失败");
        return { ok: true, message: "邮箱验证成功！福利已解锁" };
      }),
    // A.1: 绑定手机号
    bindPhone: protectedProcedure
      .input(z.object({ phone: z.string().min(7).max(20) }))
      .mutation(async ({ input, ctx }) => {
        const phone = input.phone.trim();
        const owner = await db.getUserByPhone(phone);
        if (owner && owner.id !== ctx.user.id) throw new Error("该手机号已被其他账号使用");
        await db.updateUser(ctx.user.id, { phone });
        return { ok: true, message: "手机号已保存" };
      }),
    // A.1: 扩展 profile
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      const emailVerified = user.email ? await db.isUserEmailVerified(user.email) : false;
      const isFullMember = emailVerified;
      return {
        id: user.id, openId: user.openId, name: user.name, email: user.email,
        phone: user.phone || null, avatar: user.avatar, bio: user.bio, role: user.role,
        lastSignedIn: user.lastSignedIn, emailVerified, phoneVerified: user.phoneVerified || false,
        isFullMember,
        recommendations: { verifyEmail: !emailVerified && !!user.email, bindPhone: !user.phone },
      };
    }),
    // A.1: 邮箱+验证码注册
    registerWithCode: publicProcedure
      .input(z.object({ email: z.string().email(), code: z.string().min(4).max(10), name: z.string().min(1).max(50) }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const verifyResult = await verifyCode({ target: email, purpose: "register", code: input.code });
        if (!verifyResult.ok) throw new Error(verifyResult.error || "验证码错误");
        const existing = await db.getUserByEmail(email);
        if (existing) throw new Error("该邮箱已注册");
        const user = await db.createUser({ email, name: input.name, loginMethod: "email" });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || email, expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { ok: true, sessionToken, user: { id: user.id, email, name: user.name } };
      }),
    // A.1: 验证码登录
    loginWithCode: publicProcedure
      .input(z.object({ email: z.string().email(), code: z.string().min(4).max(10) }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const verifyResult = await verifyCode({ target: email, purpose: "login", code: input.code });
        if (!verifyResult.ok) throw new Error(verifyResult.error || "验证码错误");
        const user = await db.getUserByEmail(email);
        if (!user) throw new Error("该邮箱未注册");
        await db.updateUser(user.id, { lastSignedIn: new Date() });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || email, expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { ok: true, sessionToken, user };
      }),
    // A.1: 重置密码
    resetPassword: publicProcedure
      .input(z.object({ email: z.string().email(), code: z.string().min(4).max(10), newPassword: z.string().min(6).max(100) }))
      .mutation(async ({ input }) => {
        const email = input.email.trim().toLowerCase();
        const verifyResult = await verifyCode({ target: email, purpose: "reset_password", code: input.code });
        if (!verifyResult.ok) throw new Error(verifyResult.error || "验证码错误");
        const user = await db.getUserByEmail(email);
        if (!user) throw new Error("该邮箱未注册");
        await db.updateUser(user.id, { passwordHash: hashPassword(input.newPassword) });
        return { ok: true, message: "密码已重置，请重新登录" };
      }),
  }),

  // 策略相关
  strategies: router({
    list: publicProcedure
      .input(
        z.object({
          platform: z.enum(["MT4", "MT5"]).optional(),
          orderBy: z.enum(["latest", "popular", "return", "hot"]).optional(),
          tag: z.string().optional(),
          productType: z.string().optional(),
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

      create: adminProcedure
        .input(
          z.object({
            strategyId: z.number(),
            content: z.string().min(1).max(1000),
          })
        )
        .mutation(async ({ ctx, input }) => {
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
        coverImage: z.string().optional(),
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
        coverImage: z.string().optional(),
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

  // 订阅/联系方式收集
  subscriptions: router({
    subscribe: publicProcedure
      .input(
        z.object({
          email: z.string().optional(),
          contactInfo: z.string().optional(),
        }).refine(data => (data.email && data.email.trim()) || (data.contactInfo && data.contactInfo.trim()), {
          message: "请至少填写一种联系方式",
        })
      )
      .mutation(({ input }) => db.createEmailSubscription({
        email: input.email?.trim() || undefined,
        contactInfo: input.contactInfo?.trim() || undefined,
      })),

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

  // 合作方案管理（Admin）
  cooperationAdmin: router({
    // 合作卡片管理
    cards: router({
      list: adminProcedure.query(() => db.getAllCooperationCards()),
      create: adminProcedure
        .input(z.object({
          title: z.string().min(1),
          subtitle: z.string().optional(),
          description: z.string().optional(),
          coverImage: z.string().optional(),
          galleryImages: z.string().optional(),
          badge: z.string().optional(),
          badgeColor: z.string().optional(),
          strategyType: z.string().optional(),
          platform: z.string().optional(),
          observeNote: z.string().optional(),
          contactInfo: z.string().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => db.createCooperationCard(input)),
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          title: z.string().optional(),
          subtitle: z.string().optional(),
          description: z.string().optional(),
          coverImage: z.string().optional(),
          galleryImages: z.string().optional(),
          badge: z.string().optional(),
          badgeColor: z.string().optional(),
          strategyType: z.string().optional(),
          platform: z.string().optional(),
          observeNote: z.string().optional(),
          contactInfo: z.string().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return db.updateCooperationCard(id, data);
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => db.deleteCooperationCard(input.id)),
    }),
    // 合作模式管理
    plans: router({
      list: adminProcedure.query(() => db.getAllCooperationPlans()),
      create: adminProcedure
        .input(z.object({
          title: z.string().min(1),
          badge: z.string().optional(),
          price: z.string().optional(),
          priceNote: z.string().optional(),
          features: z.string().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => db.createCooperationPlan(input)),
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          title: z.string().optional(),
          badge: z.string().optional(),
          price: z.string().optional(),
          priceNote: z.string().optional(),
          features: z.string().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return db.updateCooperationPlan(id, data);
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => db.deleteCooperationPlan(input.id)),
    }),
  }),

  // 促销商品管理（Admin）
  promoAdmin: router({
    list: adminProcedure.query(() => db.getAllPromoProducts()),
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        coverImage: z.string().optional(),
        galleryImages: z.string().optional(),
        platform: z.string().optional(),
        category: z.string().optional(),
        originalPrice: z.string(),
        promoPrice: z.string(),
        promoLabel: z.string().optional(),
        promoEndTime: z.string().optional(),
        detailContent: z.string().optional(),
        paymentInfo: z.string().optional(),
        contactInfo: z.string().optional(),
        stock: z.number().optional(),
        sortOrder: z.number().optional(),
        isVisible: z.boolean().optional(),
        status: z.enum(["active", "expired", "soldout"]).optional(),
      }))
      .mutation(({ input }) => db.createPromoProduct(input)),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        coverImage: z.string().optional(),
        galleryImages: z.string().optional(),
        platform: z.string().optional(),
        category: z.string().optional(),
        originalPrice: z.string().optional(),
        promoPrice: z.string().optional(),
        promoLabel: z.string().optional(),
        promoEndTime: z.string().optional(),
        detailContent: z.string().optional(),
        paymentInfo: z.string().optional(),
        contactInfo: z.string().optional(),
        stock: z.number().optional(),
        soldCount: z.number().optional(),
        sortOrder: z.number().optional(),
        isVisible: z.boolean().optional(),
        status: z.enum(["active", "expired", "soldout"]).optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updatePromoProduct(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deletePromoProduct(input.id)),
  }),

  // 合作方案页
  cooperation: router({
    cards: publicProcedure.query(() => db.getCooperationCards()),
    plans: publicProcedure.query(() => db.getCooperationPlans()),
  }),

  // 促销商城
  promo: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional() }))
      .query(({ input }) => db.getPromoProducts(input.category)),
    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getPromoProductById(input.id)),
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

  // ─── Bundle A.2: 分类 ───
  categories: router({
    list: publicProcedure.query(async () => db.listCategories()),
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => db.getCategoryBySlug(input.slug)),
    adminCreate: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100),
        parentId: z.number().nullable().optional(),
        icon: z.string().max(50).optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        isVisible: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new Error('Admin only');
        await db.createCategory({ name: input.name, slug: input.slug, parentId: input.parentId ?? null, icon: input.icon ?? null, description: input.description ?? null, sortOrder: input.sortOrder ?? 0, isVisible: input.isVisible ?? true });
        return { ok: true };
      }),
    adminUpdate: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), slug: z.string().optional(), parentId: z.number().nullable().optional(), icon: z.string().optional(), description: z.string().optional(), sortOrder: z.number().optional(), isVisible: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new Error('Admin only');
        const { id, ...patch } = input;
        await db.updateCategory(id, patch as any);
        return { ok: true };
      }),
    adminDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new Error('Admin only');
        await db.deleteCategory(input.id);
        return { ok: true };
      }),
  }),
  // ─── Bundle A.3: 订单 ───
  orders: router({
    create: protectedProcedure
      .input(z.object({ productKind: z.enum(['strategy', 'promo']), productId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        let product: any = null;
        let productTitle = '';
        let productCover: string | null = null;
        let amount = '0.00';
        let originalAmount: string | null = null;
        if (input.productKind === 'strategy') {
          product = await db.getStrategyById(input.productId);
          if (product.saleMode !== 'direct') throw new Error('此商品仅支持商务咨询授权，无法下单');
          if (product.isFree) throw new Error('免费商品无需下单，可直接下载');
          productTitle = product.title;
          productCover = product.coverImage;
          amount = String(product.price || '0.00');
          originalAmount = product.originalPrice ? String(product.originalPrice) : null;
        } else {
          product = await db.getPromoProductById(input.productId);
          productTitle = product.title;
          productCover = product.coverImage;
          amount = String(product.promoPrice);
          originalAmount = String(product.originalPrice);
        }
        if (parseFloat(amount) <= 0) throw new Error('商品金额异常');
        const existing = await db.getUserOrders(ctx.user.id, { status: 'pending', limit: 5 });
        if (dup) return { ok: true, orderNo: dup.orderNo, isExisting: true };
        const orderNo = generateOrderNo();
        await db.createOrder({ orderNo, userId: ctx.user.id, productKind: input.productKind, productId: input.productId, productTitle, productCover, amount, originalAmount, status: 'pending', expiresAt: getOrderExpiresAt(30) });
        return { ok: true, orderNo, isExisting: false };
      }),
    detail: protectedProcedure
      .input(z.object({ orderNo: z.string() }))
      .query(async ({ ctx, input }) => {
        const order = await db.getOrderByOrderNo(input.orderNo);
        if (order.userId !== ctx.user.id && ctx.user.role !== 'admin') throw new Error('无权访问此订单');
        if (order.status === 'pending' && isOrderExpired(order.expiresAt)) {
          await db.cancelOrder(order.id);
          (order as any).status = 'expired';
        }
        const paymentsList = await db.getPaymentsByOrderId(order.id);
        let downloadUrl: string | null = null;
        if (order.status === 'paid' && order.productKind === 'strategy') {
          const product = await db.getStrategyById(order.productId);
          downloadUrl = product?.downloadUrl || null;
        }
        return { ...order, payments: paymentsList, downloadUrl };
      }),
    myList: protectedProcedure
      .input(z.object({ status: z.enum(['pending', 'paid', 'cancelled', 'refunded', 'expired']).optional(), limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => db.getUserOrders(ctx.user.id, { status: input?.status, limit: input?.limit || 50 })),
    cancel: protectedProcedure
      .input(z.object({ orderNo: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderByOrderNo(input.orderNo);
        if (order.userId !== ctx.user.id) throw new Error('无权操作');
        if (order.status !== 'pending') throw new Error('当前状态无法取消');
        await db.cancelOrder(order.id);
        return { ok: true };
      }),
    adminList: protectedProcedure
      .input(z.object({ status: z.enum(['pending', 'paid', 'cancelled', 'refunded', 'expired']).optional(), limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new Error('Admin only');
        return db.listAllOrders({ status: input?.status, limit: input?.limit });
      }),
    adminConfirmUsdt: protectedProcedure
      .input(z.object({ orderNo: z.string(), gatewayOrderNo: z.string().optional(), note: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new Error('Admin only');
        const order = await db.getOrderByOrderNo(input.orderNo);
        if (order.status === 'paid') return { ok: true, message: '订单已支付' };
        const allPayments = await db.getPaymentsByOrderId(order.id);
        const usdtPayment = allPayments.find((p: any) => p.gateway === 'usdt-manual' && p.method === 'usdt');
        if (usdtPayment) {
          await db.updatePayment(usdtPayment.id, { status: 'success', gatewayOrderNo: input.gatewayOrderNo || null, callbackRaw: JSON.stringify({ type: 'admin_confirm', adminId: ctx.user.id, txHash: input.gatewayOrderNo, confirmedAt: new Date().toISOString() }), callbackVerified: true, paidAt: new Date() });
        } else {
          await db.createPayment({ orderId: order.id, orderNo: order.orderNo, gateway: 'usdt-manual', method: 'usdt', gatewayOrderNo: input.gatewayOrderNo || null, amount: order.amount, currency: order.currency, status: 'success', callbackRaw: JSON.stringify({ type: 'admin_confirm_no_intent', adminId: ctx.user.id }), callbackVerified: true, paidAt: new Date() });
        }
        await db.markOrderPaid(order.id, { paymentMethod: 'usdt', paymentGateway: 'usdt-manual' });
        return { ok: true };
      }),
    adminPendingUsdt: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin only');
      return db.listPendingUsdtPayments();
    }),
  }),
  // ─── Bundle A.3: 支付 ───
  payments: router({
    listMethods: publicProcedure.query(() => getPublicPaymentMethods()),
    initiate: protectedProcedure
      .input(z.object({ orderNo: z.string(), method: z.enum(['alipay', 'wxpay', 'usdt']) }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderByOrderNo(input.orderNo);
        if (order.userId !== ctx.user.id) throw new Error('无权访问此订单');
        if (order.status === 'paid') throw new Error('订单已支付');
        if (order.status === 'cancelled' || order.status === 'expired') throw new Error('订单已失效');
        if (isOrderExpired(order.expiresAt)) { await db.cancelOrder(order.id); throw new Error('订单已过期，请重新下单'); }
        const gateway = getGatewayForMethod(input.method);
        const returnUrl = (process.env.ZPAY_RETURN_URL || '') + '?orderNo=' + encodeURIComponent(order.orderNo);
        const result = await gateway.initiate({ order, method: input.method, returnUrl });
        const existing = await db.getActivePaymentByOrderId(order.id);
        if (existing && existing.status === 'pending') {
          await db.updatePayment(existing.id, { gateway: gateway.name, method: input.method, gatewayOrderNo: result.gatewayOrderNo || null });
        } else {
          await db.createPayment({ orderId: order.id, orderNo: order.orderNo, gateway: gateway.name, method: input.method, gatewayOrderNo: result.gatewayOrderNo || null, amount: order.amount, currency: order.currency, status: 'pending' });
        }
        return result;
      }),
    markUsdtSubmitted: protectedProcedure
      .input(z.object({ orderNo: z.string(), txHashOrNote: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderByOrderNo(input.orderNo);
        if (order.userId !== ctx.user.id) throw new Error('无权操作');
        const allPayments = await db.getPaymentsByOrderId(order.id);
        const usdtPayment = allPayments.find((p: any) => p.gateway === 'usdt-manual' && p.status === 'pending');
        await db.updatePayment(usdtPayment.id, { callbackRaw: JSON.stringify({ type: 'user_submitted', submittedAt: new Date().toISOString(), userNote: input.txHashOrNote || null }) });
        return { ok: true, message: '已通知客服，30 分钟内确认。' };
      }),
  }),
  // ─── Bundle B: 下载 ───
  downloads: router({
    getSignedUrl: protectedProcedure
      .input(z.object({ productKind: z.enum(['strategy']), productId: z.number() }))
      .query(async ({ ctx, input }) => {
        const purchased = await db.hasUserPurchased(ctx.user.id, input.productId);
        const strategy = await db.getStrategyById(input.productId);
        const token = signDownloadToken({ userId: ctx.user.id, productKind: input.productKind, productId: input.productId });
        return { url: '/api/download/secure?token=' + encodeURIComponent(token), expiresIn: 30 * 60 };
      }),
    list: protectedProcedure.query(async ({ ctx }) => db.getUserDownloads(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
