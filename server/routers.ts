import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { adminAuthRouter } from "./routers/admin-auth";
import { adminRouter } from "./routers/admin";
import { authRouter } from "./routers/auth";
import { ordersRouter, paymentsRouter } from "./routers/commerce";
import {
  categoriesRouter,
  notificationsRouter,
  pageContentsRouter,
  siteEntriesRouter,
  siteSettingsRouter,
} from "./routers/content";
import { anonymousCommentsRouter, listingRequestsRouter, subscriptionsRouter } from "./routers/community";
import { featuresRouter } from "./routers/features";
import { favoritesRouter } from "./routers/favorites";
import { groupBuysRouter } from "./routers/group-buys";
import { cooperationAdminRouter, cooperationRouter, promoAdminRouter, promoRouter } from "./routers/market";
import {
  commentsRouter,
  downloadsRouter,
  purchasesRouter,
  strategiesRouter,
  tradesRouter,
} from "./routers/strategy-public";
import { v2Router } from "./routers/v2";

export const appRouter = router({
  system: systemRouter,
  adminAuth: adminAuthRouter,
  features: featuresRouter,
  auth: authRouter,
  strategies: strategiesRouter,
  comments: commentsRouter,
  trades: tradesRouter,
  purchases: purchasesRouter,
  downloads: downloadsRouter,
  favorites: favoritesRouter,
  admin: adminRouter,
  anonymousComments: anonymousCommentsRouter,
  listingRequests: listingRequestsRouter,
  groupBuys: groupBuysRouter,
  subscriptions: subscriptionsRouter,
  pageContents: pageContentsRouter,
  notifications: notificationsRouter,
  cooperationAdmin: cooperationAdminRouter,
  promoAdmin: promoAdminRouter,
  cooperation: cooperationRouter,
  promo: promoRouter,
  siteSettings: siteSettingsRouter,
  categories: categoriesRouter,
  siteEntries: siteEntriesRouter,
  orders: ordersRouter,
  payments: paymentsRouter,
  v2: v2Router,
});

export type AppRouter = typeof appRouter;
