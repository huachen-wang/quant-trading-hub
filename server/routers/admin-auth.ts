/**
 * 管理员认证路由
 * 提供登录和token验证功能
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import "../_core/ensure-webcrypto";
import { SignJWT, jwtVerify } from "jose";
import { isProductionRuntime } from "../_core/runtime-env";
import crypto from "node:crypto";
import {
  assertSecurityAttemptAllowed,
  clearSecurityFailures,
  recordSecurityFailure,
  requestIp,
} from "../_core/admin-security-throttle";

export function resolveAdminConfig(
  name: "ADMIN_EMAIL" | "ADMIN_PASSWORD" | "JWT_SECRET",
  developmentFallback: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const configured = env[name]?.trim();
  if (configured) return configured;
  if (isProductionRuntime(env)) {
    throw new Error(`[admin-auth] ${name} must be configured in production`);
  }
  return developmentFallback;
}

// 本地开发保留便捷默认值；生产环境缺少任一项时在启动阶段 fail closed。
const ADMIN_EMAIL = resolveAdminConfig("ADMIN_EMAIL", "admin@eaxau.com");
const ADMIN_PASSWORD = resolveAdminConfig("ADMIN_PASSWORD", "admin123");
const JWT_SECRET = resolveAdminConfig("JWT_SECRET", "local-development-admin-secret");

if (
  isProductionRuntime() &&
  (ADMIN_PASSWORD === "admin123" ||
    ADMIN_PASSWORD === "change-me" ||
    JWT_SECRET === "your-secret-key-change-in-production" ||
    JWT_SECRET === "change-me")
) {
  throw new Error("[admin-auth] Refusing insecure production admin credentials");
}

// JWT密钥（用于签名和验证）
const secret = new TextEncoder().encode(JWT_SECRET);

type AdminAccount = { id: number; email: string; password: string };

function stableLegacyAdminId(email: string) {
  const fragment = crypto.createHash("sha256").update(email.toLowerCase()).digest().readUInt32BE(0);
  return 1_000_000_000 + (fragment % 1_000_000_000);
}

const ADMIN_ACCOUNT: AdminAccount = {
  id: stableLegacyAdminId(ADMIN_EMAIL),
  email: ADMIN_EMAIL.toLowerCase(),
  password: ADMIN_PASSWORD,
};

if (
  isProductionRuntime() &&
  ["admin123", "change-me", "password1234"].includes(
    ADMIN_ACCOUNT.password,
  )
) {
  throw new Error("[admin-auth] Refusing insecure production admin account password");
}

function timingSafeTextEqual(left: string, right: string) {
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

/**
 * 签发管理员JWT token
 */
async function signAdminToken(account: AdminAccount): Promise<string> {
  const token = await new SignJWT({
    email: account.email,
    role: "admin",
    adminId: account.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(`admin:${account.id}`)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
  return token;
}

/**
 * 验证管理员JWT token
 */
export async function verifyAdminToken(token: string): Promise<{
  adminId: number;
  email: string;
  role: "admin";
} | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (
      payload.role === "admin" &&
      typeof payload.email === "string" &&
      typeof payload.adminId === "number" &&
      payload.sub === `admin:${payload.adminId}` &&
      ADMIN_ACCOUNT.id === payload.adminId &&
      ADMIN_ACCOUNT.email === payload.email
    ) {
      return {
        adminId: payload.adminId,
        email: payload.email,
        role: "admin",
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export const adminAuthRouter = router({
  /**
   * 管理员登录
   * 验证邮箱密码，成功后返回JWT token
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = ADMIN_ACCOUNT;
      const principal = input.email.toLowerCase();
      const ip = requestIp(ctx.req);
      try {
        assertSecurityAttemptAllowed("ADMIN_LOGIN", principal, ip);
      } catch (error) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: error instanceof Error ? error.message : "登录尝试过多",
        });
      }
      if (
        !timingSafeTextEqual(principal, account.email) ||
        !timingSafeTextEqual(input.password, account.password)
      ) {
        recordSecurityFailure("ADMIN_LOGIN", principal, ip);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "邮箱或密码错误",
        });
      }
      clearSecurityFailures("ADMIN_LOGIN", principal, ip);

      // 签发JWT token
      const token = await signAdminToken(account);

      return {
        success: true,
        token,
        email: account.email,
        adminId: account.id,
      };
    }),

  /**
   * 验证管理员token
   * 用于前端检查登录状态
   */
  verify: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .query(async ({ input }) => {
      const payload = await verifyAdminToken(input.token);
      if (!payload) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "无效的token",
        });
      }

      return {
        valid: true,
        email: payload.email,
        adminId: payload.adminId,
      };
    }),
});
