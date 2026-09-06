import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { adminProcedure } from "./_admin";
import {
  confirmEmailNewsletter,
  requestEmailNewsletter,
  unsubscribeEmailNewsletter,
} from "../newsletter";
import {
  NewsletterRateLimitError,
  NewsletterUnavailableError,
  getNewsletterOutboxHealth,
} from "../newsletter-repository";
import { newsletterRequestIp } from "../_core/newsletter-security";
import { EAXAU_EMAIL_LOCALES } from "../../shared/email-subscription";

export const anonymousCommentsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        strategyId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(({ input }) =>
      db.getAnonymousComments(input.strategyId, input.limit, input.offset),
    ),

  listAll: adminProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(({ input }) =>
      db.getAllAnonymousComments(input.limit, input.offset),
    ),

  create: publicProcedure
    .input(
      z.object({
        strategyId: z.number(),
        nickname: z.string().max(100).optional(),
        content: z.string().min(1).max(1000),
      }),
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
});

export const listingRequestsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        contact: z.string().min(1).max(255),
        eaName: z.string().min(1).max(255),
        eaDescription: z.string().max(2000).optional(),
      }),
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
      }),
    )
    .query(({ input }) =>
      db.getListingRequests(input.status, input.limit, input.offset),
    ),

  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "contacted", "rejected"]),
        notes: z.string().optional(),
      }),
    )
    .mutation(({ input }) =>
      db.updateListingRequestStatus(input.id, input.status, input.notes),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteListingRequest(input.id)),
});

export const subscriptionsRouter = router({
  subscribe: publicProcedure
    .input(
      z
        .object({
          email: z.string().optional(),
          contactInfo: z.string().optional(),
        })
        .refine(
          (data) =>
            (data.email && data.email.trim()) ||
            (data.contactInfo && data.contactInfo.trim()),
          {
            message: "请至少填写一种联系方式",
          },
        ),
    )
    .mutation(({ input }) =>
      db.createEmailSubscription({
        email: input.email?.trim() || undefined,
        contactInfo: input.contactInfo?.trim() || undefined,
      }),
    ),

  list: adminProcedure
    .input(
      z.object({ limit: z.number().optional(), offset: z.number().optional() }),
    )
    .query(({ input }) => db.getEmailSubscriptions(input.limit, input.offset)),

  count: publicProcedure.query(() => db.getEmailSubscriptionCount()),

  requestEmailConfirmation: publicProcedure
    .input(
      z
        .object({
          email: z.string().trim().email().max(254),
          consentAccepted: z.literal(true),
          locale: z.enum(EAXAU_EMAIL_LOCALES),
          attribution: z
            .object({
              utmSource: z.string().trim().min(1).max(120).optional(),
              utmMedium: z.string().trim().min(1).max(120).optional(),
              utmCampaign: z.string().trim().min(1).max(160).optional(),
              utmContent: z.string().trim().min(1).max(160).optional(),
              utmTerm: z.string().trim().min(1).max(160).optional(),
              referrer: z.string().trim().url().max(300).optional(),
            })
            .strict()
            .default({}),
        })
        .strict(),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await requestEmailNewsletter({
          email: input.email,
          source: "HOME_MARKETPLACE",
          locale: input.locale,
          attribution: input.attribution,
          requestIp: newsletterRequestIp(ctx.req),
        });
      } catch (error) {
        if (error instanceof NewsletterRateLimitError) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "请求过于频繁，请稍后再试",
          });
        }
        if (error instanceof NewsletterUnavailableError) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "邮件订阅暂时不可用，请稍后再试",
          });
        }
        throw error;
      }
    }),

  confirmEmail: publicProcedure
    .input(
      z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u) }).strict(),
    )
    .mutation(({ input }) => confirmEmailNewsletter(input.token)),

  unsubscribeEmail: publicProcedure
    .input(
      z
        .object({
          token: z.string().regex(/^\d+\.\d+\.[A-Za-z0-9_-]{43}$/u),
        })
        .strict(),
    )
    .mutation(({ input }) => unsubscribeEmailNewsletter(input.token)),

  marketingOutboxHealth: adminProcedure.query(() =>
    getNewsletterOutboxHealth(),
  ),
});
