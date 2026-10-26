import { readFileSync } from "node:fs";
import { routeHarness } from "../../tests/helpers/route-call";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ users: [] as any[], unavailable: false }));
vi.mock("../db", () => ({
  getUserByEmail: vi.fn(async (email: string) => state.users.find((user) => user.email === email)),
  getUserByOpenId: vi.fn(async (openId: string) => {
    if (state.unavailable) throw new Error("offline database failure");
    const user = state.users.find((row) => row.openId === openId);
    return user ? { ...user } : null;
  }),
  getUserByPhone: vi.fn(async () => null),
  createUser: vi.fn(async (data: any) => state.users.push({ id: state.users.length + 1, sessionVersion: 0, role: "user", ...data })),
  updateUser: vi.fn(async (id: number, data: any) => Object.assign(state.users.find((user) => user.id === id), data)),
  upsertUser: vi.fn(async () => undefined),
  confirmUserEmail: vi.fn(async (id: number, email: string) => {
    const user = state.users.find((row) => row.id === id && row.email === email);
    if (!user.emailVerifiedAt) Object.assign(user, { emailVerifiedAt: new Date(), passwordHash: null, sessionVersion: user.sessionVersion + 1 });
    return { ...user };
  }),
  updateUserPassword: vi.fn(async (id: number, passwordHash: string, options: any = {}) => {
    const user = state.users.find((row) => row.id === id);
    if (options.expectedSessionVersion !== undefined && options.expectedSessionVersion !== user.sessionVersion) throw new Error("session changed");
    Object.assign(user, { passwordHash, sessionVersion: user.sessionVersion + 1,
      ...(options.verifiedEmail ? { emailVerifiedAt: new Date() } : {}) });
  }),
  markUserEmailVerified: vi.fn(async (id: number, email: string) => {
    const user = state.users.find((row) => row.id === id && row.email === email);
    if (user && !user.emailVerifiedAt) user.emailVerifiedAt = new Date();
  }),
  revokeUserSessions: vi.fn(async (id: number) => { state.users.find((user) => user.id === id).sessionVersion += 1; }),
  isUserEmailVerified: vi.fn(async (email: string) => Boolean(state.users.find((row) => row.email === email)?.emailVerifiedAt)),
}));
vi.mock("./email", () => ({ sendVerificationCodeEmail: vi.fn(() => { throw new Error("No emails allowed in this suite"); }) }));
vi.mock("./login-throttle", () => ({
  checkLoginAllowed: vi.fn(async () => ({ allowed: true })),
  recordLoginFailure: vi.fn(async () => undefined), clearLoginFailures: vi.fn(async () => undefined),
  CODE_VERIFY_IP_RULE: {}, USER_LOGIN_IP_RULE: {}, ADMIN_LOGIN_RULE: {},
}));

import { sdk } from "./sdk";
import { registerOAuthRoutes } from "./oauth";
import { registerAccountRoutes } from "./account-routes";
import { hashPassword, verifyPassword } from "./password";
import { authRouter } from "../routers/auth";
import { adminAuthRouter } from "../routers/admin-auth";
import * as db from "../db";
import { COOKIE_NAME } from "../../shared/const";
import { createVerificationCode, MemoryVerificationCodeStore, setVerificationStoreForTests, type VerificationPurpose } from "./verification";

const http = routeHarness();
let store: MemoryVerificationCodeStore;
const email = "owner@example.test";
function user() { return state.users[0]; }
function ctx(token?: string, headers: Record<string, string> = {}) {
  return {
    user: null,
    req: { protocol: "https", hostname: "example.test", headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, socket: {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn(), setHeader: vi.fn() },
  } as any;
}
async function code(purpose: VerificationPurpose, target = email) {
  const result = await createVerificationCode({ target, targetType: "email", purpose });
  if (!result.code) throw new Error("fixture code unavailable");
  return result.code;
}
async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return http.call("POST", path, body, { "Content-Type": "application/json", ...headers });
}
async function token() { return sdk.createSessionToken(user().openId); }

beforeAll(() => {
  registerOAuthRoutes(http.app);
  registerAccountRoutes(http.app);
});
beforeEach(() => {
  vi.clearAllMocks();
  state.unavailable = false;
  state.users = [{ id: 1, openId: `email:${email}`, email, name: "fixture", role: "user",
    passwordHash: hashPassword("fixture-password"), emailVerifiedAt: null, sessionVersion: 0 }];
  store = new MemoryVerificationCodeStore();
  setVerificationStoreForTests({ store, now: () => Date.now() });
});

describe("P1: email ownership and durable verification", () => {
  it("retires legacy registration without creating a user or issuing a session", async () => {
    const response = await post("/api/auth/register", { email: "new@example.test", password: "fixture-password" });
    expect(response.status).toBe(410);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.createUser).not.toHaveBeenCalled();
  });

  it("requires a usable code, then registers with a durable verification marker", async () => {
    const caller = authRouter.createCaller(ctx());
    const target = "new@example.test";
    await expect(caller.registerWithCode({ email: target, code: "000000" })).rejects.toThrow();
    expect(db.createUser).not.toHaveBeenCalled();
    const result = await caller.registerWithCode({ email: target, code: await code("register", target), password: "chosen-password" });
    const saved = state.users.find((row) => row.email === target);
    expect(saved.emailVerifiedAt).toBeInstanceOf(Date);
    expect(verifyPassword("chosen-password", saved.passwordHash)).toBe(true);
    expect(await sdk.verifySession(result.sessionToken)).toMatchObject({ sessionVersion: 0 });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("sessionVersion");
    await expect(caller.registerWithCode({ email: target, code: store.rows[0].code })).rejects.toThrow();
  });

  it("legacy unverified password still logs in; the owner's first code login removes it and all old sessions", async () => {
    const old = await token();
    // 存量老账号（旧入口注册、没验证过邮箱）升级后照常用密码登录，不把真实用户挡在门外。
    expect((await post("/api/auth/login", { email, password: "fixture-password" })).status).toBe(200);
    const result = await authRouter.createCaller(ctx()).loginWithCode({ email, code: await code("login") });
    expect(user()).toMatchObject({ passwordHash: null, sessionVersion: 1 });
    expect(user().emailVerifiedAt).toBeInstanceOf(Date);
    expect(await sdk.verifySession(old)).toBeNull();
    expect(await sdk.verifySession(result.sessionToken)).toMatchObject({ sessionVersion: 1 });
    expect((await post("/api/auth/login", { email, password: "fixture-password" })).status).toBe(401);
    store.rows.length = 0; // 模拟验证码清理；账号标记和会员状态不随临时记录消失。
    const profile = await authRouter.createCaller({ ...ctx(), user: { ...user() } }).getProfile();
    expect(profile).toMatchObject({ emailVerified: true, isFullMember: true });
  });

  it("does not erase a password established after email verification", async () => {
    user().emailVerifiedAt = new Date();
    await authRouter.createCaller(ctx()).loginWithCode({ email, code: await code("login") });
    expect(user().sessionVersion).toBe(0);
    expect(verifyPassword("fixture-password", user().passwordHash)).toBe(true);
  });

  it("verifyEmail persists proof without logging the signed-in owner out or erasing their password", async () => {
    const current = await token();
    await authRouter.createCaller({ ...ctx(), user: { ...user() } }).verifyEmail({ code: await code("verify_email") });
    expect(user().emailVerifiedAt).toBeInstanceOf(Date);
    expect(verifyPassword("fixture-password", user().passwordHash)).toBe(true);
    expect(await sdk.verifySession(current)).toMatchObject({ sessionVersion: 0 });
    store.rows.length = 0;
    expect(await authRouter.createCaller({ ...ctx(), user: { ...user() } }).getProfile()).toMatchObject({ emailVerified: true });
  });

  it("both frontend registration modes use the verified route", () => {
    const source = readFileSync("app/auth/register.tsx", "utf8");
    expect(source).not.toContain("/api/auth/register");
    expect(source).toContain("onPress={handleCodeRegister}");
    expect(source).toContain("邮箱验证码");
  });
});

describe("P1: server-side session revocation", () => {
  it("password reset revokes old Cookie and Bearer sessions and enables only the new password", async () => {
    const old = await token();
    await authRouter.createCaller(ctx()).resetPassword({ email, code: await code("reset_password"), newPassword: "new-fixture-password" });
    await expect(sdk.authenticateRequest(ctx(old).req)).rejects.toThrow();
    await expect(sdk.authenticateRequest(ctx(undefined, { cookie: `${COOKIE_NAME}=${old}` }).req)).rejects.toThrow();
    expect((await post("/api/auth/login", { email, password: "fixture-password" })).status).toBe(401);
    expect((await post("/api/auth/login", { email, password: "new-fixture-password" })).status).toBe(200);
    expect(db.updateUserPassword).toHaveBeenCalledWith(1, expect.any(String), { verifiedEmail: email });
  });

  it("authenticated password change revokes existing sessions and clears the cookie", async () => {
    user().emailVerifiedAt = new Date();
    const old = await token();
    const response = await post("/api/auth/change-password", { oldPassword: "fixture-password", newPassword: "new-fixture-password" }, { authorization: `Bearer ${old}` });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE_NAME}=`);
    expect(await sdk.verifySession(old)).toBeNull();
    expect(db.updateUserPassword).toHaveBeenCalledWith(1, expect.any(String), { expectedSessionVersion: 0 });
  });

  it.each(["REST", "tRPC"])("%s logout revokes copied sessions", async (kind) => {
    const old = await token();
    if (kind === "REST") expect((await post("/api/auth/logout", {}, { cookie: `${COOKIE_NAME}=${old}` })).status).toBe(200);
    else await authRouter.createCaller(ctx(old)).logout();
    expect(user().sessionVersion).toBe(1);
    expect(await sdk.verifySession(old)).toBeNull();
    expect(await sdk.verifySession(await token())).toMatchObject({ sessionVersion: 1 });
  });

  it("rejects versionless JWTs and cannot upgrade a stale credential check to a new session version", async () => {
    const old = await sdk.signSession({ openId: user().openId, appId: "", name: "fixture" } as any);
    expect(await sdk.verifySession(old)).toBeNull();
    user().sessionVersion += 1;
    await expect(sdk.createSessionToken(user().openId, { sessionVersion: 0 })).rejects.toThrow();
  });

  it("does not report successful logout when the session store is unavailable", async () => {
    const old = await token();
    state.unavailable = true;
    expect((await post("/api/auth/logout", {}, { authorization: `Bearer ${old}` })).status).toBe(503);
    state.unavailable = false;
    expect(await sdk.verifySession(old)).not.toBeNull();
  });
});

describe("P2: login source and admin verification transport", () => {
  it.each(["https://attacker.example", "null"])("blocks a hostile Origin (%s) before authentication", async (origin) => {
    user().emailVerifiedAt = new Date();
    const response = await post("/api/auth/login", { email, password: "fixture-password" }, { origin });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("blocks urlencoded login forms even without an Origin", async () => {
    const response = await http.call("POST", "/api/auth/login", { email, password: "fixture-password" }, { "Content-Type": "application/x-www-form-urlencoded" });
    expect(response.status).toBe(415);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([undefined, "https://eaxau.com"])("accepts JSON native/same-site login (%s)", async (origin) => {
    user().emailVerifiedAt = new Date();
    expect((await post("/api/auth/login", { email, password: "fixture-password" }, origin ? { origin } : {})).status).toBe(200);
  });

  it("verifies admin credentials from headers and marks the response uncacheable", async () => {
    const signed = await adminAuthRouter.createCaller(ctx()).login({ email: "admin@eaxau.com", password: "admin123" });
    const headerVariants: Record<string, string>[] = [{ "x-admin-token": signed.token }, { authorization: `Bearer ${signed.token}` }];
    for (const headers of headerVariants) {
      const context = ctx(undefined, headers);
      expect(await adminAuthRouter.createCaller(context).verify()).toMatchObject({ valid: true });
      expect(context.res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    }
    await expect(adminAuthRouter.createCaller(ctx()).verify()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(adminAuthRouter.createCaller(ctx()).verify({ token: signed.token } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const source = readFileSync("app/admin/_layout.tsx", "utf8");
    expect(source).not.toContain("adminAuth.verify?input=");
    expect(source).toContain('"X-Admin-Token": token');
  });
});
