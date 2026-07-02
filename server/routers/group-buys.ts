import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { adminProcedure } from "./_admin";

export const groupBuysRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["active", "completed", "cancelled"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
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
      }),
    )
    .mutation(({ input }) => {
      return db.createGroupBuyRequest({
        name: input.name,
        contact: input.contact,
        eaName: input.eaName,
        eaDescription: input.eaDescription || null,
      });
    }),

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
});
