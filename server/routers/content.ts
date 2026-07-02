import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { adminProcedure } from "./_admin";

export const pageContentsRouter = router({
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
});

export const notificationsRouter = router({
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
});

export const siteSettingsRouter = router({
  getAll: publicProcedure.query(() => db.getSiteSettings()),
  getContact: publicProcedure.query(() => db.getContactSettings()),

  update: adminProcedure
    .input(z.object({
      key: z.string(),
      value: z.string(),
      description: z.string().optional(),
    }))
    .mutation(({ input }) => db.upsertSiteSetting(input.key, input.value, input.description)),
});

export const categoriesRouter = router({
  list: publicProcedure.query(async () => db.listCategories()),
  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => db.getCategoryBySlug(input.slug)),
  adminCreate: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(100),
      parentId: z.number().nullable().optional(),
      icon: z.string().max(50).optional(),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
      isVisible: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.createCategory({
        name: input.name,
        slug: input.slug,
        parentId: input.parentId ?? null,
        icon: input.icon ?? null,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        isVisible: input.isVisible ?? true,
      });
      return { ok: true };
    }),
  adminUpdate: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      slug: z.string().optional(),
      parentId: z.number().nullable().optional(),
      icon: z.string().optional(),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
      isVisible: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db.updateCategory(id, patch as any);
      return { ok: true };
    }),
  adminDelete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteCategory(input.id);
      return { ok: true };
    }),
});

export const siteEntriesRouter = router({
  list: publicProcedure
    .input(z.object({ enabled: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return db.listSiteEntries({ enabled: input?.enabled });
    }),
  adminList: adminProcedure.query(async () => {
    return db.listSiteEntries({ all: true });
  }),
  create: adminProcedure
    .input(z.object({
      emoji: z.string().min(1).max(16),
      label: z.string().min(1).max(50),
      href: z.string().min(1).max(500),
      sortOrder: z.number().int().default(0),
      enabled: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      return db.createSiteEntry(input);
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number().int(),
      emoji: z.string().min(1).max(16).optional(),
      label: z.string().min(1).max(50).optional(),
      href: z.string().min(1).max(500).optional(),
      sortOrder: z.number().int().optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      return db.updateSiteEntry(id, rest);
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      return db.deleteSiteEntry(input.id);
    }),
});
