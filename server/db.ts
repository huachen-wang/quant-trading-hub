import { eq, and, desc, asc, sql, or, like, isNull, isNotNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import type { VerificationPurpose, VerificationTargetType } from "./_core/verification";
import type {
  ManagedSessionDraftInput,
  ManagedSessionStatus,
} from "../shared/managed-sessions/contracts";
import {
  createMockManagedSessionDraft,
  getMockManagedSessionByNo,
  listMockManagedSessions,
  replaceMockManagedSessionDraft,
  transitionMockManagedSession,
  updateMockManagedExecutionSlot,
  appendMockBrokerFundingAuditEvent,
  assignMockCollectionAddress,
  createMockBrokerFundingIntent,
  createMockCollectionAddress,
  findMockBrokerFundingByTxHash,
  getMockBrokerFundingIntent,
  getMockCollectionApproval,
  listMockBrokerFundingIntents,
  listMockCollectionAddresses,
  listMockCollectionApprovals,
  markMockCollectionAddressUsed,
  transitionMockBrokerFundingIntent,
  upsertMockCollectionApproval,
} from "./managed-sessions/mock-store";
import type { ManagedTransitionPatch } from "./managed-sessions/state-machine";
import {
  createMockComment,
  createMockAnonymousComment,
  createMockOrder,
  createMockPayment,
  createMockSiteEntry,
  createMockStrategy,
  cancelMockOrder,
  deleteMockSiteEntry,
  deleteMockStrategy,
  expireMockStaleOrders,
  getMockActivePaymentByOrderId,
  getMockAdminStats,
  getMockAllComments,
  getMockAllAnonymousComments,
  getMockAllStrategies,
  getMockAnonymousComments,
  getMockBacktestData,
  getMockCategories,
  getMockCategoryById,
  getMockCategoryBySlug,
  getMockComments,
  getMockContactSettings,
  getMockCooperationCards,
  getMockCooperationPlans,
  getMockGroupBuyById,
  getMockGroupBuys,
  getMockOrderById,
  getMockOrderByOrderNo,
  getMockPaymentById,
  getMockPaymentByGatewayOrderNo,
  getMockPaymentsByOrderId,
  getMockPromoProducts,
  getMockSiteSetting,
  getMockSiteSettings,
  getMockStrategies,
  getMockStrategyById,
  getMockUserOrders,
  listMockAllOrders,
  listMockPendingUsdtPayments,
  listMockSiteEntries,
  markMockOrderPaid,
  markMockOrderRefunded,
  searchMockStrategies,
  updateMockSiteEntry,
  updateMockPayment,
  updateMockStrategy,
  createMockCommerceUsdtEvent,
  listMockCommerceUsdtEvents,
  listMockUsdtPayments,
  reserveMockChainTransaction,
  releaseMockChainTransaction,
} from "./mock-data";

const { users, strategies, trades, comments, purchases, downloads, anonymousComments, listingRequests, groupBuys, notifications, siteSettings, backtestData: backtestDataTable, cooperationCards, cooperationPlans, promoProducts, verificationCodes, userFavorites, categories, orders, payments, commerceUsdtEvents, chainTxRegistry, adminTotpUses, managedSessions, managedSessionStrategies, managedExecutionSlots, managedSessionEvents, managedBrokerFundingIntents, managedBrokerFundingEvents, managedCollectionAddresses, managedBrokerCollectionApprovals } = schema;

let pool: mysql.Pool | null = null;
let db: any = null;
const mockAdminTotpUses = new Set<string>();

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL!,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

export function getDatabasePool() {
  return process.env.DATABASE_URL ? getPool() : null;
}

async function getDb() {
  try {
    if (!process.env.DATABASE_URL) {
      return null;
    }
    if (!db) {
      const p = getPool();
      db = drizzle(p, { schema, mode: "default" });
    }
    return db;
  } catch (error) {
    console.error("[DB] Failed to get database connection:", error);
    // Reset on error to force reconnection
    db = null;
    pool = null;
    return null;
  }
}

// ========== 用户相关 ==========

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] || null;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

export async function createUser(data: typeof users.$inferInsert) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(users).values(data);
  return result;
}

export async function updateUser(id: number, data: Partial<typeof users.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;

  await db.update(users).set(data).where(eq(users.id, id));
  return getUserById(id);
}

export async function upsertUser(data: Partial<typeof users.$inferInsert> & { openId: string }) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    await db.update(users).set(data).where(eq(users.openId, data.openId));
    return getUserByOpenId(data.openId);
  } else {
    await db.insert(users).values(data as any);
    return getUserByOpenId(data.openId);
  }
}

// ========== 策略相关 ==========

export async function getStrategies(params: {
  platform?: "MT4" | "MT5";
  orderBy?: "latest" | "popular" | "return" | "hot";
  tag?: string;
  productType?: string;
  saleMode?: "direct" | "inquiry";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return getMockStrategies(params);

  try {
    // 尝试使用新字段查询（含标签筛选、产品类型筛选、旗舰置顶）
    const conditions: any[] = [eq(strategies.status, "published")];
    if (params.platform) conditions.push(eq(strategies.platform, params.platform));
    if (params.tag) {
      // 精确匹配标签：使用 FIND_IN_SET 避免部分匹配（如"黄金"匹配"超级黄金"）
      conditions.push(sql`FIND_IN_SET(${params.tag}, REPLACE(${strategies.tags}, ' ', '')) > 0`);
    }
    if (params.productType) conditions.push(eq(strategies.productType, params.productType));
    if (params.saleMode) conditions.push(eq(strategies.saleMode, params.saleMode));

    const whereConditions = and(...conditions);

    const orderByColumn =
      params.orderBy === "popular"
        ? desc(strategies.downloadCount)
        : params.orderBy === "return"
          ? desc(strategies.totalReturn)
          : params.orderBy === "hot"
            ? desc(sql`${strategies.viewCount} + ${strategies.virtualSubscribers} * 10`)
            : desc(strategies.createdAt);

    const query = db
      .select()
      .from(strategies)
      .where(whereConditions)
      .orderBy(desc(strategies.isFeatured), desc(strategies.isCurated), orderByColumn)
      .limit(params.limit || 20)
      .offset(params.offset || 0);

    return await query;
  } catch (error: any) {
    // 如果新字段不存在（迁移尚未执行），回退到基础查询
    console.warn("[getStrategies] New columns not available, falling back to basic query:", error?.message);
    const conditions: any[] = [eq(strategies.status, "published")];
    if (params.platform) conditions.push(eq(strategies.platform, params.platform));
    const whereConditions = and(...conditions);

    const orderByColumn =
      params.orderBy === "popular"
        ? desc(strategies.downloadCount)
        : params.orderBy === "return"
          ? desc(strategies.totalReturn)
          : params.orderBy === "hot"
            ? desc(strategies.viewCount)
            : desc(strategies.createdAt);

    const rows = await db
      .select({
        id: strategies.id,
        title: strategies.title,
        description: strategies.description,
        platform: strategies.platform,
        pairs: strategies.pairs,
        timeframe: strategies.timeframe,
        coverImage: strategies.coverImage,
        totalReturn: strategies.totalReturn,
        maxDrawdown: strategies.maxDrawdown,
        sharpeRatio: strategies.sharpeRatio,
        winRate: strategies.winRate,
        downloadUrl: strategies.downloadUrl,
        price: strategies.price,
        isFree: strategies.isFree,
        downloadCount: strategies.downloadCount,
        telegramGroup: strategies.telegramGroup,
        qqGroup: strategies.qqGroup,
        viewCount: strategies.viewCount,
        status: strategies.status,
        createdAt: strategies.createdAt,
        updatedAt: strategies.updatedAt,
      })
      .from(strategies)
      .where(whereConditions)
      .orderBy(orderByColumn)
      .limit(params.limit || 20)
      .offset(params.offset || 0);

    return rows.map((row: any) => ({
      ...row,
      originalPrice: null,
      productType: "ea",
      tags: null,
      saleMode: row.isFree ? "direct" : "inquiry",
      richDescription: null,
      galleryImages: null,
      isFeatured: false,
      isCurated: false,
      featuredLink: null,
      dataStatus: "estimated",
      sourceName: null,
      sourceUrl: null,
      evidenceUrl: null,
      virtualSubscribers: 0,
      virtualDownloads: 0,
    }));
  }
}

export async function getStrategyById(id: number) {
  const db = await getDb();
  if (!db) return getMockStrategyById(id);

  const result = await db.select().from(strategies).where(eq(strategies.id, id)).limit(1);
  return result[0] || null;
}

export async function incrementStrategyViewCount(id: number) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(strategies)
    .set({ viewCount: sql`${strategies.viewCount} + 1` })
    .where(eq(strategies.id, id));
}

export async function searchStrategies(keyword: string, limit?: number) {
  const db = await getDb();
  if (!db) return searchMockStrategies(keyword, limit);

  return db
    .select()
    .from(strategies)
    .where(
      and(
        eq(strategies.status, "published"),
        or(like(strategies.title, `%${keyword}%`), like(strategies.description, `%${keyword}%`))
      )
    )
    .limit(limit || 20);
}

// ========== 评论相关(作为策略备注) ==========

export async function getComments(strategyId: number, limit?: number, offset?: number) {
  const db = await getDb();
  if (!db) return getMockComments(strategyId, limit, offset);

  return db
    .select({
      id: comments.id,
      userId: comments.userId,
      content: comments.content,
      createdAt: comments.createdAt,
      user: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.strategyId, strategyId))
    .orderBy(desc(comments.createdAt))
    .limit(limit || 20)
    .offset(offset || 0);
}

export async function createComment(data: { userId: number; strategyId: number; content: string }) {
  const db = await getDb();
  if (!db) return createMockComment(data);

  const result = await db.insert(comments).values(data);
  return result;
}

export async function deleteComment(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  await db.delete(comments).where(and(eq(comments.id, id), eq(comments.userId, userId)));
  return true;
}

// ========== 交易记录相关 ==========

export async function getTrades(strategyId: number, limit?: number, offset?: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(trades)
    .where(eq(trades.strategyId, strategyId))
    .orderBy(desc(trades.openTime))
    .limit(limit || 50)
    .offset(offset || 0);
}

export async function getTradeStats(strategyId: number) {
  const db = await getDb();
  if (!db) return null;

  const allTrades = await db.select().from(trades).where(eq(trades.strategyId, strategyId));

  const closedTrades = allTrades.filter((t: any) => t.status === "closed");
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter((t: any) => parseFloat(t.profit || "0") > 0).length;
  const totalProfit = closedTrades.reduce((sum: number, t: any) => sum + parseFloat(t.profit || "0"), 0);

  return {
    totalTrades,
    winningTrades,
    losingTrades: totalTrades - winningTrades,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    totalProfit,
  };
}

// ========== 购买记录相关 ==========

export async function createPurchase(data: { userId: number; strategyId: number; price: string }) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(purchases).values(data);
  return result;
}

export async function getUserPurchases(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: purchases.id,
      price: purchases.price,
      purchasedAt: purchases.purchasedAt,
      strategy: strategies,
    })
    .from(purchases)
    .leftJoin(strategies, eq(purchases.strategyId, strategies.id))
    .where(eq(purchases.userId, userId))
    .orderBy(desc(purchases.purchasedAt));
}

export async function hasPurchased(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.strategyId, strategyId)))
    .limit(1);

  return result.length > 0;
}

// ========== 下载记录相关 ==========

export async function createDownload(data: { userId: number; strategyId: number }) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(downloads).values(data);

  // 更新下载计数
  await db
    .update(strategies)
    .set({ downloadCount: sql`${strategies.downloadCount} + 1` })
    .where(eq(strategies.id, data.strategyId));

  return result;
}

export async function getUserDownloads(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: downloads.id,
      downloadedAt: downloads.downloadedAt,
      strategy: strategies,
    })
    .from(downloads)
    .leftJoin(strategies, eq(downloads.strategyId, strategies.id))
    .where(eq(downloads.userId, userId))
    .orderBy(desc(downloads.downloadedAt));
}


// ========== 管理员功能 ==========

export async function createStrategy(data: typeof strategies.$inferInsert) {
  const db = await getDb();
  if (!db) return createMockStrategy(data);

  const result = await db.insert(strategies).values(data);
  // 返回插入的策略对象
  const insertId = result[0].insertId;
  return getStrategyById(insertId);
}

export async function updateStrategy(id: number, data: Partial<typeof strategies.$inferInsert>) {
  const db = await getDb();
  if (!db) return updateMockStrategy(id, data);

  await db.update(strategies).set(data).where(eq(strategies.id, id));
  return getStrategyById(id);
}

export async function deleteStrategy(id: number) {
  const db = await getDb();
  if (!db) return deleteMockStrategy(id);

  await db.delete(strategies).where(eq(strategies.id, id));
  return true;
}

export async function getAllStrategies(params: {
  status?: "draft" | "published" | "archived";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return getMockAllStrategies(params);

  const whereCondition = params.status ? eq(strategies.status, params.status) : undefined;

  const query = db
    .select()
    .from(strategies)
    .where(whereCondition)
    .orderBy(desc(strategies.createdAt))
    .limit(params.limit || 50)
    .offset(params.offset || 0);

  return query;
}

export async function getAllComments(limit?: number, offset?: number) {
  const db = await getDb();
  if (!db) return getMockAllComments(limit, offset);

  return db
    .select({
      id: comments.id,
      userId: comments.userId,
      strategyId: comments.strategyId,
      content: comments.content,
      createdAt: comments.createdAt,
      user: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
      },
      strategy: {
        id: strategies.id,
        title: strategies.title,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .leftJoin(strategies, eq(comments.strategyId, strategies.id))
    .orderBy(desc(comments.createdAt))
    .limit(limit || 50)
    .offset(offset || 0);
}

export async function deleteCommentByAdmin(id: number) {
  const db = await getDb();
  if (!db) return null;

  await db.delete(comments).where(eq(comments.id, id));
  return true;
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return getMockAdminStats();

  const totalStrategies = await db.select({ count: sql<number>`count(*)` }).from(strategies);
  const publishedStrategies = await db
    .select({ count: sql<number>`count(*)` })
    .from(strategies)
    .where(eq(strategies.status, "published"));
  const totalDownloads = await db.select({ count: sql<number>`count(*)` }).from(downloads);
  const totalPurchases = await db.select({ count: sql<number>`count(*)` }).from(purchases);
  const totalComments = await db.select({ count: sql<number>`count(*)` }).from(comments);

  return {
    totalStrategies: totalStrategies[0]?.count || 0,
    publishedStrategies: publishedStrategies[0]?.count || 0,
    totalDownloads: totalDownloads[0]?.count || 0,
    totalPurchases: totalPurchases[0]?.count || 0,
    totalComments: totalComments[0]?.count || 0,
  };
}

// ========== 回测数据相关 ==========

export async function getBacktestData(strategyId: number) {
  const db = await getDb();
  if (!db) return getMockBacktestData(strategyId);

  const { backtestData } = schema;
  return db
    .select()
    .from(backtestData)
    .where(eq(backtestData.strategyId, strategyId))
    .orderBy(backtestData.date);
}

export async function createBacktestData(data: typeof schema.backtestData.$inferInsert) {
  const db = await getDb();
  if (!db) return null;

  const { backtestData } = schema;
  const result = await db.insert(backtestData).values(data);
  return result;
}

export async function deleteBacktestData(id: number) {
  const db = await getDb();
  if (!db) return;
  const { backtestData } = schema;
  await db.delete(backtestData).where(eq(backtestData.id, id));
  return { success: true };
}

export async function deleteAllBacktestData(strategyId: number) {
  const db = await getDb();
  if (!db) return;
  const { backtestData } = schema;
  await db.delete(backtestData).where(eq(backtestData.strategyId, strategyId));
  return { success: true };
}

// ========== 匿名留言相关 ==========

export async function getAnonymousComments(strategyId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return getMockAnonymousComments(strategyId, limit, offset);

  return db
    .select()
    .from(anonymousComments)
    .where(eq(anonymousComments.strategyId, strategyId))
    .orderBy(desc(anonymousComments.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getAllAnonymousComments(limit = 200, offset = 0) {
  const db = await getDb();
  if (!db) return getMockAllAnonymousComments(limit, offset);

  return db
    .select({
      id: anonymousComments.id,
      strategyId: anonymousComments.strategyId,
      nickname: anonymousComments.nickname,
      content: anonymousComments.content,
      isApproved: anonymousComments.isApproved,
      rating: anonymousComments.rating,
      createdAt: anonymousComments.createdAt,
      strategyTitle: strategies.title,
    })
    .from(anonymousComments)
    .leftJoin(strategies, eq(anonymousComments.strategyId, strategies.id))
    .orderBy(desc(anonymousComments.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createAnonymousComment(data: typeof anonymousComments.$inferInsert) {
  const db = await getDb();
  if (!db) return createMockAnonymousComment(data);

  const result = await db.insert(anonymousComments).values(data);
  return result;
}

export async function approveAnonymousComment(id: number) {
  const db = await getDb();
  if (!db) return null;

  await db
    .update(anonymousComments)
    .set({ isApproved: true })
    .where(eq(anonymousComments.id, id));
  return { success: true };
}

export async function deleteAnonymousComment(id: number) {
  const db = await getDb();
  if (!db) return null;

  await db.delete(anonymousComments).where(eq(anonymousComments.id, id));
  return { success: true };
}

// ========== 上架EA申请相关 ==========

export async function createListingRequest(data: typeof listingRequests.$inferInsert) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(listingRequests).values(data);
  return result;
}

export async function getListingRequests(status?: "pending" | "contacted" | "rejected", limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  const whereCondition = status ? eq(listingRequests.status, status) : undefined;

  const query = db
    .select()
    .from(listingRequests)
    .orderBy(desc(listingRequests.createdAt))
    .limit(limit)
    .offset(offset);

  if (whereCondition) {
    return query.where(whereCondition);
  }

  return query;
}

export async function updateListingRequestStatus(id: number, status: "pending" | "contacted" | "rejected", notes?: string) {
  const db = await getDb();
  if (!db) return null;

  const updateData: any = { status };
  if (notes !== undefined) {
    updateData.notes = notes;
  }

  await db.update(listingRequests).set(updateData).where(eq(listingRequests.id, id));
  return { success: true };
}

// ========== 合购相关 ==========

export async function getGroupBuys(status?: "active" | "completed" | "cancelled", limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) {
    const rows = getMockGroupBuys().filter((groupBuy: any) => !status || groupBuy.status === status);
    return rows.slice(offset, offset + limit);
  }

  const whereCondition = status ? eq(groupBuys.status, status) : undefined;

  const query = db
    .select()
    .from(groupBuys)
    .orderBy(desc(groupBuys.createdAt))
    .limit(limit)
    .offset(offset);

  if (whereCondition) {
    return query.where(whereCondition);
  }

  return query;
}

export async function getGroupBuyDetail(id: number) {
  const db = await getDb();
  if (!db) return getMockGroupBuyById(id);

  const result = await db.select().from(groupBuys).where(eq(groupBuys.id, id)).limit(1);
  return result[0] || null;
}

export async function createGroupBuyRequest(data: typeof listingRequests.$inferInsert) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(listingRequests).values(data);
  return result;
}

export async function updateGroupBuyParticipants(id: number, increment: number) {
  const db = await getDb();
  if (!db) return null;

  const groupBuy = await getGroupBuyDetail(id);
  if (!groupBuy) return null;

  const newCount = groupBuy.currentParticipants + increment;
  const newStatus = newCount >= groupBuy.targetParticipants ? "completed" : "active";

  await db
    .update(groupBuys)
    .set({
      currentParticipants: newCount,
      status: newStatus,
    })
    .where(eq(groupBuys.id, id));

  return { success: true };
}


// ========== 订阅/联系方式相关 ==========

// 智能识别联系方式类型
function detectContactType(value: string): string {
  const v = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(v)) return "email";
  if (/^\d{5,11}$/.test(v)) return "qq"; // QQ号通常是5-11位数字
  if (/^@/.test(v) || /t\.me\//i.test(v)) return "telegram";
  return "wechat"; // 默认为微信
}

export async function createEmailSubscription(input: { email?: string; contactInfo?: string }) {
  const db = await getDb();
  const { emailSubscriptions } = schema;
  const email = input.email?.trim() || null;
  const contactInfo = input.contactInfo?.trim() || null;
  
  if (!email && !contactInfo) {
    return { success: false, message: "请至少填写一种联系方式" };
  }

  if (!db) return { success: true, message: "提交成功，本地预览已记录样例请求" };

  // 检查是否已存在（按邮箱或联系方式查重）
  const conditions = [];
  if (email) conditions.push(eq(emailSubscriptions.email, email));
  if (contactInfo) conditions.push(eq(emailSubscriptions.contactInfo, contactInfo));
  
  const existing = await db.select().from(emailSubscriptions)
    .where(conditions.length > 1 ? or(...conditions) : conditions[0])
    .limit(1);
    
  if (existing.length > 0) {
    if (!existing[0].isActive) {
      // 重新激活并更新信息
      const updateData: any = { isActive: true };
      if (email) updateData.email = email;
      if (contactInfo) {
        updateData.contactInfo = contactInfo;
        updateData.contactType = detectContactType(contactInfo);
      }
      await db.update(emailSubscriptions).set(updateData).where(eq(emailSubscriptions.id, existing[0].id));
      return { success: true, message: "已重新订阅" };
    }
    return { success: false, message: "该联系方式已订阅" };
  }

  // 新增订阅
  const contactType = contactInfo ? detectContactType(contactInfo) : (email ? "email" : "unknown");
  await db.insert(emailSubscriptions).values({ 
    email, 
    contactInfo,
    contactType,
  });
  return { success: true, message: "提交成功，我们将尽快与您联系！" };
}

export async function getEmailSubscriptions(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  const { emailSubscriptions } = schema;
  return db.select().from(emailSubscriptions).orderBy(desc(emailSubscriptions.createdAt)).limit(limit).offset(offset);
}

export async function getEmailSubscriptionCount() {
  const db = await getDb();
  if (!db) return 0;

  const { emailSubscriptions } = schema;
  const result = await db.select({ count: sql<number>`count(*)` }).from(emailSubscriptions).where(eq(emailSubscriptions.isActive, true));
  const realCount = result[0]?.count || 0;
  
  // 加上虚拟订阅数
  const virtualSetting = await getSiteSetting('virtual_subscriber_count');
  const virtualCount = virtualSetting ? parseInt(virtualSetting.settingValue) || 0 : 0;
  
  return realCount + virtualCount;
}

// ========== 页面内容相关 ==========

export async function getPageContents(pageKey: string) {
  const db = await getDb();
  if (!db) return [];

  const { pageContents } = schema;
  return db.select().from(pageContents)
    .where(and(eq(pageContents.pageKey, pageKey), eq(pageContents.isVisible, true)))
    .orderBy(pageContents.sortOrder);
}

export async function getAllPageContents(pageKey?: string) {
  const db = await getDb();
  if (!db) return [];

  const { pageContents } = schema;
  const query = db.select().from(pageContents).orderBy(pageContents.pageKey, pageContents.sortOrder);
  if (pageKey) {
    return query.where(eq(pageContents.pageKey, pageKey));
  }
  return query;
}

export async function createPageContent(data: typeof schema.pageContents.$inferInsert) {
  const db = await getDb();
  if (!db) return null;

  const { pageContents } = schema;
  const result = await db.insert(pageContents).values(data);
  return result;
}

export async function updatePageContent(id: number, data: Partial<typeof schema.pageContents.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;

  const { pageContents } = schema;
  await db.update(pageContents).set(data).where(eq(pageContents.id, id));
  return { success: true };
}

export async function reorderPageContents(
  pageKey: string,
  items: Array<{
    recordId: number | null;
    sectionKey: string;
    title: string;
    content: string;
    icon: string;
    sortOrder: number;
    isVisible: boolean;
  }>,
) {
  const db = await getDb();
  if (!db) return null;

  const { pageContents } = schema;
  await db.transaction(async (transaction: any) => {
    for (const item of items) {
      const payload = {
        title: item.title,
        content: item.content,
        icon: item.icon,
        sortOrder: item.sortOrder,
        isVisible: item.isVisible,
      };
      if (item.recordId) {
        await transaction
          .update(pageContents)
          .set(payload)
          .where(eq(pageContents.id, item.recordId));
      } else {
        await transaction.insert(pageContents).values({
          ...payload,
          pageKey,
          sectionKey: item.sectionKey,
        });
      }
    }
  });
  return { success: true };
}

export async function deletePageContent(id: number) {
  const db = await getDb();
  if (!db) return null;

  const { pageContents } = schema;
  await db.delete(pageContents).where(eq(pageContents.id, id));
  return { success: true };
}

// ========== 通知/公告 ==========

export async function getActiveNotifications() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(notifications)
    .where(eq(notifications.isActive, true))
    .orderBy(notifications.sortOrder);
}

export async function getAllNotifications(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit).offset(offset);
}

export async function createNotification(data: { title: string; content: string; type?: string; icon?: string; link?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(notifications).values(data as any);
  return { success: true, id: result[0].insertId };
}

export async function updateNotification(id: number, data: Partial<{ title: string; content: string; type: string; icon: string; link: string; isActive: boolean; sortOrder: number }>) {
  const db = await getDb();
  if (!db) return null;

  await db.update(notifications).set(data).where(eq(notifications.id, id));
  return { success: true };
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return null;

  await db.delete(notifications).where(eq(notifications.id, id));
  return { success: true };
}

// ========== 站点设置 ==========

export async function getSiteSettings() {
  const db = await getDb();
  if (!db) return getMockSiteSettings();

  return db.select().from(siteSettings);
}

export async function getSiteSetting(key: string) {
  const db = await getDb();
  if (!db) return getMockSiteSetting(key);

  const result = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, key)).limit(1);
  return result[0] || null;
}

export async function upsertSiteSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) return null;

  const existing = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, key)).limit(1);
  if (existing.length > 0) {
    await db.update(siteSettings).set({ settingValue: value }).where(eq(siteSettings.settingKey, key));
  } else {
    await db.insert(siteSettings).values({ settingKey: key, settingValue: value, description: description || null });
  }
  return { success: true };
}

export async function getContactSettings() {
  const db = await getDb();
  if (!db) return getMockContactSettings();

  const settings = await db.select().from(siteSettings)
    .where(sql`${siteSettings.settingKey} LIKE 'contact_%'`);
  
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.settingKey] = s.settingValue;
  }
  return result;
}

// ========== 合购管理（Admin） ==========
export async function createGroupBuy(data: typeof groupBuys.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(groupBuys).values(data);
  return { success: true, id: result[0].insertId };
}

export async function updateGroupBuy(id: number, data: Partial<typeof groupBuys.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(groupBuys).set(data).where(eq(groupBuys.id, id));
  return { success: true };
}

export async function deleteGroupBuy(id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(groupBuys).where(eq(groupBuys.id, id));
  return { success: true };
}

export async function getAllGroupBuys(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return getMockGroupBuys().slice(offset, offset + limit);
  return db.select().from(groupBuys).orderBy(desc(groupBuys.createdAt)).limit(limit).offset(offset);
}

// ========== 上架申请管理（Admin） ==========
export async function deleteListingRequest(id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(listingRequests).where(eq(listingRequests.id, id));
  return { success: true };
}

// ========== 合作方案页 ==========

// 获取可见的合作展示卡片
export async function getCooperationCards() {
  const db = await getDb();
  if (!db) return getMockCooperationCards();
  return db.select().from(cooperationCards)
    .where(eq(cooperationCards.isVisible, true))
    .orderBy(asc(cooperationCards.sortOrder));
}

// 获取所有合作展示卡片（管理员）
export async function getAllCooperationCards() {
  const db = await getDb();
  if (!db) return getMockCooperationCards();
  return db.select().from(cooperationCards).orderBy(asc(cooperationCards.sortOrder));
}

// 创建合作展示卡片
export async function createCooperationCard(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(cooperationCards).values(data);
  return { id: result[0].insertId };
}

// 更新合作展示卡片
export async function updateCooperationCard(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(cooperationCards).set(data).where(eq(cooperationCards.id, id));
  return { success: true };
}

// 删除合作展示卡片
export async function deleteCooperationCard(id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(cooperationCards).where(eq(cooperationCards.id, id));
  return { success: true };
}

// 获取可见的合作模式
export async function getCooperationPlans() {
  const db = await getDb();
  if (!db) return getMockCooperationPlans();
  return db.select().from(cooperationPlans)
    .where(eq(cooperationPlans.isVisible, true))
    .orderBy(asc(cooperationPlans.sortOrder));
}

// 获取所有合作模式（管理员）
export async function getAllCooperationPlans() {
  const db = await getDb();
  if (!db) return getMockCooperationPlans();
  return db.select().from(cooperationPlans).orderBy(asc(cooperationPlans.sortOrder));
}

// 创建合作模式
export async function createCooperationPlan(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(cooperationPlans).values(data);
  return { id: result[0].insertId };
}

// 更新合作模式
export async function updateCooperationPlan(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(cooperationPlans).set(data).where(eq(cooperationPlans.id, id));
  return { success: true };
}

// 删除合作模式
export async function deleteCooperationPlan(id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(cooperationPlans).where(eq(cooperationPlans.id, id));
  return { success: true };
}

// ========== 限时促销商城 ==========

// 获取可见的促销商品
export async function getPromoProducts(category?: string) {
  const db = await getDb();
  if (!db) return getMockPromoProducts(category);
  const conditions = [eq(promoProducts.isVisible, true), eq(promoProducts.status, "active")];
  if (category) {
    conditions.push(eq(promoProducts.category, category));
  }
  return db.select().from(promoProducts)
    .where(and(...conditions))
    .orderBy(asc(promoProducts.sortOrder));
}

// 获取促销商品详情
export async function getPromoProductById(id: number) {
  const db = await getDb();
  if (!db) return getMockPromoProducts().find((product: any) => product.id === id) || null;
  const result = await db.select().from(promoProducts).where(eq(promoProducts.id, id)).limit(1);
  return result[0] || null;
}

// 获取所有促销商品（管理员）
export async function getAllPromoProducts() {
  const db = await getDb();
  if (!db) return getMockPromoProducts();
  return db.select().from(promoProducts).orderBy(asc(promoProducts.sortOrder));
}

// 创建促销商品
export async function createPromoProduct(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(promoProducts).values(data);
  return { id: result[0].insertId };
}

// 更新促销商品
export async function updatePromoProduct(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(promoProducts).set(data).where(eq(promoProducts.id, id));
  return { success: true };
}

// 删除促销商品
export async function deletePromoProduct(id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(promoProducts).where(eq(promoProducts.id, id));
  return { success: true };
}

// ==================== Bundle A.1: 用户手机号查找 + 邮箱验证 + 云端收藏 ====================

export async function getUserByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return result[0] || null;
}

export async function getUserFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId))
    .orderBy(desc(userFavorites.createdAt));
}

export async function isFavorited(userId: number, productKind: string, productId: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(userFavorites)
    .where(
      and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.productKind, productKind),
        eq(userFavorites.productId, productId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function addFavorite(userId: number, productKind: string, productId: number) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(userFavorites).values({ userId, productKind, productId });
  } catch (e: any) {
    if (e?.code !== "ER_DUP_ENTRY") throw e;
  }
  return { ok: true };
}

export async function removeFavorite(userId: number, productKind: string, productId: number) {
  const db = await getDb();
  if (!db) return null;
  await db
    .delete(userFavorites)
    .where(
      and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.productKind, productKind),
        eq(userFavorites.productId, productId),
      ),
    );
  return { ok: true };
}

export async function isUserEmailVerified(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.target, email),
        eq(verificationCodes.purpose, "verify_email"),
        eq(verificationCodes.used, true),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ==================== Bundle A.2: 分类 CRUD ====================

export async function listCategories() {
  const db = await getDb();
  if (!db) return getMockCategories();
  return db
    .select()
    .from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(categories.sortOrder);
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return getMockCategoryBySlug(slug);
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return rows[0] || null;
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return getMockCategoryById(id);
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return rows[0] || null;
}

export async function createCategory(data: typeof categories.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(categories).values(data);
  return result;
}

export async function updateCategory(id: number, data: Partial<typeof categories.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(categories).where(eq(categories.id, id));
}


// ==================== Bundle A.3: 订单 CRUD ====================

export async function createOrder(data: typeof orders.$inferInsert) {
  const db = await getDb();
  if (!db) return createMockOrder(data);
  await db.insert(orders).values(data);
  return getOrderByOrderNo(data.orderNo);
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return getMockOrderById(id);
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] || null;
}

export async function getOrderByOrderNo(orderNo: string) {
  const db = await getDb();
  if (!db) return getMockOrderByOrderNo(orderNo);
  const rows = await db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1);
  return rows[0] || null;
}

export async function getUserOrders(userId: number, opts?: { limit?: number; status?: string }) {
  const db = await getDb();
  if (!db) return getMockUserOrders(userId, opts);
  const conditions: any[] = [eq(orders.userId, userId)];
  if (opts?.status) conditions.push(eq(orders.status, opts.status as any));
  return db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(opts?.limit || 50);
}

export async function listAllOrders(opts?: { limit?: number; status?: string }) {
  const db = await getDb();
  if (!db) return listMockAllOrders(opts);
  const conditions: any[] = [];
  if (opts?.status) conditions.push(eq(orders.status, opts.status as any));
  const query = db.select().from(orders);
  const finalQuery = conditions.length > 0 ? query.where(and(...conditions)) : query;
  return finalQuery.orderBy(desc(orders.createdAt)).limit(opts?.limit || 100);
}

export async function markOrderPaid(
  orderId: number,
  opts: { paymentMethod?: string | null; paymentGateway?: string | null }
) {
  const db = await getDb();
  if (!db) return markMockOrderPaid(orderId, opts);
  await db
    .update(orders)
    .set({
      status: "paid",
      paidAt: new Date(),
      paymentMethod: opts.paymentMethod || null,
      paymentGateway: opts.paymentGateway || null,
    })
    .where(eq(orders.id, orderId));
}

export async function markOrderRefunded(orderId: number) {
  const database = await getDb();
  if (!database) return markMockOrderRefunded(orderId);
  await database
    .update(orders)
    .set({ status: "refunded" })
    .where(eq(orders.id, orderId));
}

export async function cancelOrder(orderId: number) {
  const db = await getDb();
  if (!db) return cancelMockOrder(orderId);
  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
}

export async function expireStaleOrders(): Promise<number> {
  const db = await getDb();
  if (!db) return expireMockStaleOrders();
  const now = new Date();
  const result = await db
    .update(orders)
    .set({ status: "expired" })
    .where(
      and(
        eq(orders.status, "pending"),
        sql`${orders.expiresAt} < ${now}`
      )
    );
  return (result as any).rowsAffected || 0;
}

// ==================== Bundle A.3: 支付记录 CRUD ====================

export async function createPayment(data: typeof payments.$inferInsert) {
  const db = await getDb();
  if (!db) return createMockPayment(data);
  await db.insert(payments).values(data);
}

export async function updatePayment(id: number, data: Partial<typeof payments.$inferInsert>) {
  const db = await getDb();
  if (!db) return updateMockPayment(id, data);
  await db.update(payments).set(data).where(eq(payments.id, id));
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return getMockPaymentById(id);
  const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return rows[0] || null;
}

export async function getPaymentsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return getMockPaymentsByOrderId(orderId);
  return db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt));
}

export async function getActivePaymentByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return getMockActivePaymentByOrderId(orderId);
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function getPaymentByGatewayOrderNo(gatewayOrderNo: string) {
  const database = await getDb();
  if (!database) return getMockPaymentByGatewayOrderNo(gatewayOrderNo);
  const rows = await database
    .select()
    .from(payments)
    .where(eq(payments.gatewayOrderNo, gatewayOrderNo))
    .limit(1);
  return rows[0] || null;
}

export async function listPendingUsdtPayments() {
  const db = await getDb();
  if (!db) return listMockPendingUsdtPayments();
  return db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.gateway, "usdt-manual"),
        eq(payments.status, "pending"),
        isNotNull(payments.gatewayOrderNo)
      )
    )
    .orderBy(desc(payments.createdAt));
}

export async function createCommerceUsdtEvent(data: {
  paymentId: number;
  orderId: number;
  actorUserId?: number | null;
  eventType: string;
  payload?: string | null;
}) {
  const database = await getDb();
  if (!database) return createMockCommerceUsdtEvent(data);
  await database.insert(commerceUsdtEvents).values(data);
}

export async function listCommerceUsdtEvents(paymentId: number) {
  const database = await getDb();
  if (!database) return listMockCommerceUsdtEvents(paymentId);
  return database
    .select()
    .from(commerceUsdtEvents)
    .where(eq(commerceUsdtEvents.paymentId, paymentId))
    .orderBy(asc(commerceUsdtEvents.createdAt), asc(commerceUsdtEvents.id));
}

export async function listUsdtPayments(input?: {
  reviewStatus?: string;
  limit?: number;
}) {
  const database = await getDb();
  if (!database) return listMockUsdtPayments(input);
  const conditions: any[] = [eq(payments.gateway, "usdt-manual")];
  if (input?.reviewStatus) {
    conditions.push(eq(payments.usdtReviewStatus, input.reviewStatus as any));
  }
  const rows = await database
    .select()
    .from(payments)
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt))
    .limit(input?.limit ?? 100);
  return Promise.all(
    rows.map(async (payment: any) => ({
      ...payment,
      events: await listCommerceUsdtEvents(payment.id),
    })),
  );
}

type ChainTransactionUsage =
  | "COMMERCE_INBOUND"
  | "BROKER_DIRECT_INBOUND"
  | "COLLECTION_INBOUND"
  | "COLLECTION_PAYOUT"
  | "COLLECTION_REFUND"
  | "COMMERCE_REFUND";

function normalizeChainTransaction(input: {
  network: string;
  normalizedHash: string;
}) {
  const upperNetwork = input.network.trim().toUpperCase();
  const network =
    upperNetwork === "TRC20"
      ? "TRON"
      : upperNetwork === "ERC20"
        ? "ETHEREUM"
        : upperNetwork === "BEP20"
          ? "BSC"
          : upperNetwork;
  const normalizedHash =
    network === "SOLANA" || network === "OTHER"
      ? input.normalizedHash.trim()
      : input.normalizedHash.trim().replace(/^0x/i, "").toLowerCase();
  return { network, normalizedHash };
}

async function occupyChainTransactionInTx(
  tx: any,
  input: {
    network: string;
    normalizedHash: string;
    usageType: ChainTransactionUsage;
    referenceNo: string;
    actorUserId?: number | null;
  },
) {
  const rows = await tx
    .select()
    .from(chainTxRegistry)
    .where(
      and(
        eq(chainTxRegistry.network, input.network),
        eq(chainTxRegistry.normalizedHash, input.normalizedHash),
      ),
    )
    .limit(1)
    .for("update");
  const existing = rows[0];
  if (existing) {
    if (
      existing.usageType === input.usageType &&
      existing.referenceNo === input.referenceNo
    ) {
      return;
    }
    throw new Error("该链上交易已被另一 USDT 账路占用");
  }
  try {
    await tx.insert(chainTxRegistry).values(input);
  } catch {
    // A concurrent transaction may have inserted after the SELECT. The unique
    // key is authoritative; callers retry from fresh state instead of guessing.
    throw new Error("该链上交易已被另一 USDT 账路占用");
  }
}

/**
 * Atomically occupies an inbound chain transaction, updates the merchant USDT
 * payment, appends its audit event and (only for a true MATCHED result) marks
 * the order paid. Any CAS/event/order failure rolls the registry insert back.
 */
export async function reconcileCommerceUsdtAtomically(input: {
  paymentId: number;
  orderId: number;
  orderNo: string;
  actorUserId: number;
  network: string;
  normalizedHash: string;
  expectedPaymentStatus: "pending" | "success" | "failed" | "refunded";
  paymentUpdate: Partial<typeof payments.$inferInsert>;
  eventType: string;
  eventPayload: string;
  markOrderPaid: boolean;
}) {
  const key = normalizeChainTransaction(input);
  const registryInput = {
    ...key,
    usageType: "COMMERCE_INBOUND" as const,
    referenceNo: input.orderNo,
    actorUserId: input.actorUserId,
  };
  const database = await getDb();
  if (!database) {
    const payment = getMockPaymentById(input.paymentId);
    const order = getMockOrderById(input.orderId);
    if (!payment || payment.status !== input.expectedPaymentStatus) {
      throw new Error("支付记录已被其他操作更新，请刷新后重试");
    }
    if (input.markOrderPaid && (!order || order.status !== "pending")) {
      throw new Error("订单已被其他通道更新，请重新对账");
    }
    reserveMockChainTransaction(registryInput);
    try {
      updateMockPayment(input.paymentId, input.paymentUpdate);
      createMockCommerceUsdtEvent({
        paymentId: input.paymentId,
        orderId: input.orderId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.eventPayload,
      });
      if (input.markOrderPaid) {
        markMockOrderPaid(input.orderId, {
          paymentMethod: "usdt",
          paymentGateway: "usdt-manual",
        });
      }
    } catch (error) {
      releaseMockChainTransaction(registryInput);
      throw error;
    }
    return;
  }

  await database.transaction(async (tx: any) => {
    await occupyChainTransactionInTx(tx, registryInput);
    const paymentResult = await tx
      .update(payments)
      .set(input.paymentUpdate)
      .where(
        and(
          eq(payments.id, input.paymentId),
          eq(payments.status, input.expectedPaymentStatus),
        ),
      );
    const paymentAffected = Number(
      (paymentResult as any)[0]?.affectedRows ??
        (paymentResult as any).rowsAffected ??
        0,
    );
    if (paymentAffected !== 1) {
      throw new Error("支付记录已被其他操作更新，请刷新后重试");
    }
    await tx.insert(commerceUsdtEvents).values({
      paymentId: input.paymentId,
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      payload: input.eventPayload,
    });
    if (input.markOrderPaid) {
      const orderResult = await tx
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          paymentMethod: "usdt",
          paymentGateway: "usdt-manual",
        })
        .where(and(eq(orders.id, input.orderId), eq(orders.status, "pending")));
      const orderAffected = Number(
        (orderResult as any)[0]?.affectedRows ??
          (orderResult as any).rowsAffected ??
          0,
      );
      if (orderAffected !== 1) {
        throw new Error("订单已被其他通道更新，请重新对账");
      }
    }
  });
}

/** Final merchant-USDT refund ledger write; external wallets execute the tx. */
export async function recordCommerceUsdtRefundAtomically(input: {
  paymentId: number;
  orderId: number;
  orderNo: string;
  actorUserId: number;
  network: string;
  normalizedHash: string;
  expectedPaymentStatus: "pending" | "success" | "failed" | "refunded";
  paymentUpdate: Partial<typeof payments.$inferInsert>;
  eventPayload: string;
  markOrderRefunded: boolean;
}) {
  const key = normalizeChainTransaction(input);
  const registryInput = {
    ...key,
    usageType: "COMMERCE_REFUND" as const,
    referenceNo: input.orderNo,
    actorUserId: input.actorUserId,
  };
  const database = await getDb();
  if (!database) {
    const payment = getMockPaymentById(input.paymentId);
    const order = getMockOrderById(input.orderId);
    if (
      !payment ||
      payment.status !== input.expectedPaymentStatus ||
      payment.refundTxHash
    ) {
      throw new Error("退款记录已被其他操作更新，请刷新后重试");
    }
    if (
      input.markOrderRefunded &&
      (!order || order.status !== "paid" || order.paymentGateway !== "usdt-manual")
    ) {
      throw new Error("订单状态已变更，不能登记全额退款");
    }
    reserveMockChainTransaction(registryInput);
    try {
      updateMockPayment(input.paymentId, input.paymentUpdate);
      createMockCommerceUsdtEvent({
        paymentId: input.paymentId,
        orderId: input.orderId,
        actorUserId: input.actorUserId,
        eventType: "USDT_REFUND_TX_RECORDED",
        payload: input.eventPayload,
      });
      if (input.markOrderRefunded) markMockOrderRefunded(input.orderId);
    } catch (error) {
      releaseMockChainTransaction(registryInput);
      throw error;
    }
    return;
  }
  await database.transaction(async (tx: any) => {
    await occupyChainTransactionInTx(tx, registryInput);
    const paymentResult = await tx
      .update(payments)
      .set(input.paymentUpdate)
      .where(
        and(
          eq(payments.id, input.paymentId),
          eq(payments.status, input.expectedPaymentStatus),
          isNull(payments.refundTxHash),
        ),
      );
    const paymentAffected = Number(
      (paymentResult as any)[0]?.affectedRows ??
        (paymentResult as any).rowsAffected ??
        0,
    );
    if (paymentAffected !== 1) {
      throw new Error("退款记录已被其他操作更新，请刷新后重试");
    }
    await tx.insert(commerceUsdtEvents).values({
      paymentId: input.paymentId,
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      eventType: "USDT_REFUND_TX_RECORDED",
      payload: input.eventPayload,
    });
    if (input.markOrderRefunded) {
      const orderResult = await tx
        .update(orders)
        .set({ status: "refunded" })
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.status, "paid"),
            eq(orders.paymentGateway, "usdt-manual"),
          ),
        );
      const orderAffected = Number(
        (orderResult as any)[0]?.affectedRows ??
          (orderResult as any).rowsAffected ??
          0,
      );
      if (orderAffected !== 1) {
        throw new Error("订单状态已变更，不能登记全额退款");
      }
    }
  });
}

export async function reserveChainTransaction(input: {
  network: string;
  normalizedHash: string;
  usageType: ChainTransactionUsage;
  referenceNo: string;
  actorUserId?: number | null;
}) {
  const { network, normalizedHash } = normalizeChainTransaction(input);
  const normalizedInput = { ...input, network, normalizedHash };
  const database = await getDb();
  if (!database) return reserveMockChainTransaction(normalizedInput);
  const readExisting = async () => {
    const rows = await database
      .select()
      .from(chainTxRegistry)
      .where(
        and(
          eq(chainTxRegistry.network, normalizedInput.network),
          eq(chainTxRegistry.normalizedHash, normalizedInput.normalizedHash),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  };
  const existing = await readExisting();
  if (existing) {
    if (
      existing.usageType === normalizedInput.usageType &&
      existing.referenceNo === normalizedInput.referenceNo
    ) {
      return existing;
    }
    throw new Error("该链上交易已被另一 USDT 账路占用");
  }
  try {
    await database.insert(chainTxRegistry).values(normalizedInput);
  } catch (error) {
    const raced = await readExisting();
    if (
      raced?.usageType === normalizedInput.usageType &&
      raced.referenceNo === normalizedInput.referenceNo
    ) {
      return raced;
    }
    throw error;
  }
  return readExisting();
}

export async function releaseChainTransactionReservation(input: {
  network: string;
  normalizedHash: string;
  usageType: ChainTransactionUsage;
  referenceNo: string;
}) {
  const { network, normalizedHash } = normalizeChainTransaction(input);
  const normalizedInput = { ...input, network, normalizedHash };
  const database = await getDb();
  if (!database) return releaseMockChainTransaction(normalizedInput);
  await database
    .delete(chainTxRegistry)
    .where(
      and(
        eq(chainTxRegistry.network, normalizedInput.network),
        eq(chainTxRegistry.normalizedHash, normalizedInput.normalizedHash),
        eq(chainTxRegistry.usageType, normalizedInput.usageType),
        eq(chainTxRegistry.referenceNo, normalizedInput.referenceNo),
      ),
    );
}

export async function consumeAdminTotpStep(input: {
  adminId: number;
  timeStep: number;
  action: string;
}) {
  const database = await getDb();
  if (!database) {
    const key = `${input.adminId}:${input.timeStep}`;
    if (mockAdminTotpUses.has(key)) {
      throw new Error("该动态码已用于另一个敏感操作，请等待下一个动态码");
    }
    mockAdminTotpUses.add(key);
    return;
  }
  try {
    await database.insert(adminTotpUses).values(input);
  } catch {
    throw new Error("该动态码已用于另一个敏感操作，请等待下一个动态码");
  }
}

// ==================== Bundle B: 购买权限 / 下载记录 / Profile 编辑 ====================

export async function hasUserPurchased(userId: number, strategyId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // 只信任完成支付的订单。旧 purchases 表曾允许客户端直接写入，不能作为
  // EA 私有文件的授权来源；历史记录需另行人工核验后迁移为 paid order。
  const paidOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.productKind, "strategy"),
        eq(orders.productId, strategyId),
        eq(orders.status, "paid")
      )
    )
    .limit(1);
  return paidOrders.length > 0;
}

export async function recordDownload(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(downloads)
    .where(and(eq(downloads.userId, userId), eq(downloads.strategyId, strategyId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(downloads).values({ userId, strategyId, downloadedAt: new Date() });
    const strategy = await getStrategyById(strategyId);
    if (strategy) {
      await db
        .update(strategies)
        .set({ downloadCount: (strategy.downloadCount || 0) + 1 })
        .where(eq(strategies.id, strategyId));
    }
  }
}

export async function updateUserProfile(
  userId: number,
  data: { name?: string; avatar?: string; bio?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const update: any = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.avatar !== undefined) update.avatar = data.avatar;
  if (data.bio !== undefined) update.bio = data.bio;
  if (Object.keys(update).length === 0) return;
  await db.update(users).set(update).where(eq(users.id, userId));
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

// ==================== Bundle A.1: Verification Code wrapper ====================
// Re-export from _core/verification so routers.ts can import from db if needed
// (actual implementation is in server/_core/verification.ts)
export async function createVerificationCode(opts: {
  target: string;
  targetType: VerificationTargetType;
  purpose: VerificationPurpose;
  ip?: string;
}): Promise<{ ok: boolean; code?: string; error?: string }> {
  const { createVerificationCode: _create } = await import("./_core/verification");
  return _create(opts);
}

// ============================================================
// 侧边栏自定义入口 CRUD
// ============================================================
export async function listSiteEntries(params?: { enabled?: boolean; all?: boolean }) {
  const db = await getDb();
  if (!db) return listMockSiteEntries(params);
  const { siteEntries } = schema;
  let query = db.select().from(siteEntries).$dynamic();
  if (!params?.all && params?.enabled !== undefined) {
    query = query.where(eq(siteEntries.enabled, params.enabled));
  } else if (!params?.all) {
    // 默认只返回启用的
    query = query.where(eq(siteEntries.enabled, true));
  }
  return query.orderBy(asc(siteEntries.sortOrder), asc(siteEntries.id));
}

export async function createSiteEntry(data: typeof schema.siteEntries.$inferInsert) {
  const db = await getDb();
  if (!db) return createMockSiteEntry(data);
  const result = await db.insert(schema.siteEntries).values(data);
  return { ok: true, id: (result as any)[0]?.insertId };
}

export async function updateSiteEntry(id: number, data: Partial<typeof schema.siteEntries.$inferInsert>) {
  const db = await getDb();
  if (!db) return updateMockSiteEntry(id, data);
  await db.update(schema.siteEntries).set(data).where(eq(schema.siteEntries.id, id));
  return { ok: true };
}

export async function deleteSiteEntry(id: number) {
  const db = await getDb();
  if (!db) return deleteMockSiteEntry(id);
  await db.delete(schema.siteEntries).where(eq(schema.siteEntries.id, id));
  return { ok: true };
}

// ============================================================
// AI 量化联盟委托 CRUD（历史表名保留 managed_sessions）
// ============================================================

async function hydrateManagedSession(database: any, session: any) {
  const [strategyRows, slotRows, eventRows] = await Promise.all([
    database
      .select()
      .from(managedSessionStrategies)
      .where(eq(managedSessionStrategies.sessionId, session.id))
      .orderBy(asc(managedSessionStrategies.sortOrder)),
    database
      .select()
      .from(managedExecutionSlots)
      .where(eq(managedExecutionSlots.sessionId, session.id))
      .orderBy(asc(managedExecutionSlots.id)),
    database
      .select()
      .from(managedSessionEvents)
      .where(eq(managedSessionEvents.sessionId, session.id))
      .orderBy(asc(managedSessionEvents.createdAt), asc(managedSessionEvents.id)),
  ]);
  return {
    ...session,
    strategies: strategyRows,
    executionSlots: slotRows,
    events: eventRows,
  };
}

export async function createManagedSessionDraft(
  userId: number,
  sessionNo: string,
  input: ManagedSessionDraftInput,
) {
  const database = await getDb();
  if (!database) return createMockManagedSessionDraft(userId, sessionNo, input);

  await database.transaction(async (tx: any) => {
    await tx.insert(managedSessions).values({
      sessionNo,
      userId,
      status: "DRAFT",
      termDays: 0,
      capitalMode: "DIRECT_BROKER",
      onboardingMode: input.onboardingMode,
      fundsRoute: input.fundsRoute,
      targetCapital: input.targetCapital,
      settlementAsset: "USDT",
      riskProfile: input.riskProfile,
      maxDrawdownPct: input.maxDrawdownPct.toFixed(2),
      exitMode: input.exitMode,
      tradeAuthorizationStatus: "NOT_REQUESTED",
      withdrawalPermission: "NONE",
      executionEnabled: false,
      version: 1,
    });
    const rows = await tx
      .select({ id: managedSessions.id })
      .from(managedSessions)
      .where(eq(managedSessions.sessionNo, sessionNo))
      .limit(1);
    const sessionId = rows[0]?.id;
    if (!sessionId) throw new Error("无法创建资管会话");

    await tx.insert(managedSessionStrategies).values(
      input.strategies.map((item, index) => ({
        sessionId,
        strategyId: item.strategyId,
        weightPct: item.weightPct.toFixed(2),
        riskMultiplier: item.riskMultiplier.toFixed(2),
        sortOrder: index + 1,
      })),
    );
    await tx.insert(managedExecutionSlots).values(
      input.executionSlots.map((item, index) => ({
        sessionId,
        slotKey: `SLOT-${index + 1}-${sessionNo.slice(-6)}`,
        brokerId: item.brokerId,
        label: item.label ?? null,
        capitalWeightPct: item.capitalWeightPct.toFixed(2),
        fundingSource: "DIRECT_BROKER",
        connectionStatus: "UNLINKED",
        tradePermission: "NOT_REQUESTED",
        withdrawalPermission: "NONE",
      })),
    );
    await tx.insert(managedSessionEvents).values({
      sessionId,
      actorUserId: userId,
      eventType: "DRAFT_CREATED",
      fromStatus: null,
      toStatus: "DRAFT",
      payload: JSON.stringify({
        strategyCount: input.strategies.length,
        executionSlotCount: input.executionSlots.length,
        executionSideEffects: false,
      }),
    });
  });
  return getManagedSessionByNo(sessionNo);
}

export async function getManagedSessionByNo(sessionNo: string) {
  const database = await getDb();
  if (!database) return getMockManagedSessionByNo(sessionNo);
  const rows = await database
    .select()
    .from(managedSessions)
    .where(eq(managedSessions.sessionNo, sessionNo))
    .limit(1);
  return rows[0] ? hydrateManagedSession(database, rows[0]) : null;
}

export async function listManagedSessions(userId?: number) {
  const database = await getDb();
  if (!database) return listMockManagedSessions(userId);
  const base = database.select().from(managedSessions).$dynamic();
  const rows = userId === undefined
    ? await base.orderBy(desc(managedSessions.createdAt)).limit(100)
    : await base
        .where(eq(managedSessions.userId, userId))
        .orderBy(desc(managedSessions.createdAt))
        .limit(100);
  return Promise.all(rows.map((row: any) => hydrateManagedSession(database, row)));
}

export async function replaceManagedSessionDraft(
  sessionNo: string,
  input: ManagedSessionDraftInput,
) {
  const database = await getDb();
  if (!database) return replaceMockManagedSessionDraft(sessionNo, input);
  const existing = await getManagedSessionByNo(sessionNo);
  if (!existing) return null;

  await database.transaction(async (tx: any) => {
    const updateResult = await tx
      .update(managedSessions)
      .set({
        termDays: 0,
        capitalMode: "DIRECT_BROKER",
        onboardingMode: input.onboardingMode,
        fundsRoute: input.fundsRoute,
        targetCapital: input.targetCapital,
        settlementAsset: "USDT",
        riskProfile: input.riskProfile,
        maxDrawdownPct: input.maxDrawdownPct.toFixed(2),
        exitMode: input.exitMode,
        version: sql`${managedSessions.version} + 1`,
      })
      .where(
        and(
          eq(managedSessions.id, existing.id),
          eq(managedSessions.status, "DRAFT"),
        ),
      );
    const affected = Number(
      (updateResult as any)[0]?.affectedRows ??
      (updateResult as any).rowsAffected ??
      0,
    );
    if (affected === 0) {
      throw new Error("资管草案已被提交或其他操作更新，请刷新后重试");
    }
    await tx
      .delete(managedSessionStrategies)
      .where(eq(managedSessionStrategies.sessionId, existing.id));
    await tx
      .delete(managedExecutionSlots)
      .where(eq(managedExecutionSlots.sessionId, existing.id));
    await tx.insert(managedSessionStrategies).values(
      input.strategies.map((item, index) => ({
        sessionId: existing.id,
        strategyId: item.strategyId,
        weightPct: item.weightPct.toFixed(2),
        riskMultiplier: item.riskMultiplier.toFixed(2),
        sortOrder: index + 1,
      })),
    );
    await tx.insert(managedExecutionSlots).values(
      input.executionSlots.map((item, index) => ({
        sessionId: existing.id,
        slotKey: `SLOT-${index + 1}-${sessionNo.slice(-6)}`,
        brokerId: item.brokerId,
        label: item.label ?? null,
        capitalWeightPct: item.capitalWeightPct.toFixed(2),
        fundingSource: "DIRECT_BROKER",
        connectionStatus: "UNLINKED",
        tradePermission: "NOT_REQUESTED",
        withdrawalPermission: "NONE",
      })),
    );
    await tx.insert(managedSessionEvents).values({
      sessionId: existing.id,
      actorUserId: existing.userId,
      eventType: "DRAFT_UPDATED",
      fromStatus: "DRAFT",
      toStatus: "DRAFT",
      payload: JSON.stringify({ executionSideEffects: false }),
    });
  });
  return getManagedSessionByNo(sessionNo);
}

export async function transitionManagedSession(
  sessionNo: string,
  opts: {
    actorUserId: number | null;
    expectedFrom: ManagedSessionStatus;
    toStatus: ManagedSessionStatus;
    eventType: string;
    tradeAuthorizationStatus?: "NOT_REQUESTED" | "PENDING" | "GRANTED" | "REVOKED";
    executionEnabled?: boolean;
    timestamps?: ManagedTransitionPatch;
    eventPayload?: Record<string, unknown>;
  },
) {
  const database = await getDb();
  if (!database) {
    return transitionMockManagedSession(
      sessionNo,
      opts.actorUserId,
      opts.toStatus,
      opts.eventType,
      opts,
    );
  }
  const existing = await getManagedSessionByNo(sessionNo);
  if (!existing) return null;
  const update: Record<string, unknown> = {
    status: opts.toStatus,
    version: sql`${managedSessions.version} + 1`,
    ...(opts.timestamps ?? {}),
  };
  if (opts.tradeAuthorizationStatus) {
    update.tradeAuthorizationStatus = opts.tradeAuthorizationStatus;
  }
  if (opts.executionEnabled !== undefined) {
    update.executionEnabled = opts.executionEnabled;
  }
  await database.transaction(async (tx: any) => {
    const result = await tx
      .update(managedSessions)
      .set(update)
      .where(
        and(
          eq(managedSessions.id, existing.id),
          eq(managedSessions.status, opts.expectedFrom),
        ),
      );
    const affected = Number(
      (result as any)[0]?.affectedRows ?? (result as any).rowsAffected ?? 0,
    );
    if (affected === 0) {
      throw new Error("资管会话已被其他操作更新，请刷新后重试");
    }
    await tx.insert(managedSessionEvents).values({
      sessionId: existing.id,
      actorUserId: opts.actorUserId,
      eventType: opts.eventType,
      fromStatus: opts.expectedFrom,
      toStatus: opts.toStatus,
      payload: opts.eventPayload ? JSON.stringify(opts.eventPayload) : null,
    });
  });
  return getManagedSessionByNo(sessionNo);
}

export async function updateManagedExecutionSlot(
  sessionNo: string,
  slotKey: string,
  input: {
    connectionStatus: "UNLINKED" | "PENDING" | "VERIFIED" | "REVOKED";
    tradePermission: "NOT_REQUESTED" | "PENDING" | "GRANTED" | "REVOKED";
    accountAlias?: string | null;
    authorizationReference?: string | null;
    actorUserId: number;
  },
) {
  const database = await getDb();
  if (!database) {
    return updateMockManagedExecutionSlot(sessionNo, slotKey, input);
  }
  const session = await getManagedSessionByNo(sessionNo);
  if (!session) return null;
  const slot = session.executionSlots.find((item: any) => item.slotKey === slotKey);
  if (!slot) return null;
  await database.transaction(async (tx: any) => {
    await tx
      .update(managedExecutionSlots)
      .set({
        connectionStatus: input.connectionStatus,
        tradePermission: input.tradePermission,
        withdrawalPermission: "NONE",
        accountAlias: input.accountAlias ?? null,
        authorizationReference: input.authorizationReference ?? null,
      })
      .where(eq(managedExecutionSlots.id, slot.id));
    await tx.insert(managedSessionEvents).values({
      sessionId: session.id,
      actorUserId: input.actorUserId,
      eventType: "EXECUTION_SLOT_REVIEWED",
      fromStatus: session.status,
      toStatus: session.status,
      payload: JSON.stringify({
        slotKey,
        connectionStatus: input.connectionStatus,
        tradePermission: input.tradePermission,
        withdrawalPermission: "NONE",
      }),
    });
  });
  return getManagedSessionByNo(sessionNo);
}

// ==================== 客户券商 USDT 入金账路 ====================

async function hydrateBrokerFundingIntent(database: any, row: any) {
  const events = await database
    .select()
    .from(managedBrokerFundingEvents)
    .where(eq(managedBrokerFundingEvents.fundingIntentId, row.id))
    .orderBy(
      asc(managedBrokerFundingEvents.createdAt),
      asc(managedBrokerFundingEvents.id),
    );
  return { ...row, events };
}

export async function createBrokerFundingIntent(
  session: any,
  slot: any,
  intentNo: string,
  expectedAmount: string,
) {
  const database = await getDb();
  if (!database) {
    return createMockBrokerFundingIntent(
      session,
      slot,
      intentNo,
      expectedAmount,
    );
  }
  await database.transaction(async (tx: any) => {
    await tx.insert(managedBrokerFundingIntents).values({
      intentNo,
      sessionId: session.id,
      slotId: slot.id,
      userId: session.userId,
      brokerId: slot.brokerId,
      status: "DRAFT",
      asset: "USDT",
      fundsRoute: session.fundsRoute,
      custodyProvider: "MANUAL",
      expectedAmount,
      screeningStatus:
        session.fundsRoute === "PLATFORM_COLLECTION" ? "PENDING" : null,
    });
    const rows = await tx
      .select({ id: managedBrokerFundingIntents.id })
      .from(managedBrokerFundingIntents)
      .where(eq(managedBrokerFundingIntents.intentNo, intentNo))
      .limit(1);
    if (!rows[0]?.id) throw new Error("无法创建券商入金记录");
    await tx.insert(managedBrokerFundingEvents).values({
      fundingIntentId: rows[0].id,
      sessionId: session.id,
      actorUserId: session.userId,
      eventType: "FUNDING_INTENT_CREATED",
      fromStatus: null,
      toStatus: "DRAFT",
      payload: JSON.stringify({
        fundsRoute: session.fundsRoute,
        asset: "USDT",
        externalTransferTriggered: false,
      }),
    });
  });
  return getBrokerFundingIntentByNo(intentNo);
}

export async function getBrokerFundingIntentByNo(intentNo: string) {
  const database = await getDb();
  if (!database) return getMockBrokerFundingIntent(intentNo);
  const rows = await database
    .select()
    .from(managedBrokerFundingIntents)
    .where(eq(managedBrokerFundingIntents.intentNo, intentNo))
    .limit(1);
  return rows[0]
    ? hydrateBrokerFundingIntent(database, rows[0])
    : null;
}

export async function listBrokerFundingIntents(input: {
  userId?: number;
  sessionId?: number;
  status?: string;
  fundsRoute?: string;
  limit?: number;
} = {}) {
  const database = await getDb();
  if (!database) return listMockBrokerFundingIntents(input);
  const conditions: any[] = [];
  if (input.userId !== undefined) {
    conditions.push(eq(managedBrokerFundingIntents.userId, input.userId));
  }
  if (input.sessionId !== undefined) {
    conditions.push(eq(managedBrokerFundingIntents.sessionId, input.sessionId));
  }
  if (input.status) {
    conditions.push(eq(managedBrokerFundingIntents.status, input.status as any));
  }
  if (input.fundsRoute) {
    conditions.push(
      eq(managedBrokerFundingIntents.fundsRoute, input.fundsRoute as any),
    );
  }
  const query = database.select().from(managedBrokerFundingIntents).$dynamic();
  const rows = conditions.length
    ? await query
        .where(and(...conditions))
        .orderBy(desc(managedBrokerFundingIntents.createdAt))
        .limit(input.limit ?? 100)
    : await query
        .orderBy(desc(managedBrokerFundingIntents.createdAt))
        .limit(input.limit ?? 100);
  return Promise.all(
    rows.map((row: any) => hydrateBrokerFundingIntent(database, row)),
  );
}

export async function findBrokerFundingByTransactionReference(value: string) {
  const database = await getDb();
  if (!database) return findMockBrokerFundingByTxHash(value);
  const rows = await database
    .select()
    .from(managedBrokerFundingIntents)
    .where(
      or(
        eq(managedBrokerFundingIntents.txHash, value),
        eq(managedBrokerFundingIntents.payoutTxHash, value),
        eq(managedBrokerFundingIntents.refundTxHash, value),
      ),
    )
    .limit(1);
  return rows[0]
    ? hydrateBrokerFundingIntent(database, rows[0])
    : null;
}

export async function transitionBrokerFundingIntent(
  intentNo: string,
  expectedFrom: string | string[],
  toStatus: string,
  actorUserId: number,
  eventType: string,
  patch: Record<string, unknown> = {},
  eventPayload: Record<string, unknown> = {},
) {
  const database = await getDb();
  if (!database) {
    return transitionMockBrokerFundingIntent(
      intentNo,
      expectedFrom,
      toStatus,
      actorUserId,
      eventType,
      patch,
      eventPayload,
    );
  }
  const existing = await getBrokerFundingIntentByNo(intentNo);
  if (!existing) return null;
  const expected = Array.isArray(expectedFrom) ? expectedFrom : [expectedFrom];
  await database.transaction(async (tx: any) => {
    const result = await tx
      .update(managedBrokerFundingIntents)
      .set({ ...patch, status: toStatus as any })
      .where(
        and(
          eq(managedBrokerFundingIntents.id, existing.id),
          inArray(managedBrokerFundingIntents.status, expected as any),
        ),
      );
    const affected = Number(
      (result as any)[0]?.affectedRows ?? (result as any).rowsAffected ?? 0,
    );
    if (affected === 0) {
      throw new Error("券商入金记录已被其他操作更新，请刷新后重试");
    }
    await tx.insert(managedBrokerFundingEvents).values({
      fundingIntentId: existing.id,
      sessionId: existing.sessionId,
      actorUserId,
      eventType,
      fromStatus: existing.status,
      toStatus,
      payload: Object.keys(eventPayload).length
        ? JSON.stringify(eventPayload)
        : null,
    });
  });
  return getBrokerFundingIntentByNo(intentNo);
}

export async function appendBrokerFundingAuditEvent(
  intentNo: string,
  actorUserId: number,
  eventType: string,
  patch: Record<string, unknown> = {},
  eventPayload: Record<string, unknown> = {},
) {
  const database = await getDb();
  if (!database) {
    return appendMockBrokerFundingAuditEvent(
      intentNo,
      actorUserId,
      eventType,
      patch,
      eventPayload,
    );
  }
  const existing = await getBrokerFundingIntentByNo(intentNo);
  if (!existing) return null;
  await database.transaction(async (tx: any) => {
    await tx
      .update(managedBrokerFundingIntents)
      .set(patch)
      .where(eq(managedBrokerFundingIntents.id, existing.id));
    await tx.insert(managedBrokerFundingEvents).values({
      fundingIntentId: existing.id,
      sessionId: existing.sessionId,
      actorUserId,
      eventType,
      fromStatus: existing.status,
      toStatus: existing.status,
      payload: Object.keys(eventPayload).length
        ? JSON.stringify(eventPayload)
        : null,
    });
  });
  return getBrokerFundingIntentByNo(intentNo);
}

export async function createCollectionAddress(input: {
  label: string;
  network: string;
  address: string;
  depositTag?: string | null;
  createdBy: number;
}) {
  const database = await getDb();
  if (!database) return createMockCollectionAddress(input);
  await database.insert(managedCollectionAddresses).values({
    ...input,
    asset: "USDT",
    status: "AVAILABLE",
  });
  const rows = await database
    .select()
    .from(managedCollectionAddresses)
    .where(
      and(
        eq(managedCollectionAddresses.network, input.network),
        eq(managedCollectionAddresses.address, input.address),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listCollectionAddresses(status?: string) {
  const database = await getDb();
  if (!database) return listMockCollectionAddresses(status);
  const query = database.select().from(managedCollectionAddresses).$dynamic();
  return status
    ? query
        .where(eq(managedCollectionAddresses.status, status as any))
        .orderBy(asc(managedCollectionAddresses.id))
    : query.orderBy(asc(managedCollectionAddresses.id));
}

export async function assignCollectionAddress(
  intentNo: string,
  addressId: number,
  actorUserId: number,
  instructionsExpireAt?: Date | null,
  eligibility?: {
    referenceHash: string;
    attestedAt: Date;
  },
) {
  const database = await getDb();
  if (!database) {
    return assignMockCollectionAddress(
      intentNo,
      addressId,
      actorUserId,
      instructionsExpireAt,
      eligibility,
    );
  }
  const intent = await getBrokerFundingIntentByNo(intentNo);
  if (!intent) return null;
  const rows = await database
    .select()
    .from(managedCollectionAddresses)
    .where(eq(managedCollectionAddresses.id, addressId))
    .limit(1);
  const address = rows[0];
  if (!address) return null;
  await database.transaction(async (tx: any) => {
    const reserve = await tx
      .update(managedCollectionAddresses)
      .set({
        status: "RESERVED",
        currentFundingIntentId: intent.id,
        reservedAt: new Date(),
      })
      .where(
        and(
          eq(managedCollectionAddresses.id, addressId),
          eq(managedCollectionAddresses.status, "AVAILABLE"),
          sql`${managedCollectionAddresses.currentFundingIntentId} IS NULL`,
        ),
      );
    const reserved = Number(
      (reserve as any)[0]?.affectedRows ?? (reserve as any).rowsAffected ?? 0,
    );
    if (reserved === 0) throw new Error("代收地址已被分配或不可用");
    const updateIntent = await tx
      .update(managedBrokerFundingIntents)
      .set({
        status: "READY_TO_FUND",
        collectionAddressId: address.id,
        instructionSource: "PLATFORM_ADDRESS_POOL",
        custodyProvider: "MANUAL",
        network: address.network,
        depositAddress: address.address,
        depositTag: address.depositTag,
        instructionsIssuedAt: new Date(),
        instructionsExpireAt: instructionsExpireAt ?? null,
        customerEligibilityReferenceHash:
          eligibility?.referenceHash ?? null,
        customerEligibilityAttestedBy: eligibility ? actorUserId : null,
        customerEligibilityAttestedAt: eligibility?.attestedAt ?? null,
      })
      .where(
        and(
          eq(managedBrokerFundingIntents.id, intent.id),
          eq(managedBrokerFundingIntents.status, "WAITING_INSTRUCTIONS"),
        ),
      );
    const updated = Number(
      (updateIntent as any)[0]?.affectedRows ??
        (updateIntent as any).rowsAffected ??
        0,
    );
    if (updated === 0) throw new Error("入金记录当前不能分配代收地址");
    await tx.insert(managedBrokerFundingEvents).values({
      fundingIntentId: intent.id,
      sessionId: intent.sessionId,
      actorUserId,
      eventType: "COLLECTION_ADDRESS_ASSIGNED",
      fromStatus: intent.status,
      toStatus: "READY_TO_FUND",
      payload: JSON.stringify({
        addressId,
        network: address.network,
        customerScopeAttested: Boolean(eligibility),
      }),
    });
  });
  return getBrokerFundingIntentByNo(intentNo);
}

export async function markCollectionAddressUsed(fundingIntentId: number) {
  const database = await getDb();
  if (!database) return markMockCollectionAddressUsed(fundingIntentId);
  await database
    .update(managedCollectionAddresses)
    .set({ status: "USED", usedAt: new Date() })
    .where(
      and(
        eq(managedCollectionAddresses.currentFundingIntentId, fundingIntentId),
        eq(managedCollectionAddresses.status, "RESERVED"),
      ),
    );
}

export async function getBrokerCollectionApproval(brokerId: string) {
  const database = await getDb();
  if (!database) return getMockCollectionApproval(brokerId);
  const rows = await database
    .select()
    .from(managedBrokerCollectionApprovals)
    .where(eq(managedBrokerCollectionApprovals.brokerId, brokerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listBrokerCollectionApprovals() {
  const database = await getDb();
  if (!database) return listMockCollectionApprovals();
  return database
    .select()
    .from(managedBrokerCollectionApprovals)
    .orderBy(asc(managedBrokerCollectionApprovals.brokerId));
}

export async function upsertBrokerCollectionApproval(input: any) {
  const database = await getDb();
  if (!database) return upsertMockCollectionApproval(input);
  await database
    .insert(managedBrokerCollectionApprovals)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        status: input.status,
        approvalReferenceHash: input.approvalReferenceHash,
        allowedNetworks: input.allowedNetworks,
        minimumAmount: input.minimumAmount,
        maximumAmount: input.maximumAmount,
        reviewedBy: input.reviewedBy,
        approvedAt: input.approvedAt,
        note: input.note,
      },
    });
  return getBrokerCollectionApproval(input.brokerId);
}
