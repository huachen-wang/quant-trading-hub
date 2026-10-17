import crypto from "node:crypto";
import * as db from "../db";

/**
 * 登录失败限流（2026-10-17 安全修复）。
 *
 * - 计数存在库里（表 login_throttle，启动时由 server/migrate.ts 建），重启、多实例都共享；
 *   库不可用时退回进程内计数，限流不会因此失效。
 * - 只存 sha256 摘要，不存明文 IP、邮箱或密码。
 * - 锁定到时自动解开：只比较 lockedUntil 和当前时间，不需要任何清理任务。
 *
 * 规则（第三条见下方 CODE_VERIFY_IP_RULE，2026-10-18）：
 * - 管理员登录：按「IP + 邮箱」计数，5 分钟内失败 5 次锁 15 分钟；同一邮箱换个 IP 不受影响，
 *   所以别人无法凭邮箱把管理员锁在外面。登录成功清掉这个 IP + 邮箱的计数。
 * - 普通用户密码登录：按 IP 计数（不分邮箱），15 分钟内失败 20 次锁 15 分钟。
 *   成功登录不清零，防止攻击者夹带自己的账号来重置计数。
 */

export type ThrottleRule = {
  scope: string;
  maxFailures: number;
  windowMs: number;
  lockMs: number;
};

export const ADMIN_LOGIN_RULE: ThrottleRule = {
  scope: "ADMIN_LOGIN",
  maxFailures: 5,
  windowMs: 5 * 60_000,
  lockMs: 15 * 60_000,
};

export const USER_LOGIN_IP_RULE: ThrottleRule = {
  scope: "USER_LOGIN_IP",
  maxFailures: 20,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
};

/**
 * 验证码校验（验证码登录、注册、找回密码、验证邮箱）按 IP 计失败（2026-10-18）。
 * 每条码自身最多校验 5 次（server/_core/verification.ts）；这条管的是同一个 IP 换着目标邮箱、
 * 或者不停申请新码来猜。和密码登录分开计数，互不占用名额。
 */
export const CODE_VERIFY_IP_RULE: ThrottleRule = {
  scope: "CODE_VERIFY_IP",
  maxFailures: 20,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
};

export type ThrottleState = {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
};

/**
 * 记一次失败后的新状态。纯函数，和 DbThrottleStore 里那条 SQL 是同一套规则：
 * 窗口过期或上一次锁已到期 → 从 1 重新计；达到上限 → 锁 lockMs；锁还没到期 → 保持。
 */
export function applyFailure(prev: ThrottleState | null, now: number, rule: ThrottleRule): ThrottleState {
  const restart =
    !prev ||
    now - prev.windowStartedAt >= rule.windowMs ||
    (prev.lockedUntil > 0 && prev.lockedUntil <= now);
  const failures = restart ? 1 : prev!.failures + 1;
  const windowStartedAt = restart ? now : prev!.windowStartedAt;
  const stillLocked = prev && prev.lockedUntil > now ? prev.lockedUntil : 0;
  const lockedUntil = failures >= rule.maxFailures ? now + rule.lockMs : stillLocked;
  return { failures, windowStartedAt, lockedUntil };
}

export interface ThrottleStore {
  /** 当前锁到什么时候（毫秒时间戳），没锁返回 0。 */
  getLockedUntil(scope: string, keyHash: string): Promise<number>;
  /** 记一次失败，返回记完之后锁到什么时候（没锁返回 0）。 */
  recordFailure(scope: string, keyHash: string, now: number, rule: ThrottleRule): Promise<number>;
  clear(scope: string, keyHash: string): Promise<void>;
}

export class MemoryThrottleStore implements ThrottleStore {
  private readonly states = new Map<string, ThrottleState>();

  async getLockedUntil(scope: string, keyHash: string) {
    return this.states.get(`${scope}:${keyHash}`)?.lockedUntil ?? 0;
  }

  async recordFailure(scope: string, keyHash: string, now: number, rule: ThrottleRule) {
    const id = `${scope}:${keyHash}`;
    const next = applyFailure(this.states.get(id) ?? null, now, rule);
    this.states.set(id, next);
    return next.lockedUntil;
  }

  async clear(scope: string, keyHash: string) {
    this.states.delete(`${scope}:${keyHash}`);
  }
}

/**
 * 一条语句原子完成「新建或累加」，并发的失败请求不会互相覆盖计数。
 * MySQL 按书写顺序求值 ON DUPLICATE KEY UPDATE：failures 先更新；windowStartedAt 的条件只用旧的
 * windowStartedAt / lockedUntil；lockedUntil 最后一项用的是更新后的 failures 和旧的 lockedUntil。
 * 结果与 applyFailure 一致（另用真 MySQL 8.4 的临时表逐步核对过，见 2026-10-17 回执）。
 */
export const RECORD_FAILURE_SQL =
  "INSERT INTO `login_throttle` (`scope`, `keyHash`, `failures`, `windowStartedAt`, `lockedUntil`) VALUES (?, ?, ?, ?, ?) " +
  "ON DUPLICATE KEY UPDATE " +
  "`failures` = IF(? - `windowStartedAt` >= ? OR (`lockedUntil` > 0 AND `lockedUntil` <= ?), 1, `failures` + 1), " +
  "`windowStartedAt` = IF(? - `windowStartedAt` >= ? OR (`lockedUntil` > 0 AND `lockedUntil` <= ?), ?, `windowStartedAt`), " +
  "`lockedUntil` = IF(`failures` >= ?, ? + ?, IF(`lockedUntil` > ?, `lockedUntil`, 0))";

export function recordFailureParams(scope: string, keyHash: string, now: number, rule: ThrottleRule): unknown[] {
  const first = applyFailure(null, now, rule);
  return [
    scope,
    keyHash,
    first.failures,
    first.windowStartedAt,
    first.lockedUntil,
    now,
    rule.windowMs,
    now,
    now,
    rule.windowMs,
    now,
    now,
    rule.maxFailures,
    now,
    rule.lockMs,
    now,
  ];
}

/** 库里的计数；库不可用或语句失败时退回进程内计数。 */
export class DbThrottleStore implements ThrottleStore {
  constructor(private readonly fallback: ThrottleStore = new MemoryThrottleStore()) {}

  async getLockedUntil(scope: string, keyHash: string) {
    try {
      const rows = await db.loginThrottleQuery<Array<{ lockedUntil: number | string }>>(
        "SELECT `lockedUntil` FROM `login_throttle` WHERE `scope` = ? AND `keyHash` = ? LIMIT 1",
        [scope, keyHash],
      );
      if (rows === null) return this.fallback.getLockedUntil(scope, keyHash);
      return rows.length ? Number(rows[0].lockedUntil) || 0 : 0;
    } catch (error: any) {
      console.error("[login-throttle] read failed, using in-process fallback:", error?.code || error?.message);
      return this.fallback.getLockedUntil(scope, keyHash);
    }
  }

  async recordFailure(scope: string, keyHash: string, now: number, rule: ThrottleRule) {
    try {
      const result = await db.loginThrottleQuery(RECORD_FAILURE_SQL, recordFailureParams(scope, keyHash, now, rule));
      if (result === null) return this.fallback.recordFailure(scope, keyHash, now, rule);
      // 顺手清理两天没动过的旧行，避免表无限增长（小概率触发，不影响本次结果）。
      if (Math.random() < 0.02) {
        void db
          .loginThrottleQuery("DELETE FROM `login_throttle` WHERE `updatedAt` < NOW() - INTERVAL 2 DAY LIMIT 500", [])
          .catch(() => undefined);
      }
      return this.getLockedUntil(scope, keyHash);
    } catch (error: any) {
      console.error("[login-throttle] write failed, using in-process fallback:", error?.code || error?.message);
      return this.fallback.recordFailure(scope, keyHash, now, rule);
    }
  }

  async clear(scope: string, keyHash: string) {
    try {
      const result = await db.loginThrottleQuery(
        "DELETE FROM `login_throttle` WHERE `scope` = ? AND `keyHash` = ?",
        [scope, keyHash],
      );
      if (result === null) await this.fallback.clear(scope, keyHash);
    } catch (error: any) {
      console.error("[login-throttle] clear failed:", error?.code || error?.message);
      await this.fallback.clear(scope, keyHash);
    }
  }
}

let store: ThrottleStore = new DbThrottleStore();
let clock: () => number = () => Date.now();

export function setLoginThrottleForTests(next: { store?: ThrottleStore; now?: () => number }) {
  if (next.store) store = next.store;
  if (next.now) clock = next.now;
}

export function resetLoginThrottleForTests() {
  store = new MemoryThrottleStore();
  clock = () => Date.now();
}

/** 规则 + 计数对象（IP、邮箱）→ 摘要。明文不落库。 */
export function throttleKey(rule: ThrottleRule, parts: string[]): string {
  return crypto
    .createHash("sha256")
    .update([rule.scope, ...parts.map((part) => part.trim().toLowerCase())].join("\u0000"))
    .digest("hex");
}

export type ThrottleCheck = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function checkLoginAllowed(rule: ThrottleRule, parts: string[]): Promise<ThrottleCheck> {
  const now = clock();
  const lockedUntil = await store.getLockedUntil(rule.scope, throttleKey(rule, parts));
  if (lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000)) };
  }
  return { allowed: true };
}

export async function recordLoginFailure(rule: ThrottleRule, parts: string[]): Promise<number> {
  return store.recordFailure(rule.scope, throttleKey(rule, parts), clock(), rule);
}

export async function clearLoginFailures(rule: ThrottleRule, parts: string[]): Promise<void> {
  await store.clear(rule.scope, throttleKey(rule, parts));
}

export const LOGIN_LOCKED_MESSAGE = "登录尝试过多，请 15 分钟后再试";
export const CODE_VERIFY_LOCKED_MESSAGE = "验证码尝试次数过多，请 15 分钟后再试";
