import { eq, and, desc, sql, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

const { users, strategies, trades, comments, purchases, downloads, anonymousComments, listingRequests, groupBuys, notifications, siteSettings } = schema;

let pool: mysql.Pool | null = null;
let db: any = null;

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

async function getDb() {
  try {
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
  orderBy?: "latest" | "popular" | "return";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const whereConditions = params.platform
    ? and(eq(strategies.status, "published"), eq(strategies.platform, params.platform))
    : eq(strategies.status, "published");

  const orderByColumn =
    params.orderBy === "popular"
      ? desc(strategies.downloadCount)
      : params.orderBy === "return"
        ? desc(strategies.totalReturn)
        : desc(strategies.createdAt);

  const query = db
    .select()
    .from(strategies)
    .where(whereConditions)
    .orderBy(orderByColumn)
    .limit(params.limit || 20)
    .offset(params.offset || 0);

  return query;
}

export async function getStrategyById(id: number) {
  const db = await getDb();
  if (!db) return null;

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
  if (!db) return [];

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
  if (!db) return [];

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
  if (!db) return null;

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
  if (!db) return null;

  const result = await db.insert(strategies).values(data);
  // 返回插入的策略对象
  const insertId = result[0].insertId;
  return getStrategyById(insertId);
}

export async function updateStrategy(id: number, data: Partial<typeof strategies.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;

  await db.update(strategies).set(data).where(eq(strategies.id, id));
  return getStrategyById(id);
}

export async function deleteStrategy(id: number) {
  const db = await getDb();
  if (!db) return null;

  await db.delete(strategies).where(eq(strategies.id, id));
  return true;
}

export async function getAllStrategies(params: {
  status?: "draft" | "published" | "archived";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

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
  if (!db) return [];

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
  if (!db) return null;

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
  if (!db) return [];

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

// ========== 匿名留言相关 ==========

export async function getAnonymousComments(strategyId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

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
  if (!db) return [];

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
  if (!db) return null;

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
  if (!db) return [];

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
  if (!db) return null;

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


// ========== 邮箱订阅相关 ==========

export async function createEmailSubscription(email: string) {
  const db = await getDb();
  if (!db) return null;

  const { emailSubscriptions } = schema;
  
  // 检查是否已存在
  const existing = await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.email, email)).limit(1);
  if (existing.length > 0) {
    // 如果已存在但已取消，重新激活
    if (!existing[0].isActive) {
      await db.update(emailSubscriptions).set({ isActive: true }).where(eq(emailSubscriptions.id, existing[0].id));
      return { success: true, message: "已重新订阅" };
    }
    return { success: false, message: "该邮箱已订阅" };
  }

  await db.insert(emailSubscriptions).values({ email });
  return { success: true, message: "订阅成功" };
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
  if (!db) return [];

  return db.select().from(siteSettings);
}

export async function getSiteSetting(key: string) {
  const db = await getDb();
  if (!db) return null;

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
  if (!db) return {};

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
  if (!db) return [];
  return db.select().from(groupBuys).orderBy(desc(groupBuys.createdAt)).limit(limit).offset(offset);
}

// ========== 上架申请管理（Admin） ==========
export async function deleteListingRequest(id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(listingRequests).where(eq(listingRequests.id, id));
  return { success: true };
}
