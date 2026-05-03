/**
 * Verification Code Service — 验证码核心逻辑
 *
 * 职责：
 *   - 生成 6 位随机验证码
 *   - 写入 verification_codes 表（含过期时间、用途、目标）
 *   - 限流：同一目标 60 秒内不能重复发送
 *   - 校验：验证码必须未使用、未过期、purpose 一致
 *   - 验证后立即标记为 used（防重放）
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

import { eq, and, gt, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";

const { verificationCodes } = schema;

const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 分钟
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 秒冷却

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

/**
 * 生成 6 位数字验证码
 */
function genCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 创建验证码（带限流）
 * 返回的 code 字段需要由调用方传给邮件/短信服务发出，调用方不应该返回给前端。
 */
export async function createVerificationCode(opts: CreateCodeOpts): Promise<CreateCodeResult> {
  const d = getDb();

  // 限流检查：60 秒内已发过则拒绝
  const cooldownThreshold = new Date(Date.now() - RESEND_COOLDOWN_MS);
  const recent = await d
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.target, opts.target),
        eq(verificationCodes.purpose, opts.purpose),
        gt(verificationCodes.createdAt, cooldownThreshold),
      ),
    )
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  if (recent.length > 0) {
    const last = recent[0];
    const elapsed = Date.now() - new Date(last.createdAt).getTime();
    const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return {
      ok: false,
      error: `请等待 ${retryAfter} 秒后再试`,
      retryAfter,
    };
  }

  const code = genCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  await d.insert(verificationCodes).values({
    target: opts.target,
    targetType: opts.targetType,
    code,
    purpose: opts.purpose,
    expiresAt,
    ip: opts.ip || null,
    used: false,
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
 */
export async function verifyCode(opts: VerifyCodeOpts): Promise<VerifyCodeResult> {
  const d = getDb();

  const rows = await d
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.target, opts.target),
        eq(verificationCodes.purpose, opts.purpose),
        eq(verificationCodes.code, opts.code),
        eq(verificationCodes.used, false),
      ),
    )
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  if (rows.length === 0) {
    return { ok: false, error: "验证码错误" };
  }

  const row = rows[0];

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "验证码已过期，请重新获取" };
  }

  // 标记为已使用
  await d.update(verificationCodes).set({ used: true }).where(eq(verificationCodes.id, row.id));

  return { ok: true };
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
