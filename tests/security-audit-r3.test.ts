/**
 * 2026-10-18 安全修复（代码体检 R3 的 ①②④⑤）。不连库、不发信、不打线上：
 * 用户表用替身；验证码表用和 SQL 同语义的进程内实现；商品走本地 mock 数据模式。
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-session-secret-2026-10-18";
});

const fakeUsers = vi.hoisted(() => new Map<string, any>());

vi.mock("../server/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/db")>();
  const { hashPassword } = await import("../server/_core/password");
  const seed = () => {
    fakeUsers.clear();
    fakeUsers.set("member@example.com", {
      id: 21,
      openId: "email:member@example.com",
      name: "member",
      email: "member@example.com",
      passwordHash: hashPassword("old-password-1"),
      avatar: null,
      bio: null,
      loginMethod: "email",
      role: "user",
      phone: null,
      phoneVerified: false,
      sessionVersion: 0,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
  };
  seed();
  return {
    ...original,
    __seedUsers: seed,
    getUserByEmail: vi.fn(async (email: string) => fakeUsers.get(email) ?? null),
    getUserByOpenId: vi.fn(async (openId: string) => [...fakeUsers.values()].find((user) => user.openId === openId) ?? null),
    confirmUserEmail: vi.fn(async (_id: number, email: string) => fakeUsers.get(email)),
    updateUserPassword: vi.fn(async (id: number, passwordHash: string) => {
      const user = [...fakeUsers.values()].find((row) => row.id === id);
      Object.assign(user, { passwordHash, sessionVersion: user.sessionVersion + 1 });
    }),
    getUserByPhone: vi.fn(async () => null),
    updateUser: vi.fn(async (id: number, data: any) => {
      for (const user of fakeUsers.values()) if (user.id === id) Object.assign(user, data);
      return null;
    }),
    createUser: vi.fn(async (data: any) => {
      fakeUsers.set(data.email, { id: 100 + fakeUsers.size, role: "user", avatar: null, bio: null, sessionVersion: 0, ...data });
      return null;
    }),
    getStrategies: vi.fn(original.getStrategies),
    searchStrategies: vi.fn(original.searchStrategies),
    getUserPurchases: vi.fn(original.getUserPurchases),
    getUserDownloads: vi.fn(original.getUserDownloads),
    incrementStrategyViewCount: vi.fn(async () => undefined),
  };
});

import express from "express";
import { getTableColumns } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import * as db from "../server/db";
import { appRouter } from "../server/routers";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { verifyPassword } from "../server/_core/password";
import {
  CODE_ATTEMPTS_EXHAUSTED_MESSAGE,
  CODE_EXPIRED_MESSAGE,
  CODE_WRONG_MESSAGE,
  MAX_VERIFY_ATTEMPTS,
  MemoryVerificationCodeStore,
  buildConsumeQuery,
  buildReserveAttemptQuery,
  createVerificationCode,
  resetVerificationStoreForTests,
  setVerificationStoreForTests,
  verifyCode,
} from "../server/_core/verification";
import {
  CODE_VERIFY_IP_RULE,
  MemoryThrottleStore,
  resetLoginThrottleForTests,
  setLoginThrottleForTests,
} from "../server/_core/login-throttle";
import { USER_RESPONSE_FIELDS, toUserResponse } from "../server/_core/user-response";
import { ensureUserAuthColumns, ensureVerificationCodeAttemptsColumn } from "../server/migrate";
import {
  INTERNAL_STRATEGY_FIELDS,
  PUBLIC_STRATEGY_FIELDS,
  toPublicStrategy,
} from "../server/routers/strategy-public";

const repoRoot = resolve(__dirname, "..");
const MIN = 60_000;
const INTERNAL = ["downloadUrl", "packageDigestUrl", "packageSha256", "packageBytes"];

function ctxFor(user: any, ip = "198.51.100.30") {
  return {
    req: { protocol: "https", hostname: "www.eaxau.com", headers: { "x-forwarded-for": ip }, socket: { remoteAddress: "100.64.0.9" } } as any,
    res: { cookie: () => undefined, clearCookie: () => undefined } as any,
    user,
  };
}

/** 一整行商品记录：所有列都有值，交付字段填的是「原始发包地址」。 */
function fullStrategyRow(overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {};
  for (const column of Object.keys(getTableColumns(schema.strategies))) row[column] = `value-of-${column}`;
  return {
    ...row,
    id: 77,
    title: "黄金 EA",
    platform: "MT5",
    status: "published",
    downloadUrl: "https://storage.example/private/source-v1.ex5",
    packageDigestUrl: "https://storage.example/private/source-v1.ex5",
    packageSha256: "a".repeat(64),
    packageBytes: 123456,
    // 将来新加、没人登记过的列：白名单下也出不去。
    internalStorageKey: "s3://bucket/private/source-v1.ex5",
    ...overrides,
  };
}

function expectNoInternalFields(value: unknown) {
  const text = JSON.stringify(value);
  expect(text).not.toContain("storage.example/private");
  expect(text).not.toContain("s3://bucket");
  for (const field of [...INTERNAL, "internalStorageKey"]) expect(text).not.toContain(`"${field}"`);
}

let now = Date.UTC(2026, 9, 18, 0, 0, 0);
let codeStore: MemoryVerificationCodeStore;

beforeEach(() => {
  now = Date.UTC(2026, 9, 18, 0, 0, 0);
  (db as any).__seedUsers();
  codeStore = new MemoryVerificationCodeStore();
  setVerificationStoreForTests({ store: codeStore, now: () => now });
  resetLoginThrottleForTests();
  setLoginThrottleForTests({ store: new MemoryThrottleStore(), now: () => now });
});

afterAll(() => {
  resetVerificationStoreForTests();
  resetLoginThrottleForTests();
});

async function issue(target: string, purpose: "login" | "reset_password" | "register" = "login") {
  const created = await createVerificationCode({ target, targetType: "email", purpose });
  expect(created.ok).toBe(true);
  return created.code!;
}

function wrongCodeFor(code: string) {
  // 合法验证码是 100000–999999，000000 永远不会是真码。
  return code === "000000" ? "111111" : "000000";
}

// ---------------------------------------------------------------- ①
describe("① 公开商品响应：字段白名单，不带任何交付 / 存储字段", () => {
  it("白名单与内部字段不相交；strategies 表每一列都已归类（新加列必须先决定公开与否）", () => {
    for (const field of INTERNAL) {
      expect(PUBLIC_STRATEGY_FIELDS as readonly string[]).not.toContain(field);
      expect(INTERNAL_STRATEGY_FIELDS as readonly string[]).toContain(field);
    }
    const classified = new Set<string>([...PUBLIC_STRATEGY_FIELDS, ...INTERNAL_STRATEGY_FIELDS]);
    const columns = Object.keys(getTableColumns(schema.strategies));
    expect(columns.filter((column) => !classified.has(column))).toEqual([]);
  });

  it("投影只留白名单字段 + downloadAvailable；packageDigestUrl 等全部去掉", () => {
    const projected = toPublicStrategy(fullStrategyRow());
    expectNoInternalFields(projected);
    expect(Object.keys(projected).sort()).toEqual([...PUBLIC_STRATEGY_FIELDS, "downloadAvailable"].sort());
    expect(projected.downloadAvailable).toBe(true);
  });

  it("公开列表、搜索、详情、已购、下载记录都不带交付字段", async () => {
    vi.mocked(db.getStrategies).mockResolvedValueOnce([fullStrategyRow()] as any);
    vi.mocked(db.searchStrategies).mockResolvedValueOnce([fullStrategyRow()] as any);
    vi.mocked(db.getUserPurchases).mockResolvedValueOnce([{ id: 1, price: "9.00", purchasedAt: new Date(), strategy: fullStrategyRow() }] as any);
    vi.mocked(db.getUserDownloads).mockResolvedValueOnce([{ id: 2, downloadedAt: new Date(), strategy: fullStrategyRow() }] as any);

    const anonymous = appRouter.createCaller(ctxFor(null));
    const member = appRouter.createCaller(ctxFor(fakeUsers.get("member@example.com")));
    const list = await anonymous.strategies.list({});
    const search = await anonymous.strategies.search({ keyword: "黄金" });
    const purchases = await member.purchases.list();
    const downloads = await member.downloads.list();
    for (const value of [list, search, purchases, downloads]) expectNoInternalFields(value);
    expect(list[0].title).toBe("黄金 EA");

    // 详情：本地 mock 数据模式下的真实查询函数，商品带着交付摘要。
    const created = await db.createStrategy({
      title: "R3 detail leak check",
      platform: "MT5",
      pairs: "XAUUSD",
      status: "published",
      downloadUrl: "https://storage.example/private/detail.ex5",
      packageDigestUrl: "https://storage.example/private/detail.ex5",
      packageSha256: "b".repeat(64),
      packageBytes: 42,
    } as any);
    const detail = await anonymous.strategies.detail({ id: created!.id });
    expectNoInternalFields(detail);
    expect(detail.title).toBe("R3 detail leak check");
  });

  it("前端用到的公开字段都还在（详情页类型里声明的字段 ⊆ 白名单）", () => {
    const types = readFileSync(join(repoRoot, "components/strategy-detail/types.ts"), "utf-8");
    const block = types.slice(types.indexOf("export type StrategyDetailData"), types.indexOf("};", types.indexOf("export type StrategyDetailData")));
    const declared = [...block.matchAll(/^\s+(\w+)\??:/gm)].map((match) => match[1]);
    const allowed = new Set<string>([...PUBLIC_STRATEGY_FIELDS, "downloadAvailable"]);
    expect(declared.length).toBeGreaterThan(10);
    expect(declared.filter((field) => !allowed.has(field))).toEqual([]);
  });
});

// ---------------------------------------------------------------- ④
describe("④ 未发布（草稿 / 归档）商品不能匿名读详情", () => {
  it("公开详情查询条件 = id 且 status = 'published'", () => {
    const query = new MySqlDialect().sqlToQuery(db.publishedStrategyByIdWhere(42) as any);
    expect(query.sql).toContain("`id`");
    expect(query.sql).toContain("`status`");
    expect(query.params).toEqual([42, "published"]);
  });

  it.each(["draft", "archived"])("%s 商品：公开详情 NOT_FOUND，且不涨浏览数；后台查询照旧能读到", async (status) => {
    const created = await db.createStrategy({ title: `R3 ${status}`, platform: "MT4", pairs: "XAUUSD", status } as any);
    vi.mocked(db.incrementStrategyViewCount).mockClear();
    const anonymous = appRouter.createCaller(ctxFor(null));
    await expect(anonymous.strategies.detail({ id: created!.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.incrementStrategyViewCount).not.toHaveBeenCalled();
    expect(await db.getPublishedStrategyById(created!.id)).toBeNull();
    expect((await db.getStrategyById(created!.id))?.status).toBe(status);
  });

  it("已发布商品照常可读；不存在的 id 也是 NOT_FOUND", async () => {
    const created = await db.createStrategy({ title: "R3 published", platform: "MT5", pairs: "XAUUSD", status: "published" } as any);
    const anonymous = appRouter.createCaller(ctxFor(null));
    await expect(anonymous.strategies.detail({ id: created!.id })).resolves.toMatchObject({ id: created!.id });
    await expect(anonymous.strategies.detail({ id: 987654 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("公开详情走带状态条件的查询；后台详情仍用不带状态的 getStrategyById", () => {
    const router = readFileSync(join(repoRoot, "server/routers/strategy-public.ts"), "utf-8");
    expect(router).toMatch(/detail: publicProcedure[\s\S]*?db\.getPublishedStrategyById\(input\.id\)/);
    const admin = readFileSync(join(repoRoot, "server/routers/admin.ts"), "utf-8");
    expect(admin).toContain("db.getStrategyById(input.id)");
    const dbSource = readFileSync(join(repoRoot, "server/db.ts"), "utf-8");
    const fn = dbSource.slice(dbSource.indexOf("export async function getPublishedStrategyById"));
    expect(fn.slice(0, fn.indexOf("\n}\n"))).toContain("publishedStrategyByIdWhere(id)");
  });
});

// ---------------------------------------------------------------- ②
describe("② 验证码校验次数上限（每条码最多 5 次）", () => {
  it("连错 5 次后这条码作废：之后输入正确的码也被拒绝", async () => {
    const code = await issue("member@example.com");
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS - 1; i += 1) {
      expect(await verifyCode({ target: "member@example.com", purpose: "login", code: wrongCodeFor(code) })).toEqual({
        ok: false,
        error: CODE_WRONG_MESSAGE,
      });
    }
    expect(await verifyCode({ target: "member@example.com", purpose: "login", code: wrongCodeFor(code) })).toEqual({
      ok: false,
      error: CODE_ATTEMPTS_EXHAUSTED_MESSAGE,
    });
    expect(await verifyCode({ target: "member@example.com", purpose: "login", code })).toEqual({
      ok: false,
      error: CODE_ATTEMPTS_EXHAUSTED_MESSAGE,
    });
    expect(codeStore.rows[0]).toMatchObject({ attempts: MAX_VERIFY_ATTEMPTS, used: false });
  });

  it("错 4 次后第 5 次输对仍然通过；用过的码不能再用（防重放）", async () => {
    const code = await issue("member@example.com");
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS - 1; i += 1) {
      await verifyCode({ target: "member@example.com", purpose: "login", code: wrongCodeFor(code) });
    }
    expect(await verifyCode({ target: "member@example.com", purpose: "login", code })).toEqual({ ok: true });
    expect((await verifyCode({ target: "member@example.com", purpose: "login", code })).ok).toBe(false);
  });

  it("并发 20 个错误请求：只有 5 次被比对，随后正确的码也不认", async () => {
    const code = await issue("member@example.com");
    await Promise.all(
      Array.from({ length: 20 }, () => verifyCode({ target: "member@example.com", purpose: "login", code: wrongCodeFor(code) })),
    );
    expect(codeStore.rows[0].attempts).toBe(MAX_VERIFY_ATTEMPTS);
    expect((await verifyCode({ target: "member@example.com", purpose: "login", code })).ok).toBe(false);
  });

  it("并发拿同一个正确的码来：只有一个成功", async () => {
    const code = await issue("member@example.com");
    const results = await Promise.all(
      Array.from({ length: 4 }, () => verifyCode({ target: "member@example.com", purpose: "login", code })),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it("点过「重新发送」有两条有效码：一次错误在两条上各记一次，不能靠多申请码换更多次数", async () => {
    const first = await issue("member@example.com");
    now += 61_000;
    const second = await issue("member@example.com");
    const wrong = ["000000", "111111"].find((value) => value !== first && value !== second)!;
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i += 1) {
      await verifyCode({ target: "member@example.com", purpose: "login", code: wrong });
    }
    expect(codeStore.rows.map((row) => row.attempts)).toEqual([MAX_VERIFY_ATTEMPTS, MAX_VERIFY_ATTEMPTS]);
    expect((await verifyCode({ target: "member@example.com", purpose: "login", code: first })).ok).toBe(false);
    expect((await verifyCode({ target: "member@example.com", purpose: "login", code: second })).ok).toBe(false);
  });

  it("过期的码提示过期；次数按目标 + 用途分开计", async () => {
    const loginCode = await issue("member@example.com", "login");
    const resetCode = await issue("member@example.com", "reset_password");
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i += 1) {
      await verifyCode({ target: "member@example.com", purpose: "login", code: wrongCodeFor(loginCode) });
    }
    expect(await verifyCode({ target: "member@example.com", purpose: "reset_password", code: resetCode })).toEqual({ ok: true });

    const later = await issue("other@example.com");
    now += 5 * MIN + 1;
    expect(await verifyCode({ target: "other@example.com", purpose: "login", code: later })).toEqual({
      ok: false,
      error: CODE_EXPIRED_MESSAGE,
    });
  });

  it("库里的两条语句都是带条件的单条更新：未使用且次数没满才占名额；未使用才标记已用", () => {
    const mock = drizzle.mock({ schema, mode: "default" });
    const reserve = buildReserveAttemptQuery(mock, 42, MAX_VERIFY_ATTEMPTS).toSQL();
    expect(reserve.sql).toMatch(/^update `verification_codes` set `attempts` = `verification_codes`\.`attempts` \+ 1 where/);
    expect(reserve.sql).toContain("`verification_codes`.`id` = ?");
    expect(reserve.sql).toContain("`verification_codes`.`used` = ?");
    expect(reserve.sql).toContain("`verification_codes`.`attempts` < ?");
    expect(reserve.params).toEqual([42, false, MAX_VERIFY_ATTEMPTS]);
    const consume = buildConsumeQuery(mock, 42).toSQL();
    expect(consume.sql).toMatch(/^update `verification_codes` set `used` = \? where/);
    expect(consume.sql).toContain("`verification_codes`.`used` = ?");
    expect(consume.params).toEqual([true, 42, false]);
  });

  it("迁移：旧表补 attempts 列；已有列 / 表还没建都不动；新建表语句自带这一列", async () => {
    const run = async (state: { table: boolean; column: boolean }) => {
      const statements: string[] = [];
      const connection = {
        query: async (statement: string) => {
          statements.push(statement);
          if (statement.includes("INFORMATION_SCHEMA.TABLES")) return [state.table ? [{ 1: 1 }] : []];
          if (statement.includes("INFORMATION_SCHEMA.COLUMNS")) return [state.column ? [{ 1: 1 }] : []];
          return [[]];
        },
      };
      const changed = await ensureVerificationCodeAttemptsColumn(connection as any);
      return { changed, altered: statements.filter((statement) => statement.startsWith("ALTER")) };
    };
    expect(await run({ table: true, column: false })).toEqual({
      changed: 1,
      altered: ["ALTER TABLE `verification_codes` ADD COLUMN `attempts` int NOT NULL DEFAULT 0"],
    });
    expect(await run({ table: true, column: true })).toEqual({ changed: 0, altered: [] });
    expect(await run({ table: false, column: false })).toEqual({ changed: 0, altered: [] });
    const migrate = readFileSync(join(repoRoot, "server/migrate.ts"), "utf-8");
    const create = migrate.slice(migrate.indexOf("CREATE TABLE IF NOT EXISTS \\`verification_codes\\`"));
    expect(create.slice(0, create.indexOf("ENGINE"))).toContain("\\`attempts\\` int NOT NULL DEFAULT 0");
  });
});

describe("迁移：users 会话版本 / 邮箱验证时间（2026-10-26）", () => {
  it("启动迁移只补缺的列、不改数据；列都在 / 表没建都不动；排在迁移链最前面", async () => {
    const run = async (state: { table: boolean; columns: string[] }) => {
      const statements: string[] = [];
      const connection = {
        query: async (statement: string) => {
          statements.push(statement);
          if (statement.includes("INFORMATION_SCHEMA.TABLES")) return [state.table ? [{ 1: 1 }] : []];
          if (statement.includes("INFORMATION_SCHEMA.COLUMNS")) return [state.columns.map((COLUMN_NAME) => ({ COLUMN_NAME }))];
          return [[]];
        },
      };
      const changed = await ensureUserAuthColumns(connection as any);
      return { changed, statements };
    };
    const fresh = await run({ table: true, columns: [] });
    expect(fresh.changed).toBe(2);
    expect(fresh.statements.filter((statement) => statement.startsWith("ALTER"))).toEqual([
      "ALTER TABLE `users` ADD COLUMN `sessionVersion` int NOT NULL DEFAULT 0",
      "ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` timestamp NULL DEFAULT NULL",
    ]);
    expect(fresh.statements.some((statement) => /^\s*(UPDATE|DELETE|INSERT)/i.test(statement))).toBe(false);
    expect((await run({ table: true, columns: ["sessionVersion"] })).changed).toBe(1);
    expect((await run({ table: true, columns: ["sessionVersion", "emailVerifiedAt"] })).changed).toBe(0);
    expect((await run({ table: false, columns: [] })).changed).toBe(0);
    const migrate = readFileSync(join(repoRoot, "server/migrate.ts"), "utf-8");
    const chain = migrate.slice(migrate.indexOf("async function runMigrations"));
    expect(chain.indexOf("ensureUserAuthColumns(connection)")).toBeGreaterThan(0);
    expect(chain.indexOf("ensureUserAuthColumns(connection)")).toBeLessThan(chain.indexOf("strategyMigrations"));
  });
});

describe("② 验证码登录 / 找回密码接口", () => {
  it("验证码登录：连错 5 次后正确的码也登不进去", async () => {
    const code = await issue("member@example.com", "login");
    const caller = appRouter.createCaller(ctxFor(null));
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i += 1) {
      await expect(caller.auth.loginWithCode({ email: "member@example.com", code: wrongCodeFor(code) })).rejects.toThrow();
    }
    await expect(caller.auth.loginWithCode({ email: "member@example.com", code })).rejects.toThrow(
      CODE_ATTEMPTS_EXHAUSTED_MESSAGE,
    );
  });

  it("找回密码：连错 5 次后正确的码也改不了密码", async () => {
    const code = await issue("member@example.com", "reset_password");
    const caller = appRouter.createCaller(ctxFor(null));
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i += 1) {
      await expect(
        caller.auth.resetPassword({ email: "member@example.com", code: wrongCodeFor(code), newPassword: "new-password-1" }),
      ).rejects.toThrow();
    }
    await expect(
      caller.auth.resetPassword({ email: "member@example.com", code, newPassword: "new-password-1" }),
    ).rejects.toThrow(CODE_ATTEMPTS_EXHAUSTED_MESSAGE);
    expect(verifyPassword("old-password-1", fakeUsers.get("member@example.com").passwordHash)).toBe(true);
  });

  it("同一 IP 15 分钟内验证码失败 20 次 → 锁 15 分钟（换着邮箱猜也算）；换个 IP 不受影响；到时自动解开", async () => {
    const attacker = appRouter.createCaller(ctxFor(null, "203.0.113.70"));
    for (let i = 0; i < CODE_VERIFY_IP_RULE.maxFailures; i += 1) {
      await expect(attacker.auth.loginWithCode({ email: `victim${i}@example.com`, code: "000000" })).rejects.toThrow(
        CODE_WRONG_MESSAGE,
      );
    }
    const code = await issue("member@example.com", "login");
    await expect(attacker.auth.loginWithCode({ email: "member@example.com", code })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    await expect(attacker.auth.resetPassword({ email: "member@example.com", code, newPassword: "x-password" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    // 被锁的请求不碰验证码表：这条码一次都没被比对。
    expect(codeStore.rows.find((row) => row.target === "member@example.com")?.attempts).toBe(0);

    const other = appRouter.createCaller(ctxFor(null, "203.0.113.71"));
    await expect(other.auth.loginWithCode({ email: "member@example.com", code })).resolves.toMatchObject({ ok: true });

    now += 15 * MIN;
    const code2 = await issue("member@example.com", "login");
    await expect(attacker.auth.loginWithCode({ email: "member@example.com", code: code2 })).resolves.toMatchObject({ ok: true });
  });

  it("注册、验证邮箱也走同一道限流", () => {
    const source = readFileSync(join(repoRoot, "server/routers/auth.ts"), "utf-8");
    const direct = [...source.matchAll(/await verifyCode\(/g)];
    expect(direct).toHaveLength(1); // 只在 verifyCodeWithThrottle 里调用
    expect([...source.matchAll(/verifyCodeWithThrottle\(ctx, \{[^}]*purpose: "(\w+)"/g)].map((match) => match[1]).sort()).toEqual(
      ["login", "register", "reset_password", "verify_email"],
    );
  });
});

// ---------------------------------------------------------------- ⑤
describe("⑤ 用户对象不带密码哈希", () => {
  it("白名单不含 passwordHash；未登记的新列也出不去", () => {
    expect(USER_RESPONSE_FIELDS as readonly string[]).not.toContain("passwordHash");
    const safe = toUserResponse({ ...fakeUsers.get("member@example.com"), totpSecret: "x" } as any);
    expect(safe).not.toHaveProperty("passwordHash");
    expect(safe).not.toHaveProperty("totpSecret");
    expect(safe).toMatchObject({ id: 21, openId: "email:member@example.com", role: "user" });
    expect(toUserResponse(null)).toBeNull();
  });

  it("auth.me：已登录返回的用户没有 passwordHash；未登录仍是 null", async () => {
    const me = await appRouter.createCaller(ctxFor(fakeUsers.get("member@example.com"))).auth.me();
    expect(me).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(me)).not.toContain(fakeUsers.get("member@example.com").passwordHash);
    expect(me).toMatchObject({ id: 21, openId: "email:member@example.com", email: "member@example.com" });
    expect(await appRouter.createCaller(ctxFor(null)).auth.me()).toBeNull();
  });

  it("验证码登录、验证码注册成功：返回的用户没有 passwordHash", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    const loginCode = await issue("member@example.com", "login");
    const login = await caller.auth.loginWithCode({ email: "member@example.com", code: loginCode });
    expect(login.ok).toBe(true);
    expect(login.user).not.toHaveProperty("passwordHash");
    expect(login.user).toMatchObject({ id: 21, email: "member@example.com" });

    const registerCode = await issue("new-member@example.com", "register");
    const registered = await caller.auth.registerWithCode({
      email: "new-member@example.com",
      code: registerCode,
      password: "new-member-pass",
    });
    expect(fakeUsers.get("new-member@example.com").passwordHash).toBeTruthy();
    expect(registered.user).not.toHaveProperty("passwordHash");
    expect(registered.user).toMatchObject({ email: "new-member@example.com" });
  });

  describe("REST 密码登录 / 注册 / me（真 HTTP，localhost）", () => {
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

    it("登录、注册响应体里没有 passwordHash", async () => {
      const post = async (path: string, body: unknown) => {
        const res = await fetch(`${base}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.90" },
          body: JSON.stringify(body),
        });
        return { status: res.status, text: await res.text() };
      };
      const login = await post("/api/auth/login", { email: "member@example.com", password: "old-password-1" });
      expect(login.status).toBe(200);
      expect(login.text).not.toContain("passwordHash");
      expect(JSON.parse(login.text).user).toMatchObject({ id: 21, email: "member@example.com" });

      const register = await post("/api/auth/register", { email: "rest-new@example.com", password: "rest-new-pass" });
      expect(register.status).toBe(410);
      expect(register.text).not.toContain("passwordHash");
      expect(fakeUsers.has("rest-new@example.com")).toBe(false);
    });
  });
});
