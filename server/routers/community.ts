import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { adminProcedure } from "./_admin";

export const anonymousCommentsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        strategyId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(({ input }) => db.getAnonymousComments(input.strategyId, input.limit, input.offset)),

  listAll: adminProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(({ input }) => db.getAllAnonymousComments(input.limit, input.offset)),

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
    .query(({ input }) => db.getListingRequests(input.status, input.limit, input.offset)),

  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "contacted", "rejected"]),
        notes: z.string().optional(),
      }),
    )
    .mutation(({ input }) => db.updateListingRequestStatus(input.id, input.status, input.notes)),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteListingRequest(input.id)),
});

export const subscriptionsRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().optional(),
        contactInfo: z.string().optional(),
        interestContext: z.string().max(255).optional(),
        sourcePath: z.string().max(255).optional(),
      }).refine(data => (data.email && data.email.trim()) || (data.contactInfo && data.contactInfo.trim()), {
        message: "请至少填写一种联系方式",
      }),
    )
    .mutation(({ input }) => db.createEmailSubscription({
      email: input.email?.trim() || undefined,
      contactInfo: input.contactInfo?.trim() || undefined,
      interestContext: input.interestContext?.trim() || undefined,
      sourcePath: input.sourcePath?.trim() || undefined,
    })),

  list: adminProcedure
    .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
    .query(({ input }) => db.getEmailSubscriptions(input.limit, input.offset)),

  count: publicProcedure.query(() => db.getEmailSubscriptionCount()),
});
