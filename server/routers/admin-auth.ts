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

/**
 * 签发管理员JWT token
 */
async function signAdminToken(email: string): Promise<string> {
  const token = await new SignJWT({ email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // token有效期7天
    .sign(secret);
  return token;
}

/**
 * 验证管理员JWT token
 */
export async function verifyAdminToken(token: string): Promise<{ email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.role === "admin" && typeof payload.email === "string") {
      return { email: payload.email, role: payload.role };
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
    .mutation(async ({ input }) => {
      // 验证管理员凭证
      if (input.email !== ADMIN_EMAIL || input.password !== ADMIN_PASSWORD) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "邮箱或密码错误",
        });
      }

      // 签发JWT token
      const token = await signAdminToken(input.email);

      return {
        success: true,
        token,
        email: input.email,
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
      };
    }),
});
