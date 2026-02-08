import { eq, desc, and, sql, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  strategies,
  ratings,
  comments,
  follows,
  favorites,
  trades,
  type InsertStrategy,
  type InsertRating,
  type InsertComment,
  type InsertFollow,
  type InsertFavorite,
  type InsertTrade,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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
    params.orderBy === "popular" ? desc(strategies.followCount) :
    params.orderBy === "return" ? desc(strategies.totalReturn) :
    desc(strategies.createdAt);

  const query = db
    .select({
      id: strategies.id,
      userId: strategies.userId,
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
      followCount: strategies.followCount,
      favoriteCount: strategies.favoriteCount,
      viewCount: strategies.viewCount,
      avgRating: strategies.avgRating,
      ratingCount: strategies.ratingCount,
      status: strategies.status,
      createdAt: strategies.createdAt,
      updatedAt: strategies.updatedAt,
      author: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
      },
    })
    .from(strategies)
    .leftJoin(users, eq(strategies.userId, users.id))
    .where(whereConditions)
    .orderBy(orderByColumn)
    .limit(params.limit || 20)
    .offset(params.offset || 0);

  return query;
}

export async function getStrategyById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      id: strategies.id,
      userId: strategies.userId,
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
      followCount: strategies.followCount,
      favoriteCount: strategies.favoriteCount,
      viewCount: strategies.viewCount,
      avgRating: strategies.avgRating,
      ratingCount: strategies.ratingCount,
      status: strategies.status,
      createdAt: strategies.createdAt,
      updatedAt: strategies.updatedAt,
      author: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
        bio: users.bio,
      },
    })
    .from(strategies)
    .leftJoin(users, eq(strategies.userId, users.id))
    .where(eq(strategies.id, id))
    .limit(1);

  return result[0] || null;
}

export async function createStrategy(data: InsertStrategy) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(strategies).values(data);
  return Number(result[0].insertId);
}

export async function updateStrategy(id: number, data: Partial<InsertStrategy>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(strategies).set(data).where(eq(strategies.id, id));
}

export async function deleteStrategy(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(strategies).where(eq(strategies.id, id));
}

export async function incrementStrategyViewCount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(strategies)
    .set({ viewCount: sql`${strategies.viewCount} + 1` })
    .where(eq(strategies.id, id));
}

export async function searchStrategies(keyword: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: strategies.id,
      userId: strategies.userId,
      title: strategies.title,
      description: strategies.description,
      platform: strategies.platform,
      totalReturn: strategies.totalReturn,
      avgRating: strategies.avgRating,
      followCount: strategies.followCount,
      author: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
      },
    })
    .from(strategies)
    .leftJoin(users, eq(strategies.userId, users.id))
    .where(
      and(
        eq(strategies.status, "published"),
        or(
          like(strategies.title, `%${keyword}%`),
          like(strategies.description, `%${keyword}%`)
        )
      )
    )
    .limit(limit);
}

// ========== 评分相关 ==========

export async function getUserRating(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.strategyId, strategyId)))
    .limit(1);

  return result[0] || null;
}

export async function createOrUpdateRating(data: InsertRating) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserRating(data.userId, data.strategyId);

  if (existing) {
    await db
      .update(ratings)
      .set({ score: data.score, updatedAt: new Date() })
      .where(eq(ratings.id, existing.id));
  } else {
    await db.insert(ratings).values(data);
  }

  await updateStrategyAvgRating(data.strategyId);
}

async function updateStrategyAvgRating(strategyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      avg: sql<number>`AVG(${ratings.score})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(ratings)
    .where(eq(ratings.strategyId, strategyId));

  const stats = result[0];
  if (stats) {
    await db
      .update(strategies)
      .set({
        avgRating: stats.avg.toFixed(2),
        ratingCount: stats.count,
      })
      .where(eq(strategies.id, strategyId));
  }
}

export async function getRatingDistribution(strategyId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      score: ratings.score,
      count: sql<number>`COUNT(*)`,
    })
    .from(ratings)
    .where(eq(ratings.strategyId, strategyId))
    .groupBy(ratings.score)
    .orderBy(desc(ratings.score));
}

// ========== 评论相关 ==========

export async function getComments(strategyId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: comments.id,
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
    .limit(limit)
    .offset(offset);
}

export async function createComment(data: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(comments).values(data);
  return Number(result[0].insertId);
}

export async function deleteComment(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(comments).where(and(eq(comments.id, id), eq(comments.userId, userId)));
}

// ========== 关注相关 ==========

export async function isFollowing(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.strategyId, strategyId)))
    .limit(1);

  return result.length > 0;
}

export async function followStrategy(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await isFollowing(userId, strategyId);
  if (existing) return;

  await db.insert(follows).values({ userId, strategyId });

  await db
    .update(strategies)
    .set({ followCount: sql`${strategies.followCount} + 1` })
    .where(eq(strategies.id, strategyId));
}

export async function unfollowStrategy(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(follows).where(and(eq(follows.userId, userId), eq(follows.strategyId, strategyId)));

  await db
    .update(strategies)
    .set({ followCount: sql`${strategies.followCount} - 1` })
    .where(eq(strategies.id, strategyId));
}

export async function getFollowedStrategies(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: strategies.id,
      title: strategies.title,
      platform: strategies.platform,
      totalReturn: strategies.totalReturn,
      avgRating: strategies.avgRating,
      updatedAt: strategies.updatedAt,
      author: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
      },
    })
    .from(follows)
    .innerJoin(strategies, eq(follows.strategyId, strategies.id))
    .leftJoin(users, eq(strategies.userId, users.id))
    .where(eq(follows.userId, userId))
    .orderBy(desc(strategies.updatedAt))
    .limit(limit)
    .offset(offset);
}

// ========== 收藏相关 ==========

export async function isFavorited(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.strategyId, strategyId)))
    .limit(1);

  return result.length > 0;
}

export async function favoriteStrategy(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await isFavorited(userId, strategyId);
  if (existing) return;

  await db.insert(favorites).values({ userId, strategyId });

  await db
    .update(strategies)
    .set({ favoriteCount: sql`${strategies.favoriteCount} + 1` })
    .where(eq(strategies.id, strategyId));
}

export async function unfavoriteStrategy(userId: number, strategyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.strategyId, strategyId)));

  await db
    .update(strategies)
    .set({ favoriteCount: sql`${strategies.favoriteCount} - 1` })
    .where(eq(strategies.id, strategyId));
}

export async function getFavoritedStrategies(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: strategies.id,
      title: strategies.title,
      platform: strategies.platform,
      totalReturn: strategies.totalReturn,
      avgRating: strategies.avgRating,
      author: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
      },
    })
    .from(favorites)
    .innerJoin(strategies, eq(favorites.strategyId, strategies.id))
    .leftJoin(users, eq(strategies.userId, users.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt))
    .limit(limit)
    .offset(offset);
}

// ========== 交易记录相关 ==========

export async function getTrades(strategyId: number, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(trades)
    .where(eq(trades.strategyId, strategyId))
    .orderBy(desc(trades.openTime))
    .limit(limit)
    .offset(offset);
}

export async function createTrade(data: InsertTrade) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(trades).values(data);
  return Number(result[0].insertId);
}

export async function getTradeStats(strategyId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      totalTrades: sql<number>`COUNT(*)`,
      winningTrades: sql<number>`SUM(CASE WHEN ${trades.profit} > 0 THEN 1 ELSE 0 END)`,
      totalProfit: sql<number>`SUM(${trades.profit})`,
    })
    .from(trades)
    .where(and(eq(trades.strategyId, strategyId), eq(trades.status, "closed")));

  return result[0] || null;
}

// ========== 用户相关 ==========

export async function getUserStrategies(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(strategies)
    .where(eq(strategies.userId, userId))
    .orderBy(desc(strategies.createdAt));
}

export async function updateUserProfile(userId: number, data: { name?: string; bio?: string; avatar?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(data).where(eq(users.id, userId));
}
