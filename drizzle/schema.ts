import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, index, boolean, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
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
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }), // 原价（用于划线价展示）
  isFree: boolean("isFree").default(true).notNull(), // 是否免费
  downloadCount: int("downloadCount").default(0).notNull(),
  
  // 产品分类与标签
  productType: varchar("productType", { length: 20 }).default("ea").notNull(), // ea | indicator | tool
  tags: text("tags"), // 逗号分隔标签，如 "马丁,对冲,黄金"
  
  // 图片画廊（JSON数组，存储多张实盘/回测截图URL）
  galleryImages: text("galleryImages"), // JSON数组字符串
  
  // 旗舰/置顶标记
  isFeatured: boolean("isFeatured").default(false).notNull(), // 是否为旗舰推荐
  featuredLink: text("featuredLink"), // 旗舰产品外部跳转链接（如 ddxau.com）
  
  // 联系方式
  telegramGroup: varchar("telegramGroup", { length: 255 }), // Telegram群组
  qqGroup: varchar("qqGroup", { length: 255 }), // QQ群号
  
  // 虚拟数据（前端显示 = 实际值 + 虚拟值）
  virtualSubscribers: int("virtualSubscribers").default(0).notNull(), // 虚拟订阅数
  virtualDownloads: int("virtualDownloads").default(0).notNull(), // 虚拟下载量
  
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
  isApproved: boolean("isApproved").default(false).notNull(), // 审核状态
  rating: int("rating"), // 可选评分（1-5）
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
  coverImage: text("coverImage"), // 合购封面图
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

// 邮箱订阅表
export const emailSubscriptions = mysqlTable("email_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
}));

export type EmailSubscription = typeof emailSubscriptions.$inferSelect;
export type InsertEmailSubscription = typeof emailSubscriptions.$inferInsert;

// 订阅页面自定义内容（后台管理）
export const pageContents = mysqlTable("page_contents", {
  id: int("id").autoincrement().primaryKey(),
  pageKey: varchar("pageKey", { length: 100 }).notNull(), // e.g. "subscribe_page", "moments_page"
  sectionKey: varchar("sectionKey", { length: 100 }).notNull(), // e.g. "tech_support", "cooperation", "announcement"
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  icon: varchar("icon", { length: 50 }), // emoji icon
  sortOrder: int("sortOrder").default(0).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  pageKeyIdx: index("pageKey_idx").on(table.pageKey),
  sectionKeyIdx: index("sectionKey_idx").on(table.sectionKey),
}));

export type PageContent = typeof pageContents.$inferSelect;
export type InsertPageContent = typeof pageContents.$inferInsert;

// 通知/公告表
export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: varchar("type", { length: 50 }).default("info").notNull(), // info, warning, success, promo
  icon: varchar("icon", { length: 50 }),
  link: varchar("link", { length: 500 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// 站点设置表（联系方式等）
export const siteSettings = mysqlTable("site_settings", {
  id: int("id").primaryKey().autoincrement(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  description: varchar("description", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

// ==================== 合作方案页 ====================
// 合作展示卡片（后台高度可定制，每张卡片=标题+文本+图片+观摩说明）
export const cooperationCards = mysqlTable("cooperation_cards", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(), // 卡片标题，如"极限黄金对冲 Pro"
  subtitle: varchar("subtitle", { length: 255 }), // 副标题/一句话亮点
  description: text("description"), // 详细描述（支持多行）
  coverImage: text("coverImage"), // 封面图URL
  galleryImages: text("galleryImages"), // JSON数组，观摩截图URLs
  badge: varchar("badge", { length: 50 }), // 标签，如"热门"/"零爆仓"/"主力"
  badgeColor: varchar("badgeColor", { length: 20 }).default("gold"), // 标签颜色
  strategyType: varchar("strategyType", { length: 50 }), // 策略类型，如"对冲策略"/"网格策略"
  platform: varchar("platform", { length: 20 }), // MT4/MT5/MT4&MT5
  observeNote: text("observeNote"), // 观摩说明（如何获取观摩账户等）
  contactInfo: text("contactInfo"), // 联系方式说明
  sortOrder: int("sortOrder").default(0).notNull(), // 排序
  isVisible: boolean("isVisible").default(true).notNull(), // 是否显示
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sortOrderIdx: index("sortOrder_idx").on(table.sortOrder),
  isVisibleIdx: index("isVisible_idx").on(table.isVisible),
}));

export type CooperationCard = typeof cooperationCards.$inferSelect;
export type InsertCooperationCard = typeof cooperationCards.$inferInsert;

// 合作模式配置（试用/授权/源码买断，后台可编辑价格和权益）
export const cooperationPlans = mysqlTable("cooperation_plans", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 100 }).notNull(), // 如"试用合作"/"策略授权"/"源码买断"
  badge: varchar("badge", { length: 50 }), // 如"零门槛"/"推荐"
  price: varchar("price", { length: 100 }), // 如"免费"/"¥1,000/月"/"¥9,800起"
  priceNote: varchar("priceNote", { length: 100 }), // 价格补充说明，如"¥2,500/年"
  features: text("features"), // JSON数组，权益列表
  sortOrder: int("sortOrder").default(0).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CooperationPlan = typeof cooperationPlans.$inferSelect;
export type InsertCooperationPlan = typeof cooperationPlans.$inferInsert;

// ==================== 限时促销商城页 ====================
// 促销商品表（参考1mt5跳蚤市场）
export const promoProducts = mysqlTable("promo_products", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(), // 商品标题
  description: text("description"), // 商品描述
  coverImage: text("coverImage"), // 封面图
  galleryImages: text("galleryImages"), // JSON数组，详情图
  platform: varchar("platform", { length: 20 }), // MT4/MT5
  category: varchar("category", { length: 50 }).default("ea").notNull(), // ea/indicator/tool/course
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }).notNull(), // 原价
  promoPrice: decimal("promoPrice", { precision: 10, scale: 2 }).notNull(), // 促销价
  promoLabel: varchar("promoLabel", { length: 50 }), // 促销标签，如"限时特价"/"新品首发"/"爆款"
  promoEndTime: timestamp("promoEndTime"), // 促销结束时间（用于倒计时）
  detailContent: text("detailContent"), // 弹窗详细说明（富文本/markdown）
  paymentInfo: text("paymentInfo"), // 支付说明（如何购买、联系方式）
  contactInfo: text("contactInfo"), // 联系方式
  stock: int("stock").default(-1).notNull(), // 库存，-1为无限
  soldCount: int("soldCount").default(0).notNull(), // 已售数量
  sortOrder: int("sortOrder").default(0).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  status: mysqlEnum("status", ["active", "expired", "soldout"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("status_idx").on(table.status),
  categoryIdx: index("category_idx").on(table.category),
  sortOrderIdx: index("sortOrder_idx").on(table.sortOrder),
}));

export type PromoProduct = typeof promoProducts.$inferSelect;
export type InsertPromoProduct = typeof promoProducts.$inferInsert;
