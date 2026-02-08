import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
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

  strategies: router({
    list: publicProcedure
      .input(z.object({
        platform: z.enum(["MT4", "MT5"]).optional(),
        orderBy: z.enum(["latest", "popular", "return"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }))
      .query(({ input }) => db.getStrategies(input)),

    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const strategy = await db.getStrategyById(input.id);
        if (!strategy) throw new Error("Strategy not found");
        await db.incrementStrategyViewCount(input.id);
        return strategy;
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        platform: z.enum(["MT4", "MT5"]),
        pairs: z.string(),
        timeframe: z.string().optional(),
        coverImage: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        return db.createStrategy({
          userId: ctx.user.id,
          ...input,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        pairs: z.string().optional(),
        timeframe: z.string().optional(),
        coverImage: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateStrategy(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteStrategy(input.id)),

    search: publicProcedure
      .input(z.object({ keyword: z.string().min(1), limit: z.number().optional() }))
      .query(({ input }) => db.searchStrategies(input.keyword, input.limit)),

    myStrategies: protectedProcedure
      .query(({ ctx }) => db.getUserStrategies(ctx.user.id)),
  }),

  ratings: router({
    submit: protectedProcedure
      .input(z.object({
        strategyId: z.number(),
        score: z.number().min(1).max(5),
      }))
      .mutation(({ ctx, input }) => {
        return db.createOrUpdateRating({
          userId: ctx.user.id,
          strategyId: input.strategyId,
          score: input.score,
        });
      }),

    myRating: protectedProcedure
      .input(z.object({ strategyId: z.number() }))
      .query(({ ctx, input }) => db.getUserRating(ctx.user.id, input.strategyId)),

    distribution: publicProcedure
      .input(z.object({ strategyId: z.number() }))
      .query(({ input }) => db.getRatingDistribution(input.strategyId)),
  }),

  comments: router({
    list: publicProcedure
      .input(z.object({
        strategyId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(({ input }) => db.getComments(input.strategyId, input.limit, input.offset)),

    create: protectedProcedure
      .input(z.object({
        strategyId: z.number(),
        content: z.string().min(1).max(1000),
      }))
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

  follows: router({
    follow: protectedProcedure
      .input(z.object({ strategyId: z.number() }))
      .mutation(({ ctx, input }) => db.followStrategy(ctx.user.id, input.strategyId)),

    unfollow: protectedProcedure
      .input(z.object({ strategyId: z.number() }))
      .mutation(({ ctx, input }) => db.unfollowStrategy(ctx.user.id, input.strategyId)),

    isFollowing: protectedProcedure
      .input(z.object({ strategyId: z.number() }))
      .query(({ ctx, input }) => db.isFollowing(ctx.user.id, input.strategyId)),

    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(({ ctx, input }) => db.getFollowedStrategies(ctx.user.id, input.limit, input.offset)),
  }),

  favorites: router({
    favorite: protectedProcedure
      .input(z.object({ strategyId: z.number() }))
      .mutation(({ ctx, input }) => db.favoriteStrategy(ctx.user.id, input.strategyId)),

    unfavorite: protectedProcedure
      .input(z.object({ strategyId: z.number() }))
      .mutation(({ ctx, input }) => db.unfavoriteStrategy(ctx.user.id, input.strategyId)),

    isFavorited: protectedProcedure
      .input(z.object({ strategyId: z.number() }))
      .query(({ ctx, input }) => db.isFavorited(ctx.user.id, input.strategyId)),

    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(({ ctx, input }) => db.getFavoritedStrategies(ctx.user.id, input.limit, input.offset)),
  }),

  trades: router({
    list: publicProcedure
      .input(z.object({
        strategyId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(({ input }) => db.getTrades(input.strategyId, input.limit, input.offset)),

    stats: publicProcedure
      .input(z.object({ strategyId: z.number() }))
      .query(({ input }) => db.getTradeStats(input.strategyId)),

    create: protectedProcedure
      .input(z.object({
        strategyId: z.number(),
        pair: z.string(),
        direction: z.enum(["buy", "sell"]),
        openTime: z.date(),
        openPrice: z.string(),
        volume: z.string(),
        closeTime: z.date().optional(),
        closePrice: z.string().optional(),
        profit: z.string().optional(),
      }))
      .mutation(({ input }) => db.createTrade(input)),
  }),

  profile: router({
    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        avatar: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => db.updateUserProfile(ctx.user.id, input)),
  }),
});

export type AppRouter = typeof appRouter;
