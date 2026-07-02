type StrategyRecord = any;
type CommentRecord = any;
type OrderRecord = any;
type PaymentRecord = any;

const now = Date.now();

let mockStrategies: StrategyRecord[] = [
  {
    id: 1,
    title: "黄金智能交易系统",
    description: "专注于黄金市场的AI驱动交易系统，内置风险管理模块，适合稳健型投资者。",
    platform: "MT4",
    pairs: "XAUUSD",
    timeframe: "H1",
    coverImage: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3",
    totalReturn: "156.80",
    maxDrawdown: "12.30",
    sharpeRatio: "2.45",
    winRate: "68.50",
    downloadUrl: "https://example.com/mock/gold-ea.zip",
    price: "0.00",
    originalPrice: null,
    isFree: true,
    downloadCount: 1250,
    productType: "ea",
    tags: "黄金,趋势,稳健",
    saleMode: "direct",
    richDescription: "<h2>核心特点</h2><p>本地预览样例数据，不影响线上真实数据库。</p>",
    galleryImages: JSON.stringify([
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3",
      "https://images.unsplash.com/photo-1642790106117-e829e14a795f",
    ]),
    isFeatured: true,
    featuredLink: null,
    telegramGroup: "@GoldTradingEA",
    qqGroup: "123456789",
    virtualSubscribers: 128,
    virtualDownloads: 320,
    viewCount: 3200,
    status: "published",
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 2),
    updatedAt: new Date(now - 1000 * 60 * 60 * 8),
  },
  {
    id: 2,
    title: "欧美剥头皮专家",
    description: "专为 EURUSD 设计的短线策略，适合低点差账户和 VPS 环境。",
    platform: "MT5",
    pairs: "EURUSD",
    timeframe: "M5",
    coverImage: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44",
    totalReturn: "89.40",
    maxDrawdown: "8.60",
    sharpeRatio: "1.95",
    winRate: "72.30",
    downloadUrl: null,
    price: "399.00",
    originalPrice: "699.00",
    isFree: false,
    downloadCount: 856,
    productType: "ea",
    tags: "剥头皮,短线,EURUSD",
    saleMode: "direct",
    richDescription: null,
    galleryImages: null,
    isFeatured: false,
    featuredLink: null,
    telegramGroup: "@EURUSDScalper",
    qqGroup: "987654321",
    virtualSubscribers: 42,
    virtualDownloads: 120,
    viewCount: 2100,
    status: "published",
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 5),
    updatedAt: new Date(now - 1000 * 60 * 60 * 12),
  },
  {
    id: 3,
    title: "多货币网格交易机器人",
    description: "支持多货币对的区间网格策略，适合震荡行情。",
    platform: "MT4",
    pairs: "EURUSD,GBPUSD,USDJPY,AUDUSD",
    timeframe: "H4",
    coverImage: "https://images.unsplash.com/photo-1642790106117-e829e14a795f",
    totalReturn: "234.60",
    maxDrawdown: "15.80",
    sharpeRatio: "3.12",
    winRate: "65.80",
    downloadUrl: null,
    price: "599.00",
    originalPrice: "899.00",
    isFree: false,
    downloadCount: 642,
    productType: "tool",
    tags: "网格,多货币,震荡",
    saleMode: "inquiry",
    richDescription: null,
    galleryImages: null,
    isFeatured: false,
    featuredLink: null,
    telegramGroup: "@GridTradingBot",
    qqGroup: "456789123",
    virtualSubscribers: 75,
    virtualDownloads: 96,
    viewCount: 1850,
    status: "published",
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 9),
    updatedAt: new Date(now - 1000 * 60 * 60 * 30),
  },
  {
    id: 4,
    title: "AI深度学习交易指标",
    description: "用于辅助判断趋势强弱和入场区间的 MT5 指标样例。",
    platform: "MT5",
    pairs: "XAUUSD,EURUSD",
    timeframe: "H1",
    coverImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0",
    totalReturn: "112.50",
    maxDrawdown: "9.20",
    sharpeRatio: "2.85",
    winRate: "70.40",
    downloadUrl: null,
    price: "299.00",
    originalPrice: null,
    isFree: false,
    downloadCount: 489,
    productType: "indicator",
    tags: "指标,AI,趋势",
    saleMode: "inquiry",
    richDescription: null,
    galleryImages: null,
    isFeatured: false,
    featuredLink: null,
    telegramGroup: "@AITradingPro",
    qqGroup: "321654987",
    virtualSubscribers: 31,
    virtualDownloads: 77,
    viewCount: 1250,
    status: "published",
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 12),
    updatedAt: new Date(now - 1000 * 60 * 60 * 48),
  },
];

let nextStrategyId = mockStrategies.length + 1;
let nextCommentId = 10;

let mockComments: CommentRecord[] = [
  {
    id: 1,
    userId: 1,
    strategyId: 1,
    content: "本地样例备注：适合先看整体页面效果。",
    createdAt: new Date(now - 1000 * 60 * 60 * 6),
    user: { id: 1, name: "管理员", avatar: null },
  },
];

let mockAnonymousComments = [
  { id: 1, strategyId: 1, nickname: "交易老手", content: "这个 EA 的回撤控制看起来不错，适合做本地预览。", isApproved: true, rating: 5, createdAt: new Date(now - 1000 * 60 * 60 * 24 * 2) },
  { id: 2, strategyId: 1, nickname: null, content: "免费样例也能看到详情页评价区的布局。", isApproved: true, rating: 4, createdAt: new Date(now - 1000 * 60 * 60 * 20) },
  { id: 3, strategyId: 2, nickname: "剥头皮用户", content: "短线策略卡片和详情页状态正常。", isApproved: true, rating: 5, createdAt: new Date(now - 1000 * 60 * 60 * 14) },
];
let nextAnonymousCommentId = mockAnonymousComments.length + 1;

let mockOrders: OrderRecord[] = [
  {
    id: 1,
    orderNo: "MOCK-ORDER-001",
    userId: 1,
    productKind: "strategy",
    productId: 2,
    productTitle: "欧美剥头皮专家",
    productCover: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44",
    amount: "399.00",
    originalAmount: "699.00",
    currency: "CNY",
    status: "pending",
    paymentMethod: "usdt",
    paymentGateway: "usdt-manual",
    paidAt: null,
    expiresAt: new Date(now + 1000 * 60 * 24),
    metadata: JSON.stringify({ source: "local-preview" }),
    remark: "本地预览：等待人工确认 USDT 收款",
    createdAt: new Date(now - 1000 * 60 * 12),
    updatedAt: new Date(now - 1000 * 60 * 6),
  },
  {
    id: 2,
    orderNo: "MOCK-ORDER-002",
    userId: 1,
    productKind: "strategy",
    productId: 3,
    productTitle: "多货币网格交易机器人",
    productCover: "https://images.unsplash.com/photo-1642790106117-e829e14a795f",
    amount: "599.00",
    originalAmount: "899.00",
    currency: "CNY",
    status: "paid",
    paymentMethod: "alipay",
    paymentGateway: "zpay",
    paidAt: new Date(now - 1000 * 60 * 60 * 8),
    expiresAt: new Date(now - 1000 * 60 * 60 * 7),
    metadata: JSON.stringify({ source: "local-preview" }),
    remark: null,
    createdAt: new Date(now - 1000 * 60 * 60 * 9),
    updatedAt: new Date(now - 1000 * 60 * 60 * 8),
  },
  {
    id: 3,
    orderNo: "MOCK-ORDER-003",
    userId: 2,
    productKind: "promo",
    productId: 1,
    productTitle: "黄金EA限时包",
    productCover: null,
    amount: "299.00",
    originalAmount: "699.00",
    currency: "CNY",
    status: "expired",
    paymentMethod: null,
    paymentGateway: null,
    paidAt: null,
    expiresAt: new Date(now - 1000 * 60 * 30),
    metadata: JSON.stringify({ source: "local-preview" }),
    remark: null,
    createdAt: new Date(now - 1000 * 60 * 90),
    updatedAt: new Date(now - 1000 * 60 * 30),
  },
];
let nextOrderId = mockOrders.length + 1;

let mockPayments: PaymentRecord[] = [
  {
    id: 1,
    orderId: 1,
    orderNo: "MOCK-ORDER-001",
    gateway: "usdt-manual",
    gatewayOrderNo: null,
    method: "usdt",
    amount: "399.00",
    currency: "CNY",
    status: "pending",
    callbackRaw: JSON.stringify({ type: "user_submitted", note: "TRC20 截图已提交" }),
    callbackVerified: false,
    errorMessage: null,
    paidAt: null,
    createdAt: new Date(now - 1000 * 60 * 10),
    updatedAt: new Date(now - 1000 * 60 * 10),
  },
  {
    id: 2,
    orderId: 2,
    orderNo: "MOCK-ORDER-002",
    gateway: "zpay",
    gatewayOrderNo: "LOCAL-ZPAY-002",
    method: "alipay",
    amount: "599.00",
    currency: "CNY",
    status: "success",
    callbackRaw: JSON.stringify({ type: "local-preview-paid" }),
    callbackVerified: true,
    errorMessage: null,
    paidAt: new Date(now - 1000 * 60 * 60 * 8),
    createdAt: new Date(now - 1000 * 60 * 60 * 9),
    updatedAt: new Date(now - 1000 * 60 * 60 * 8),
  },
];
let nextPaymentId = mockPayments.length + 1;

let mockSiteEntries = [
  { id: 1, emoji: "📚", label: "EA 教程", href: "/subscribe", sortOrder: 10, enabled: true, createdAt: new Date(now), updatedAt: new Date(now) },
  { id: 2, emoji: "🧪", label: "主题实验室", href: "/dev/theme-lab", sortOrder: 20, enabled: true, createdAt: new Date(now), updatedAt: new Date(now) },
  { id: 3, emoji: "📨", label: "商务合作", href: "/cooperation", sortOrder: 30, enabled: true, createdAt: new Date(now), updatedAt: new Date(now) },
];
let nextSiteEntryId = mockSiteEntries.length + 1;

const mockCategories = [
  { id: 1, name: "EA", slug: "ea", parentId: null, icon: "🤖", description: "自动交易策略", sortOrder: 1, isVisible: true, createdAt: new Date(now), updatedAt: new Date(now) },
  { id: 2, name: "指标", slug: "indicator", parentId: null, icon: "📈", description: "辅助分析指标", sortOrder: 2, isVisible: true, createdAt: new Date(now), updatedAt: new Date(now) },
  { id: 3, name: "工具", slug: "tool", parentId: null, icon: "🧰", description: "交易辅助工具", sortOrder: 3, isVisible: true, createdAt: new Date(now), updatedAt: new Date(now) },
];

export function isMockDbEnabled() {
  return !process.env.DATABASE_URL;
}

function withPaging<T>(rows: T[], limit = 20, offset = 0) {
  return rows.slice(offset, offset + limit);
}

export function getMockStrategies(params: {
  platform?: "MT4" | "MT5";
  orderBy?: "latest" | "popular" | "return" | "hot";
  tag?: string;
  productType?: string;
  saleMode?: "direct" | "inquiry";
  limit?: number;
  offset?: number;
}) {
  let rows = mockStrategies.filter((strategy) => strategy.status === "published");
  if (params.platform) rows = rows.filter((strategy) => strategy.platform === params.platform);
  if (params.productType) rows = rows.filter((strategy) => strategy.productType === params.productType);
  if (params.saleMode) rows = rows.filter((strategy) => strategy.saleMode === params.saleMode);
  if (params.tag) rows = rows.filter((strategy) => String(strategy.tags || "").split(",").map((tag) => tag.trim()).includes(params.tag!));

  rows = [...rows].sort((a, b) => {
    if (params.orderBy === "popular") return (b.downloadCount || 0) - (a.downloadCount || 0);
    if (params.orderBy === "return") return parseFloat(b.totalReturn || "0") - parseFloat(a.totalReturn || "0");
    if (params.orderBy === "hot") return (b.viewCount || 0) + (b.virtualSubscribers || 0) * 10 - ((a.viewCount || 0) + (a.virtualSubscribers || 0) * 10);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return withPaging(rows, params.limit, params.offset);
}

export function getMockAllStrategies(params: { status?: "draft" | "published" | "archived"; limit?: number; offset?: number }) {
  const rows = params.status ? mockStrategies.filter((strategy) => strategy.status === params.status) : mockStrategies;
  return withPaging([...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), params.limit || 50, params.offset || 0);
}

export function getMockStrategyById(id: number) {
  return mockStrategies.find((strategy) => strategy.id === id) || null;
}

export function searchMockStrategies(keyword: string, limit = 20) {
  const term = keyword.toLowerCase();
  return mockStrategies
    .filter((strategy) => strategy.status === "published")
    .filter((strategy) => `${strategy.title} ${strategy.description} ${strategy.pairs}`.toLowerCase().includes(term))
    .slice(0, limit);
}

export function createMockStrategy(data: StrategyRecord) {
  const strategy = {
    description: null,
    timeframe: null,
    coverImage: null,
    totalReturn: "0.00",
    maxDrawdown: "0.00",
    sharpeRatio: "0.00",
    winRate: "0.00",
    downloadUrl: null,
    price: "0.00",
    originalPrice: null,
    isFree: true,
    downloadCount: 0,
    productType: "ea",
    tags: null,
    saleMode: data.isFree ? "direct" : "inquiry",
    richDescription: null,
    galleryImages: null,
    isFeatured: false,
    featuredLink: null,
    telegramGroup: null,
    qqGroup: null,
    virtualSubscribers: 0,
    virtualDownloads: 0,
    viewCount: 0,
    status: "published",
    ...data,
    id: nextStrategyId++,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockStrategies = [strategy, ...mockStrategies];
  return strategy;
}

export function updateMockStrategy(id: number, data: Partial<StrategyRecord>) {
  const current = getMockStrategyById(id);
  if (!current) return null;
  Object.assign(current, data, { updatedAt: new Date() });
  return current;
}

export function deleteMockStrategy(id: number) {
  mockStrategies = mockStrategies.filter((strategy) => strategy.id !== id);
  return true;
}

export function getMockComments(strategyId: number, limit = 50, offset = 0) {
  return withPaging(mockComments.filter((comment) => comment.strategyId === strategyId), limit, offset);
}

export function getMockAllComments(limit = 50, offset = 0) {
  return withPaging(mockComments, limit, offset);
}

export function createMockComment(data: { userId: number; strategyId: number; content: string }) {
  const strategy = getMockStrategyById(data.strategyId);
  const comment = {
    id: nextCommentId++,
    ...data,
    createdAt: new Date(),
    user: { id: data.userId, name: "管理员", avatar: null },
    strategy: strategy ? { id: strategy.id, title: strategy.title } : null,
  };
  mockComments = [comment, ...mockComments];
  return comment;
}

export function getMockAnonymousComments(strategyId: number, limit = 50, offset = 0) {
  return withPaging(mockAnonymousComments.filter((comment) => comment.strategyId === strategyId && comment.isApproved), limit, offset);
}

export function getMockAllAnonymousComments(limit = 200, offset = 0) {
  const rows = mockAnonymousComments.map((comment) => ({
    ...comment,
    strategyTitle: getMockStrategyById(comment.strategyId)?.title || null,
  }));
  return withPaging(rows, limit, offset);
}

export function createMockAnonymousComment(data: StrategyRecord) {
  const comment = {
    id: nextAnonymousCommentId++,
    strategyId: data.strategyId,
    nickname: data.nickname || null,
    content: data.content,
    isApproved: data.isApproved ?? true,
    rating: data.rating ?? 5,
    createdAt: new Date(),
  };
  mockAnonymousComments = [comment, ...mockAnonymousComments];
  return { success: true, id: comment.id };
}

export function getMockBacktestData(strategyId: number) {
  return Array.from({ length: 12 }, (_, index) => ({
    id: strategyId * 100 + index + 1,
    strategyId,
    date: new Date(now - (11 - index) * 1000 * 60 * 60 * 24),
    equity: String(10000 + index * 180),
    balance: String(10000 + index * 160),
    profit: String(index === 0 ? 0 : 120 + index * 10),
    drawdown: String(index % 4 === 0 ? 1.2 : 0),
    tradesCount: 1 + (index % 3),
    createdAt: new Date(now - (11 - index) * 1000 * 60 * 60 * 24),
  }));
}

export function getMockAdminStats() {
  return {
    totalStrategies: mockStrategies.length,
    publishedStrategies: mockStrategies.filter((strategy) => strategy.status === "published").length,
    totalDownloads: mockStrategies.reduce((sum, strategy) => sum + (strategy.downloadCount || 0), 0),
    totalPurchases: mockOrders.filter((order) => order.status === "paid").length,
    totalComments: mockComments.length,
  };
}

export function getMockCategories() {
  return mockCategories;
}

export function getMockCategoryBySlug(slug: string) {
  return mockCategories.find((category) => category.slug === slug) || null;
}

export function getMockCategoryById(id: number) {
  return mockCategories.find((category) => category.id === id) || null;
}

export function createMockOrder(data: OrderRecord) {
  const order = {
    id: nextOrderId++,
    currency: "CNY",
    status: "pending",
    paymentMethod: null,
    paymentGateway: null,
    paidAt: null,
    expiresAt: null,
    metadata: null,
    remark: null,
    ...data,
    createdAt: data.createdAt || new Date(),
    updatedAt: new Date(),
  };
  mockOrders = [order, ...mockOrders];
  return order;
}

export function getMockOrderById(id: number) {
  return mockOrders.find((order) => order.id === id) || null;
}

export function getMockOrderByOrderNo(orderNo: string) {
  return mockOrders.find((order) => order.orderNo === orderNo) || null;
}

export function getMockUserOrders(userId: number, opts?: { limit?: number; status?: string }) {
  let rows = mockOrders.filter((order) => order.userId === userId);
  if (opts?.status) rows = rows.filter((order) => order.status === opts.status);
  return withPaging([...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), opts?.limit || 50, 0);
}

export function listMockAllOrders(opts?: { limit?: number; status?: string }) {
  let rows = mockOrders;
  if (opts?.status) rows = rows.filter((order) => order.status === opts.status);
  return withPaging([...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), opts?.limit || 100, 0);
}

export function markMockOrderPaid(
  orderId: number,
  opts: { paymentMethod?: string | null; paymentGateway?: string | null },
) {
  const order = getMockOrderById(orderId);
  if (!order) return;
  Object.assign(order, {
    status: "paid",
    paidAt: new Date(),
    paymentMethod: opts.paymentMethod || null,
    paymentGateway: opts.paymentGateway || null,
    updatedAt: new Date(),
  });
}

export function cancelMockOrder(orderId: number) {
  const order = getMockOrderById(orderId);
  if (!order) return;
  Object.assign(order, { status: "cancelled", updatedAt: new Date() });
}

export function expireMockStaleOrders() {
  const nowDate = new Date();
  let count = 0;
  for (const order of mockOrders) {
    if (order.status === "pending" && order.expiresAt && new Date(order.expiresAt) < nowDate) {
      order.status = "expired";
      order.updatedAt = nowDate;
      count += 1;
    }
  }
  return count;
}

export function createMockPayment(data: PaymentRecord) {
  const payment = {
    id: nextPaymentId++,
    currency: "CNY",
    gatewayOrderNo: null,
    status: "pending",
    callbackRaw: null,
    callbackVerified: false,
    errorMessage: null,
    paidAt: null,
    ...data,
    createdAt: data.createdAt || new Date(),
    updatedAt: new Date(),
  };
  mockPayments = [payment, ...mockPayments];
  return payment;
}

export function updateMockPayment(id: number, data: Partial<PaymentRecord>) {
  const payment = getMockPaymentById(id);
  if (!payment) return;
  Object.assign(payment, data, { updatedAt: new Date() });
}

export function getMockPaymentById(id: number) {
  return mockPayments.find((payment) => payment.id === id) || null;
}

export function getMockPaymentsByOrderId(orderId: number) {
  return mockPayments
    .filter((payment) => payment.orderId === orderId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getMockActivePaymentByOrderId(orderId: number) {
  return getMockPaymentsByOrderId(orderId)[0] || null;
}

export function listMockPendingUsdtPayments() {
  return mockPayments
    .filter((payment) => payment.gateway === "usdt-manual" && payment.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function listMockSiteEntries(params?: { enabled?: boolean; all?: boolean }) {
  let rows = mockSiteEntries;
  if (!params?.all) {
    rows = rows.filter((entry) => (params?.enabled === undefined ? entry.enabled : entry.enabled === params.enabled));
  }
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function createMockSiteEntry(data: { emoji: string; label: string; href: string; sortOrder?: number; enabled?: boolean }) {
  const entry = {
    id: nextSiteEntryId++,
    emoji: data.emoji,
    label: data.label,
    href: data.href,
    sortOrder: data.sortOrder ?? 0,
    enabled: data.enabled ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockSiteEntries = [...mockSiteEntries, entry];
  return { ok: true, id: entry.id };
}

export function updateMockSiteEntry(id: number, data: Partial<{ emoji: string; label: string; href: string; sortOrder: number; enabled: boolean }>) {
  const entry = mockSiteEntries.find((item) => item.id === id);
  if (!entry) return { ok: false };
  Object.assign(entry, data, { updatedAt: new Date() });
  return { ok: true };
}

export function deleteMockSiteEntry(id: number) {
  mockSiteEntries = mockSiteEntries.filter((entry) => entry.id !== id);
  return { ok: true };
}

export function getMockSiteSettings() {
  return [
    { id: 1, settingKey: "contact_title", settingValue: "联系我们", description: "联系方式弹窗标题", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: 2, settingKey: "contact_subtitle", settingValue: "上架EA策略 | 代挂合作服务", description: "联系方式弹窗副标题", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: 3, settingKey: "contact_telegram", settingValue: "@xau6000", description: "Telegram", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: 4, settingKey: "contact_telegram_link", settingValue: "https://t.me/xau6000", description: "Telegram链接", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: 5, settingKey: "contact_qq", settingValue: "1226426670", description: "QQ群", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: 6, settingKey: "contact_wechat", settingValue: "xau6000", description: "微信", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: 7, settingKey: "contact_description", settingValue: "本地预览使用样例联系方式，线上会读取真实数据库配置。", description: "说明文字", createdAt: new Date(now), updatedAt: new Date(now) },
    { id: 8, settingKey: "virtual_subscriber_count", settingValue: "128", description: "本地样例虚拟订阅数", createdAt: new Date(now), updatedAt: new Date(now) },
  ];
}

export function getMockSiteSetting(key: string) {
  return getMockSiteSettings().find((setting) => setting.settingKey === key) || null;
}

export function getMockContactSettings() {
  return Object.fromEntries(getMockSiteSettings().map((setting) => [setting.settingKey, setting.settingValue]));
}

export function getMockGroupBuys() {
  return [
    { id: 1, title: "AI深度学习系统合购", eaName: "AI深度学习交易系统", description: "本地预览样例合购", targetPrice: "899.00", currentParticipants: 7, targetParticipants: 10, pricePerPerson: "90.00", contactInfo: "Telegram: @xau6000", status: "active", createdAt: new Date(now), updatedAt: new Date(now) },
  ];
}

export function getMockGroupBuyById(id: number) {
  return getMockGroupBuys().find((groupBuy) => groupBuy.id === id) || null;
}

export function getMockCooperationCards() {
  return [
    { id: 1, title: "策略授权合作", subtitle: "本地样例", description: "展示合作页结构", isVisible: true, sortOrder: 1, createdAt: new Date(now), updatedAt: new Date(now) },
  ];
}

export function getMockCooperationPlans() {
  return [
    { id: 1, title: "试用合作", badge: "推荐", price: "免费", priceNote: "本地样例", features: JSON.stringify(["策略观摩", "部署咨询"]), isVisible: true, sortOrder: 1, createdAt: new Date(now), updatedAt: new Date(now) },
  ];
}

export function getMockPromoProducts(category?: string) {
  const rows = [
    { id: 1, title: "黄金EA限时包", description: "本地预览促销商品", category: "ea", platform: "MT4", originalPrice: "699.00", promoPrice: "299.00", status: "active", isVisible: true, sortOrder: 1, createdAt: new Date(now), updatedAt: new Date(now) },
    { id: 2, title: "趋势指标套装", description: "本地预览指标商品", category: "indicator", platform: "MT5", originalPrice: "399.00", promoPrice: "199.00", status: "active", isVisible: true, sortOrder: 2, createdAt: new Date(now), updatedAt: new Date(now) },
  ];
  return category ? rows.filter((row) => row.category === category) : rows;
}
