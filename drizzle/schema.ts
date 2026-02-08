import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  bio: text("bio"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 策略表
export const strategies = mysqlTable("strategies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  platform: mysqlEnum("platform", ["MT4", "MT5"]).notNull(),
  pairs: text("pairs").notNull(), // JSON array of trading pairs
  timeframe: varchar("timeframe", { length: 50 }),
  coverImage: text("coverImage"),
  totalReturn: decimal("totalReturn", { precision: 10, scale: 2 }).default("0.00"),
  maxDrawdown: decimal("maxDrawdown", { precision: 10, scale: 2 }).default("0.00"),
  sharpeRatio: decimal("sharpeRatio", { precision: 10, scale: 2 }).default("0.00"),
  winRate: decimal("winRate", { precision: 5, scale: 2 }).default("0.00"),
  followCount: int("followCount").default(0).notNull(),
  favoriteCount: int("favoriteCount").default(0).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  avgRating: decimal("avgRating", { precision: 3, scale: 2 }).default("0.00"),
  ratingCount: int("ratingCount").default(0).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  platformIdx: index("platform_idx").on(table.platform),
  statusIdx: index("status_idx").on(table.status),
  avgRatingIdx: index("avgRating_idx").on(table.avgRating),
  totalReturnIdx: index("totalReturn_idx").on(table.totalReturn),
}));

// 评分表
export const ratings = mysqlTable("ratings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  strategyId: int("strategyId").notNull(),
  score: int("score").notNull(), // 1-5 stars
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userStrategyIdx: index("user_strategy_idx").on(table.userId, table.strategyId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
}));

// 评论表
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  strategyId: int("strategyId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  userIdIdx: index("userId_idx").on(table.userId),
}));

// 关注表
export const follows = mysqlTable("follows", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  strategyId: int("strategyId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userStrategyIdx: index("user_strategy_idx").on(table.userId, table.strategyId),
  userIdIdx: index("userId_idx").on(table.userId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
}));

// 收藏表
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  strategyId: int("strategyId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userStrategyIdx: index("user_strategy_idx").on(table.userId, table.strategyId),
  userIdIdx: index("userId_idx").on(table.userId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
}));

// 交易记录表
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  strategyId: int("strategyId").notNull(),
  pair: varchar("pair", { length: 20 }).notNull(),
  direction: mysqlEnum("direction", ["buy", "sell"]).notNull(),
  openTime: timestamp("openTime").notNull(),
  closeTime: timestamp("closeTime"),
  openPrice: decimal("openPrice", { precision: 20, scale: 8 }).notNull(),
  closePrice: decimal("closePrice", { precision: 20, scale: 8 }),
  volume: decimal("volume", { precision: 10, scale: 2 }).notNull(),
  profit: decimal("profit", { precision: 15, scale: 2 }),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  statusIdx: index("status_idx").on(table.status),
  openTimeIdx: index("openTime_idx").on(table.openTime),
}));

export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = typeof strategies.$inferInsert;

export type Rating = typeof ratings.$inferSelect;
export type InsertRating = typeof ratings.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

export type Follow = typeof follows.$inferSelect;
export type InsertFollow = typeof follows.$inferInsert;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;
