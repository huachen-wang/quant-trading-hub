import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/* 会话签名要 JWT_SECRET；必须在 import 服务端模块之前设好。只用于本测试进程。 */
vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-session-secret-2026-10-17";
});

/* 普通用户登录：用假用户表，覆盖「未注册 / 没设密码 / 密码错 / 正确」四种情况，不连真库。 */
vi.mock("../server/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/db")>();
  const { hashPassword } = await import("../server/_core/password");
  const users: Record<string, any> = {
    "has-password@example.com": {
      id: 7,
      openId: "email:has-password@example.com",
      name: "has",
      email: "has-password@example.com",
      passwordHash: hashPassword("right-password"),
      loginMethod: "email",
      sessionVersion: 0,
      emailVerifiedAt: new Date(),
      role: "user",
      lastSignedIn: new Date(),
    },
    "no-password@example.com": {
      id: 8,
      openId: "email:no-password@example.com",
      name: "nopw",
      email: "no-password@example.com",
      passwordHash: null,
      loginMethod: "email",
      sessionVersion: 0,
      emailVerifiedAt: new Date(),
      role: "user",
      lastSignedIn: new Date(),
    },
  };
  return {
    ...original,
    getUserByEmail: vi.fn(async (email: string) => users[email] ?? null),
    getUserByOpenId: vi.fn(async (openId: string) => Object.values(users).find((user) => user.openId === openId) ?? null),
    updateUser: vi.fn(async () => null),
  };
});

import express from "express";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { appRouter } from "../server/routers";
import { publicAnonymousCommentsWhere } from "../server/db";
import { registerOAuthRoutes, LOGIN_FAILED_MESSAGE } from "../server/_core/oauth";
import { clientIp, isCloudflareIp } from "../server/_core/client-ip";
import {
  ADMIN_LOGIN_RULE,
  MemoryThrottleStore,
  USER_LOGIN_IP_RULE,
  applyFailure,
  resetLoginThrottleForTests,
  setLoginThrottleForTests,
} from "../server/_core/login-throttle";

const repoRoot = resolve(__dirname, "..");
const MIN = 60_000;

function ctxFor(user: any, headers: Record<string, string> = {}) {
  return {
    req: { protocol: "https", headers, socket: { remoteAddress: "100.64.0.9" } } as any,
    res: { cookie: () => undefined, clearCookie: () => undefined } as any,
    user,
  };
}

let now = Date.UTC(2026, 9, 17, 0, 0, 0);
beforeEach(() => {
  now = Date.UTC(2026, 9, 17, 0, 0, 0);
  resetLoginThrottleForTests();
  setLoginThrottleForTests({ store: new MemoryThrottleStore(), now: () => now });
});

// ---------------------------------------------------------------- 1
describe("1. siteSettings.getAll 只给管理员", () => {
  it("不带凭据 → UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.siteSettings.getAll()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("普通登录用户也拿不到", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 1, role: "user", openId: "u1" }));
    await expect(caller.siteSettings.getAll()).rejects.toThrow();
  });

  it("前台联系方式走 getContact，照常公开，且只返回 contact_*", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    const contact = (await caller.siteSettings.getContact()) as Record<string, string>;
    expect(Object.keys(contact).length).toBeGreaterThan(0);
    for (const key of Object.keys(contact)) expect(key.startsWith("contact_")).toBe(true);
    const dbSource = readFileSync(join(repoRoot, "server/db.ts"), "utf-8");
    expect(dbSource).toContain("LIKE 'contact_%'");
  });

  it("前台代码里没有任何地方调用 getAll（只有后台客户端 lib/admin-api.ts）", () => {
    for (const file of ["components/contact-modal.tsx", "components/community/community-contacts.tsx", "app/cooperation.tsx", "app/promo.tsx"]) {
      const source = readFileSync(join(repoRoot, file), "utf-8");
      expect(source, file).not.toContain("siteSettings.getAll");
    }
  });
});

// ---------------------------------------------------------------- 2
describe("2. 公开评论只返回审核通过的", () => {
  it("公开查询条件 = 商品 id 且 isApproved = true", () => {
    const query = new MySqlDialect().sqlToQuery(publicAnonymousCommentsWhere(42) as any);
    expect(query.sql).toContain("`strategyId`");
    expect(query.sql).toContain("`isApproved`");
    expect(query.params).toEqual([42, true]);
  });

  it("公开接口用带审核条件的查询；后台看全部的接口仍是 admin 且不加审核条件", () => {
    const router = readFileSync(join(repoRoot, "server/routers/community.ts"), "utf-8");
    expect(router).toMatch(/list: publicProcedure[\s\S]*?db\.getAnonymousComments\(/);
    expect(router).toMatch(/listAll: adminProcedure[\s\S]*?db\.getAllAnonymousComments\(/);
    const dbSource = readFileSync(join(repoRoot, "server/db.ts"), "utf-8");
    const publicFn = dbSource.slice(dbSource.indexOf("export async function getAnonymousComments"));
    expect(publicFn.slice(0, publicFn.indexOf("\n}\n"))).toContain("publicAnonymousCommentsWhere(strategyId)");
    const adminFn = dbSource.slice(dbSource.indexOf("export async function getAllAnonymousComments"));
    const adminBody = adminFn.slice(0, adminFn.indexOf("\n}\n"));
    expect(adminBody).not.toContain("publicAnonymousCommentsWhere");
    expect(adminBody).not.toContain("eq(anonymousComments.isApproved");
  });
});

// ---------------------------------------------------------------- 3
describe("3. 限流规则（纯函数，和库里那条 SQL 同一套）", () => {
  it("5 分钟内失败 5 次锁 15 分钟；到时自动解开、从 1 重新计", () => {
    let state = null as ReturnType<typeof applyFailure> | null;
    for (let i = 0; i < 4; i += 1) state = applyFailure(state, now + i * 1000, ADMIN_LOGIN_RULE);
    expect(state!.lockedUntil).toBe(0);
    state = applyFailure(state, now + 5000, ADMIN_LOGIN_RULE);
    expect(state.lockedUntil).toBe(now + 5000 + 15 * MIN);
    state = applyFailure(state, now + 5000 + 15 * MIN, ADMIN_LOGIN_RULE);
    expect(state).toEqual({ failures: 1, windowStartedAt: now + 5000 + 15 * MIN, lockedUntil: 0 });
  });

  it("窗口过期后从 1 重新计；锁没到期时再记失败不会提前解锁", () => {
    let state = applyFailure(null, now, ADMIN_LOGIN_RULE);
    state = applyFailure(state, now + 6 * MIN, ADMIN_LOGIN_RULE);
    expect(state.failures).toBe(1);
    const locked = { failures: 5, windowStartedAt: now, lockedUntil: now + 15 * MIN };
    const later = applyFailure(locked, now + 6 * MIN, ADMIN_LOGIN_RULE);
    expect(later.lockedUntil).toBe(now + 15 * MIN);
  });
});

describe("3. 管理员登录限流（IP + 邮箱，存库，锁 15 分钟自动解开）", () => {
  const ADMIN_EMAIL = "admin@eaxau.com"; // 非生产环境的开发兜底账号
  const ADMIN_PASSWORD = "admin123";
  const ipA = { "x-forwarded-for": "198.51.100.10" };
  const ipB = { "x-forwarded-for": "198.51.100.20" };

  it("同一 IP + 邮箱失败 5 次后锁住，连正确密码也进不去", async () => {
    const caller = appRouter.createCaller(ctxFor(null, ipA));
    for (let i = 0; i < 5; i += 1) {
      await expect(caller.adminAuth.login({ email: ADMIN_EMAIL, password: "wrong" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
    await expect(caller.adminAuth.login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("同一邮箱换个 IP 不被锁", async () => {
    const attacker = appRouter.createCaller(ctxFor(null, ipA));
    for (let i = 0; i < 6; i += 1) {
      await attacker.adminAuth.login({ email: ADMIN_EMAIL, password: "wrong" }).catch(() => undefined);
    }
    const admin = appRouter.createCaller(ctxFor(null, ipB));
    await expect(admin.adminAuth.login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).resolves.toMatchObject({
      success: true,
    });
  });

  it("锁 15 分钟，到时自动解开", async () => {
    const caller = appRouter.createCaller(ctxFor(null, ipA));
    for (let i = 0; i < 5; i += 1) {
      await caller.adminAuth.login({ email: ADMIN_EMAIL, password: "wrong" }).catch(() => undefined);
    }
    now += 15 * MIN - 1000;
    await expect(caller.adminAuth.login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    now += 1000;
    await expect(caller.adminAuth.login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).resolves.toMatchObject({
      success: true,
    });
  });

  it("库里只存摘要：计数键里没有明文 IP 和邮箱", async () => {
    const store = new MemoryThrottleStore();
    setLoginThrottleForTests({ store });
    const caller = appRouter.createCaller(ctxFor(null, ipA));
    await caller.adminAuth.login({ email: ADMIN_EMAIL, password: "wrong" }).catch(() => undefined);
    const keys = [...(store as any).states.keys()].join(" ");
    expect(keys).toMatch(/^ADMIN_LOGIN:[0-9a-f]{64}$/);
    expect(keys).not.toContain("198.51.100.10");
    expect(keys).not.toContain(ADMIN_EMAIL);
  });
});

// ---------------------------------------------------------------- 4
describe("4. 普通用户密码登录：统一报错 + 按 IP 限流", () => {
  let server: Server;
  let base = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerOAuthRoutes(app);
    server = createServer(app);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server?.close());

  async function login(email: string, password: string, ip: string) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ email, password }),
    });
    return { status: res.status, body: await res.json() };
  }

  it("未注册、没设密码、密码错：同一个状态码、同一句「邮箱或密码错误」", async () => {
    const results = [
      await login("nobody@example.com", "whatever", "203.0.113.1"),
      await login("no-password@example.com", "whatever", "203.0.113.1"),
      await login("has-password@example.com", "wrong-password", "203.0.113.1"),
    ];
    for (const result of results) {
      expect(result.status).toBe(401);
      expect(result.body).toEqual({ error: "邮箱或密码错误" });
    }
    expect(LOGIN_FAILED_MESSAGE).toBe("邮箱或密码错误");
    const source = readFileSync(join(repoRoot, "server/_core/oauth.ts"), "utf-8");
    expect(source).not.toContain("Email not registered");
  });

  it("同一 IP 15 分钟内失败 20 次后锁住（429），换个 IP 不受影响，15 分钟后自动解开", async () => {
    for (let i = 0; i < USER_LOGIN_IP_RULE.maxFailures; i += 1) {
      expect((await login(`u${i}@example.com`, "x", "203.0.113.50")).status).toBe(401);
    }
    const locked = await login("has-password@example.com", "right-password", "203.0.113.50");
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe("登录尝试过多，请 15 分钟后再试");

    expect((await login("has-password@example.com", "right-password", "203.0.113.51")).status).toBe(200);

    now += 15 * MIN;
    expect((await login("has-password@example.com", "right-password", "203.0.113.50")).status).toBe(200);
  });

  it("注册流程「邮箱已被注册」的提示保持原样（旧免验证注册入口 2026-10-26 起固定 410）", () => {
    const oauth = readFileSync(join(repoRoot, "server/_core/oauth.ts"), "utf-8");
    expect(oauth).toContain('res.status(410).json({ error: "请使用邮箱验证码注册" })');
    const auth = readFileSync(join(repoRoot, "server/routers/auth.ts"), "utf-8");
    expect(auth).toContain('if (existing) throw new Error("该邮箱已注册")');
  });
});

// ---------------------------------------------------------------- IP
describe("访客 IP：不拿 Railway 代理的内网地址当 IP", () => {
  it("经 Cloudflare：最右一项是 Cloudflare 网段 → 用 CF-Connecting-IP", () => {
    expect(isCloudflareIp("172.70.1.2")).toBe(true);
    expect(isCloudflareIp("2606:4700::1")).toBe(true);
    expect(isCloudflareIp("203.0.113.9")).toBe(false);
    expect(
      clientIp(
        { headers: { "x-forwarded-for": "1.2.3.4, 198.51.100.7, 172.70.1.2", "cf-connecting-ip": "198.51.100.7" }, socket: { remoteAddress: "100.64.0.3" } },
        {} as NodeJS.ProcessEnv,
      ),
    ).toBe("198.51.100.7");
  });

  it("不经 Cloudflare：用最右一项（访客只能往左边塞值）", () => {
    expect(
      clientIp(
        { headers: { "x-forwarded-for": "6.6.6.6, 198.51.100.8", "cf-connecting-ip": "6.6.6.6" }, socket: { remoteAddress: "100.64.0.3" } },
        {} as NodeJS.ProcessEnv,
      ),
    ).toBe("198.51.100.8");
  });

  it("没有转发头（本地）→ socket 对端；配置了代理层数 → 沿用原规则", () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: "::ffff:127.0.0.1" } }, {} as NodeJS.ProcessEnv)).toBe("127.0.0.1");
    expect(
      clientIp(
        { headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.8" }, socket: { remoteAddress: "10.0.0.9" } },
        { ADMIN_TRUSTED_PROXY_HOPS: "2" } as unknown as NodeJS.ProcessEnv,
      ),
    ).toBe("198.51.100.10");
  });
});

// ---------------------------------------------------------------- 迁移
describe("迁移：login_throttle 在启动迁移链最前面建", () => {
  it("runMigrations 调用 ensureLoginThrottleSchema，DDL 带唯一索引", () => {
    const source = readFileSync(join(repoRoot, "server/migrate.ts"), "utf-8");
    expect(source).toContain("migrationsRun += await ensureLoginThrottleSchema(connection);");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS \\`login_throttle\\`");
    expect(source).toContain("UNIQUE INDEX \\`login_throttle_scope_key_unique_idx\\` (\\`scope\\`, \\`keyHash\\`)");
  });
});
