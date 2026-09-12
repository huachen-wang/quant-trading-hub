/**
 * 访客身份：一枚存在本机的随机令牌，用来把同一个人的咨询会话接上。
 *
 * 它是个「能读回自己会话」的凭据，所以：
 *   - 优先用 WebCrypto 取随机数（网页端一定有）；实在没有才退回 Math.random，
 *     并在注释里写明这是弱随机，不能当安全边界用；
 *   - 只存本机，不进任何日志；服务端只保存它的 sha256。
 *
 * **令牌跟着身份走。** 独立复核 H1 打的就是这点：旧版令牌一旦写进 localStorage 就再也不换，
 * 于是同一台电脑上「访客甲说的话被后来登录的乙读走」，乙登出后那台机器又永久 FORBIDDEN。
 * 现在令牌和「当前身份」绑在一起：登录、登出、换账号都会**重新 bootstrap 一枚新令牌**，
 * 换下来的旧令牌单独留一份，只用于客户**显式认领**自己刚才以访客身份留下的记录。
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const VISITOR_TOKEN_KEY = "eaxau_support_visitor_token";
/** 记录当前令牌是在哪个身份下 bootstrap 的：`guest` 或 `user:<id>`。 */
const VISITOR_IDENTITY_KEY = "eaxau_support_visitor_identity";
/** 换新时保留的上一枚令牌，只用于「把访客记录并入账号」的显式认领。 */
const PREVIOUS_TOKEN_KEY = "eaxau_support_previous_token";
const TOKEN_BYTES = 24;

export const GUEST_IDENTITY = "guest";

export function identityKeyFor(user: { id: number } | null | undefined) {
  return user ? `user:${user.id}` : GUEST_IDENTITY;
}

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

export type VisitorIdentity = {
  token: string;
  /** 这一次调用是否换了新令牌（身份变了 / 被服务端要求重开）。 */
  rotated: boolean;
  /** 换新前的那枚令牌；只有刚 rotate 过才有值，用于显式认领。 */
  previousToken: string | null;
};

async function readStored() {
  try {
    const [token, identity, previousToken] = await Promise.all([
      AsyncStorage.getItem(VISITOR_TOKEN_KEY),
      AsyncStorage.getItem(VISITOR_IDENTITY_KEY),
      AsyncStorage.getItem(PREVIOUS_TOKEN_KEY),
    ]);
    return { token, identity, previousToken };
  } catch {
    return { token: null, identity: null, previousToken: null };
  }
}

async function writeStored(token: string, identity: string, previousToken: string | null) {
  try {
    await AsyncStorage.setItem(VISITOR_TOKEN_KEY, token);
    await AsyncStorage.setItem(VISITOR_IDENTITY_KEY, identity);
    if (previousToken) await AsyncStorage.setItem(PREVIOUS_TOKEN_KEY, previousToken);
    else await AsyncStorage.removeItem(PREVIOUS_TOKEN_KEY);
  } catch {
    // 存不下也能用完这一次会话，只是下次回来接不上历史
  }
}

let pending: Promise<VisitorIdentity> | null = null;
/** `pending` 是为哪个身份发起的。不记这个的话，登录瞬间会把飞行中的 guest 结果发给登录态。 */
let pendingIdentity: string | null = null;

/**
 * 取当前身份下该用的访客令牌；身份变了就换一枚新的（旧的留作认领用）。
 *
 * 并发合流**按身份区分**：只有同一个身份的并发调用才共用同一个 Promise。
 * 复核回合 2 低 1 指出，旧版 `if (pending) return pending` 不比较身份，
 * 登录那一次会拿到 guest 那次的令牌——虽然服务端仍然三态判定不会越权，
 * 但面板会白白多一次 rotate，也让「身份变了就换令牌」这条不再是确定行为。
 */
export function ensureVisitorToken(identity: string): Promise<VisitorIdentity> {
  if (pending && pendingIdentity === identity) return pending;
  pendingIdentity = identity;
  pending = (async () => {
    const stored = await readStored();
    if (stored.token && stored.token.length >= 16 && stored.identity === identity) {
      return { token: stored.token, rotated: false, previousToken: stored.previousToken };
    }
    // 身份变了（登录 / 登出 / 换号）或本机还没有令牌：bootstrap 一枚新的。
    const token = randomToken();
    // 只有「从访客变成登录用户」时，上一枚令牌才值得留着让本人认领；
    // 登出、换号都不该把上一位的记录递给下一位。
    const carryPrevious =
      stored.token && stored.identity === GUEST_IDENTITY && identity !== GUEST_IDENTITY
        ? stored.token
        : null;
    await writeStored(token, identity, carryPrevious);
    return { token, rotated: Boolean(stored.token), previousToken: carryPrevious };
  })().finally(() => {
    // 只清掉「自己这一次」；期间如果有别的身份发起过新的一次，别把人家的清了。
    if (pendingIdentity === identity) {
      pending = null;
      pendingIdentity = null;
    }
  });
  return pending;
}

/** 服务端说「这个窗口属于别的身份」时，强制换一枚新令牌重开一条线。 */
export async function rotateVisitorToken(identity: string): Promise<VisitorIdentity> {
  // 作废飞行中的 ensure：它可能正要返回刚被换掉的那枚令牌。
  pending = null;
  pendingIdentity = null;
  const token = randomToken();
  await writeStored(token, identity, null);
  return { token, rotated: true, previousToken: null };
}

/** 认领成功（或客户拒绝认领）之后把旧令牌丢掉，不再反复提示。 */
export async function forgetPreviousVisitorToken() {
  try {
    await AsyncStorage.removeItem(PREVIOUS_TOKEN_KEY);
  } catch {
    // 忽略：下次进来最多再问一次
  }
}

/**
 * 生成一条消息的幂等键。**同一次发送的重试必须复用同一个值** ——
 * 调用方要把它存进 ref，只有服务端确认收下（或客户主动改了内容）才换新的。
 */
export function newClientMsgId() {
  return `${Date.now().toString(36)}-${randomToken().slice(0, 16)}`;
}
