/**
 * 咨询提醒的持久外发箱。
 *
 * 三条硬约束，都是踩过的坑：
 *   1. **不在客户请求路径上 await Telegram。** 发消息先落库返回，投递由 `void` 触发的
 *      异步 drain 和 cron 兜底，Telegram 超时不能把客户的消息吞掉。
 *   2. **不做进程内内存重试。** 失败写回 `support_notifications`，带退避与租约；
 *      进程崩在 `sending` 上的行由租约超时回收，不会永久卡住。
 *   3. **摘要不含敏感内容。** 只发会话编号、商品名（服务端查库得来，不信客户端传的字符串）、
 *      消息条数、状态和后台链接。消息正文、QQ/微信/邮箱/手机号一律不进 Telegram。
 */

import { PUBLIC_SITE_ORIGIN } from "../../lib/inquiry-message";
import { getSupportStore, type SupportStore } from "./store";

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60_000;
/** 认领后多久算租约过期，可被下一轮回收。 */
export const NOTIFICATION_LEASE_TIMEOUT_MS = 5 * 60_000;
/** 未开启投递时的重扫间隔，避免 attempts 无限膨胀。 */
const DISABLED_RECHECK_MS = 6 * 60 * 60_000;
/** 同一会话的提醒节流窗口：5 分钟内只排一条。 */
export const NOTIFY_THROTTLE_SECONDS = 5 * 60;

export type TelegramConfig = {
  mode: "live" | "dry_run";
  botToken: string;
  chatId: string;
};

/**
 * 沿用本机既有 bot 的环境变量名（TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID），
 * 不新建 bot、不引入第三方推送服务。SUPPORT_ 前缀是可选的专用覆盖。
 */
export function resolveTelegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig {
  const rawMode = (env.SUPPORT_TELEGRAM_NOTIFY_MODE ?? env.TELEGRAM_NOTIFY_MODE ?? "").trim();
  const botToken = (env.SUPPORT_TELEGRAM_BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (env.SUPPORT_TELEGRAM_CHAT_ID ?? env.TELEGRAM_CHAT_ID ?? "").trim();
  // 只有精确 live 且凭据齐全才真发。缺省一律 dry_run —— 默认不对外发任何东西。
  const mode = rawMode === "live" && botToken && chatId ? "live" : "dry_run";
  return { mode, botToken, chatId };
}

export function resolveSiteOrigin(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.PUBLIC_SITE_URL?.trim();
  return (configured || PUBLIC_SITE_ORIGIN).replace(/\/+$/, "");
}

export function buildAdminConversationUrl(publicNo: string, env: NodeJS.ProcessEnv = process.env) {
  return `${resolveSiteOrigin(env)}/admin/support?no=${encodeURIComponent(publicNo)}`;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** 摘要里只允许出现这些字段。逐个清洗，换行与控制字符压平，长度封顶。 */
function sanitizeLabel(value: string | null | undefined, maxLength = 60) {
  const flattened = String(value ?? "")
    .replace(CONTROL_CHARS, " ")
    .trim();
  if (!flattened) return "";
  return flattened.length > maxLength ? `${flattened.slice(0, maxLength)}...` : flattened;
}

export type NotificationSummaryInput = {
  publicNo: string;
  /** 服务端查库得到的商品名；调用方不得直接透传客户端字符串。 */
  strategyTitle: string | null;
  strategyId: number | null;
  customerMessageCount: number;
  status: string;
  identity: "guest" | "member";
};

/**
 * 生成通知摘要。刻意不接收任何消息正文参数 —— 类型上就不给「不小心把正文塞进去」的机会。
 */
export function buildNotificationSummary(
  input: NotificationSummaryInput,
  env: NodeJS.ProcessEnv = process.env,
) {
  const title = sanitizeLabel(input.strategyTitle);
  const product = title
    ? input.strategyId
      ? `${title}（编号 ${input.strategyId}）`
      : title
    : input.strategyId
      ? `商品编号 ${input.strategyId}`
      : "未绑定商品";
  const lines = [
    "EAXAU 网页咨询｜有客户在等回复",
    `会话 ${sanitizeLabel(input.publicNo, 32)}`,
    `商品 ${product}`,
    `客户消息 ${Math.max(0, Math.trunc(input.customerMessageCount))} 条 · 状态 ${sanitizeLabel(input.status, 16)} · ${input.identity === "member" ? "已登录客户" : "访客"}`,
    "正文不进 Telegram，请到后台查看并回复：",
    buildAdminConversationUrl(input.publicNo, env),
  ];
  return lines.join("\n");
}

export function buildDedupeKey(conversationId: number, now: Date = new Date()) {
  const bucket = Math.floor(now.getTime() / 1000 / NOTIFY_THROTTLE_SECONDS);
  return `support:conv:${conversationId}:${bucket}`;
}

export type TelegramSender = (input: {
  botToken: string;
  chatId: string;
  text: string;
}) => Promise<{ ok: boolean; retryable: boolean; error?: string }>;

export const defaultTelegramSender: TelegramSender = async ({ botToken, chatId, text }) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return { ok: true, retryable: false };
    // 4xx（除 429）基本是配置错，重试也没用；429 / 5xx 值得退避重投。
    const retryable = response.status === 429 || response.status >= 500;
    return { ok: false, retryable, error: `http_${response.status}` };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error ? error.name : "transport_error",
    };
  }
};

function backoffFor(attempts: number) {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

export type DrainResult = {
  mode: "live" | "dry_run";
  claimed: number;
  sent: number;
  held: number;
  retried: number;
  failed: number;
};

export async function processDueSupportNotifications(options: {
  store?: SupportStore;
  now?: Date;
  limit?: number;
  env?: NodeJS.ProcessEnv;
  sender?: TelegramSender;
} = {}): Promise<DrainResult> {
  const store = options.store ?? getSupportStore();
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  const config = resolveTelegramConfig(env);
  const sender = options.sender ?? defaultTelegramSender;

  const claimed = await store.claimDueNotifications({
    now,
    limit: options.limit ?? 20,
    leaseTimeoutMs: NOTIFICATION_LEASE_TIMEOUT_MS,
  });

  const result: DrainResult = {
    mode: config.mode,
    claimed: claimed.length,
    sent: 0,
    held: 0,
    retried: 0,
    failed: 0,
  };

  for (const row of claimed) {
    if (config.mode !== "live") {
      // 未开启真实投递：明确记为 held，留痕但不外发，也不谎称已发送。
      await store.finishNotification({
        id: row.id,
        claimToken: row.claimToken!,
        status: "held",
        nextAttemptAt: new Date(now.getTime() + DISABLED_RECHECK_MS),
        lastError: "notify_disabled",
        sentAt: null,
      });
      result.held += 1;
      continue;
    }

    const outcome = await sender({
      botToken: config.botToken,
      chatId: config.chatId,
      text: row.summary,
    });

    if (outcome.ok) {
      await store.finishNotification({
        id: row.id,
        claimToken: row.claimToken!,
        status: "sent",
        lastError: null,
        sentAt: now,
      });
      result.sent += 1;
      continue;
    }

    const exhausted = !outcome.retryable || row.attempts >= MAX_ATTEMPTS;
    if (exhausted) {
      await store.finishNotification({
        id: row.id,
        claimToken: row.claimToken!,
        status: "failed",
        lastError: (outcome.error ?? "send_failed").slice(0, 200),
        sentAt: null,
      });
      result.failed += 1;
      continue;
    }

    await store.finishNotification({
      id: row.id,
      claimToken: row.claimToken!,
      status: "pending",
      nextAttemptAt: new Date(now.getTime() + backoffFor(row.attempts)),
      lastError: (outcome.error ?? "send_failed").slice(0, 200),
      sentAt: null,
    });
    result.retried += 1;
  }

  return result;
}

/** 客户请求路径上只用这个：投完就走，异常吞掉并打日志，绝不影响响应。 */
export function scheduleSupportNotificationDrain() {
  void processDueSupportNotifications().catch((error) => {
    console.warn("[support] notification drain failed:", error);
  });
}
