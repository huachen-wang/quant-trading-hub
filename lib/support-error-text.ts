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
 * 三语：站点有中/英/阿，错误提示也得跟着走（复核 M6）。调用方把 `useLanguage()` 的
 * `text(zh, en, ar)` 传进来；不传就退回中文，保持老调用点行为不变。
 *
 * 纯函数、无 React 依赖，便于单测。
 */

type TextFn = (chinese: string, english: string, arabic?: string) => string;

/** 每个错误码一份三语文案。 */
export const SUPPORT_ERROR_TEXT_I18N: Record<string, [string, string, string]> = {
  TOO_MANY_REQUESTS: [
    "发送太频繁了，稍等一下再试。",
    "That was a bit too fast — wait a moment and try again.",
    "الإرسال سريع جدًا — انتظر لحظة ثم أعد المحاولة.",
  ],
  BAD_REQUEST: [
    "这条消息发不出去，检查一下内容长度再试。",
    "This message could not be sent — check its length and try again.",
    "تعذّر إرسال هذه الرسالة — تحقّق من طولها ثم أعد المحاولة.",
  ],
  FORBIDDEN: [
    "这个咨询窗口当前身份不可用，正在为你重新开一条。",
    "This chat is not available for your current sign-in state; opening a fresh one for you.",
    "هذه المحادثة غير متاحة لحالة تسجيل دخولك الحالية؛ يجري فتح محادثة جديدة لك.",
  ],
  CONFLICT: [
    "正在为你开一条新的咨询会话，请再发一次。",
    "Opening a new chat thread for you — please send it once more.",
    "يجري فتح محادثة جديدة لك — من فضلك أرسل الرسالة مرة أخرى.",
  ],
  INTERNAL_SERVER_ERROR: [
    "咨询服务暂时不可用，请稍后再试。",
    "The chat service is temporarily unavailable. Please try again later.",
    "خدمة المحادثة غير متاحة مؤقتًا. يرجى المحاولة لاحقًا.",
  ],
  TIMEOUT: [
    "网络有点慢，请再试一次。",
    "The network is slow right now — please try again.",
    "الشبكة بطيئة الآن — يرجى المحاولة مرة أخرى.",
  ],
};

/** 中文视图，保留给不关心语言的调用点与既有测试。 */
export const SUPPORT_ERROR_TEXT: Record<string, string> = Object.fromEntries(
  Object.entries(SUPPORT_ERROR_TEXT_I18N).map(([code, value]) => [code, value[0]]),
);

/** 只有这两个码的服务端文案是我们自己写死的短句，可以直接展示。 */
const SAFE_SERVER_MESSAGE_CODES = new Set(["BAD_REQUEST", "TOO_MANY_REQUESTS"]);

/** 带这些痕迹的文本一律不展示——不管它是从哪一层漏出来的。 */
const LEAK_PATTERNS = /failed query|insert into|update .+ set |select .+ from |params:|sqlmessage/i;

const MAX_SERVER_MESSAGE_LENGTH = 80;

export function readableSupportError(error: any, text?: TextFn): string {
  const code = typeof error?.data?.code === "string" ? error.data.code : "";
  const localized = (key: string) => {
    const entry = SUPPORT_ERROR_TEXT_I18N[key] ?? SUPPORT_ERROR_TEXT_I18N.INTERNAL_SERVER_ERROR;
    return text ? text(entry[0], entry[1], entry[2]) : entry[0];
  };
  if (SAFE_SERVER_MESSAGE_CODES.has(code)) {
    const message = typeof error?.message === "string" ? error.message : "";
    // 服务端文案只有中文，所以只在客户用中文时才原样展示；其它语言走本地白名单。
    const chineseUi = !text || text("zh", "en", "ar") === "zh";
    if (
      chineseUi &&
      message &&
      !LEAK_PATTERNS.test(message) &&
      message.length <= MAX_SERVER_MESSAGE_LENGTH
    ) {
      return message;
    }
  }
  return localized(code);
}
