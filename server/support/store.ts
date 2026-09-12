/**
 * 站内咨询的存储层。
 *
 * 这里刻意写成「适配器」而不是直接调 `server/db.ts`：EAXAU 的生产库是 **MySQL**
 * （drizzle + mysql2），没有 `UPDATE ... RETURNING`、没有 SQLite 的 batch DDL，
 * 另一批次（fanyong / niubang）那两套 D1 / Postgres 的写法不能照抄。本文件的每一处
 * 并发保护都按 MySQL 的真实能力实现：
 *
 *   - 会话唯一性 → `(visitorTokenHash, strategyKey)` 唯一索引 + 撞键后回读；
 *   - 消息幂等   → `(conversationId, clientMsgId)` 唯一索引 + 撞键后回读；
 *   - 消息顺序   → 自增主键，不设 next_seq 计数列，杜绝读-改-写抢号丢消息；
 *   - 限流计数   → `INSERT ... ON DUPLICATE KEY UPDATE hits = hits + 1` 单条原子自增；
 *   - 外发箱认领 → 条件 UPDATE + affectedRows 判定，租约超时可回收。
 *
 * 没有 DATABASE_URL 时（本地开发 / 单测）落到进程内存实现，语义与 MySQL 版一致，
 * 包括上面这些唯一约束——这样测试测到的就是线上会走的分支逻辑。
 */

import crypto from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { SUPPORT_HISTORY_LIMIT, SUPPORT_POLL_OVERLAP_SECONDS } from "../../shared/support/contracts";
import type { SupportRole, SupportStatus } from "../../shared/support/contracts";

const { supportConversations, supportMessages, supportNotifications, supportRateLimits } = schema;

export type ConversationRow = {
  id: number;
  publicNo: string;
  visitorTokenHash: string;
  userId: number | null;
  strategyId: number | null;
  strategyKey: number;
  strategyTitle: string | null;
  pageUrl: string | null;
  locale: string;
  status: SupportStatus;
  customerMessageCount: number;
  operatorMessageCount: number;
  lastMessageAt: Date;
  lastCustomerMessageAt: Date | null;
  lastOperatorMessageAt: Date | null;
  createdAt: Date;
};

export type MessageRow = {
  id: number;
  conversationId: number;
  role: SupportRole;
  body: string;
  clientMsgId: string | null;
  autoRuleKey: string | null;
  operatorId: number | null;
  createdAt: Date;
};

export type NotificationRow = {
  id: number;
  dedupeKey: string;
  conversationId: number;
  summary: string;
  status: "pending" | "sending" | "sent" | "held" | "failed";
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
  claimedAt: Date | null;
  claimToken: string | null;
  sentAt: Date | null;
};

export type EnsureConversationInput = {
  visitorTokenHash: string;
  userId: number | null;
  strategyId: number | null;
  strategyTitle: string | null;
  pageUrl: string | null;
  locale: string;
};

export type AppendMessageInput = {
  conversationId: number;
  role: SupportRole;
  body: string;
  clientMsgId?: string | null;
  autoRuleKey?: string | null;
  operatorId?: number | null;
};

export type SupportStore = {
  readonly kind: "mysql" | "memory";
  /** 首条消息才会调用；同一访客同一商品重复调用返回同一条会话。 */
  ensureConversation(input: EnsureConversationInput): Promise<ConversationRow>;
  findConversationByVisitor(
    visitorTokenHash: string,
    strategyKey: number,
  ): Promise<ConversationRow | null>;
  findConversationById(id: number): Promise<ConversationRow | null>;
  findConversationByPublicNo(publicNo: string): Promise<ConversationRow | null>;
  /** 幂等写入；clientMsgId 重复时返回已存在的那条，`created=false`。 */
  appendMessage(input: AppendMessageInput): Promise<{ message: MessageRow; created: boolean }>;
  listMessages(
    conversationId: number,
    afterId: number,
    now?: Date,
  ): Promise<MessageRow[]>;
  listRecentMessages(conversationId: number, limit?: number): Promise<MessageRow[]>;
  listConversations(input: {
    status?: SupportStatus | "all";
    limit: number;
    offset: number;
  }): Promise<ConversationRow[]>;
  countConversations(status?: SupportStatus | "all"): Promise<number>;
  setStatus(conversationId: number, status: SupportStatus): Promise<void>;
  /** 登录后把匿名会话收归到该账号名下；已有归属则不动。 */
  linkUser(conversationId: number, userId: number): Promise<void>;
  enqueueNotification(input: {
    dedupeKey: string;
    conversationId: number;
    summary: string;
  }): Promise<void>;
  claimDueNotifications(input: {
    now: Date;
    limit: number;
    leaseTimeoutMs: number;
  }): Promise<NotificationRow[]>;
  finishNotification(input: {
    id: number;
    claimToken: string;
    status: "sent" | "held" | "pending" | "failed";
    nextAttemptAt?: Date;
    lastError?: string | null;
    sentAt?: Date | null;
  }): Promise<void>;
  listNotifications(conversationId: number): Promise<NotificationRow[]>;
  /** 原子自增并返回窗口内累计次数；返回值 > limit 即为超限。 */
  hitRateLimit(input: {
    bucketKey: string;
    windowSeconds: number;
    now: Date;
  }): Promise<number>;
};

export function hashVisitorToken(token: string) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

const PUBLIC_NO_ALPHABET = "ACDEFGHJKLMNPQRSTUVWXY3456789";

export function generatePublicNo() {
  const bytes = crypto.randomBytes(7);
  let out = "";
  for (const byte of bytes) out += PUBLIC_NO_ALPHABET[byte % PUBLIC_NO_ALPHABET.length];
  return `EAX-${out}`;
}

function isDuplicateKeyError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const errno = (error as { errno?: number } | null)?.errno;
  return code === "ER_DUP_ENTRY" || errno === 1062;
}

// ─────────────────────────── 内存实现 ───────────────────────────

function cloneConversation(row: ConversationRow): ConversationRow {
  return { ...row };
}

class MemorySupportStore implements SupportStore {
  readonly kind = "memory" as const;
  private conversations = new Map<number, ConversationRow>();
  private messages: MessageRow[] = [];
  private notifications = new Map<number, NotificationRow>();
  private rateLimits = new Map<string, number>();
  private nextConversationId = 1;
  private nextMessageId = 1;
  private nextNotificationId = 1;

  /**
   * 同步查找。`ensureConversation` 里从查重到插入之间**不能有 await**，
   * 否则并发调用会各自插一条，测不出 MySQL 那条唯一索引实际挡住的行为。
   */
  private findConversationSync(visitorTokenHash: string, strategyKey: number) {
    for (const row of this.conversations.values()) {
      if (row.visitorTokenHash === visitorTokenHash && row.strategyKey === strategyKey) return row;
    }
    return null;
  }

  async ensureConversation(input: EnsureConversationInput): Promise<ConversationRow> {
    const strategyKey = input.strategyId && input.strategyId > 0 ? input.strategyId : 0;
    // 下面这段刻意保持同步，等价于 (visitorTokenHash, strategyKey) 上的唯一索引。
    const existing = this.findConversationSync(input.visitorTokenHash, strategyKey);
    if (existing) {
      const row = existing;
      // 商品标题/页面地址可能后来才补全，但归属和编号绝不改。
      if (!row.strategyTitle && input.strategyTitle) row.strategyTitle = input.strategyTitle;
      if (!row.pageUrl && input.pageUrl) row.pageUrl = input.pageUrl;
      return cloneConversation(row);
    }
    const now = new Date();
    const row: ConversationRow = {
      id: this.nextConversationId++,
      publicNo: generatePublicNo(),
      visitorTokenHash: input.visitorTokenHash,
      userId: input.userId,
      strategyId: input.strategyId,
      strategyKey,
      strategyTitle: input.strategyTitle,
      pageUrl: input.pageUrl,
      locale: input.locale,
      status: "open",
      customerMessageCount: 0,
      operatorMessageCount: 0,
      lastMessageAt: now,
      lastCustomerMessageAt: null,
      lastOperatorMessageAt: null,
      createdAt: now,
    };
    this.conversations.set(row.id, row);
    return cloneConversation(row);
  }

  async findConversationByVisitor(visitorTokenHash: string, strategyKey: number) {
    for (const row of this.conversations.values()) {
      if (row.visitorTokenHash === visitorTokenHash && row.strategyKey === strategyKey) {
        return cloneConversation(row);
      }
    }
    return null;
  }

  async findConversationById(id: number) {
    const row = this.conversations.get(id);
    return row ? cloneConversation(row) : null;
  }

  async findConversationByPublicNo(publicNo: string) {
    for (const row of this.conversations.values()) {
      if (row.publicNo === publicNo) return cloneConversation(row);
    }
    return null;
  }

  async appendMessage(input: AppendMessageInput) {
    const clientMsgId = input.clientMsgId?.trim() || null;
    if (clientMsgId) {
      const duplicate = this.messages.find(
        (m) => m.conversationId === input.conversationId && m.clientMsgId === clientMsgId,
      );
      if (duplicate) return { message: { ...duplicate }, created: false };
    }
    const now = new Date();
    const message: MessageRow = {
      id: this.nextMessageId++,
      conversationId: input.conversationId,
      role: input.role,
      body: input.body,
      clientMsgId,
      autoRuleKey: input.autoRuleKey ?? null,
      operatorId: input.operatorId ?? null,
      createdAt: now,
    };
    this.messages.push(message);
    const conversation = this.conversations.get(input.conversationId);
    if (conversation) {
      conversation.lastMessageAt = now;
      if (input.role === "customer") {
        conversation.customerMessageCount += 1;
        conversation.lastCustomerMessageAt = now;
        if (conversation.status !== "closed") conversation.status = "open";
      } else if (input.role === "operator") {
        conversation.operatorMessageCount += 1;
        conversation.lastOperatorMessageAt = now;
        conversation.status = "answered";
      }
    }
    return { message: { ...message }, created: true };
  }

  async listMessages(conversationId: number, afterId: number, now: Date = new Date()) {
    const overlapFrom = new Date(now.getTime() - SUPPORT_POLL_OVERLAP_SECONDS * 1000);
    return this.messages
      .filter(
        (m) =>
          m.conversationId === conversationId &&
          (m.id > afterId || m.createdAt.getTime() >= overlapFrom.getTime()),
      )
      .sort((a, b) => a.id - b.id)
      .slice(0, SUPPORT_HISTORY_LIMIT)
      .map((m) => ({ ...m }));
  }

  async listRecentMessages(conversationId: number, limit = SUPPORT_HISTORY_LIMIT) {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.id - b.id)
      .slice(-limit)
      .map((m) => ({ ...m }));
  }

  async listConversations(input: { status?: SupportStatus | "all"; limit: number; offset: number }) {
    const rows = [...this.conversations.values()]
      .filter((row) => !input.status || input.status === "all" || row.status === input.status)
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    return rows.slice(input.offset, input.offset + input.limit).map(cloneConversation);
  }

  async countConversations(status?: SupportStatus | "all") {
    return [...this.conversations.values()].filter(
      (row) => !status || status === "all" || row.status === status,
    ).length;
  }

  async setStatus(conversationId: number, status: SupportStatus) {
    const row = this.conversations.get(conversationId);
    if (row) row.status = status;
  }

  async linkUser(conversationId: number, userId: number) {
    const row = this.conversations.get(conversationId);
    if (row && row.userId === null) row.userId = userId;
  }

  async enqueueNotification(input: { dedupeKey: string; conversationId: number; summary: string }) {
    for (const row of this.notifications.values()) {
      if (row.dedupeKey === input.dedupeKey) {
        if (row.status === "pending" || row.status === "held") row.summary = input.summary;
        return;
      }
    }
    const row: NotificationRow = {
      id: this.nextNotificationId++,
      dedupeKey: input.dedupeKey,
      conversationId: input.conversationId,
      summary: input.summary,
      status: "pending",
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(),
      claimedAt: null,
      claimToken: null,
      sentAt: null,
    };
    this.notifications.set(row.id, row);
  }

  async claimDueNotifications(input: { now: Date; limit: number; leaseTimeoutMs: number }) {
    const claimed: NotificationRow[] = [];
    const staleBefore = new Date(input.now.getTime() - input.leaseTimeoutMs);
    for (const row of [...this.notifications.values()].sort((a, b) => a.id - b.id)) {
      if (claimed.length >= input.limit) break;
      const due =
        (row.status === "pending" || row.status === "held") &&
        row.nextAttemptAt.getTime() <= input.now.getTime();
      const stale =
        row.status === "sending" &&
        (row.claimedAt?.getTime() ?? 0) <= staleBefore.getTime();
      if (!due && !stale) continue;
      row.status = "sending";
      row.attempts += 1;
      row.claimedAt = input.now;
      row.claimToken = crypto.randomUUID();
      claimed.push({ ...row });
    }
    return claimed;
  }

  async finishNotification(input: {
    id: number;
    claimToken: string;
    status: "sent" | "held" | "pending" | "failed";
    nextAttemptAt?: Date;
    lastError?: string | null;
    sentAt?: Date | null;
  }) {
    const row = this.notifications.get(input.id);
    if (!row || row.claimToken !== input.claimToken) return;
    row.status = input.status;
    row.claimToken = null;
    row.claimedAt = null;
    if (input.nextAttemptAt) row.nextAttemptAt = input.nextAttemptAt;
    row.lastError = input.lastError ?? null;
    if (input.sentAt !== undefined) row.sentAt = input.sentAt;
  }

  async listNotifications(conversationId: number) {
    return [...this.notifications.values()]
      .filter((row) => row.conversationId === conversationId)
      .map((row) => ({ ...row }));
  }

  async hitRateLimit(input: { bucketKey: string; windowSeconds: number; now: Date }) {
    const windowStart =
      Math.floor(input.now.getTime() / 1000 / input.windowSeconds) * input.windowSeconds;
    const key = `${input.bucketKey}:${windowStart}`;
    const next = (this.rateLimits.get(key) ?? 0) + 1;
    this.rateLimits.set(key, next);
    return next;
  }

  /** 仅测试用：清空全部状态。 */
  reset() {
    this.conversations.clear();
    this.messages = [];
    this.notifications.clear();
    this.rateLimits.clear();
    this.nextConversationId = 1;
    this.nextMessageId = 1;
    this.nextNotificationId = 1;
  }
}

// ─────────────────────────── MySQL 实现 ───────────────────────────

function toConversationRow(row: any): ConversationRow {
  return {
    id: row.id,
    publicNo: row.publicNo,
    visitorTokenHash: row.visitorTokenHash,
    userId: row.userId ?? null,
    strategyId: row.strategyId ?? null,
    strategyKey: row.strategyKey ?? 0,
    strategyTitle: row.strategyTitle ?? null,
    pageUrl: row.pageUrl ?? null,
    locale: row.locale ?? "zh",
    status: row.status,
    customerMessageCount: row.customerMessageCount ?? 0,
    operatorMessageCount: row.operatorMessageCount ?? 0,
    lastMessageAt: new Date(row.lastMessageAt),
    lastCustomerMessageAt: row.lastCustomerMessageAt ? new Date(row.lastCustomerMessageAt) : null,
    lastOperatorMessageAt: row.lastOperatorMessageAt ? new Date(row.lastOperatorMessageAt) : null,
    createdAt: new Date(row.createdAt),
  };
}

function toMessageRow(row: any): MessageRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    body: row.body,
    clientMsgId: row.clientMsgId ?? null,
    autoRuleKey: row.autoRuleKey ?? null,
    operatorId: row.operatorId ?? null,
    createdAt: new Date(row.createdAt),
  };
}

function toNotificationRow(row: any): NotificationRow {
  return {
    id: row.id,
    dedupeKey: row.dedupeKey,
    conversationId: row.conversationId,
    summary: row.summary,
    status: row.status,
    attempts: row.attempts ?? 0,
    lastError: row.lastError ?? null,
    nextAttemptAt: new Date(row.nextAttemptAt),
    claimedAt: row.claimedAt ? new Date(row.claimedAt) : null,
    claimToken: row.claimToken ?? null,
    sentAt: row.sentAt ? new Date(row.sentAt) : null,
  };
}

class MysqlSupportStore implements SupportStore {
  readonly kind = "mysql" as const;
  constructor(private readonly db: any) {}

  async ensureConversation(input: EnsureConversationInput): Promise<ConversationRow> {
    const strategyKey = input.strategyId && input.strategyId > 0 ? input.strategyId : 0;
    const existing = await this.findConversationByVisitor(input.visitorTokenHash, strategyKey);
    if (existing) return existing;
    try {
      await this.db.insert(supportConversations).values({
        publicNo: generatePublicNo(),
        visitorTokenHash: input.visitorTokenHash,
        userId: input.userId,
        strategyId: input.strategyId,
        strategyKey,
        strategyTitle: input.strategyTitle,
        pageUrl: input.pageUrl,
        locale: input.locale,
      });
    } catch (error) {
      // 并发首条消息：另一个请求刚建好同一条线。回读即可，不要再建第二条。
      if (!isDuplicateKeyError(error)) throw error;
    }
    const row = await this.findConversationByVisitor(input.visitorTokenHash, strategyKey);
    if (!row) throw new Error("[support] conversation insert raced and vanished");
    return row;
  }

  async findConversationByVisitor(visitorTokenHash: string, strategyKey: number) {
    const rows = await this.db
      .select()
      .from(supportConversations)
      .where(
        and(
          eq(supportConversations.visitorTokenHash, visitorTokenHash),
          eq(supportConversations.strategyKey, strategyKey),
        ),
      )
      .limit(1);
    return rows.length ? toConversationRow(rows[0]) : null;
  }

  async findConversationById(id: number) {
    const rows = await this.db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.id, id))
      .limit(1);
    return rows.length ? toConversationRow(rows[0]) : null;
  }

  async findConversationByPublicNo(publicNo: string) {
    const rows = await this.db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.publicNo, publicNo))
      .limit(1);
    return rows.length ? toConversationRow(rows[0]) : null;
  }

  async appendMessage(input: AppendMessageInput) {
    const clientMsgId = input.clientMsgId?.trim() || null;
    let created = true;
    try {
      await this.db.insert(supportMessages).values({
        conversationId: input.conversationId,
        role: input.role,
        body: input.body,
        clientMsgId,
        autoRuleKey: input.autoRuleKey ?? null,
        operatorId: input.operatorId ?? null,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error) || !clientMsgId) throw error;
      created = false;
    }

    if (!created) {
      const rows = await this.db
        .select()
        .from(supportMessages)
        .where(
          and(
            eq(supportMessages.conversationId, input.conversationId),
            eq(supportMessages.clientMsgId, clientMsgId!),
          ),
        )
        .limit(1);
      if (!rows.length) throw new Error("[support] duplicate clientMsgId without stored row");
      return { message: toMessageRow(rows[0]), created: false };
    }

    // 计数与状态跟着实际写入走，一条 UPDATE 搞定，不做读-改-写。
    if (input.role === "customer") {
      await this.db
        .update(supportConversations)
        .set({
          customerMessageCount: sql`${supportConversations.customerMessageCount} + 1`,
          lastMessageAt: sql`CURRENT_TIMESTAMP`,
          lastCustomerMessageAt: sql`CURRENT_TIMESTAMP`,
          status: sql`CASE WHEN ${supportConversations.status} = 'closed' THEN 'closed' ELSE 'open' END`,
        })
        .where(eq(supportConversations.id, input.conversationId));
    } else if (input.role === "operator") {
      await this.db
        .update(supportConversations)
        .set({
          operatorMessageCount: sql`${supportConversations.operatorMessageCount} + 1`,
          lastMessageAt: sql`CURRENT_TIMESTAMP`,
          lastOperatorMessageAt: sql`CURRENT_TIMESTAMP`,
          status: "answered",
        })
        .where(eq(supportConversations.id, input.conversationId));
    } else {
      await this.db
        .update(supportConversations)
        .set({ lastMessageAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(supportConversations.id, input.conversationId));
    }

    const rows = await this.db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.conversationId, input.conversationId))
      .orderBy(desc(supportMessages.id))
      .limit(1);
    return { message: toMessageRow(rows[0]), created: true };
  }

  async listMessages(conversationId: number, afterId: number, now: Date = new Date()) {
    const overlapFrom = new Date(now.getTime() - SUPPORT_POLL_OVERLAP_SECONDS * 1000);
    const rows = await this.db
      .select()
      .from(supportMessages)
      .where(
        and(
          eq(supportMessages.conversationId, conversationId),
          or(
            sql`${supportMessages.id} > ${afterId}`,
            gte(supportMessages.createdAt, overlapFrom),
          ),
        ),
      )
      .orderBy(asc(supportMessages.id))
      .limit(SUPPORT_HISTORY_LIMIT);
    return rows.map(toMessageRow);
  }

  async listRecentMessages(conversationId: number, limit = SUPPORT_HISTORY_LIMIT) {
    const rows = await this.db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.conversationId, conversationId))
      .orderBy(desc(supportMessages.id))
      .limit(limit);
    return rows.map(toMessageRow).reverse();
  }

  async listConversations(input: { status?: SupportStatus | "all"; limit: number; offset: number }) {
    const base = this.db.select().from(supportConversations);
    const filtered =
      input.status && input.status !== "all"
        ? base.where(eq(supportConversations.status, input.status))
        : base;
    const rows = await filtered
      .orderBy(desc(supportConversations.lastMessageAt))
      .limit(input.limit)
      .offset(input.offset);
    return rows.map(toConversationRow);
  }

  async countConversations(status?: SupportStatus | "all") {
    const base = this.db
      .select({ value: sql<number>`COUNT(*)` })
      .from(supportConversations);
    const rows =
      status && status !== "all"
        ? await base.where(eq(supportConversations.status, status))
        : await base;
    return Number(rows?.[0]?.value ?? 0);
  }

  async setStatus(conversationId: number, status: SupportStatus) {
    await this.db
      .update(supportConversations)
      .set({ status })
      .where(eq(supportConversations.id, conversationId));
  }

  async linkUser(conversationId: number, userId: number) {
    await this.db
      .update(supportConversations)
      .set({ userId })
      .where(
        and(eq(supportConversations.id, conversationId), isNull(supportConversations.userId)),
      );
  }

  async enqueueNotification(input: { dedupeKey: string; conversationId: number; summary: string }) {
    // 去重键撞上时只刷新摘要，不新增行，也不把已发出的行拖回 pending。
    await this.db.execute(sql`
      INSERT INTO support_notifications (dedupeKey, conversationId, summary, status, attempts, nextAttemptAt)
      VALUES (${input.dedupeKey}, ${input.conversationId}, ${input.summary}, 'pending', 0, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        summary = IF(status IN ('pending','held'), VALUES(summary), summary)
    `);
  }

  async claimDueNotifications(input: { now: Date; limit: number; leaseTimeoutMs: number }) {
    const staleBefore = new Date(input.now.getTime() - input.leaseTimeoutMs);
    const candidates = await this.db
      .select()
      .from(supportNotifications)
      .where(
        or(
          and(
            inArray(supportNotifications.status, ["pending", "held"]),
            sql`${supportNotifications.nextAttemptAt} <= ${input.now}`,
          ),
          and(
            eq(supportNotifications.status, "sending"),
            lt(supportNotifications.claimedAt, staleBefore),
          ),
        ),
      )
      .orderBy(asc(supportNotifications.id))
      .limit(input.limit);

    const claimed: NotificationRow[] = [];
    for (const candidate of candidates) {
      const claimToken = crypto.randomUUID();
      const result: any = await this.db.execute(sql`
        UPDATE support_notifications
        SET status = 'sending',
            attempts = attempts + 1,
            claimedAt = CURRENT_TIMESTAMP,
            claimToken = ${claimToken}
        WHERE id = ${candidate.id}
          AND status = ${candidate.status}
          AND (claimToken <=> ${candidate.claimToken ?? null})
      `);
      const affected = Number(
        result?.[0]?.affectedRows ?? result?.affectedRows ?? result?.rowsAffected ?? 0,
      );
      if (affected !== 1) continue; // 被别的实例抢走了，跳过，绝不重复投递
      claimed.push({
        ...toNotificationRow(candidate),
        status: "sending",
        attempts: (candidate.attempts ?? 0) + 1,
        claimToken,
        claimedAt: input.now,
      });
    }
    return claimed;
  }

  async finishNotification(input: {
    id: number;
    claimToken: string;
    status: "sent" | "held" | "pending" | "failed";
    nextAttemptAt?: Date;
    lastError?: string | null;
    sentAt?: Date | null;
  }) {
    await this.db
      .update(supportNotifications)
      .set({
        status: input.status,
        claimToken: null,
        claimedAt: null,
        lastError: input.lastError ?? null,
        ...(input.nextAttemptAt ? { nextAttemptAt: input.nextAttemptAt } : {}),
        ...(input.sentAt !== undefined ? { sentAt: input.sentAt } : {}),
      })
      .where(
        and(
          eq(supportNotifications.id, input.id),
          eq(supportNotifications.claimToken, input.claimToken),
        ),
      );
  }

  async listNotifications(conversationId: number) {
    const rows = await this.db
      .select()
      .from(supportNotifications)
      .where(eq(supportNotifications.conversationId, conversationId))
      .orderBy(asc(supportNotifications.id));
    return rows.map(toNotificationRow);
  }

  async hitRateLimit(input: { bucketKey: string; windowSeconds: number; now: Date }) {
    const windowStart =
      Math.floor(input.now.getTime() / 1000 / input.windowSeconds) * input.windowSeconds;
    // 单条原子自增。先 SELECT COUNT 再 INSERT 的写法在并发下会被整片绕过，这里不用。
    await this.db.execute(sql`
      INSERT INTO support_rate_limits (bucketKey, windowStart, hits)
      VALUES (${input.bucketKey}, ${windowStart}, 1)
      ON DUPLICATE KEY UPDATE hits = hits + 1
    `);
    const rows = await this.db
      .select({ hits: supportRateLimits.hits })
      .from(supportRateLimits)
      .where(
        and(
          eq(supportRateLimits.bucketKey, input.bucketKey),
          eq(supportRateLimits.windowStart, windowStart),
        ),
      )
      .limit(1);
    // 回读只会读到 >= 自己那次自增的值，所以判定只会更严，不会被绕过。
    return Number(rows?.[0]?.hits ?? 1);
  }
}

// ─────────────────────────── 选择实现 ───────────────────────────

let memoryStore: MemorySupportStore | null = null;
let mysqlStore: MysqlSupportStore | null = null;
let pool: mysql.Pool | null = null;

export function getMemorySupportStore() {
  if (!memoryStore) memoryStore = new MemorySupportStore();
  return memoryStore;
}

/** 仅测试用。 */
export function resetMemorySupportStore() {
  getMemorySupportStore().reset();
}

export function createMemorySupportStore(): SupportStore {
  return new MemorySupportStore();
}

export function getSupportStore(): SupportStore {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return getMemorySupportStore();
  if (!mysqlStore) {
    pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
    mysqlStore = new MysqlSupportStore(drizzle(pool, { schema, mode: "default" }));
  }
  return mysqlStore;
}
