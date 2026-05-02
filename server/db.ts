import { eq, and, desc, asc, sql, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

const { users, strategies, trades, comments, purchases, downloads, anonymousComments, listingRequests, groupBuys, notifications, siteSettings, backtestData: backtestDataTable, cooperationCards, cooperationPlans, promoProducts, verificationCodes, userFavorites, categories, orders, payments } = schema;

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
  orderBy?: "latest" | "popular" | "return" | "hot";
  tag?: string;
  productType?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  try {
    // 尝试使用新字段查询（含标签筛选、产品类型筛选、旗舰置顶）
    const conditions: any[] = [eq(strategies.status, "published")];
    if (params.platform) conditions.push(eq(strategies.platform, params.platform));
    if (params.tag) {
      // 精确匹配标签：使用 FIND_IN_SET 避免部分匹配（如"黄金"匹配"超级黄金"）
      conditions.push(sql`FIND_IN_SET(${params.tag}, REPLACE(${strategies.tags}, ' ', '')) > 0`);
    }
    if (params.productType) conditions.push(eq(strategies.productType, params.productType));

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
      .orderBy(desc(strategies.isFeatured), orderByColumn)
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
            ? desc(sql`${strategies.viewCount} + ${strategies.virtualSubscribers} * 10`)
            : desc(strategies.createdAt);

    return db
      .select()
      .from(strategies)
      .where(whereConditions)
      .orderBy(orderByColumn)
      .limit(params.limit || 20)
      .offset(params.offset || 0);
  }
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
  if (!db) return null;

  const { emailSubscriptions } = schema;
  const email = input.email?.trim() || null;
  const contactInfo = input.contactInfo?.trim() || null;
  
  if (!email && !contactInfo) {
    return { success: false, message: "请至少填写一种联系方式" };
  }

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

// ========== 合作方案页 ==========

// 获取可见的合作展示卡片
export async function getCooperationCards() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cooperationCards)
    .where(eq(cooperationCards.isVisible, true))
    .orderBy(asc(cooperationCards.sortOrder));
}

// 获取所有合作展示卡片（管理员）
export async function getAllCooperationCards() {
  const db = await getDb();
  if (!db) return [];
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
  if (!db) return [];
  return db.select().from(cooperationPlans)
    .where(eq(cooperationPlans.isVisible, true))
    .orderBy(asc(cooperationPlans.sortOrder));
}

// 获取所有合作模式（管理员）
export async function getAllCooperationPlans() {
  const db = await getDb();
  if (!db) return [];
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
  if (!db) return [];
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
  if (!db) return null;
  const result = await db.select().from(promoProducts).where(eq(promoProducts.id, id)).limit(1);
  return result[0] || null;
}

// 获取所有促销商品（管理员）
export async function getAllPromoProducts() {
  const db = await getDb();
  if (!db) return [];
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
  if (!db) return [];
  return db
    .select()
    .from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(categories.sortOrder);
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return rows[0] || null;
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return null;
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
  if (!db) throw new Error("DB not available");
  await db.insert(orders).values(data);
  return getOrderByOrderNo(data.orderNo);
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] || null;
}

export async function getOrderByOrderNo(orderNo: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1);
  return rows[0] || null;
}

export async function getUserOrders(userId: number, opts?: { limit?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
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
  if (!db) return [];
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
  if (!db) throw new Error("DB not available");
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

export async function cancelOrder(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
}

export async function expireStaleOrders(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
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
  if (!db) throw new Error("DB not available");
  await db.insert(payments).values(data);
}

export async function updatePayment(id: number, data: Partial<typeof payments.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(payments).set(data).where(eq(payments.id, id));
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return rows[0] || null;
}

export async function getPaymentsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt));
}

export async function getActivePaymentByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function listPendingUsdtPayments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.gateway, "usdt-manual"),
        eq(payments.status, "pending")
      )
    )
    .orderBy(desc(payments.createdAt));
}

// ==================== Bundle B: 购买权限 / 下载记录 / Profile 编辑 ====================

export async function hasUserPurchased(userId: number, strategyId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
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
  if (paidOrders.length > 0) return true;
  const purchaseRows = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.strategyId, strategyId)))
    .limit(1);
  return purchaseRows.length > 0;
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



// ==================== Bundle B additions ====================
export async function hasUserPurchased(userId: number, strategyId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // 检查新订单系统
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
  if (paidOrders.length > 0) return true;

  // 检查旧 purchases 表（向后兼容）
  const purchaseRows = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.strategyId, strategyId)))
    .limit(1);
  return purchaseRows.length > 0;
}

/**
 * 记录下载（用于统计）
 *
 * 写入 downloads 表 + 更新 strategies.downloadCount。
 * 已存在的下载记录（同用户同策略）不重复增加 count。
 */
export async function recordDownload(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) return;

  // 检查是否已记录过下载
  const existing = await db
    .select()
    .from(downloads)
    .where(and(eq(downloads.userId, userId), eq(downloads.strategyId, strategyId)))
    .limit(1);

  if (existing.length === 0) {
    // 首次下载：写记录 + 增加计数
    await db.insert(downloads).values({
      userId,
      strategyId,
      downloadedAt: new Date(),
    });

    // 更新 strategies.downloadCount + 1
    const strategy = await getStrategyById(strategyId);
    if (strategy) {
      await db
        .update(strategies)
        .set({ downloadCount: (strategy.downloadCount || 0) + 1 })
        .where(eq(strategies.id, strategyId));
    }
  }
}

// ==================== Profile 编辑 ====================

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
  targetType: string;
  purpose: string;
  ip?: string;
}): Promise<{ ok: boolean; code?: string; error?: string }> {
  const { createVerificationCode: _create } = await import("./_core/verification");
  return _create(opts);
}
