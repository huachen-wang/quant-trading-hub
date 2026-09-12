/**
 * 客户可见的错误文案白名单。
 *
 * 独立复核 B2：旧版聊天面板直接 `setError(err.message)`，而撞键失败时 drizzle 的错误信息是
 * `Failed query: insert into support_messages ... params: 15,customer,<客户刚打的那句话>,...`，
 * 原样渲染在聊天框上方——表结构、字段名和客户正文一起泄露给任何访客。
 *
 * 服务端现在已经统一兜底（`server/routers/support.ts` 的 `toTrpcError`），这里是第二道：
 * **只按错误码取本地文案**，服务端文案仅在明确安全的少数码上使用，且带 SQL 痕迹的一律丢弃。
 *
 * 纯函数、无 React 依赖，便于单测。
 */

export const SUPPORT_ERROR_TEXT: Record<string, string> = {
  TOO_MANY_REQUESTS: "发送太频繁了，稍等一下再试。",
  BAD_REQUEST: "这条消息发不出去，检查一下内容长度再试。",
  FORBIDDEN: "这个咨询窗口当前身份不可用，正在为你重新开一条。",
  CONFLICT: "正在为你开一条新的咨询会话，请再发一次。",
  INTERNAL_SERVER_ERROR: "咨询服务暂时不可用，请稍后再试。",
  TIMEOUT: "网络有点慢，请再试一次。",
};

/** 只有这两个码的服务端文案是我们自己写死的短句，可以直接展示。 */
const SAFE_SERVER_MESSAGE_CODES = new Set(["BAD_REQUEST", "TOO_MANY_REQUESTS"]);

/** 带这些痕迹的文本一律不展示——不管它是从哪一层漏出来的。 */
const LEAK_PATTERNS = /failed query|insert into|update .+ set |select .+ from |params:|sqlmessage/i;

const MAX_SERVER_MESSAGE_LENGTH = 80;

export function readableSupportError(error: any): string {
  const code = typeof error?.data?.code === "string" ? error.data.code : "";
  if (SAFE_SERVER_MESSAGE_CODES.has(code)) {
    const message = typeof error?.message === "string" ? error.message : "";
    if (message && !LEAK_PATTERNS.test(message) && message.length <= MAX_SERVER_MESSAGE_LENGTH) {
      return message;
    }
  }
  return SUPPORT_ERROR_TEXT[code] ?? SUPPORT_ERROR_TEXT.INTERNAL_SERVER_ERROR;
}
