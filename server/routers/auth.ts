import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies";
import { sendVerificationCodeEmail } from "../_core/email";
import { hashPassword } from "../_core/password";
import { sdk } from "../_core/sdk";
import { createVerificationCode, verifyCode } from "../_core/verification";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

const emailPurpose = z.enum(["register", "login", "reset_password", "bind_email", "verify_email"]);

function getRequestIp(req: { headers: Record<string, unknown>; socket: { remoteAddress?: string } }) {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || undefined;
}

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
    return { success: true } as const;
  }),

  sendEmailCode: publicProcedure
    .input(z.object({
      email: z.string().email("邮箱格式不正确"),
      purpose: emailPurpose,
    }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const ip = getRequestIp(ctx.req);
      if (input.purpose === "register") {
        const existing = await db.getUserByEmail(email);
        if (existing) throw new Error("该邮箱已注册，请直接登录");
      }
      if (input.purpose === "reset_password" || input.purpose === "login") {
        const existing = await db.getUserByEmail(email);
        if (!existing) throw new Error("该邮箱未注册");
      }
      if (input.purpose === "verify_email" || input.purpose === "bind_email") {
        if (!ctx.user) throw new Error("请先登录");
      }
      const result = await createVerificationCode({ target: email, targetType: "email", purpose: input.purpose, ip });
      if (!result.ok) throw new Error(result.error || "验证码发送失败");
      const sendResult = await sendVerificationCodeEmail(email, result.code!, input.purpose);
      if (!sendResult.ok) throw new Error(`邮件发送失败：${sendResult.error || "请稍后再试"}`);
      return { ok: true, message: "验证码已发送，5 分钟内有效" };
    }),

  sendVerificationCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
      purpose: emailPurpose,
    }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const ip = getRequestIp(ctx.req);
      const result = await createVerificationCode({ target: email, targetType: "email", purpose: input.purpose, ip });
      if (!result.ok) throw new Error(result.error || "验证码发送失败");
      const sendResult = await sendVerificationCodeEmail(email, result.code!, input.purpose);
      if (!sendResult.ok) throw new Error(`邮件发送失败：${sendResult.error || "请稍后再试"}`);
      return { ok: true, message: "验证码已发送" };
    }),

  verifyEmail: protectedProcedure
    .input(z.object({ code: z.string().min(4).max(10) }))
    .mutation(async ({ input, ctx }) => {
      const email = ctx.user.email;
      if (!email) throw new Error("当前账号未绑定邮箱");
      const result = await verifyCode({ target: email.toLowerCase(), purpose: "verify_email", code: input.code });
      if (!result.ok) throw new Error(result.error || "验证失败");
      return { ok: true, message: "邮箱验证成功！福利已解锁" };
    }),

  bindPhone: protectedProcedure
    .input(z.object({ phone: z.string().min(7).max(20) }))
    .mutation(async ({ input, ctx }) => {
      const phone = input.phone.trim();
      const owner = await db.getUserByPhone(phone);
      if (owner && owner.id !== ctx.user.id) throw new Error("该手机号已被其他账号使用");
      await db.updateUser(ctx.user.id, { phone });
      return { ok: true, message: "手机号已保存" };
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    const emailVerified = user.email ? await db.isUserEmailVerified(user.email) : false;
    const isFullMember = emailVerified;
    return {
      id: user.id,
      openId: user.openId,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
      lastSignedIn: user.lastSignedIn,
      emailVerified,
      phoneVerified: user.phoneVerified || false,
      isFullMember,
      recommendations: { verifyEmail: !emailVerified && !!user.email, bindPhone: !user.phone },
    };
  }),

  registerWithCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().min(4).max(10),
      name: z.string().min(1).max(50).optional(),
      phone: z.string().min(7).max(20).optional(),
      password: z.string().min(6).max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const verifyResult = await verifyCode({ target: email, purpose: "register", code: input.code });
      if (!verifyResult.ok) throw new Error(verifyResult.error || "验证码错误");
      const existing = await db.getUserByEmail(email);
      if (existing) throw new Error("该邮箱已注册");
      const phone = input.phone?.trim() || null;
      if (phone) {
        const phoneOwner = await db.getUserByPhone(phone);
        if (phoneOwner) throw new Error("该手机号已被其他账号使用");
      }
      const displayName = input.name?.trim() || email.split("@")[0];
      const openId = `email:${email}`;
      await db.createUser({
        openId,
        email,
        name: displayName,
        phone,
        passwordHash: input.password ? hashPassword(input.password) : null,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });
      const user = await db.getUserByEmail(email);
      if (!user) throw new Error("注册失败，请稍后重试");
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || email, expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { ok: true, sessionToken, user: { id: user.id, email: user.email, name: user.name } };
    }),

  loginWithCode: publicProcedure
    .input(z.object({ email: z.string().email(), code: z.string().min(4).max(10) }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const verifyResult = await verifyCode({ target: email, purpose: "login", code: input.code });
      if (!verifyResult.ok) throw new Error(verifyResult.error || "验证码错误");
      const user = await db.getUserByEmail(email);
      if (!user) throw new Error("该邮箱未注册");
      await db.updateUser(user.id, { lastSignedIn: new Date() });
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || email, expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { ok: true, sessionToken, user };
    }),

  resetPassword: publicProcedure
    .input(z.object({ email: z.string().email(), code: z.string().min(4).max(10), newPassword: z.string().min(6).max(100) }))
    .mutation(async ({ input }) => {
      const email = input.email.trim().toLowerCase();
      const verifyResult = await verifyCode({ target: email, purpose: "reset_password", code: input.code });
      if (!verifyResult.ok) throw new Error(verifyResult.error || "验证码错误");
      const user = await db.getUserByEmail(email);
      if (!user) throw new Error("该邮箱未注册");
      await db.updateUser(user.id, { passwordHash: hashPassword(input.newPassword) });
      return { ok: true, message: "密码已重置，请重新登录" };
    }),
});
