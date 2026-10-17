import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { createUser, getUserByEmail, getUserByOpenId, getUserByPhone, updateUser, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { hashPassword, verifyPassword } from "./password";
import { clientIp } from "./client-ip";
import { toUserResponse } from "./user-response";
import {
  LOGIN_LOCKED_MESSAGE,
  USER_LOGIN_IP_RULE,
  checkLoginAllowed,
  recordLoginFailure,
} from "./login-throttle";

/** 密码登录失败统一提示（2026-10-17）：不区分「邮箱未注册」「没设密码」「密码错」。 */
export const LOGIN_FAILED_MESSAGE = "邮箱或密码错误";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
      },
) {
  // 先过统一的用户白名单（server/_core/user-response.ts），再挑这几个 REST 接口一直返回的字段。
  // 2026-10-18：加上 avatar、bio——前端 getMe() 的类型和「编辑资料」页一直按这两个字段回填，
  // 原来没返回，保存后表单会被清空。两者都在白名单里。
  const safe = toUserResponse(user as any);
  return {
    id: safe?.id ?? null,
    openId: safe?.openId ?? null,
    name: safe?.name ?? null,
    email: safe?.email ?? null,
    avatar: safe?.avatar ?? null,
    bio: safe?.bio ?? null,
    loginMethod: safe?.loginMethod ?? null,
    lastSignedIn: (safe?.lastSignedIn ?? new Date()).toISOString(),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasSessionCookie(req: Request) {
  return req.headers.cookie
    ?.split(";")
    .some((cookie) => cookie.trim().startsWith(`${COOKIE_NAME}=`));
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    try {
      const existing = await getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      if (phone) {
        const phoneOwner = await getUserByPhone(phone);
        if (phoneOwner) {
          res.status(409).json({ error: "Phone already registered" });
          return;
        }
      }

      const displayName = name || email.split("@")[0];
      const openId = `email:${email}`;
      const lastSignedIn = new Date();

      await createUser({
        openId,
        name: displayName,
        email,
        phone: phone || null,
        passwordHash: hashPassword(password),
        loginMethod: "email",
        lastSignedIn,
      });

      const saved = await getUserByEmail(email);
      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(
          saved ?? {
            openId,
            name: displayName,
            email,
            loginMethod: "email",
            lastSignedIn,
          },
        ),
      });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }

    // 2026-10-17：按 IP 限流（计数存库，锁 15 分钟到时自动解开）。
    const throttleParts = [clientIp(req)];
    try {
      const check = await checkLoginAllowed(USER_LOGIN_IP_RULE, throttleParts);
      if (!check.allowed) {
        res.setHeader("Retry-After", String(check.retryAfterSeconds));
        res.status(429).json({ error: LOGIN_LOCKED_MESSAGE });
        return;
      }
    } catch (error) {
      console.error("[Auth] Login throttle check failed:", error);
    }

    try {
      const user = await getUserByEmail(email);
      /* 未注册、没设密码、密码错：一律同一句话、同一个状态码，不再透露邮箱是否注册过。 */
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        await recordLoginFailure(USER_LOGIN_IP_RULE, throttleParts).catch((error) =>
          console.error("[Auth] Login throttle record failed:", error),
        );
        res.status(401).json({ error: LOGIN_FAILED_MESSAGE });
        return;
      }

      const lastSignedIn = new Date();
      await updateUser(user.id, {
        lastSignedIn,
        loginMethod: user.loginMethod || "email",
      });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse({
          ...user,
          lastSignedIn,
        }),
      });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to the frontend URL (Expo web on port 8081)
      // Cookie is set with parent domain so it works across both 3000 and 8081 subdomains
      const frontendUrl =
        process.env.EXPO_WEB_PREVIEW_URL ||
        process.env.EXPO_PACKAGER_PROXY_URL ||
        "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);

      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch {
      if (hasSessionCookie(req)) {
        const cookieOptions = getSessionCookieOptions(req);
        res.clearCookie(COOKIE_NAME, cookieOptions);
      }
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
