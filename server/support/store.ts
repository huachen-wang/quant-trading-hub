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
 *   - 一轮对话   → 客户消息 + 计数 + 机器人回复 + 提醒排队**同一个事务**，要么全成要么全不成；
 *   - 限流计数   → `INSERT ... ON DUPLICATE KEY UPDATE` + `LAST_INSERT_ID()` 同连接回读；
 *   - 外发箱认领 → 条件 UPDATE + affectedRows 判定，租约超时可回收。
 *
 * 独立复核（`growth-sprint-20260913/eaxau-chat-review/REVIEW.md`）在真实 MySQL 8.4 上
 * 打出的 B1 就落在这里：drizzle 0.44 把驱动错误包成 `DrizzleQueryError`，
 * `code` / `errno` 只挂在 `.cause` 上，顶层是 undefined。所以撞键判定必须**顺着 cause 链找**，
 * 而且要能分辨撞的是哪一条唯一索引——撞 clientMsgId 是幂等重试，撞 publicNo 是编号碰撞要换号重来，
 * 两者混在一起会报出完全不相干的错误。
 *
 * 没有 DATABASE_URL 时（本地开发 / 快测）落到进程内存实现，语义与 MySQL 版一致。
 * 但**内存实现不是并发证据**：它永远不会抛重复键错误，撞键分支在内存里走不到。
 * 存储契约的验收以 `tests/support-mysql.test.ts`（打真库）为准。
 */

import crypto from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import {
  SUPPORT_HISTORY_LIMIT,
  SUPPORT_POLL_OVERLAP_SECONDS,
  isAutoAssistEnabled,
} from "../../shared/support/contracts";
import type {
  SupportRole,
  SupportStatus,
} from "../../shared/support/contracts";

const {
  supportConversations,
  supportMessages,
  supportNotifications,
  supportRateLimits,
} = schema;

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
  /** 自动接待开关的显式覆盖；null 表示按 operatorMessageCount 推导。见 isAutoAssistEnabled。 */
  autoAssistEnabled: boolean | null;
  notifyGeneration: number;
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
  generation: number;
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

/** 一轮客户对话要原子写入的全部内容。 */
export type CustomerTurnInput = {
  conversationId: number;
  body: string;
  clientMsgId: string;
  /**
   * 机器人这一轮**备好的**回复。写不写由存储层在持会话行锁的同一个事务里决定：
   * 会话处于真人手动接管态时整条丢弃，`autoMessage` 返回 null、`autoSuppressed` 为 true。
   *
   * 判定必须在事务里做，不能由调用方先查一次再传结论进来——「运营正在点发送」和
   * 「访客正在点发送」是两个并发事务，先查后用的那个窗口正好是抢答发生的地方。
   */
  autoReply: { body: string; ruleKey: string };
  /**
   * 事务内拿到刚更新完的会话行后调用，返回这一轮要排队的提醒。
   * 返回 null 表示不排提醒。摘要在这里构造，是为了能读到**已经加过 1** 的真实条数。
   */
  buildNotification: (
    conversation: ConversationRow,
  ) => { dedupeKey: string; summary: string } | null;
};

export type CustomerTurnResult = {
  created: boolean;
  conversation: ConversationRow;
  customerMessage: MessageRow;
  autoMessage: MessageRow | null;
  /**
   * 这一轮的自动回复被**手动接管**压掉了（客户消息照样落库、提醒照样排队，只是机器不插话）。
   *
   * 和 `autoMessage === null` 不是一回事：幂等命中的重复提交同样没有新的自动回复，
   * 但那是「这一轮压根没发生」，不是「接管中不许机器答」。调用方要分得清才能如实回话。
   */
  autoSuppressed: boolean;
  /**
   * 幂等命中了，但**这次提交的正文和当初落库的那条不一样**。
   *
   * 说明调用方拿旧的幂等键发了新内容：按幂等语义我们只能返回当初那条，新内容一个字都没进库。
   * 这时候绝不能让调用方以为「发成功了」——客户端要据此保住草稿并如实告诉客户。
   * 客户端本来就不该这么发（见 support-chat.tsx 的 pendingAttempt），这里是第二道。
   */
  bodyMismatch: boolean;
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
  appendMessage(
    input: AppendMessageInput,
  ): Promise<{ message: MessageRow; created: boolean }>;
  /** 客户消息 + 计数 + 机器人回复 + 提醒排队，一个事务内完成。 */
  appendCustomerTurn(input: CustomerTurnInput): Promise<CustomerTurnResult>;
  listMessages(
    conversationId: number,
    afterId: number,
    now?: Date,
  ): Promise<MessageRow[]>;
  listRecentMessages(
    conversationId: number,
    limit?: number,
  ): Promise<MessageRow[]>;
  listConversations(input: {
    status?: SupportStatus | "all";
    limit: number;
    offset: number;
  }): Promise<ConversationRow[]>;
  countConversations(status?: SupportStatus | "all"): Promise<number>;
  setStatus(conversationId: number, status: SupportStatus): Promise<void>;
  /**
   * 后台显式切换自动接待：`true` = 交还给机器人，`false` = 人工接管。
   *
   * 和 `appendCustomerTurn` 一样在事务里先锁会话行，所以「运营点交还」与「访客正在发消息」
   * 撞在一起时只有一种结果：要么访客那一轮看到的是交还前的状态（不自动答），
   * 要么看到交还后的状态（自动答），不会出现半边状态。返回落库后的会话行。
   */
  setAutoAssist(input: {
    conversationId: number;
    enabled: boolean;
  }): Promise<ConversationRow>;
  /**
   * 客户**显式认领**一条尚未归属的匿名会话：把归属写成该账号，同时把会话迁到新的访客令牌上。
   * 已经有归属的会话一律拒绝（返回 false），不做「后来者自动继承前一位的记录」。
   */
  claimConversationForUser(input: {
    conversationId: number;
    userId: number;
    visitorTokenHash: string;
  }): Promise<boolean>;
  enqueueNotification(input: {
    dedupeKey: string;
    conversationId: number;
    generation: number;
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
    /** 显式回写尝试次数。用于「这一次认领根本没真的投递」的情况（dry_run）。 */
    attempts?: number;
  }): Promise<void>;
  listNotifications(conversationId: number): Promise<NotificationRow[]>;
  /** 后台列表用：一次取多条会话的最新提醒，避免逐行查询。 */
  latestNotificationByConversation(
    conversationIds: number[],
  ): Promise<Map<number, NotificationRow>>;
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
  // 拒绝采样去掉模偏：256 % 29 != 0，直接取模会让前几个字符略微偏多。
  const out: string[] = [];
  const limit = 256 - (256 % PUBLIC_NO_ALPHABET.length);
  while (out.length < 7) {
    for (const byte of crypto.randomBytes(8)) {
      if (byte >= limit) continue;
      out.push(PUBLIC_NO_ALPHABET[byte % PUBLIC_NO_ALPHABET.length]);
      if (out.length === 7) break;
    }
  }
  return `EAX-${out.join("")}`;
}

/** MySQL 唯一索引名。撞键后要按索引名分流，不能把所有 1062 当成同一回事。 */
export const UNIQUE_INDEX = {
  conversationVisitorStrategy:
    "support_conversation_visitor_strategy_unique_idx",
  conversationPublicNo: "support_conversations_publicNo_unique",
  messageClientMsgId: "support_message_client_msg_unique_idx",
  notificationDedupeKey: "support_notifications_dedupeKey_unique",
} as const;

/** cause 链最多往下走这么深；防环、防异常深的包装链。 */
const MAX_CAUSE_DEPTH = 8;

/** 顺着 cause 链找第一个满足条件的驱动错误。drizzle 会把 mysql2 的错误包起来。 */
function findDriverError(
  error: unknown,
  match: (candidate: any) => boolean,
): any | null {
  const seen = new Set<unknown>();
  let current: any = error;
  for (
    let depth = 0;
    depth < MAX_CAUSE_DEPTH && current && typeof current === "object";
    depth++
  ) {
    if (seen.has(current)) break;
    seen.add(current);
    if (match(current)) return current;
    current = current.cause;
  }
  return null;
}

/**
 * InnoDB 死锁（1213）。并发写同一批行时是**预期内**的：MySQL 选一个事务回滚，
 * 重试就好，不该把它当成业务失败丢给客户。
 */
export function isDeadlockError(error: unknown) {
  return Boolean(
    findDriverError(
      error,
      (e) => e.code === "ER_LOCK_DEADLOCK" || e.errno === 1213,
    ),
  );
}

/** 锁等待超时（1205），同样值得重试一次。 */
function isLockWaitTimeout(error: unknown) {
  return Boolean(
    findDriverError(
      error,
      (e) => e.code === "ER_LOCK_WAIT_TIMEOUT" || e.errno === 1205,
    ),
  );
}

const DEADLOCK_RETRIES = 3;

/**
 * 死锁 / 锁等待超时时退让重试。
 *
 * 这条是打真库才发现的：把限流计数放进事务以后，多连接并发写同一行会稳定触发
 * `ER_LOCK_DEADLOCK`，内存适配器上完全看不到。重试前退让几毫秒，避免两边同步重试再撞。
 */
async function withDeadlockRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= DEADLOCK_RETRIES; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isDeadlockError(error) && !isLockWaitTimeout(error)) throw error;
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, 5 * (attempt + 1) + Math.random() * 10),
      );
    }
  }
  throw lastError;
}

/**
 * 顺着 `cause` 链找重复键错误，命中时返回**被违反的唯一索引名**（找不到索引名时返回空串）。
 *
 * 这是复核 B1 的修复点：drizzle-orm 0.44 抛的是 `DrizzleQueryError`，
 * 顶层既没有 `code` 也没有 `errno`，真正的 `ER_DUP_ENTRY` / 1062 挂在 `error.cause` 上。
 * 只看顶层 → 判定永远为 false → 幂等重试和并发建会话全部变成 HTTP 500。
 */
export function findDuplicateKeyName(error: unknown): string | null {
  const hit = findDriverError(
    error,
    (e) => e.code === "ER_DUP_ENTRY" || e.errno === 1062,
  );
  if (!hit) return null;
  const message =
    typeof hit.sqlMessage === "string"
      ? hit.sqlMessage
      : String(hit.message ?? "");
  const matched = message.match(/for key '([^']+)'/);
  const raw = matched?.[1] ?? "";
  // MySQL 8 报的是 `表名.索引名`，这里只留索引名。
  return raw.includes(".") ? raw.slice(raw.lastIndexOf(".") + 1) : raw;
}

export function isDuplicateKeyError(error: unknown) {
  return findDuplicateKeyName(error) !== null;
}

/** mysql2 的 INSERT 结果形状是 `[ResultSetHeader, FieldPacket[]]`，取自增主键。 */
function extractInsertId(result: any): number {
  const header = Array.isArray(result) ? result[0] : result;
  const id = Number(header?.insertId ?? 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function extractAffectedRows(result: any): number {
  const header = Array.isArray(result) ? result[0] : result;
  const value = Number(header?.affectedRows ?? header?.rowsAffected ?? 0);
  return Number.isFinite(value) ? value : 0;
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
      if (
        row.visitorTokenHash === visitorTokenHash &&
        row.strategyKey === strategyKey
      )
        return row;
    }
    return null;
  }

  async ensureConversation(
    input: EnsureConversationInput,
  ): Promise<ConversationRow> {
    const strategyKey =
      input.strategyId && input.strategyId > 0 ? input.strategyId : 0;
    // 下面这段刻意保持同步，等价于 (visitorTokenHash, strategyKey) 上的唯一索引。
    const existing = this.findConversationSync(
      input.visitorTokenHash,
      strategyKey,
    );
    if (existing) {
      const row = existing;
      // 商品标题/页面地址可能后来才补全，但归属和编号绝不改。
      if (!row.strategyTitle && input.strategyTitle)
        row.strategyTitle = input.strategyTitle;
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
      // 新会话没人表过态：走推导分支（运营 0 条 → 自动接待开着）。
      autoAssistEnabled: null,
      notifyGeneration: 0,
      lastMessageAt: now,
      lastCustomerMessageAt: null,
      lastOperatorMessageAt: null,
      createdAt: now,
    };
    this.conversations.set(row.id, row);
    return cloneConversation(row);
  }

  async findConversationByVisitor(
    visitorTokenHash: string,
    strategyKey: number,
  ) {
    const row = this.findConversationSync(visitorTokenHash, strategyKey);
    return row ? cloneConversation(row) : null;
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

  private findMessageByClientMsgIdSync(
    conversationId: number,
    clientMsgId: string,
  ) {
    return (
      this.messages.find(
        (m) =>
          m.conversationId === conversationId && m.clientMsgId === clientMsgId,
      ) ?? null
    );
  }

  private appendMessageSync(input: AppendMessageInput) {
    const clientMsgId = input.clientMsgId?.trim() || null;
    if (clientMsgId) {
      const duplicate = this.findMessageByClientMsgIdSync(
        input.conversationId,
        clientMsgId,
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
        // 运营开口 = 手动接管。显式写 false（而不是留 null 靠推导）是为了覆盖
        // 「先交还了自动接待、运营又回了一条」：那时 autoAssistEnabled 是 true，
        // 光靠 operatorMessageCount 推不出来，机器人会继续抢答。
        conversation.autoAssistEnabled = false;
      }
    }
    return { message: { ...message }, created: true };
  }

  async appendMessage(input: AppendMessageInput) {
    return this.appendMessageSync(input);
  }

  /** 内存版的「事务」= 整段同步执行，中途没有 await 让别的请求插进来。 */
  async appendCustomerTurn(
    input: CustomerTurnInput,
  ): Promise<CustomerTurnResult> {
    // 真库版在这里先 `SELECT ... FOR UPDATE` 锁会话行。内存版整段同步执行，
    // 「读到的就是没人能改的」天然成立，取值的**位置**保持一致：写客户消息之前先定状态。
    const before = this.conversations.get(input.conversationId);
    if (!before) throw new Error("[support] conversation vanished mid-turn");
    const autoAssist = isAutoAssistEnabled(before);

    const stored = this.appendMessageSync({
      conversationId: input.conversationId,
      role: "customer",
      body: input.body,
      clientMsgId: input.clientMsgId,
    });
    const conversationAfter = this.conversations.get(input.conversationId)!;
    if (!stored.created) {
      return {
        created: false,
        conversation: cloneConversation(conversationAfter),
        customerMessage: stored.message,
        autoMessage: null,
        autoSuppressed: false,
        bodyMismatch: stored.message.body !== input.body,
      };
    }
    // 接管中：机器不插进人与人的对话。客户消息已经落库，提醒照排（见下），只是不自动答。
    const auto = autoAssist
      ? this.appendMessageSync({
          conversationId: input.conversationId,
          role: "auto",
          body: input.autoReply.body,
          autoRuleKey: input.autoReply.ruleKey,
        })
      : null;
    const live = this.conversations.get(input.conversationId)!;
    // 与 MySQL 版同一套自愈规则：代数取「计数列」与「已终结提醒条数」的较大者。
    const terminalCount = [...this.notifications.values()].filter(
      (row) =>
        row.conversationId === input.conversationId &&
        (row.status === "sent" || row.status === "failed"),
    ).length;
    live.notifyGeneration = Math.max(live.notifyGeneration, terminalCount);
    const fresh = cloneConversation(live);
    const notification = input.buildNotification(fresh);
    if (notification) {
      this.enqueueNotificationSync({
        dedupeKey: notification.dedupeKey,
        conversationId: input.conversationId,
        generation: fresh.notifyGeneration,
        summary: notification.summary,
      });
    }
    return {
      created: true,
      conversation: fresh,
      customerMessage: stored.message,
      autoMessage: auto?.message ?? null,
      autoSuppressed: !autoAssist,
      bodyMismatch: false,
    };
  }

  async listMessages(
    conversationId: number,
    afterId: number,
    now: Date = new Date(),
  ) {
    const overlapFrom = new Date(
      now.getTime() - SUPPORT_POLL_OVERLAP_SECONDS * 1000,
    );
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

  async listRecentMessages(
    conversationId: number,
    limit = SUPPORT_HISTORY_LIMIT,
  ) {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.id - b.id)
      .slice(-limit)
      .map((m) => ({ ...m }));
  }

  async listConversations(input: {
    status?: SupportStatus | "all";
    limit: number;
    offset: number;
  }) {
    const rows = [...this.conversations.values()]
      .filter(
        (row) =>
          !input.status ||
          input.status === "all" ||
          row.status === input.status,
      )
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    return rows
      .slice(input.offset, input.offset + input.limit)
      .map(cloneConversation);
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

  async setAutoAssist(input: { conversationId: number; enabled: boolean }) {
    const row = this.conversations.get(input.conversationId);
    if (!row) throw new Error("[support] conversation not found");
    row.autoAssistEnabled = input.enabled;
    return cloneConversation(row);
  }

  async claimConversationForUser(input: {
    conversationId: number;
    userId: number;
    visitorTokenHash: string;
  }) {
    const row = this.conversations.get(input.conversationId);
    if (!row || row.userId !== null) return false;
    // 目标令牌在同一商品上已经有会话了就不认领，避免撞唯一索引。
    const occupied = this.findConversationSync(
      input.visitorTokenHash,
      row.strategyKey,
    );
    if (occupied && occupied.id !== row.id) return false;
    row.userId = input.userId;
    row.visitorTokenHash = input.visitorTokenHash;
    return true;
  }

  private enqueueNotificationSync(input: {
    dedupeKey: string;
    conversationId: number;
    generation: number;
    summary: string;
  }) {
    for (const row of this.notifications.values()) {
      if (row.dedupeKey === input.dedupeKey) {
        // 还没发出去的，直接把摘要刷成最新（客户追问不会被吞掉，也不会重复轰炸）。
        if (row.status === "pending" || row.status === "held")
          row.summary = input.summary;
        return;
      }
    }
    const row: NotificationRow = {
      id: this.nextNotificationId++,
      dedupeKey: input.dedupeKey,
      conversationId: input.conversationId,
      generation: input.generation,
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

  async enqueueNotification(input: {
    dedupeKey: string;
    conversationId: number;
    generation: number;
    summary: string;
  }) {
    this.enqueueNotificationSync(input);
  }

  async claimDueNotifications(input: {
    now: Date;
    limit: number;
    leaseTimeoutMs: number;
  }) {
    const claimed: NotificationRow[] = [];
    const staleBefore = new Date(input.now.getTime() - input.leaseTimeoutMs);
    for (const row of [...this.notifications.values()].sort(
      (a, b) => a.id - b.id,
    )) {
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
    attempts?: number;
  }) {
    const row = this.notifications.get(input.id);
    if (!row || row.claimToken !== input.claimToken) return;
    row.status = input.status;
    if (input.attempts !== undefined) row.attempts = Math.max(0, input.attempts);
    row.claimToken = null;
    row.claimedAt = null;
    if (input.nextAttemptAt) row.nextAttemptAt = input.nextAttemptAt;
    row.lastError = input.lastError ?? null;
    if (input.sentAt !== undefined) row.sentAt = input.sentAt;
    if (input.status === "sent" || input.status === "failed") {
      // 这一代结束了：之后的新消息进入下一代，排新的一条提醒，不会被去重键吞掉。
      const conversation = this.conversations.get(row.conversationId);
      if (conversation) {
        conversation.notifyGeneration = Math.max(
          conversation.notifyGeneration,
          row.generation + 1,
        );
      }
    }
  }

  async listNotifications(conversationId: number) {
    return [...this.notifications.values()]
      .filter((row) => row.conversationId === conversationId)
      .sort((a, b) => a.id - b.id)
      .map((row) => ({ ...row }));
  }

  async latestNotificationByConversation(conversationIds: number[]) {
    const result = new Map<number, NotificationRow>();
    for (const row of [...this.notifications.values()].sort(
      (a, b) => a.id - b.id,
    )) {
      if (!conversationIds.includes(row.conversationId)) continue;
      result.set(row.conversationId, { ...row });
    }
    return result;
  }

  async hitRateLimit(input: {
    bucketKey: string;
    windowSeconds: number;
    now: Date;
  }) {
    const windowStart =
      Math.floor(input.now.getTime() / 1000 / input.windowSeconds) *
      input.windowSeconds;
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
    // MySQL 存的是 tinyint：0/1 要压成 boolean，NULL / undefined 一律回 null
    // （null 是有语义的「没人表过态」，不能被 Boolean() 压成 false）。
    autoAssistEnabled:
      row.autoAssistEnabled === null || row.autoAssistEnabled === undefined
        ? null
        : Boolean(row.autoAssistEnabled),
    notifyGeneration: row.notifyGeneration ?? 0,
    lastMessageAt: new Date(row.lastMessageAt),
    lastCustomerMessageAt: row.lastCustomerMessageAt
      ? new Date(row.lastCustomerMessageAt)
      : null,
    lastOperatorMessageAt: row.lastOperatorMessageAt
      ? new Date(row.lastOperatorMessageAt)
      : null,
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
    generation: row.generation ?? 0,
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

/** 换 publicNo 重试的次数上限。编号空间 29^7 ≈ 1.7e10，撞一次都算稀奇，3 次足够。 */
const PUBLIC_NO_RETRIES = 3;

class MysqlSupportStore implements SupportStore {
  readonly kind = "mysql" as const;
  constructor(
    private readonly db: any,
    /** 限流计数要拿**同一条连接**跑两句 SQL，drizzle 只在事务里给连接，所以直接用池。 */
    private readonly pool: mysql.Pool,
  ) {}

  async ensureConversation(
    input: EnsureConversationInput,
  ): Promise<ConversationRow> {
    const strategyKey =
      input.strategyId && input.strategyId > 0 ? input.strategyId : 0;
    const existing = await this.findConversationByVisitor(
      input.visitorTokenHash,
      strategyKey,
    );
    if (existing) return existing;

    for (let attempt = 0; attempt <= PUBLIC_NO_RETRIES; attempt++) {
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
        const inserted = await this.findConversationByVisitor(
          input.visitorTokenHash,
          strategyKey,
        );
        if (!inserted)
          throw new Error("[support] conversation inserted but not readable");
        return inserted;
      } catch (error) {
        const key = findDuplicateKeyName(error);
        if (key === null) throw error;
        if (key === UNIQUE_INDEX.conversationPublicNo) {
          // 会话编号撞了（概率极低）：换一个编号再来，不要报成「并发建会话」。
          continue;
        }
        // 撞的是 (访客, 商品) 唯一索引 —— 另一个并发请求刚建好同一条线，回读即可。
        const raced = await this.findConversationByVisitor(
          input.visitorTokenHash,
          strategyKey,
        );
        if (raced) return raced;
        throw error;
      }
    }
    throw new Error(
      "[support] could not allocate a unique conversation number",
    );
  }

  async findConversationByVisitor(
    visitorTokenHash: string,
    strategyKey: number,
  ) {
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

  /**
   * 在事务里**排他锁住**会话行并读回来。
   *
   * 手动接管这件事全靠它：`appendCustomerTurn`（访客说话）和 `appendMessage`（运营回复）
   * 都在自己的事务最开始锁同一行，于是两者只能一前一后，不会出现
   * 「运营的回复已提交、访客那一轮读到的还是接管前的状态、机器人抢在中间答了一句」。
   *
   * 两条路径的加锁顺序一致（先会话行、后消息行），不引入新的死锁环；真撞上了
   * `withDeadlockRetry` 会重试整个事务。
   */
  private async lockConversationOn(
    executor: any,
    conversationId: number,
  ): Promise<ConversationRow> {
    const rows = await executor
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.id, conversationId))
      .for("update");
    if (!rows.length) throw new Error("[support] conversation not found");
    return toConversationRow(rows[0]);
  }

  /**
   * 在给定执行器（db 或事务）上写一条消息并更新会话计数。
   * 回读走**自增主键**，不是 `ORDER BY id DESC LIMIT 1` —— 并发下「会话里 id 最大的那行」
   * 根本不保证是自己刚写的那行（复核 H2 实测两个并发 append 拿回同一行）。
   */
  private async appendMessageOn(
    executor: any,
    input: AppendMessageInput,
  ): Promise<{ message: MessageRow; created: boolean }> {
    const clientMsgId = input.clientMsgId?.trim() || null;
    let insertId = 0;
    try {
      const result = await executor.insert(supportMessages).values({
        conversationId: input.conversationId,
        role: input.role,
        body: input.body,
        clientMsgId,
        autoRuleKey: input.autoRuleKey ?? null,
        operatorId: input.operatorId ?? null,
      });
      insertId = extractInsertId(result);
    } catch (error) {
      const key = findDuplicateKeyName(error);
      if (key === null || !clientMsgId) throw error;
      if (key !== "" && key !== UNIQUE_INDEX.messageClientMsgId) throw error;
      // 幂等：同一 clientMsgId 已经落过库，回读那一行，不再计数、不再触发自动回复。
      const rows = await executor
        .select()
        .from(supportMessages)
        .where(
          and(
            eq(supportMessages.conversationId, input.conversationId),
            eq(supportMessages.clientMsgId, clientMsgId),
          ),
        )
        .limit(1);
      if (!rows.length)
        throw new Error("[support] duplicate clientMsgId without stored row");
      return { message: toMessageRow(rows[0]), created: false };
    }

    // 计数与状态跟着实际写入走，一条 UPDATE 搞定，不做读-改-写。
    if (input.role === "customer") {
      await executor
        .update(supportConversations)
        .set({
          customerMessageCount: sql`${supportConversations.customerMessageCount} + 1`,
          lastMessageAt: sql`CURRENT_TIMESTAMP`,
          lastCustomerMessageAt: sql`CURRENT_TIMESTAMP`,
          status: sql`CASE WHEN ${supportConversations.status} = 'closed' THEN 'closed' ELSE 'open' END`,
        })
        .where(eq(supportConversations.id, input.conversationId));
    } else if (input.role === "operator") {
      await executor
        .update(supportConversations)
        .set({
          operatorMessageCount: sql`${supportConversations.operatorMessageCount} + 1`,
          lastMessageAt: sql`CURRENT_TIMESTAMP`,
          lastOperatorMessageAt: sql`CURRENT_TIMESTAMP`,
          status: "answered",
          // 运营开口 = 手动接管，和计数写在同一条 UPDATE 里。显式落 false 而不是留 NULL：
          // 「交还过自动接待之后运营又回了一条」这种情况列里是 true，光靠计数推不回来。
          autoAssistEnabled: false,
        })
        .where(eq(supportConversations.id, input.conversationId));
    } else {
      await executor
        .update(supportConversations)
        .set({ lastMessageAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(supportConversations.id, input.conversationId));
    }

    const rows = insertId
      ? await executor
          .select()
          .from(supportMessages)
          .where(eq(supportMessages.id, insertId))
          .limit(1)
      : await executor
          .select()
          .from(supportMessages)
          .where(
            and(
              eq(supportMessages.conversationId, input.conversationId),
              clientMsgId
                ? eq(supportMessages.clientMsgId, clientMsgId)
                : eq(supportMessages.body, input.body),
            ),
          )
          .orderBy(desc(supportMessages.id))
          .limit(1);
    if (!rows.length)
      throw new Error("[support] inserted message not readable");
    return { message: toMessageRow(rows[0]), created: true };
  }

  async appendMessage(input: AppendMessageInput) {
    return withDeadlockRetry<{ message: MessageRow; created: boolean }>(() =>
      this.db.transaction(async (tx: any) => {
        // 先锁会话行再写消息，和 appendCustomerTurn 同一个顺序。运营回复走的就是这条路径，
        // 锁拿到之后同一事务里把 autoAssistEnabled 写成 false，接管态和回复同生共死。
        await this.lockConversationOn(tx, input.conversationId);
        return this.appendMessageOn(tx, input);
      }),
    );
  }

  /**
   * 一轮客户对话的原子写入：客户消息 → 会话计数 → 机器人回复 → 提醒排队。
   *
   * 全在一个事务里。复核 H3 指出的场景——「机器人回复 INSERT 失败，客户重试又命中幂等直接返回，
   * 于是这条消息永远等不到回复」——在这里不可能发生：要么四件事全成，要么全部回滚、
   * 客户拿到失败提示后重试会重新走完整流程，计数也不会虚增。
   */
  async appendCustomerTurn(
    input: CustomerTurnInput,
  ): Promise<CustomerTurnResult> {
    return withDeadlockRetry<CustomerTurnResult>(() =>
      this.db.transaction(async (tx: any) => {
        // 第一件事就是锁住会话行并读出接管状态。锁在手里，`replyAsOperator` 的事务
        // 只能排在这一轮的前面或后面——不会有「运营刚回完、机器人又抢答一句」的中间态。
        const locked = await this.lockConversationOn(tx, input.conversationId);
        const autoAssist = isAutoAssistEnabled(locked);

        const stored = await this.appendMessageOn(tx, {
          conversationId: input.conversationId,
          role: "customer",
          body: input.body,
          clientMsgId: input.clientMsgId,
        });

        const readConversation = async () => {
          const rows = await tx
            .select()
            .from(supportConversations)
            .where(eq(supportConversations.id, input.conversationId))
            .limit(1);
          if (!rows.length)
            throw new Error("[support] conversation vanished mid-turn");
          return toConversationRow(rows[0]);
        };

        if (!stored.created) {
          return {
            created: false,
            conversation: await readConversation(),
            customerMessage: stored.message,
            autoMessage: null,
            autoSuppressed: false,
            bodyMismatch: stored.message.body !== input.body,
          };
        }

        // 手动接管中就不写自动回复。客户消息已经在库里，提醒下面照排——
        // 「只保存 + 通知，不自动答」这一句的实现就是这两行。
        const auto = autoAssist
          ? await this.appendMessageOn(tx, {
              conversationId: input.conversationId,
              role: "auto",
              body: input.autoReply.body,
              autoRuleKey: input.autoReply.ruleKey,
            })
          : null;

        const fresh = await readConversation();
        // 代数要**自愈**：不能只信 notifyGeneration 那一列。万一某条提醒是被别的路径
        // （人工改库、迁移脚本、旧版本代码）标成终态的，计数列没跟上，新消息就会撞回旧的
        // 去重键被吞掉。这里同时看「已终结的提醒条数」，取大的那个。
        const terminal = await tx
          .select({ value: sql<number>`COUNT(*)` })
          .from(supportNotifications)
          .where(
            and(
              eq(supportNotifications.conversationId, input.conversationId),
              inArray(supportNotifications.status, ["sent", "failed"]),
            ),
          );
        const generation = Math.max(fresh.notifyGeneration, Number(terminal?.[0]?.value ?? 0));
        if (generation !== fresh.notifyGeneration) {
          await tx
            .update(supportConversations)
            .set({ notifyGeneration: generation })
            .where(eq(supportConversations.id, input.conversationId));
          fresh.notifyGeneration = generation;
        }

        const notification = input.buildNotification(fresh);
        if (notification) {
          await this.enqueueNotificationOn(tx, {
            dedupeKey: notification.dedupeKey,
            conversationId: input.conversationId,
            generation,
            summary: notification.summary,
          });
        }

        return {
          created: true,
          conversation: fresh,
          customerMessage: stored.message,
          autoMessage: auto?.message ?? null,
          autoSuppressed: !autoAssist,
          bodyMismatch: false,
        };
      }),
    );
  }

  async listMessages(
    conversationId: number,
    afterId: number,
    now: Date = new Date(),
  ) {
    const overlapFrom = new Date(
      now.getTime() - SUPPORT_POLL_OVERLAP_SECONDS * 1000,
    );
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

  async listRecentMessages(
    conversationId: number,
    limit = SUPPORT_HISTORY_LIMIT,
  ) {
    const rows = await this.db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.conversationId, conversationId))
      .orderBy(desc(supportMessages.id))
      .limit(limit);
    return rows.map(toMessageRow).reverse();
  }

  async listConversations(input: {
    status?: SupportStatus | "all";
    limit: number;
    offset: number;
  }) {
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

  async setAutoAssist(input: { conversationId: number; enabled: boolean }) {
    return withDeadlockRetry<ConversationRow>(() =>
      this.db.transaction(async (tx: any) => {
        // 同样先锁行：和正在进行的那一轮访客对话排队，不会切一半。
        await this.lockConversationOn(tx, input.conversationId);
        await tx
          .update(supportConversations)
          .set({ autoAssistEnabled: input.enabled })
          .where(eq(supportConversations.id, input.conversationId));
        const rows = await tx
          .select()
          .from(supportConversations)
          .where(eq(supportConversations.id, input.conversationId))
          .limit(1);
        if (!rows.length) throw new Error("[support] conversation not found");
        return toConversationRow(rows[0]);
      }),
    );
  }

  async claimConversationForUser(input: {
    conversationId: number;
    userId: number;
    visitorTokenHash: string;
  }) {
    return withDeadlockRetry<boolean>(() =>
      this.db.transaction(async (tx: any) => {
        const rows = await tx
          .select()
          .from(supportConversations)
          .where(eq(supportConversations.id, input.conversationId))
          .limit(1);
        if (!rows.length) return false;
        const conversation = toConversationRow(rows[0]);
        if (conversation.userId !== null) return false;
        const occupied = await tx
          .select({ id: supportConversations.id })
          .from(supportConversations)
          .where(
            and(
              eq(supportConversations.visitorTokenHash, input.visitorTokenHash),
              eq(supportConversations.strategyKey, conversation.strategyKey),
            ),
          )
          .limit(1);
        if (occupied.length && occupied[0].id !== conversation.id) return false;
        const result = await tx
          .update(supportConversations)
          .set({
            userId: input.userId,
            visitorTokenHash: input.visitorTokenHash,
          })
          .where(
            and(
              eq(supportConversations.id, input.conversationId),
              sql`${supportConversations.userId} IS NULL`,
            ),
          );
        return extractAffectedRows(result) === 1;
      }),
    );
  }

  private async enqueueNotificationOn(
    executor: any,
    input: {
      dedupeKey: string;
      conversationId: number;
      generation: number;
      summary: string;
    },
  ) {
    // 去重键含「提醒代数」：同一代（上一条提醒还没发出去）只更新摘要，不重复排队；
    // 上一条一旦发出或失败，代数 +1，新消息落到新的去重键上，**不会被吞掉**。
    await executor.execute(sql`
      INSERT INTO support_notifications
        (dedupeKey, conversationId, generation, summary, status, attempts, nextAttemptAt)
      VALUES
        (${input.dedupeKey}, ${input.conversationId}, ${input.generation}, ${input.summary},
         'pending', 0, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        summary = IF(status IN ('pending','held'), VALUES(summary), summary)
    `);
  }

  async enqueueNotification(input: {
    dedupeKey: string;
    conversationId: number;
    generation: number;
    summary: string;
  }) {
    await this.enqueueNotificationOn(this.db, input);
  }

  async claimDueNotifications(input: {
    now: Date;
    limit: number;
    leaseTimeoutMs: number;
  }) {
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
      if (extractAffectedRows(result) !== 1) continue; // 被别的实例抢走了，绝不重复投递
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
    attempts?: number;
  }) {
    await withDeadlockRetry(() =>
      this.db.transaction(async (tx: any) => {
        const rows = await tx
          .select()
          .from(supportNotifications)
          .where(
            and(
              eq(supportNotifications.id, input.id),
              eq(supportNotifications.claimToken, input.claimToken),
            ),
          )
          .limit(1);
        if (!rows.length) return;
        const row = toNotificationRow(rows[0]);
        await tx
          .update(supportNotifications)
          .set({
            status: input.status,
            claimToken: null,
            claimedAt: null,
            lastError: input.lastError ?? null,
            ...(input.nextAttemptAt
              ? { nextAttemptAt: input.nextAttemptAt }
              : {}),
            ...(input.sentAt !== undefined ? { sentAt: input.sentAt } : {}),
            // dry_run 的 held 会把 attempts 退回认领前的值：那一轮根本没往外发过。
            ...(input.attempts !== undefined
              ? { attempts: Math.max(0, input.attempts) }
              : {}),
          })
          .where(eq(supportNotifications.id, input.id));
        if (input.status === "sent" || input.status === "failed") {
          await tx
            .update(supportConversations)
            .set({
              notifyGeneration: sql`GREATEST(${supportConversations.notifyGeneration}, ${row.generation + 1})`,
            })
            .where(eq(supportConversations.id, row.conversationId));
        }
      }),
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

  async latestNotificationByConversation(conversationIds: number[]) {
    const result = new Map<number, NotificationRow>();
    if (!conversationIds.length) return result;
    // 一次取回，不再逐行查询（复核 M4 的 N+1）。
    const rows = await this.db
      .select()
      .from(supportNotifications)
      .where(inArray(supportNotifications.conversationId, conversationIds))
      .orderBy(asc(supportNotifications.id));
    for (const raw of rows) {
      const row = toNotificationRow(raw);
      result.set(row.conversationId, row);
    }
    return result;
  }

  async hitRateLimit(input: {
    bucketKey: string;
    windowSeconds: number;
    now: Date;
  }) {
    const windowStart =
      Math.floor(input.now.getTime() / 1000 / input.windowSeconds) *
      input.windowSeconds;
    // 自增和回读必须在**同一条连接**上（LAST_INSERT_ID 是连接级的），否则并发时回读到的是
    // 别人的计数，判定会比实际更严（复核 M1 实测：并发 20 次全部被拒，一条都没放行）。
    //
    // 但**不能开事务**：打真库实测，把这两句放进 BEGIN/COMMIT 后，多连接并发写同一行会稳定
    // 触发 ER_LOCK_DEADLOCK（内存适配器上完全看不到这个）。autocommit 下每句立即提交、
    // 锁马上释放，既拿得到本连接的 LAST_INSERT_ID，又不会互相咬死。
    return withDeadlockRetry(async () => {
      const connection = await this.pool.getConnection();
      try {
        await connection.query(
          `INSERT INTO support_rate_limits (bucketKey, windowStart, hits)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE hits = LAST_INSERT_ID(hits + 1)`,
          [input.bucketKey, windowStart],
        );
        // 新插入时 ROW_COUNT() = 1，计数就是 1；命中重复键时 ROW_COUNT() = 2，取 LAST_INSERT_ID()。
        const [rows]: any = await connection.query(
          "SELECT IF(ROW_COUNT() = 1, 1, LAST_INSERT_ID()) AS hits",
        );
        const value = Number(rows?.[0]?.hits ?? 1);
        return Number.isFinite(value) && value > 0 ? value : 1;
      } finally {
        connection.release();
      }
    });
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

/** 用给定连接串建一个 MySQL store（测试用；生产走 `getSupportStore()` 的共享池）。 */
export function createMysqlSupportStore(connectionUri: string): {
  store: SupportStore;
  close: () => Promise<void>;
} {
  const testPool = mysql.createPool({
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 8,
    queueLimit: 0,
  });
  return {
    store: new MysqlSupportStore(
      drizzle(testPool, { schema, mode: "default" }),
      testPool,
    ),
    close: () => testPool.end(),
  };
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
    mysqlStore = new MysqlSupportStore(
      drizzle(pool, { schema, mode: "default" }),
      pool,
    );
  }
  return mysqlStore;
}
