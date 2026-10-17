/**
 * Verification Code Service — 验证码核心逻辑
 *
 * 职责：
 *   - 生成 6 位随机验证码（crypto.randomInt，不用 Math.random）
 *   - 写入 verification_codes 表（含过期时间、用途、目标）
 *   - 限流：同一目标 60 秒内不能重复发送
 *   - 校验：验证码必须未使用、未过期、purpose 一致、校验次数没用完
 *   - 验证后立即标记为 used（防重放）
 *
 * 校验次数上限（2026-10-18 安全修复）：
 *   原来有效期 5 分钟内可以无限次提交错误码，6 位数字能被穷举（验证码登录 = 直接拿到会话，
 *   找回密码 = 直接改密码）。现在每条码最多被校验 MAX_VERIFY_ATTEMPTS 次：
 *   - 每次校验**先**用一条带条件的 UPDATE 原子占一次名额（attempts < 上限 且 未使用），
 *     占到了才比对。并发一起打进来也只有前 MAX_VERIFY_ATTEMPTS 次能被比对，不存在「先读后写」的竞态。
 *   - 用满后这条码作废，之后输入正确的码也不认，只能重新获取。
 *   - 同一目标同一用途有好几条未过期的码（用户点过「重新发送」）时，一次错误输入会在每条上各记一次，
 *     所以不能靠多申请几条码来换更多的猜测次数。
 *   - 标记 used 也是带条件的 UPDATE（used = false 才改），两个请求同时拿正确的码来，只有一个成功。
 *
 * 验证码用途（purpose）：
 *   register        - 注册时验证邮箱/手机
 *   login           - 登录验证
 *   reset_password  - 重置密码
 *   bind_email      - 已登录用户绑定邮箱
 *   bind_phone      - 已登录用户绑定手机号
 *   verify_email    - 已登录用户验证已绑定的邮箱（拿福利标记用）
 *   verify_phone    - 同上，验证手机号
 */

import crypto from "node:crypto";
import { eq, and, gt, lt, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";

const { verificationCodes } = schema;

const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 分钟
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 秒冷却
/** 每条验证码最多被校验几次（含输对的那一次）。 */
export const MAX_VERIFY_ATTEMPTS = 5;
/** 一次校验最多看同一目标同一用途下最新的几条未使用的码（60 秒冷却 + 5 分钟有效期 → 最多 5 条同时有效）。 */
const MAX_LIVE_CODES = 5;

export const CODE_WRONG_MESSAGE = "验证码错误";
export const CODE_EXPIRED_MESSAGE = "验证码已过期，请重新获取";
export const CODE_ATTEMPTS_EXHAUSTED_MESSAGE = "验证码错误次数过多，已失效，请重新获取";

let pool: mysql.Pool | null = null;
let db: any = null;

function getDb() {
  if (!db) {
    if (!pool) {
      pool = mysql.createPool({
        uri: process.env.DATABASE_URL!,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    }
    db = drizzle(pool, { schema, mode: "default" });
  }
  return db;
}

export type VerificationPurpose =
  | "register"
  | "login"
  | "reset_password"
  | "bind_email"
  | "bind_phone"
  | "verify_email"
  | "verify_phone";

export type VerificationTargetType = "email" | "phone";

interface CreateCodeOpts {
  target: string;
  targetType: VerificationTargetType;
  purpose: VerificationPurpose;
  ip?: string;
}

interface CreateCodeResult {
  ok: boolean;
  code?: string;
  error?: string;
  retryAfter?: number; // 秒
}

export type StoredCode = {
  id: number;
  code: string;
  used: boolean;
  attempts: number;
  expiresAt: Date | string;
  createdAt: Date | string;
};

/**
 * 验证码的存储操作。生产用 DbVerificationCodeStore（MySQL）；测试用 MemoryVerificationCodeStore，
 * 两者语义一致：reserveAttempt / consume 都是「带条件的单条更新」，返回是否真的改到了那一行。
 */
export interface VerificationCodeStore {
  latestCreatedAt(target: string, purpose: string, since: Date): Promise<Date | null>;
  insert(row: {
    target: string;
    targetType: VerificationTargetType;
    code: string;
    purpose: string;
    expiresAt: Date;
    ip: string | null;
  }): Promise<void>;
  /** 同一目标同一用途下未使用的码，新的在前。 */
  listUnused(target: string, purpose: string, limit: number): Promise<StoredCode[]>;
  /** attempts < max 且未使用时 attempts + 1，返回是否占到名额。 */
  reserveAttempt(id: number, max: number): Promise<boolean>;
  /** 未使用时标记为已使用，返回是否由本次调用标记成功。 */
  consume(id: number): Promise<boolean>;
}

function affectedRows(result: any): number {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? result?.rowsAffected ?? 0);
}

/** 占一次校验名额的语句。单独导出，测试可以直接核对生成的 SQL。 */
export function buildReserveAttemptQuery(d: any, id: number, max: number) {
  return d
    .update(verificationCodes)
    .set({ attempts: sql`${verificationCodes.attempts} + 1` })
    .where(
      and(
        eq(verificationCodes.id, id),
        eq(verificationCodes.used, false),
        lt(verificationCodes.attempts, max),
      ),
    );
}

/** 把码标成已使用的语句：只有仍未使用时才改得到。 */
export function buildConsumeQuery(d: any, id: number) {
  return d
    .update(verificationCodes)
    .set({ used: true })
    .where(and(eq(verificationCodes.id, id), eq(verificationCodes.used, false)));
}

export class DbVerificationCodeStore implements VerificationCodeStore {
  constructor(private readonly db: () => any = getDb) {}

  async latestCreatedAt(target: string, purpose: string, since: Date) {
    const rows = await this.db()
      .select({ createdAt: verificationCodes.createdAt })
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.target, target),
          eq(verificationCodes.purpose, purpose),
          gt(verificationCodes.createdAt, since),
        ),
      )
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);
    return rows.length ? new Date(rows[0].createdAt) : null;
  }

  async insert(row: Parameters<VerificationCodeStore["insert"]>[0]) {
    await this.db().insert(verificationCodes).values({ ...row, used: false, attempts: 0 });
  }

  async listUnused(target: string, purpose: string, limit: number) {
    return this.db()
      .select({
        id: verificationCodes.id,
        code: verificationCodes.code,
        used: verificationCodes.used,
        attempts: verificationCodes.attempts,
        expiresAt: verificationCodes.expiresAt,
        createdAt: verificationCodes.createdAt,
      })
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.target, target),
          eq(verificationCodes.purpose, purpose),
          eq(verificationCodes.used, false),
        ),
      )
      .orderBy(desc(verificationCodes.createdAt), desc(verificationCodes.id))
      .limit(limit);
  }

  async reserveAttempt(id: number, max: number) {
    return affectedRows(await buildReserveAttemptQuery(this.db(), id, max)) === 1;
  }

  async consume(id: number) {
    return affectedRows(await buildConsumeQuery(this.db(), id)) === 1;
  }
}

/** 进程内实现，只给测试用；每个操作都先让出一次事件循环，模拟并发请求交错。 */
export class MemoryVerificationCodeStore implements VerificationCodeStore {
  rows: Array<StoredCode & { target: string; purpose: string; targetType: string; ip: string | null }> = [];
  private nextId = 1;

  async latestCreatedAt(target: string, purpose: string, since: Date) {
    await Promise.resolve();
    const hit = this.rows
      .filter((row) => row.target === target && row.purpose === purpose && new Date(row.createdAt) > since)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return hit ? new Date(hit.createdAt) : null;
  }

  async insert(row: Parameters<VerificationCodeStore["insert"]>[0]) {
    await Promise.resolve();
    this.rows.push({ ...row, id: this.nextId++, used: false, attempts: 0, createdAt: new Date(clock()) });
  }

  async listUnused(target: string, purpose: string, limit: number) {
    await Promise.resolve();
    return this.rows
      .filter((row) => row.target === target && row.purpose === purpose && !row.used)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async reserveAttempt(id: number, max: number) {
    await Promise.resolve();
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.used || row.attempts >= max) return false;
    row.attempts += 1;
    return true;
  }

  async consume(id: number) {
    await Promise.resolve();
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.used) return false;
    row.used = true;
    return true;
  }
}

let store: VerificationCodeStore = new DbVerificationCodeStore();
let clock: () => number = () => Date.now();

export function setVerificationStoreForTests(next: { store?: VerificationCodeStore; now?: () => number }) {
  if (next.store) store = next.store;
  if (next.now) clock = next.now;
}

export function resetVerificationStoreForTests() {
  store = new DbVerificationCodeStore();
  clock = () => Date.now();
}

/**
 * 生成 6 位数字验证码
 */
function genCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/** 定长比较，避免按字符提前返回。长度不同直接判不等（长度不是秘密，固定 6 位）。 */
function codesEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(provided).trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * 创建验证码（带限流）
 * 返回的 code 字段需要由调用方传给邮件/短信服务发出，调用方不应该返回给前端。
 */
export async function createVerificationCode(opts: CreateCodeOpts): Promise<CreateCodeResult> {
  const now = clock();

  // 限流检查：60 秒内已发过则拒绝
  const last = await store.latestCreatedAt(opts.target, opts.purpose, new Date(now - RESEND_COOLDOWN_MS));
  if (last) {
    const elapsed = now - last.getTime();
    const retryAfter = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
    return {
      ok: false,
      error: `请等待 ${retryAfter} 秒后再试`,
      retryAfter,
    };
  }

  const code = genCode();
  await store.insert({
    target: opts.target,
    targetType: opts.targetType,
    code,
    purpose: opts.purpose,
    expiresAt: new Date(now + CODE_EXPIRY_MS),
    ip: opts.ip || null,
  });

  return { ok: true, code };
}

interface VerifyCodeOpts {
  target: string;
  purpose: VerificationPurpose;
  code: string;
}

interface VerifyCodeResult {
  ok: boolean;
  error?: string;
}

/**
 * 校验验证码 + 立即标记 used
 *
 * 校验通过后立即标记 used，**防止重放攻击**。
 * 如果业务流程需要"先校验再操作"的两阶段，应该在校验成功后立即落地业务结果，
 * 不要把"已校验"的状态保存在前端 token 里。
 *
 * 每条码最多被比对 MAX_VERIFY_ATTEMPTS 次：先原子占名额再比对，见文件头说明。
 */
export async function verifyCode(opts: VerifyCodeOpts): Promise<VerifyCodeResult> {
  const now = clock();
  const unused = await store.listUnused(opts.target, opts.purpose, MAX_LIVE_CODES);
  const live = unused.filter((row) => new Date(row.expiresAt).getTime() >= now);

  if (live.length === 0) {
    // 只剩过期的码：输入的恰好是其中一条就提示过期（过期的码已经没用，不算泄露），否则就是错误。
    const matchedExpired = unused.some((row) => codesEqual(row.code, opts.code));
    return { ok: false, error: matchedExpired ? CODE_EXPIRED_MESSAGE : CODE_WRONG_MESSAGE };
  }

  let reservedAny = false;
  let exhausted = true;
  for (const row of live) {
    if (row.attempts >= MAX_VERIFY_ATTEMPTS) continue;
    // 先占名额再比对：占不到（已用满或刚被别的请求用掉）就不比对这条。
    if (!(await store.reserveAttempt(row.id, MAX_VERIFY_ATTEMPTS))) continue;
    reservedAny = true;
    if (codesEqual(row.code, opts.code)) {
      if (await store.consume(row.id)) return { ok: true };
      // 同一条码被并发的另一个请求先用掉了。
      return { ok: false, error: CODE_WRONG_MESSAGE };
    }
    if (row.attempts + 1 < MAX_VERIFY_ATTEMPTS) exhausted = false;
  }

  if (!reservedAny || exhausted) return { ok: false, error: CODE_ATTEMPTS_EXHAUSTED_MESSAGE };
  return { ok: false, error: CODE_WRONG_MESSAGE };
}

/**
 * 工具：每天定时清扫过期验证码（避免表无限增长）
 * 在 cron / 定时任务中调用。
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const d = getDb();
  // 删除 expiresAt < NOW() 的过期验证码
  const result = await d.delete(verificationCodes).where(gt(sql`NOW()`, verificationCodes.expiresAt));
  return result.rowsAffected || 0;
}
