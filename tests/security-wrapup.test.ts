import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-session-secret-2026-10-17";
});

/* 不连库、不发真邮件：用户表、验证码表、发信全部替身。 */
const sent = vi.hoisted(() => ({ mails: [] as Array<{ email: string; purpose: string }>, failSend: false, cooldown: false }));

vi.mock("../server/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/db")>();
  return {
    ...original,
    getUserByEmail: vi.fn(async (email: string) =>
      email === "member@example.com" ? { id: 9, email, openId: "email:member@example.com", role: "user" } : null,
    ),
  };
});
vi.mock("../server/_core/verification", () => ({
  createVerificationCode: vi.fn(async () =>
    sent.cooldown ? { ok: false, error: "请等待 42 秒后再试", retryAfter: 42 } : { ok: true, code: "123456" },
  ),
  verifyCode: vi.fn(async () => ({ ok: false, error: "验证码错误" })),
}));
vi.mock("../server/_core/email", async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    sendVerificationCodeEmail: vi.fn(async (email: string, _code: string, purpose: string) => {
      await new Promise((r) => setTimeout(r, 30)); // 真发信要花时间
      sent.mails.push({ email, purpose });
      return sent.failSend ? { ok: false, error: "provider down" } : { ok: true };
    }),
  };
});

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { setEmailCodeTimingForTests } from "../server/routers/auth";
import { EMAIL_CODE_UNIFORM_MESSAGE } from "../server/_core/email-code-gate";

const repoRoot = resolve(__dirname, "..");
const MIN_MS = 150;

function ctxFor(user: any) {
  return {
    req: { protocol: "https", headers: { "x-forwarded-for": "198.51.100.30" }, socket: { remoteAddress: "100.64.0.9" } } as any,
    res: { cookie: () => undefined, clearCookie: () => undefined } as any,
    user,
  };
}

beforeEach(() => {
  sent.mails = [];
  sent.failSend = false;
  sent.cooldown = false;
  setEmailCodeTimingForTests({ minMs: MIN_MS, jitterMs: 0 });
});

// ---------------------------------------------------------------- 1
describe("1. 登录 / 找回密码发码：注册与否回复一致", () => {
  it.each(["login", "reset_password"] as const)("%s：同一句话，只给已注册邮箱发信，两条路都不早于最短时间返回", async (purpose) => {
    const caller = appRouter.createCaller(ctxFor(null));
    const timed = async (email: string) => {
      const startedAt = Date.now();
      const result = await caller.auth.sendEmailCode({ email, purpose });
      return { result, elapsed: Date.now() - startedAt };
    };
    const member = await timed("member@example.com");
    const stranger = await timed("stranger@example.com");
    expect(member.result).toEqual({ ok: true, message: "如果这个邮箱已注册，验证码已发送" });
    expect(stranger.result).toEqual(member.result);
    expect(member.elapsed).toBeGreaterThanOrEqual(MIN_MS - 5);
    expect(stranger.elapsed).toBeGreaterThanOrEqual(MIN_MS - 5);
    expect(sent.mails).toEqual([{ email: "member@example.com", purpose }]);
  });

  it("发信失败也不改口（否则「发信失败」本身就说明注册过）", async () => {
    sent.failSend = true;
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.auth.sendEmailCode({ email: "member@example.com", purpose: "login" })).resolves.toEqual({
      ok: true,
      message: EMAIL_CODE_UNIFORM_MESSAGE,
    });
  });

  it("60 秒冷却对注册和未注册的邮箱一样出现", async () => {
    sent.cooldown = true;
    const caller = appRouter.createCaller(ctxFor(null));
    for (const email of ["member@example.com", "stranger@example.com"]) {
      await expect(caller.auth.sendEmailCode({ email, purpose: "login" })).rejects.toThrow("请等待 42 秒后再试");
    }
  });

  it("注册流程「该邮箱已注册」照旧", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.auth.sendEmailCode({ email: "member@example.com", purpose: "register" })).rejects.toThrow(
      "该邮箱已注册，请直接登录",
    );
  });

  describe("走真 HTTP（localhost）：状态码、响应体一致", () => {
    let server: Server;
    let base = "";
    beforeAll(async () => {
      const app = express();
      app.use(express.json());
      app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
      server = createServer(app);
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterAll(() => server?.close());

    it("已注册 / 未注册：HTTP 200、同样的响应体", async () => {
      const post = async (email: string) => {
        const res = await fetch(`${base}/api/trpc/auth.sendEmailCode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: { email, purpose: "login" } }),
        });
        return { status: res.status, body: await res.text() };
      };
      const member = await post("member@example.com");
      const stranger = await post("stranger@example.com");
      expect(member.status).toBe(200);
      expect(stranger.status).toBe(200);
      expect(stranger.body).toBe(member.body);
      expect(member.body).toContain("如果这个邮箱已注册，验证码已发送");
    });
  });

  it("前端提示同步：登录、找回密码页用服务端的统一回复", () => {
    for (const file of ["app/auth/login.tsx", "app/auth/forgot-password.tsx"]) {
      const source = readFileSync(join(repoRoot, file), "utf-8");
      expect(source, file).toContain("如果这个邮箱已注册，验证码已发送");
      expect(source, file).not.toContain("验证码已发送至您的邮箱");
    }
    const auth = readFileSync(join(repoRoot, "server/routers/auth.ts"), "utf-8");
    expect(auth).not.toContain('"该邮箱未注册"');
  });
});

// ---------------------------------------------------------------- 2
describe("2. 站内客服、TOTP 限流和登录用同一个取 IP 函数", () => {
  it("路由里不再直接用 socket 对端（requestIp），改用 clientIp", () => {
    for (const file of ["server/routers/support.ts", "server/routers/commerce.ts", "server/routers/managed-sessions.ts", "server/routers/auth.ts", "server/routers/admin-auth.ts", "server/_core/oauth.ts"]) {
      const source = readFileSync(join(repoRoot, file), "utf-8");
      expect(source, file).not.toMatch(/\brequestIp\(/);
      expect(source, file).toContain("clientIp(");
    }
  });
});

// ---------------------------------------------------------------- 3
describe("3. 后台接口：普通用户 403，未登录 401", () => {
  it.each([
    ["siteSettings.getAll", (c: any) => c.siteSettings.getAll()],
    ["admin.stats.overview", (c: any) => c.admin.stats.overview()],
    ["anonymousComments.listAll", (c: any) => c.anonymousComments.listAll({})],
  ])("%s", async (_name, call) => {
    await expect(call(appRouter.createCaller(ctxFor({ id: 1, role: "user", openId: "u1" })))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(call(appRouter.createCaller(ctxFor(null)))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
