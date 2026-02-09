import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, index, boolean, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
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

// EA策略表 - 简化版
export const strategies = mysqlTable("strategies", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  platform: mysqlEnum("platform", ["MT4", "MT5"]).notNull(),
  pairs: text("pairs").notNull(), // 交易对,逗号分隔
  timeframe: varchar("timeframe", { length: 50 }),
  coverImage: text("coverImage"),
  
  // 实盘数据
  totalReturn: decimal("totalReturn", { precision: 10, scale: 2 }).default("0.00"),
  maxDrawdown: decimal("maxDrawdown", { precision: 10, scale: 2 }).default("0.00"),
  sharpeRatio: decimal("sharpeRatio", { precision: 10, scale: 2 }).default("0.00"),
  winRate: decimal("winRate", { precision: 5, scale: 2 }).default("0.00"),
  
  // 下载和付费
  downloadUrl: text("downloadUrl"), // 下载链接
  price: decimal("price", { precision: 10, scale: 2 }).default("0.00"), // 价格,0为免费
  isFree: boolean("isFree").default(true).notNull(), // 是否免费
  downloadCount: int("downloadCount").default(0).notNull(),
  
  // 联系方式
  telegramGroup: varchar("telegramGroup", { length: 255 }), // Telegram群组
  qqGroup: varchar("qqGroup", { length: 255 }), // QQ群号
  
  // 统计
  viewCount: int("viewCount").default(0).notNull(),
  
  // 状态
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("published").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  platformIdx: index("platform_idx").on(table.platform),
  statusIdx: index("status_idx").on(table.status),
  totalReturnIdx: index("totalReturn_idx").on(table.totalReturn),
}));

export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = typeof strategies.$inferInsert;

// 交易记录表(实盘数据)
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

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

// 回测数据表(每日权益曲线)
export const backtestData = mysqlTable("backtest_data", {
  id: int("id").autoincrement().primaryKey(),
  strategyId: int("strategyId").notNull(),
  date: date("date").notNull(), // 交易日期
  equity: decimal("equity", { precision: 15, scale: 2 }).notNull(), // 当日权益
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull(), // 当日余额
  profit: decimal("profit", { precision: 15, scale: 2 }).notNull(), // 当日盈亏
  drawdown: decimal("drawdown", { precision: 10, scale: 2 }).notNull(), // 当日回撤
  tradesCount: int("tradesCount").default(0).notNull(), // 当日交易次数
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  dateIdx: index("date_idx").on(table.date),
  strategyDateIdx: index("strategy_date_idx").on(table.strategyId, table.date),
}));

export type BacktestData = typeof backtestData.$inferSelect;
export type InsertBacktestData = typeof backtestData.$inferInsert;

// 用户购买记录表
export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  strategyId: int("strategyId").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  userStrategyIdx: index("user_strategy_idx").on(table.userId, table.strategyId),
}));

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = typeof purchases.$inferInsert;

// 下载记录表
export const downloads = mysqlTable("downloads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  strategyId: int("strategyId").notNull(),
  downloadedAt: timestamp("downloadedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
}));

export type Download = typeof downloads.$inferSelect;
export type InsertDownload = typeof downloads.$inferInsert;

// 评论表(策略备注)
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  strategyId: int("strategyId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
}));

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// 匿名留言表(用户可匿名评论策略)
export const anonymousComments = mysqlTable("anonymous_comments", {
  id: int("id").autoincrement().primaryKey(),
  strategyId: int("strategyId").notNull(),
  nickname: varchar("nickname", { length: 100 }), // 匿名昵称(可选)
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  createdAtIdx: index("createdAt_idx").on(table.createdAt),
}));

export type AnonymousComment = typeof anonymousComments.$inferSelect;
export type InsertAnonymousComment = typeof anonymousComments.$inferInsert;

// 上架EA申请表(客户主动留联系方式)
export const listingRequests = mysqlTable("listing_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // 姓名
  contact: varchar("contact", { length: 255 }).notNull(), // 联系方式(Telegram/QQ/微信/邮箱)
  eaName: varchar("eaName", { length: 255 }).notNull(), // EA名称
  eaDescription: text("eaDescription"), // EA描述
  status: mysqlEnum("status", ["pending", "contacted", "rejected"]).default("pending").notNull(),
  notes: text("notes"), // 管理员备注
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("status_idx").on(table.status),
  createdAtIdx: index("createdAt_idx").on(table.createdAt),
}));

export type ListingRequest = typeof listingRequests.$inferSelect;
export type InsertListingRequest = typeof listingRequests.$inferInsert;

// 合购表(用户发起合购,平台展示进度和联系方式)
export const groupBuys = mysqlTable("group_buys", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(), // 合购标题
  eaName: varchar("eaName", { length: 255 }).notNull(), // EA名称
  description: text("description"), // 合购描述
  targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }).notNull(), // 目标价格
  currentParticipants: int("currentParticipants").default(0).notNull(), // 当前参与人数
  targetParticipants: int("targetParticipants").notNull(), // 目标参与人数
  pricePerPerson: decimal("pricePerPerson", { precision: 10, scale: 2 }).notNull(), // 人均价格
  contactInfo: varchar("contactInfo", { length: 255 }).notNull(), // 联系方式(Telegram/QQ/微信)
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  expiresAt: timestamp("expiresAt"), // 过期时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("status_idx").on(table.status),
  createdAtIdx: index("createdAt_idx").on(table.createdAt),
}));

export type GroupBuy = typeof groupBuys.$inferSelect;
export type InsertGroupBuy = typeof groupBuys.$inferInsert;
