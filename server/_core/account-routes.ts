import type { Express, Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import {
  checkLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
  type ThrottleRule,
} from "./login-throttle";
import { hashPassword, verifyPassword } from "./password";
import { sdk } from "./sdk";
import { toUserResponse } from "./user-response";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";

/**
 * 「编辑资料」「修改密码」两个接口（2026-10-18，代码体检 R3 ③）。
 *
 * app/profile/edit.tsx 一直在调 PATCH /api/auth/profile 和 POST /api/auth/change-password，
 * 服务端从没注册过，保存资料和改密码都必然失败。这里按前端现有的调用方式补上：
 * - 身份：和 /api/auth/me 一样用 sdk.authenticateRequest（Cookie 或 Bearer 会话）；
 * - 只收 application/json：跨站表单（application/x-www-form-urlencoded）提交不进来，
 *   跨站 fetch 带 JSON 必须先过 CORS 预检，而预检只放行 eaxau.com 自己；
 * - 出错统一回 `{ error: "中文说明" }`（前端读 data.error 弹给用户）；
 * - 返回的用户对象只经过 server/_core/user-response.ts 的白名单；
 * - 密码哈希与注册、找回密码同一套（server/_core/password.ts 的 scrypt）；
 * - 限流用 server/_core/login-throttle.ts 的同一套工具（计数存库，只存摘要）。
 */

/** 改密码时「当前密码」输错：按账号计，15 分钟内错 5 次锁 15 分钟。拿到别人会话的人也不能借这里猜密码。 */
export const PASSWORD_CHANGE_RULE: ThrottleRule = {
  scope: "PASSWORD_CHANGE_USER",
  maxFailures: 5,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
};

/** 保存资料的频率上限：按账号计，15 分钟内最多 30 次（每次保存记一笔）。 */
export const PROFILE_UPDATE_RULE: ThrottleRule = {
  scope: "PROFILE_UPDATE_USER",
  maxFailures: 30,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
};

export const PASSWORD_CHANGE_LOCKED_MESSAGE = "当前密码错误次数过多，请 15 分钟后再试";
export const PROFILE_UPDATE_LOCKED_MESSAGE = "保存太频繁，请 15 分钟后再试";
export const WRONG_CURRENT_PASSWORD_MESSAGE = "当前密码不正确";

/** 与前端输入框一致：昵称最多 50 字、简介最多 200 字；新密码 6–100 位（与注册、找回密码相同）。 */
export const NAME_MAX = 50;
export const BIO_MAX = 200;
export const AVATAR_URL_MAX = 500;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

type ProfileChanges = { name?: string; avatar?: string | null; bio?: string | null };

export type ProfileValidation = { ok: true; changes: ProfileChanges } | { ok: false; error: string };

/**
 * 校验资料修改。只认 name / avatar / bio 三个字段，其余字段一律忽略（不能借这里改 role、email 等）。
 * - 昵称：给了就必须是 1–50 个字，不能有控制字符；
 * - 头像：空字符串表示清空；否则必须是 https 地址（页面 CSP 只允许 https 图片），最长 500；
 * - 简介：空字符串表示清空；最多 200 字（换行可以，其它控制字符不行）。
 */
export function validateProfileInput(body: unknown): ProfileValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "请求内容不正确" };
  }
  const input = body as Record<string, unknown>;
  const changes: ProfileChanges = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string") return { ok: false, error: "昵称格式不正确" };
    const name = input.name.trim();
    if (!name) return { ok: false, error: "昵称不能为空" };
    if ([...name].length > NAME_MAX) return { ok: false, error: `昵称最多 ${NAME_MAX} 个字` };
    if (CONTROL_CHARS.test(name)) return { ok: false, error: "昵称包含不支持的字符" };
    changes.name = name;
  }

  if (input.avatar !== undefined) {
    if (typeof input.avatar !== "string") return { ok: false, error: "头像地址格式不正确" };
    const avatar = input.avatar.trim();
    if (!avatar) {
      changes.avatar = null;
    } else {
      if (avatar.length > AVATAR_URL_MAX) return { ok: false, error: "头像地址太长" };
      let url: URL;
      try {
        url = new URL(avatar);
      } catch {
        return { ok: false, error: "头像地址需要是以 https:// 开头的图片链接" };
      }
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
        return { ok: false, error: "头像地址需要是以 https:// 开头的图片链接" };
      }
      changes.avatar = url.toString();
    }
  }

  if (input.bio !== undefined) {
    if (typeof input.bio !== "string") return { ok: false, error: "简介格式不正确" };
    const bio = input.bio.trim();
    if ([...bio].length > BIO_MAX) return { ok: false, error: `简介最多 ${BIO_MAX} 个字` };
    if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(bio)) return { ok: false, error: "简介包含不支持的字符" };
    changes.bio = bio || null;
  }

  if (Object.keys(changes).length === 0) return { ok: false, error: "没有需要保存的内容" };
  return { ok: true, changes };
}

export type PasswordChangeValidation =
  | { ok: true; oldPassword: string; newPassword: string }
  | { ok: false; error: string };

export function validatePasswordChangeInput(body: unknown): PasswordChangeValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "请求内容不正确" };
  }
  const { oldPassword, newPassword } = body as Record<string, unknown>;
  if (typeof oldPassword !== "string" || !oldPassword) return { ok: false, error: "请填写当前密码" };
  if (typeof newPassword !== "string" || !newPassword) return { ok: false, error: "请填写新密码" };
  if (oldPassword.length > PASSWORD_MAX) return { ok: false, error: WRONG_CURRENT_PASSWORD_MESSAGE };
  if (newPassword.length < PASSWORD_MIN) return { ok: false, error: `新密码至少 ${PASSWORD_MIN} 位` };
  if (newPassword.length > PASSWORD_MAX) return { ok: false, error: `新密码最多 ${PASSWORD_MAX} 位` };
  if (newPassword === oldPassword) return { ok: false, error: "新密码不能和当前密码相同" };
  return { ok: true, oldPassword, newPassword };
}

/** 只收 JSON。跨站表单提交（urlencoded / multipart / text/plain）一律 415。 */
function requireJson(req: Request, res: Response): boolean {
  if (req.is("application/json")) return true;
  res.status(415).json({ error: "请求格式不正确" });
  return false;
}

async function requireUser(req: Request, res: Response): Promise<User | null> {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    res.status(401).json({ error: "请先登录" });
    return null;
  }
}

function lockedResponse(res: Response, retryAfterSeconds: number, message: string) {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({ error: message });
}

export function registerAccountRoutes(app: Express) {
  app.patch("/api/auth/profile", async (req: Request, res: Response) => {
    if (!requireJson(req, res)) return;
    const user = await requireUser(req, res);
    if (!user) return;

    const parsed = validateProfileInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const throttleParts = [String(user.id)];
    try {
      const check = await checkLoginAllowed(PROFILE_UPDATE_RULE, throttleParts);
      if (!check.allowed) return lockedResponse(res, check.retryAfterSeconds, PROFILE_UPDATE_LOCKED_MESSAGE);
    } catch (error: any) {
      console.error("[Account] profile throttle check failed:", error?.code || error?.message);
    }

    try {
      await db.updateUserProfile(user.id, parsed.changes);
      await recordLoginFailure(PROFILE_UPDATE_RULE, throttleParts).catch((error) =>
        console.error("[Account] profile throttle record failed:", error?.code || error?.message),
      );
      res.json({ success: true, user: toUserResponse({ ...user, ...parsed.changes }) });
    } catch (error: any) {
      console.error("[Account] profile update failed:", error?.code || error?.message);
      res.status(500).json({ error: "保存失败，请稍后重试" });
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    if (!requireJson(req, res)) return;
    const user = await requireUser(req, res);
    if (!user) return;

    const parsed = validatePasswordChangeInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const throttleParts = [String(user.id)];
    try {
      const check = await checkLoginAllowed(PASSWORD_CHANGE_RULE, throttleParts);
      if (!check.allowed) return lockedResponse(res, check.retryAfterSeconds, PASSWORD_CHANGE_LOCKED_MESSAGE);
    } catch (error: any) {
      console.error("[Account] password throttle check failed:", error?.code || error?.message);
    }

    /* 用验证码注册 / 登录、从没设过密码的账号：没有「当前密码」可核对，引导走找回密码（邮箱验证码）设置。 */
    if (!user.passwordHash) {
      res.status(400).json({ error: "这个账号还没有设置过密码，请在登录页用「忘记密码」通过邮箱验证码设置" });
      return;
    }

    if (!verifyPassword(parsed.oldPassword, user.passwordHash)) {
      await recordLoginFailure(PASSWORD_CHANGE_RULE, throttleParts).catch((error) =>
        console.error("[Account] password throttle record failed:", error?.code || error?.message),
      );
      res.status(400).json({ error: WRONG_CURRENT_PASSWORD_MESSAGE });
      return;
    }

    try {
      await db.updateUserPassword(user.id, hashPassword(parsed.newPassword), { expectedSessionVersion: user.sessionVersion });
      res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
      await clearLoginFailures(PASSWORD_CHANGE_RULE, throttleParts).catch(() => undefined);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Account] password update failed:", error?.code || error?.message);
      res.status(500).json({ error: "修改失败，请稍后重试" });
    }
  });
}
