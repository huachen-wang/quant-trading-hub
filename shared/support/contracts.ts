/**
 * 站内咨询会话的公共契约。前端 / 后端 / 测试共用一份，避免字段两处漂移。
 *
 * 只放纯类型与常量，不 import 任何运行时依赖，Expo web / node 两端都能直接引。
 */

export type SupportRole = "customer" | "auto" | "operator";
export type SupportStatus = "open" | "answered" | "closed";

/** 单条消息长度上限。够写清楚一个 EA 的授权问题，又不至于被人当存储用。 */
export const SUPPORT_MESSAGE_MAX_LENGTH = 1500;
/** 会话一次回读的最大条数。 */
export const SUPPORT_HISTORY_LIMIT = 100;

/**
 * 轮询时的安全重叠窗口。
 *
 * 只按 `id > cursor` 取增量有个真实的坑：自增 id 是在 INSERT 时分配、在 COMMIT 时才可见，
 * 两个并发写入可能出现 id=6 先可见、id=5 后可见，游标一旦推到 6，第 5 条就永远读不到了。
 * 所以增量查询额外带上「最近 N 秒内创建的消息」，客户端按 id 去重合并。
 */
export const SUPPORT_POLL_OVERLAP_SECONDS = 20;

/** 前端轮询间隔（毫秒）。面板展开时才轮询，关掉就停。 */
export const SUPPORT_POLL_INTERVAL_MS = 5000;

/**
 * 自动值守的身份声明。产品要求写死：机器人必须说明自己是机器人。
 * 这段文案同时用于消息气泡上的角标和首条自动回复的开头。
 */
export const SUPPORT_AUTO_DISCLOSURE = {
  zh: "自动值守（机器人回复，不是人工）",
  en: "Automated assistant (bot reply, not a human)",
} as const;

export const SUPPORT_HUMAN_HANDOFF = {
  zh: "真人顾问看到后会在这个会话里直接回你，消息不会丢。",
  en: "A human advisor will reply in this same thread; nothing gets lost.",
} as const;

export type SupportMessageView = {
  id: number;
  role: SupportRole;
  body: string;
  /** 自动回复命中的规则 key；仅自动消息有值。 */
  autoRuleKey: string | null;
  createdAt: string;
};

export type SupportConversationView = {
  publicNo: string;
  status: SupportStatus;
  strategyId: number | null;
  strategyTitle: string | null;
  customerMessageCount: number;
  operatorMessageCount: number;
  lastMessageAt: string;
};

export type SupportSendResult = {
  conversation: SupportConversationView;
  messages: SupportMessageView[];
  /** 该 clientMsgId 之前已经落过库，本次是重复提交。 */
  duplicate: boolean;
};
