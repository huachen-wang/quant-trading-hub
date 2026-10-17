import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies";
import { sendVerificationCodeEmail } from "../_core/email";
import { hashPassword } from "../_core/password";
import { sdk } from "../_core/sdk";
import { createVerificationCode, verifyCode, type VerificationPurpose } from "../_core/verification";
import {
  EMAIL_CODE_UNIFORM_MESSAGE,
  checkEmailCodeRequest,
  hidesRegistrationStatus,
  needsRegistrationLookup,
  type EmailCodePurpose,
} from "../_core/email-code-gate";
import { clientIp } from "../_core/client-ip";
import {
  CODE_VERIFY_IP_RULE,
  CODE_VERIFY_LOCKED_MESSAGE,
  checkLoginAllowed,
  recordLoginFailure,
} from "../_core/login-throttle";
import { toUserResponse } from "../_core/user-response";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

const emailPurpose = z.enum(["register", "login", "reset_password", "bind_email", "verify_email"]);

/**
 * 登录、找回密码发码的最短响应时间（2026-10-17）：未注册的邮箱不发信，会比真发信快很多；
 * 两条路都垫到同一个下限（再加一点随机抖动），不能从快慢看出邮箱有没有注册。
 * 正常发信（Postmark）远低于这个下限。测试里可以调小。
 */
const uniformTiming = { minMs: 1500, jitterMs: 300 };
export function setEmailCodeTimingForTests(next: { minMs: number; jitterMs: number }) {
  uniformTiming.minMs = next.minMs;
  uniformTiming.jitterMs = next.jitterMs;
}

async function withMinimumDuration<T>(task: () => Promise<T>, minMs: number): Promise<T> {
  const startedAt = Date.now();
  const pad = async () => {
    const remaining = minMs - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolveWait) => setTimeout(resolveWait, remaining));
  };
  try {
    const value = await task();
    await pad();
    return value;
  } catch (error) {
    await pad();
    throw error;
  }
}

async function issueEmailCode(
  input: { email: string; purpose: EmailCodePurpose },
  ctx: { req: any; user?: unknown },
  okMessage: string,
) {
  const email = input.email.trim().toLowerCase();
  const ip = clientIp(ctx.req);
  const uniform = hidesRegistrationStatus(input.purpose);

  const run = async () => {
    const emailIsRegistered = needsRegistrationLookup(input.purpose)
      ? Boolean(await db.getUserByEmail(email))
      : undefined;

    const gate = checkEmailCodeRequest({
      purpose: input.purpose,
      emailIsRegistered,
      requesterIsAuthenticated: Boolean(ctx.user),
    });
    if (!gate.ok) throw new Error(gate.error);

    /* 登录 / 找回密码：未注册也照样建一条码记录（不发信）。这样 60 秒冷却「请等待 N 秒」
       对注册和未注册的邮箱一样出现，不会变成探测手段；这条码从没发出去，没人能用。 */
    const result = await createVerificationCode({ target: email, targetType: "email", purpose: input.purpose, ip });
    if (!result.ok) throw new Error(result.error || "验证码发送失败");
    if (gate.deliver) {
      const sendResult = await sendVerificationCodeEmail(email, result.code!, input.purpose);
      if (!sendResult.ok) {
        // 统一回复的用途不把发信失败告诉调用方（否则「发信失败」本身就说明邮箱注册过），只记日志。
        if (uniform) console.error("[auth] verification email failed:", sendResult.error || "unknown");
        else throw new Error(`邮件发送失败：${sendResult.error || "请稍后再试"}`);
      }
    }
    return { ok: true, message: uniform ? EMAIL_CODE_UNIFORM_MESSAGE : okMessage };
  };

  if (!uniform) return run();
  return withMinimumDuration(run, uniformTiming.minMs + Math.floor(Math.random() * uniformTiming.jitterMs));
}

/**
 * 所有「拿验证码换结果」的入口都走这里（2026-10-18）：
 * 1. 同一 IP 验证码失败太多 → 先拒绝，不再碰验证码表（计数存库，和密码登录同一套限流工具、同一个取 IP 函数）；
 * 2. 校验本身每条码最多 5 次（verification.ts）；
 * 3. 失败记一次 IP 失败。成功不清零，防止夹带自己的账号来重置计数。
 */
async function verifyCodeWithThrottle(
  ctx: { req: any },
  opts: { target: string; purpose: VerificationPurpose; code: string },
) {
  const throttleParts = [clientIp(ctx.req)];
  const check = await checkLoginAllowed(CODE_VERIFY_IP_RULE, throttleParts);
  if (!check.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: CODE_VERIFY_LOCKED_MESSAGE });
  }
  const result = await verifyCode(opts);
  if (!result.ok) {
    await recordLoginFailure(CODE_VERIFY_IP_RULE, throttleParts).catch((error) =>
      console.error("[auth] code verify throttle record failed:", error?.code || error?.message),
    );
  }
  return result;
}

export const authRouter = router({
  // 只回白名单字段：ctx.user 是整行用户记录（含 passwordHash）。
  me: publicProcedure.query((opts) => toUserResponse(opts.ctx.user)),
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
    .mutation(async ({ input, ctx }) => issueEmailCode(input, ctx, "验证码已发送，5 分钟内有效")),

  // 与 sendEmailCode 同一条闸。这个名字曾经是未加闸的副本，
  // 未登录调用方可以为任意邮箱申领 verify_email / bind_email 验证码；
  // 保留名字是为了不打断可能存在的旧调用方，行为已对齐。
  sendVerificationCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
      purpose: emailPurpose,
    }))
    .mutation(async ({ input, ctx }) => issueEmailCode(input, ctx, "验证码已发送")),

  verifyEmail: protectedProcedure
    .input(z.object({ code: z.string().min(4).max(10) }))
    .mutation(async ({ input, ctx }) => {
      const email = ctx.user.email;
      if (!email) throw new Error("当前账号未绑定邮箱");
      const result = await verifyCodeWithThrottle(ctx, { target: email.toLowerCase(), purpose: "verify_email", code: input.code });
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
      const verifyResult = await verifyCodeWithThrottle(ctx, { target: email, purpose: "register", code: input.code });
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
      return { ok: true, sessionToken, user: toUserResponse(user) };
    }),

  loginWithCode: publicProcedure
    .input(z.object({ email: z.string().email(), code: z.string().min(4).max(10) }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const verifyResult = await verifyCodeWithThrottle(ctx, { target: email, purpose: "login", code: input.code });
      if (!verifyResult.ok) throw new Error(verifyResult.error || "验证码错误");
      const user = await db.getUserByEmail(email);
      if (!user) throw new Error("验证码错误或已过期"); // 不透露邮箱是否注册（2026-10-17）
      const lastSignedIn = new Date();
      await db.updateUser(user.id, { lastSignedIn });
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || email, expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      // 原来直接返回整行用户记录，密码哈希跟着出去了（2026-10-18）。
      return { ok: true, sessionToken, user: toUserResponse({ ...user, lastSignedIn }) };
    }),

  resetPassword: publicProcedure
    .input(z.object({ email: z.string().email(), code: z.string().min(4).max(10), newPassword: z.string().min(6).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const verifyResult = await verifyCodeWithThrottle(ctx, { target: email, purpose: "reset_password", code: input.code });
      if (!verifyResult.ok) throw new Error(verifyResult.error || "验证码错误");
      const user = await db.getUserByEmail(email);
      if (!user) throw new Error("验证码错误或已过期"); // 不透露邮箱是否注册（2026-10-17）
      await db.updateUser(user.id, { passwordHash: hashPassword(input.newPassword) });
      return { ok: true, message: "密码已重置，请重新登录" };
    }),
});
