import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { adminProcedure } from "./_admin";

export const cooperationAdminRouter = router({
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
});

export const promoAdminRouter = router({
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
});

export const cooperationRouter = router({
  cards: publicProcedure.query(() => db.getCooperationCards()),
  plans: publicProcedure.query(() => db.getCooperationPlans()),
});

export const promoRouter = router({
  list: publicProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(({ input }) => db.getPromoProducts(input.category)),
  detail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getPromoProductById(input.id)),
});
