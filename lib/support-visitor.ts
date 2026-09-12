/**
 * 访客身份：一枚存在本机的随机令牌，用来把同一个人的咨询会话接上。
 *
 * 它是个「能读回自己会话」的凭据，所以：
 *   - 优先用 WebCrypto 取随机数（网页端一定有）；实在没有才退回 Math.random，
 *     并在注释里写明这是弱随机，不能当安全边界用；
 *   - 只存本机，不进任何日志；服务端只保存它的 sha256。
 *
 * 服务端还有第二道闸：会话一旦绑定登录账号，光有令牌也读不回去。
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const VISITOR_TOKEN_KEY = "eaxau_support_visitor_token";
const TOKEN_BYTES = 24;

function randomToken() {
  const webCrypto = (globalThis as any)?.crypto;
  if (webCrypto?.getRandomValues) {
    const bytes = new Uint8Array(TOKEN_BYTES);
    webCrypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // 退路：仅为了不在缺少 WebCrypto 的运行时直接崩掉。强度不足以当安全边界，
  // 真正的越权拦截在服务端（令牌比对 + 账号归属）。
  let fallback = "";
  while (fallback.length < TOKEN_BYTES * 2) {
    fallback += Math.random().toString(36).slice(2);
  }
  return fallback.slice(0, TOKEN_BYTES * 2);
}

let cached: string | null = null;
let pending: Promise<string> | null = null;

/** 取（必要时创建）本机访客令牌。并发调用只会生成一枚。 */
export function getVisitorToken(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    try {
      const stored = await AsyncStorage.getItem(VISITOR_TOKEN_KEY);
      if (stored && stored.length >= 16) {
        cached = stored;
        return stored;
      }
    } catch {
      // 读失败就当没有，下面生成一枚新的
    }
    const token = randomToken();
    try {
      await AsyncStorage.setItem(VISITOR_TOKEN_KEY, token);
    } catch {
      // 存不下也能用完这一次会话，只是下次回来接不上历史
    }
    cached = token;
    return token;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** 生成一条消息的幂等键。同一次发送重试时必须复用同一个值。 */
export function newClientMsgId() {
  return `${Date.now().toString(36)}-${randomToken().slice(0, 16)}`;
}
