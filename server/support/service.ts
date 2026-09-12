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
  resolveTelegramConfig,
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
    readonly code:
      | "BAD_REQUEST"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "TOO_MANY_REQUESTS"
      | "CONFLICT",
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
    // 只回客户自己那条的幂等键，用于「我刚才那条到底发出去了没有」的确认。
    clientMsgId: row.role === "customer" ? row.clientMsgId : null,
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
 * 复核 H1 打的就是这里：旧版对「会话已绑定别人的账号」直接抛 FORBIDDEN，而访客令牌只存本机、
 * 没有轮换入口 —— 于是那台电脑上的咨询窗口**永久锁死**，连当事人自己登出后都用不了。
 *
 * 现在改成三态判定，调用方按结果决定行为，没有死路：
 *   - `ok`        令牌对上、归属也对得上，正常读写；
 *   - `unclaimed` 令牌对上、会话还没归属，但当前是登录身份 —— 需要**客户显式认领**，
 *                 在认领之前登录身份不自动继承前一位访客的记录；
 *   - `foreign`   这条会话不属于当前身份（换人、换号、登出）—— 不报错，让客户端换一枚
 *                 新访客令牌重新开一条线（identity bootstrap），旧记录原样留在原主名下。
 */
/**
 * 把「当前是谁」压成一个可比对的短串：`guest` 或 `user:<id>`。
 * 客户端发请求时带上它**自认为**的身份，服务端拿真实解析出来的身份对一遍。
 */
export function identityKeyOf(userId: number | null) {
  return userId ? `user:${userId}` : "guest";
}

/**
 * 身份切换竞态的闸门。
 *
 * 场景：客户在**匿名**状态下打好草稿 → 期间登录（或换了账号）→ 请求带着旧的访客令牌
 * 但用新账号的会话凭据到达服务端。如果这个访客令牌还没有对应会话，`ensureConversation`
 * 会用**新账号**的 userId 建一条会话，于是上一位打的字被写进了另一个人的账号名下。
 *
 * 客户端已经在身份变更时清掉草稿（见 support-chat.tsx 的 wipeIdentityBoundState），
 * 这里是服务端的第二道：请求自报的身份和服务端解析出来的身份对不上就**拒绝写入**。
 * 它只会更严，永远不会放宽——没带 expectedIdentity 的老客户端行为不变。
 */
export function assertExpectedIdentity(
  expectedIdentity: string | null | undefined,
  userId: number | null,
) {
  const expected = typeof expectedIdentity === "string" ? expectedIdentity.trim() : "";
  if (!expected) return;
  const actual = identityKeyOf(userId);
  if (expected !== actual) {
    throw new SupportError(
      "CONFLICT",
      "登录状态在发送过程中变了，这条没有发出去，请确认身份后重发",
    );
  }
}

export type ConversationAccess = "ok" | "unclaimed" | "foreign";

export function evaluateConversationAccess(
  conversation: ConversationRow,
  input: { visitorTokenHash: string; userId: number | null },
): ConversationAccess {
  if (conversation.visitorTokenHash !== input.visitorTokenHash) return "foreign";
  if (conversation.userId === null) {
    // 匿名会话：登录身份不能顺手把前一位访客说过的话并到自己名下。
    return input.userId === null ? "ok" : "unclaimed";
  }
  return conversation.userId === input.userId ? "ok" : "foreign";
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
  /** 客户端自报的身份（`guest` / `user:<id>`）；与服务端解析结果不一致就拒绝。 */
  expectedIdentity?: string | null;
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
  // 身份对不上就直接拒，放在限流之前：竞态请求不该先吃掉客户的发送配额。
  assertExpectedIdentity(input.expectedIdentity, input.userId);

  const visitorTokenHash = hashVisitorToken(visitorToken);

  await enforceRateLimits(store, { visitorTokenHash, ip: input.ip || "unknown", now });

  const { strategyId, strategyTitle } = await resolveStrategy(input.strategyId);
  const strategyKey = strategyId && strategyId > 0 ? strategyId : 0;

  // 到这一步才建会话：客户确实说了话。弹窗打开本身不产生任何库写入。
  const existing = await store.findConversationByVisitor(visitorTokenHash, strategyKey);
  if (existing) {
    const access = evaluateConversationAccess(existing, {
      visitorTokenHash,
      userId: input.userId,
    });
    // 换人 / 换号 / 登出：不往别人的会话里写，也不把人锁死，让客户端换一枚令牌重开一条线。
    if (access === "foreign") {
      throw new SupportError("CONFLICT", "这个咨询窗口属于另一个身份，正在为你开一条新的会话");
    }
    // unclaimed：登录用户碰到一条匿名会话。**不自动继承**，同样换新令牌重开，
    // 要带走之前的记录得走 claimAnonymousConversation 显式认领。
    if (access === "unclaimed") {
      throw new SupportError(
        "CONFLICT",
        "这台设备上有一段访客身份的咨询记录，需要你确认后才会并入账号",
      );
    }
  }

  const conversation = await store.ensureConversation({
    visitorTokenHash,
    userId: input.userId,
    strategyId,
    strategyTitle,
    pageUrl: typeof input.pageUrl === "string" ? input.pageUrl.slice(0, 500) : null,
    locale: input.locale || "zh",
  });
  if (evaluateConversationAccess(conversation, { visitorTokenHash, userId: input.userId }) !== "ok") {
    throw new SupportError("CONFLICT", "这个咨询窗口属于另一个身份，正在为你开一条新的会话");
  }

  const qq = await resolveQq();
  const attended = resolveTelegramConfig().mode === "live";
  const auto = buildAutoReply(body, {
    strategyTitle,
    strategyId,
    qq,
    attended,
    // 客户当前用的站点语言：英语/阿语客户不该收到整段中文（复核 M6）。
    language: input.locale || "zh",
  });

  // 客户消息 + 计数 + 机器人回复 + 提醒排队：一个事务，要么全成要么全不成。
  // 这样不会出现「消息在库里、机器人回复丢了、客户重试又命中幂等直接返回」的死角。
  const turn = await store.appendCustomerTurn({
    conversationId: conversation.id,
    body,
    clientMsgId,
    autoReply: auto,
    buildNotification: (fresh) => ({
      dedupeKey: buildDedupeKey(fresh.id, fresh.notifyGeneration),
      // 摘要只取结构化字段，正文根本没传进来。
      summary: buildNotificationSummary({
        publicNo: fresh.publicNo,
        strategyTitle: fresh.strategyTitle,
        strategyId: fresh.strategyId,
        customerMessageCount: fresh.customerMessageCount,
        status: fresh.status,
        identity: fresh.userId ? "member" : "guest",
      }),
    }),
  });

  if (turn.created) {
    // 投递不 await：Telegram 慢或挂掉都不能让客户的发送请求超时。
    (input.scheduleDrain ?? scheduleSupportNotificationDrain)();
  }

  const messages = await store.listRecentMessages(conversation.id, SUPPORT_HISTORY_LIMIT);
  return {
    duplicate: !turn.created,
    // 幂等命中但正文对不上：这次的内容**没有**落库。客户端据此保住草稿、如实告知客户，
    // 不许当成「发送成功」清空输入框（复核回合 2 的 P2）。
    bodyMismatch: turn.bodyMismatch,
    conversation: toConversationView(turn.conversation),
    messages: messages.map(toMessageView),
  };
}

/**
 * 客户**显式**把这台设备上的匿名会话并入自己的账号。
 *
 * 只有三个条件同时成立才会成功：调用方已登录、拿得出原来那枚访客令牌、目标会话尚未归属任何账号。
 * 任何一条不成立都返回失败，绝不出现「后一位登录的人自动继承前一位访客的聊天记录」。
 */
export async function claimAnonymousConversation(input: {
  previousVisitorToken: string;
  visitorToken: string;
  userId: number;
  strategyId: number | null;
  expectedIdentity?: string | null;
  store?: SupportStore;
}) {
  const store = input.store ?? getSupportStore();
  if (!input.userId) throw new SupportError("FORBIDDEN", "请先登录再认领咨询记录");
  assertExpectedIdentity(input.expectedIdentity, input.userId);
  const previousHash = hashVisitorToken(normalizeVisitorToken(input.previousVisitorToken));
  const currentHash = hashVisitorToken(normalizeVisitorToken(input.visitorToken));
  if (previousHash === currentHash) {
    throw new SupportError("BAD_REQUEST", "认领需要用换新之前的那枚访客令牌");
  }
  const strategyKey = input.strategyId && input.strategyId > 0 ? input.strategyId : 0;
  const conversation = await store.findConversationByVisitor(previousHash, strategyKey);
  if (!conversation) return { claimed: false as const, reason: "not_found" as const };
  if (conversation.userId !== null) return { claimed: false as const, reason: "already_owned" as const };

  const ok = await store.claimConversationForUser({
    conversationId: conversation.id,
    userId: input.userId,
    visitorTokenHash: currentHash,
  });
  if (!ok) return { claimed: false as const, reason: "conflict" as const };
  const fresh = (await store.findConversationById(conversation.id)) ?? conversation;
  const messages = await store.listRecentMessages(conversation.id, SUPPORT_HISTORY_LIMIT);
  return {
    claimed: true as const,
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
 *
 * 读不到别人的会话时**不抛错**：返回 `identity` 告诉客户端该怎么办
 * （换一枚令牌重开 / 弹一个「要不要把访客记录并进账号」的确认），
 * 而不是让面板停在一个永远 5 秒重试一次的 FORBIDDEN 上。
 */
export async function fetchVisitorThread(input: FetchThreadInput) {
  const store = input.store ?? getSupportStore();
  const visitorToken = normalizeVisitorToken(input.visitorToken);
  const visitorTokenHash = hashVisitorToken(visitorToken);
  const strategyKey = input.strategyId && input.strategyId > 0 ? input.strategyId : 0;
  const conversation = await store.findConversationByVisitor(visitorTokenHash, strategyKey);
  if (!conversation) {
    return { conversation: null, messages: [] as SupportMessageView[], identity: "ok" as const };
  }

  const access = evaluateConversationAccess(conversation, {
    visitorTokenHash,
    userId: input.userId,
  });
  if (access === "foreign") {
    // 这台设备换了人 / 换了账号 / 登出了：不给看，也不报错，让客户端换令牌重开。
    return {
      conversation: null,
      messages: [] as SupportMessageView[],
      identity: "rotate" as const,
    };
  }
  if (access === "unclaimed") {
    // 登录身份 + 这台设备上的匿名记录：先问客户要不要并入，问之前一个字都不给看。
    return {
      conversation: null,
      messages: [] as SupportMessageView[],
      identity: "claimable" as const,
    };
  }

  const afterId = Number.isFinite(input.afterId) ? Math.max(0, Math.trunc(input.afterId)) : 0;
  const rows =
    afterId > 0
      ? await store.listMessages(conversation.id, afterId, input.now ?? new Date())
      : await store.listRecentMessages(conversation.id, SUPPORT_HISTORY_LIMIT);
  return {
    conversation: toConversationView(conversation),
    messages: rows.map(toMessageView),
    identity: "ok" as const,
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
  // 一次把这一页所有会话的最新提醒取回来，不逐行查（复核 M4 的 N+1）。
  const latestByConversation = await store.latestNotificationByConversation(
    rows.map((row) => row.id),
  );
  const items: AdminConversationView[] = [];
  for (const row of rows) {
    const latest = latestByConversation.get(row.id) ?? null;
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
