/**
 * 站内咨询的业务编排层。路由只做校验和透传，规则都在这里，便于单测直接调。
 *
 * 关键取舍（都对应另外两批复盘里的真实缺陷）：
 *   - 会话**只在客户发出第一条真实消息时**创建。打开弹窗、切页签、光标停留都不建会话，
 *     后台不会被空线索稀释。
 *   - `clientMsgId` 幂等：双击发送、网络重试、双标签页都只落一条。
 *   - 归属一旦绑定登录用户，匿名令牌就读不回去了（同一台电脑换人登录不会串线）。
 *   - 商品名一律服务端查库，**不信客户端传来的标题**，否则等于给 Telegram 开了注入口子。
 *   - 通知只入外发箱，投递不在请求路径上 await。
 */

import * as db from "../db";
import { SUPPORT_QQ_FALLBACK, buildAutoReply } from "../../lib/support-faq";
import {
  buildDedupeKey,
  buildNotificationSummary,
  scheduleSupportNotificationDrain,
} from "./notify";
import {
  getSupportStore,
  hashVisitorToken,
  type ConversationRow,
  type MessageRow,
  type SupportStore,
} from "./store";
import {
  SUPPORT_HISTORY_LIMIT,
  SUPPORT_MESSAGE_MAX_LENGTH,
  type SupportConversationView,
  type SupportMessageView,
  type SupportStatus,
} from "../../shared/support/contracts";

export class SupportError extends Error {
  constructor(
    readonly code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "TOO_MANY_REQUESTS",
    message: string,
  ) {
    super(message);
    this.name = "SupportError";
  }
}

/** 访客令牌的最小长度，防止有人用 "a" 当令牌去撞别人的会话。 */
const MIN_VISITOR_TOKEN_LENGTH = 16;

export const SUPPORT_RATE_LIMITS = {
  /** 单个访客令牌：每分钟 6 条。 */
  visitorPerMinute: { windowSeconds: 60, limit: 6 },
  /** 单个 IP：每分钟 20 条（同一办公室/同一 NAT 下多人共用时不至于误伤）。 */
  ipPerMinute: { windowSeconds: 60, limit: 20 },
  /** 单个 IP：每天 300 条，挡住长时间慢速灌库。 */
  ipPerDay: { windowSeconds: 24 * 60 * 60, limit: 300 },
} as const;

export function normalizeVisitorToken(token: unknown) {
  const value = typeof token === "string" ? token.trim() : "";
  if (value.length < MIN_VISITOR_TOKEN_LENGTH || value.length > 200) {
    throw new SupportError("BAD_REQUEST", "访客令牌无效");
  }
  return value;
}

export function normalizeBody(body: unknown) {
  const value = typeof body === "string" ? body.replace(/\r\n/g, "\n").trim() : "";
  if (!value) throw new SupportError("BAD_REQUEST", "消息不能为空");
  if (value.length > SUPPORT_MESSAGE_MAX_LENGTH) {
    throw new SupportError("BAD_REQUEST", `单条消息最多 ${SUPPORT_MESSAGE_MAX_LENGTH} 字`);
  }
  return value;
}

export function toMessageView(row: MessageRow): SupportMessageView {
  return {
    id: row.id,
    role: row.role,
    body: row.body,
    autoRuleKey: row.autoRuleKey,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toConversationView(row: ConversationRow): SupportConversationView {
  return {
    publicNo: row.publicNo,
    status: row.status,
    strategyId: row.strategyId,
    strategyTitle: row.strategyTitle,
    customerMessageCount: row.customerMessageCount,
    operatorMessageCount: row.operatorMessageCount,
    lastMessageAt: row.lastMessageAt.toISOString(),
  };
}

/**
 * 会话可达性判定。
 *
 * 规则只有两条，但顺序很重要：
 *   1. 令牌必须对上——没有令牌就谈不上访问，任何人都不能拿商品号枚举别人的会话。
 *   2. 会话一旦归属某个登录用户，就**必须**由该用户本人登录访问；
 *      同一浏览器换人（或登出后的下一位）拿着残留令牌也读不到。
 */
export function assertConversationAccess(
  conversation: ConversationRow,
  input: { visitorTokenHash: string; userId: number | null },
) {
  if (conversation.visitorTokenHash !== input.visitorTokenHash) {
    throw new SupportError("FORBIDDEN", "无权访问该会话");
  }
  if (conversation.userId !== null && conversation.userId !== input.userId) {
    throw new SupportError("FORBIDDEN", "该会话已绑定其他账号，请登录后查看");
  }
}

async function enforceRateLimits(
  store: SupportStore,
  input: { visitorTokenHash: string; ip: string; now: Date },
) {
  const checks: Array<{ key: string; windowSeconds: number; limit: number }> = [
    {
      key: `visitor:${input.visitorTokenHash}`,
      ...SUPPORT_RATE_LIMITS.visitorPerMinute,
    },
    { key: `ip-min:${input.ip}`, ...SUPPORT_RATE_LIMITS.ipPerMinute },
    { key: `ip-day:${input.ip}`, ...SUPPORT_RATE_LIMITS.ipPerDay },
  ];
  for (const check of checks) {
    const hits = await store.hitRateLimit({
      bucketKey: check.key,
      windowSeconds: check.windowSeconds,
      now: input.now,
    });
    if (hits > check.limit) {
      throw new SupportError("TOO_MANY_REQUESTS", "发送太频繁了，稍等一下再试");
    }
  }
}

/** 商品标题只认库里的值；查不到就留空，绝不回落到客户端传的字符串。 */
async function resolveStrategy(strategyId: number | null) {
  if (!strategyId || strategyId <= 0) return { strategyId: null, strategyTitle: null };
  try {
    const strategy: any = await db.getStrategyById(strategyId);
    if (!strategy) return { strategyId: null, strategyTitle: null };
    return {
      strategyId,
      strategyTitle: typeof strategy.title === "string" ? strategy.title : null,
    };
  } catch (error) {
    console.warn("[support] failed to resolve strategy title:", error);
    return { strategyId, strategyTitle: null };
  }
}

/** 站点设置里的 QQ；没配就用公开兜底号，别让 QQ 入口在页面上消失。 */
export async function resolveQq() {
  try {
    const contact: any = await db.getContactSettings();
    const qq = contact?.contact_qq;
    if (typeof qq === "string" && qq.trim()) return qq.trim();
  } catch {
    // 读设置失败不该让咨询面板少一个入口
  }
  return SUPPORT_QQ_FALLBACK;
}

export type SendMessageInput = {
  visitorToken: string;
  userId: number | null;
  ip: string;
  body: string;
  clientMsgId: string;
  strategyId: number | null;
  pageUrl: string | null;
  locale: string;
  now?: Date;
  store?: SupportStore;
  /** 测试注入：跳过通知 drain 的真实调度。 */
  scheduleDrain?: () => void;
};

export async function sendCustomerMessage(input: SendMessageInput) {
  const store = input.store ?? getSupportStore();
  const now = input.now ?? new Date();
  const visitorToken = normalizeVisitorToken(input.visitorToken);
  const body = normalizeBody(input.body);
  const clientMsgId = String(input.clientMsgId ?? "").trim();
  if (!clientMsgId || clientMsgId.length > 64) {
    throw new SupportError("BAD_REQUEST", "clientMsgId 无效");
  }
  const visitorTokenHash = hashVisitorToken(visitorToken);

  await enforceRateLimits(store, { visitorTokenHash, ip: input.ip || "unknown", now });

  const { strategyId, strategyTitle } = await resolveStrategy(input.strategyId);

  // 到这一步才建会话：客户确实说了话。弹窗打开本身不产生任何库写入。
  const existing = await store.findConversationByVisitor(
    visitorTokenHash,
    strategyId && strategyId > 0 ? strategyId : 0,
  );
  if (existing) assertConversationAccess(existing, { visitorTokenHash, userId: input.userId });

  const conversation = await store.ensureConversation({
    visitorTokenHash,
    userId: input.userId,
    strategyId,
    strategyTitle,
    pageUrl: typeof input.pageUrl === "string" ? input.pageUrl.slice(0, 500) : null,
    locale: input.locale || "zh",
  });
  assertConversationAccess(conversation, { visitorTokenHash, userId: input.userId });
  if (input.userId && conversation.userId === null) {
    // 聊到一半登录：把这条线收归账号，不另起一条新会话（否则界面上「刚才说的话不见了」）。
    await store.linkUser(conversation.id, input.userId);
  }

  const stored = await store.appendMessage({
    conversationId: conversation.id,
    role: "customer",
    body,
    clientMsgId,
  });

  if (!stored.created) {
    // 重复提交：不再触发自动回复，也不再排通知。返回当前线程即可。
    const messages = await store.listRecentMessages(conversation.id, SUPPORT_HISTORY_LIMIT);
    const fresh = (await store.findConversationById(conversation.id)) ?? conversation;
    return {
      duplicate: true as const,
      conversation: toConversationView(fresh),
      messages: messages.map(toMessageView),
    };
  }

  const qq = await resolveQq();
  const auto = buildAutoReply(body, { strategyTitle, strategyId, qq });
  await store.appendMessage({
    conversationId: conversation.id,
    role: "auto",
    body: auto.body,
    autoRuleKey: auto.ruleKey,
  });

  const fresh = (await store.findConversationById(conversation.id)) ?? conversation;
  await store.enqueueNotification({
    dedupeKey: buildDedupeKey(conversation.id, now),
    conversationId: conversation.id,
    // 摘要只取结构化字段，正文根本没传进来。
    summary: buildNotificationSummary({
      publicNo: fresh.publicNo,
      strategyTitle: fresh.strategyTitle,
      strategyId: fresh.strategyId,
      customerMessageCount: fresh.customerMessageCount,
      status: fresh.status,
      identity: fresh.userId ? "member" : "guest",
    }),
  });

  // 投递不 await：Telegram 慢或挂掉都不能让客户的发送请求超时。
  (input.scheduleDrain ?? scheduleSupportNotificationDrain)();

  const messages = await store.listRecentMessages(conversation.id, SUPPORT_HISTORY_LIMIT);
  return {
    duplicate: false as const,
    conversation: toConversationView(fresh),
    messages: messages.map(toMessageView),
  };
}

export type FetchThreadInput = {
  visitorToken: string;
  userId: number | null;
  strategyId: number | null;
  afterId: number;
  now?: Date;
  store?: SupportStore;
};

/**
 * 客户端轮询用。没有会话就返回 null —— 不建、不写库、不发通知。
 */
export async function fetchVisitorThread(input: FetchThreadInput) {
  const store = input.store ?? getSupportStore();
  const visitorToken = normalizeVisitorToken(input.visitorToken);
  const visitorTokenHash = hashVisitorToken(visitorToken);
  const strategyKey = input.strategyId && input.strategyId > 0 ? input.strategyId : 0;
  const conversation = await store.findConversationByVisitor(visitorTokenHash, strategyKey);
  if (!conversation) return { conversation: null, messages: [] as SupportMessageView[] };
  assertConversationAccess(conversation, { visitorTokenHash, userId: input.userId });

  const afterId = Number.isFinite(input.afterId) ? Math.max(0, Math.trunc(input.afterId)) : 0;
  const rows =
    afterId > 0
      ? await store.listMessages(conversation.id, afterId, input.now ?? new Date())
      : await store.listRecentMessages(conversation.id, SUPPORT_HISTORY_LIMIT);
  return {
    conversation: toConversationView(conversation),
    messages: rows.map(toMessageView),
  };
}

// ─────────────────────────── 管理员侧 ───────────────────────────

export type AdminConversationView = SupportConversationView & {
  id: number;
  identity: "guest" | "member";
  pageUrl: string | null;
  createdAt: string;
  lastCustomerMessageAt: string | null;
  lastOperatorMessageAt: string | null;
  /** 最近一次通知的投递状态，失败不静默。 */
  notifyStatus: string | null;
  notifyAttempts: number;
  notifyError: string | null;
};

export async function listAdminConversations(input: {
  status?: SupportStatus | "all";
  limit?: number;
  offset?: number;
  store?: SupportStore;
}) {
  const store = input.store ?? getSupportStore();
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const rows = await store.listConversations({ status: input.status ?? "all", limit, offset });
  const total = await store.countConversations(input.status ?? "all");
  const items: AdminConversationView[] = [];
  for (const row of rows) {
    const notifications = await store.listNotifications(row.id);
    const latest = notifications.length ? notifications[notifications.length - 1] : null;
    items.push({
      ...toConversationView(row),
      id: row.id,
      identity: row.userId ? "member" : "guest",
      pageUrl: row.pageUrl,
      createdAt: row.createdAt.toISOString(),
      lastCustomerMessageAt: row.lastCustomerMessageAt?.toISOString() ?? null,
      lastOperatorMessageAt: row.lastOperatorMessageAt?.toISOString() ?? null,
      notifyStatus: latest?.status ?? null,
      notifyAttempts: latest?.attempts ?? 0,
      notifyError: latest?.lastError ?? null,
    });
  }
  return { items, total };
}

export async function getAdminThread(input: { publicNo: string; store?: SupportStore }) {
  const store = input.store ?? getSupportStore();
  const conversation = await store.findConversationByPublicNo(String(input.publicNo ?? "").trim());
  if (!conversation) throw new SupportError("NOT_FOUND", "会话不存在");
  const messages = await store.listRecentMessages(conversation.id, SUPPORT_HISTORY_LIMIT);
  return {
    conversation: {
      ...toConversationView(conversation),
      id: conversation.id,
      identity: conversation.userId ? ("member" as const) : ("guest" as const),
      pageUrl: conversation.pageUrl,
      createdAt: conversation.createdAt.toISOString(),
    },
    messages: messages.map(toMessageView),
  };
}

export async function replyAsOperator(input: {
  publicNo: string;
  body: string;
  operatorId: number;
  clientMsgId?: string | null;
  store?: SupportStore;
}) {
  const store = input.store ?? getSupportStore();
  const body = normalizeBody(input.body);
  const conversation = await store.findConversationByPublicNo(String(input.publicNo ?? "").trim());
  if (!conversation) throw new SupportError("NOT_FOUND", "会话不存在");
  await store.appendMessage({
    conversationId: conversation.id,
    role: "operator",
    body,
    clientMsgId: input.clientMsgId ?? null,
    operatorId: input.operatorId,
  });
  const messages = await store.listRecentMessages(conversation.id, SUPPORT_HISTORY_LIMIT);
  const fresh = (await store.findConversationById(conversation.id)) ?? conversation;
  return {
    conversation: toConversationView(fresh),
    messages: messages.map(toMessageView),
  };
}

export async function setConversationStatus(input: {
  publicNo: string;
  status: SupportStatus;
  store?: SupportStore;
}) {
  const store = input.store ?? getSupportStore();
  const conversation = await store.findConversationByPublicNo(String(input.publicNo ?? "").trim());
  if (!conversation) throw new SupportError("NOT_FOUND", "会话不存在");
  await store.setStatus(conversation.id, input.status);
  return { success: true };
}
