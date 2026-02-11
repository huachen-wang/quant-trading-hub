/**
 * 管理员认证路由
 * 提供登录和token验证功能
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";

// 从环境变量读取管理员凭证
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@eaxau.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

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

  /**
   * 验证管理员token（POST版本）
   * 避免在URL中暴露token
   */
  verifyToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ input }) => {
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
