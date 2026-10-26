/**
 * 2026-10-18 代码体检 R3 剩余项（③⑥⑦⑧）+ 公开附属接口只认已发布商品。
 * 不连库、不发信、不打线上：用户表用替身，商品走本地 mock 数据模式，头部标签用纯函数核对。
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-session-secret-2026-10-18-b";
});

const fakeUsers = vi.hoisted(() => new Map<string, any>());

vi.mock("../server/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/db")>();
  const { hashPassword } = await import("../server/_core/password");
  const seed = () => {
    fakeUsers.clear();
    const base = {
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
    };
    fakeUsers.set("email:member@example.com", {
      ...base,
      id: 31,
      openId: "email:member@example.com",
      name: "member",
      email: "member@example.com",
      passwordHash: hashPassword("old-password-1"),
    });
    fakeUsers.set("email:codeonly@example.com", {
      ...base,
      id: 32,
      openId: "email:codeonly@example.com",
      name: "code only",
      email: "codeonly@example.com",
      passwordHash: null,
    });
  };
  seed();
  const byId = (id: number) => [...fakeUsers.values()].find((user) => user.id === id);
  return {
    ...original,
    __seedUsers: seed,
    getUserByOpenId: vi.fn(async (openId: string) => fakeUsers.get(openId) ?? null),
    upsertUser: vi.fn(async () => undefined),
    updateUserProfile: vi.fn(async (id: number, data: any) => {
      Object.assign(byId(id), data);
    }),
    updateUserPassword: vi.fn(async (id: number, passwordHash: string) => {
      Object.assign(byId(id), { passwordHash, sessionVersion: byId(id).sessionVersion + 1 });
    }),
  };
});

import express from "express";
import * as db from "../server/db";
import { appRouter } from "../server/routers";
import {
  PASSWORD_CHANGE_RULE,
  registerAccountRoutes,
  validatePasswordChangeInput,
  validateProfileInput,
} from "../server/_core/account-routes";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { verifyPassword } from "../server/_core/password";
import { sdk } from "../server/_core/sdk";
import { MemoryThrottleStore, resetLoginThrottleForTests, setLoginThrottleForTests } from "../server/_core/login-throttle";
import { listingItems, listingState } from "../lib/listing-state";
import {
  SERVER_ROUTE_HEAD_SELECTOR,
  createServerHeadHandoff,
  matchesServerRouteHead,
  normalizeRoutePath,
} from "../lib/route-head";
import {
  contentPageHeadTags,
  homeHeadTags,
  noindexHeadTags,
  sectionHeadTags,
  strategyHeadTags,
} from "../shared/seo-head";
import { CONTENT_PAGES, COOPERATION_ZH_PATH, requireContentPage } from "../shared/content-pages";
import {
  groupBuySectionHtml,
  promoSectionHtml,
  renderHeadTagsHtml,
  renderHomeHtml,
  renderNoindexHtml,
  renderNotFoundHtml,
  renderSectionHtml,
  renderStrategyHtml,
} from "../server/_core/seo-render";
import { renderContentPageHtml } from "../server/_core/seo-content-pages";
import { seoActiveGroupBuys, seoPromoList } from "../server/_core/seo-catalog";

const repoRoot = resolve(__dirname, "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf-8");

let now = Date.UTC(2026, 9, 18, 0, 0, 0);
beforeEach(() => {
  now = Date.UTC(2026, 9, 18, 0, 0, 0);
  (db as any).__seedUsers();
  resetLoginThrottleForTests();
  setLoginThrottleForTests({ store: new MemoryThrottleStore(), now: () => now });
});
afterAll(() => resetLoginThrottleForTests());

// ---------------------------------------------------------------- ⑥
describe("⑥ 促销页、合作页不再拿演示数据顶替或补位", () => {
  it("清单四态：只有 ok 才有条目；空、失败、加载中都不给任何条目", () => {
    expect(listingState({ data: [{ id: 1 }], isLoading: false, isError: false })).toEqual({ kind: "ok", items: [{ id: 1 }] });
    expect(listingState({ data: [], isLoading: false, isError: false })).toEqual({ kind: "empty" });
    expect(listingState({ data: undefined, isLoading: false, isError: true })).toEqual({ kind: "error" });
    expect(listingState({ data: undefined, isLoading: true, isError: false })).toEqual({ kind: "loading" });
    for (const state of [{ kind: "empty" }, { kind: "error" }, { kind: "loading" }] as const) {
      expect(listingItems(state)).toEqual([]);
    }
    // 已经读到过真实记录、后台刷新失败：继续显示真实记录，而不是演示数据。
    expect(listingState({ data: [{ id: 2 }], isLoading: false, isError: true })).toEqual({ kind: "ok", items: [{ id: 2 }] });
  });

  it("/promo：没有写死的演示商品、价格、库存；空和失败各有自己的状态", () => {
    const page = read("app/promo.tsx");
    const data = read("components/promo/data.ts");
    expect(page).not.toContain("PLACEHOLDER_PROMO_PRODUCTS");
    expect(data).not.toMatch(/PLACEHOLDER_PROMO_PRODUCTS\s*[:=]/);
    for (const demo of ["Gold Scalper Pro 2026", "Multi-Pair Hedge System", "Smart Grid Pro", "soldCount: 14", 'promoPrice: "199"']) {
      expect(data).not.toContain(demo);
    }
    expect(page).toContain('listing.kind === "empty"');
    expect(page).toContain('listing.kind === "error"');
    expect(page).toContain("促销列表这次没能读出来");
    // 「共 N 款」只在读到真实记录时出现
    expect(page).toMatch(/listing\.kind === "ok" \? \(\s*<View style=\{s\.resultCountRow\}>/);
  });

  it("/cooperation：没有写死的策略档案和合作方案，也不补满三条", () => {
    const page = read("app/cooperation.tsx");
    expect(page).not.toContain("DEFAULT_CARDS");
    for (const demo of [
      "¥1,000/月",
      "¥2,500/年",
      "¥9,800起",
      "有效期内无限开窗口/授权",
      "永久免费更新迭代",
      "极限黄金对冲 Pro",
      "武汉小艺",
      "files.manuscdn.com",
    ]) {
      expect(page).not.toContain(demo);
    }
    expect(page).not.toMatch(/3 - \w+\.length/);
    expect(page).toContain('cardsState.kind !== "empty"');
    expect(page).toContain('plansState.kind !== "empty"');
    expect(page).toContain("策略档案这次没能读出来");
    expect(page).toContain("合作方案这次没能读出来");
  });
});

// ---------------------------------------------------------------- ③
describe("③ 编辑资料 / 修改密码接口", () => {
  it("资料校验：只认 name / avatar / bio；头像只收 https；长度与前端一致", () => {
    expect(validateProfileInput({ name: "  新昵称 ", role: "admin", email: "x@y.z" })).toEqual({ ok: true, changes: { name: "新昵称" } });
    expect(validateProfileInput({ avatar: "" })).toEqual({ ok: true, changes: { avatar: null } });
    expect(validateProfileInput({ bio: "第一行\n第二行" })).toEqual({ ok: true, changes: { bio: "第一行\n第二行" } });
    expect(validateProfileInput({ avatar: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateProfileInput({ avatar: "http://example.com/a.png" }).ok).toBe(false);
    expect(validateProfileInput({ avatar: "https://user:pw@example.com/a.png" }).ok).toBe(false);
    expect(validateProfileInput({ avatar: "https://example.com/" + "a".repeat(600) }).ok).toBe(false);
    expect(validateProfileInput({ name: "" }).ok).toBe(false);
    expect(validateProfileInput({ name: "名".repeat(51) }).ok).toBe(false);
    expect(validateProfileInput({ name: "a\u0000b" }).ok).toBe(false);
    expect(validateProfileInput({ bio: "简".repeat(201) }).ok).toBe(false);
    expect(validateProfileInput({ name: 1 }).ok).toBe(false);
    expect(validateProfileInput({}).ok).toBe(false);
    expect(validateProfileInput(null).ok).toBe(false);
  });

  it("改密码校验：两项必填、新密码 6–100 位、不能和当前密码相同", () => {
    expect(validatePasswordChangeInput({ oldPassword: "a", newPassword: "123456" })).toEqual({ ok: true, oldPassword: "a", newPassword: "123456" });
    expect(validatePasswordChangeInput({ oldPassword: "", newPassword: "123456" }).ok).toBe(false);
    expect(validatePasswordChangeInput({ oldPassword: "a", newPassword: "12345" }).ok).toBe(false);
    expect(validatePasswordChangeInput({ oldPassword: "a", newPassword: "x".repeat(101) }).ok).toBe(false);
    expect(validatePasswordChangeInput({ oldPassword: "same-pass", newPassword: "same-pass" }).ok).toBe(false);
  });

  describe("真 HTTP（localhost，和线上一样的 express.json + urlencoded）", () => {
    let server: Server;
    let base = "";
    beforeAll(async () => {
      const app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));
      registerOAuthRoutes(app);
      registerAccountRoutes(app);
      server = createServer(app);
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterAll(() => server?.close());

    const tokenFor = (openId: string) => sdk.createSessionToken(openId, { name: "t" });
    async function call(method: string, path: string, body: unknown, opts: { token?: string; form?: boolean } = {}) {
      const headers: Record<string, string> = { "X-Forwarded-For": "203.0.113.55" };
      if (opts.token) headers.Cookie = `app_session_id=${opts.token}`;
      let payload: string;
      if (opts.form) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        payload = new URLSearchParams(body as Record<string, string>).toString();
      } else {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${base}${path}`, { method, headers, body: payload });
      const text = await res.text();
      return { status: res.status, text, json: text ? JSON.parse(text) : null };
    }

    it("未登录 401；跨站表单格式 415（不能借表单提交改资料或密码）", async () => {
      expect((await call("PATCH", "/api/auth/profile", { name: "x" })).status).toBe(401);
      expect((await call("POST", "/api/auth/change-password", { oldPassword: "a", newPassword: "bbbbbb" })).status).toBe(401);
      const token = await tokenFor("email:member@example.com");
      const form = await call("POST", "/api/auth/change-password", { oldPassword: "old-password-1", newPassword: "hacked-1" }, { token, form: true });
      expect(form.status).toBe(415);
      expect(verifyPassword("old-password-1", fakeUsers.get("email:member@example.com").passwordHash)).toBe(true);
    });

    it("保存资料：只改昵称、头像、简介；返回的用户没有 passwordHash；/api/auth/me 回填 avatar、bio", async () => {
      const token = await tokenFor("email:member@example.com");
      const saved = await call(
        "PATCH",
        "/api/auth/profile",
        { name: "新名字", avatar: "https://cdn.example.com/a.png", bio: "简介", role: "admin", email: "evil@example.com" },
        { token },
      );
      expect(saved.status).toBe(200);
      expect(saved.text).not.toContain("passwordHash");
      expect(saved.json.user).toMatchObject({ id: 31, name: "新名字", avatar: "https://cdn.example.com/a.png", bio: "简介", role: "user", email: "member@example.com" });
      const stored = fakeUsers.get("email:member@example.com");
      expect(stored).toMatchObject({ name: "新名字", role: "user", email: "member@example.com" });

      const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: `app_session_id=${token}` } }).then((r) => r.json());
      expect(me.user).toMatchObject({ name: "新名字", avatar: "https://cdn.example.com/a.png", bio: "简介" });
      expect(JSON.stringify(me)).not.toContain("passwordHash");

      const bad = await call("PATCH", "/api/auth/profile", { avatar: "javascript:alert(1)" }, { token });
      expect(bad.status).toBe(400);
      expect(bad.json.error).toContain("https://");
    });

    it("改密码：当前密码错 400 并计数，按账号 5 次锁定；对的密码才改，新哈希和注册同一套", async () => {
      const token = await tokenFor("email:member@example.com");
      for (let i = 0; i < PASSWORD_CHANGE_RULE.maxFailures; i += 1) {
        const wrong = await call("POST", "/api/auth/change-password", { oldPassword: `wrong-${i}`, newPassword: "new-password-1" }, { token });
        expect(wrong.status).toBe(400);
        expect(wrong.json.error).toBe("当前密码不正确");
      }
      const locked = await call("POST", "/api/auth/change-password", { oldPassword: "old-password-1", newPassword: "new-password-1" }, { token });
      expect(locked.status).toBe(429);
      expect(verifyPassword("old-password-1", fakeUsers.get("email:member@example.com").passwordHash)).toBe(true);

      now += PASSWORD_CHANGE_RULE.lockMs + 1;
      const ok = await call("POST", "/api/auth/change-password", { oldPassword: "old-password-1", newPassword: "new-password-1" }, { token });
      expect(ok.status).toBe(200);
      expect(ok.json).toEqual({ success: true });
      const hash = fakeUsers.get("email:member@example.com").passwordHash;
      expect(hash.startsWith("scrypt$")).toBe(true);
      expect(verifyPassword("new-password-1", hash)).toBe(true);
      expect(verifyPassword("old-password-1", hash)).toBe(false);
    });

    it("从没设过密码的账号：不让改，引导走找回密码", async () => {
      const token = await tokenFor("email:codeonly@example.com");
      const res = await call("POST", "/api/auth/change-password", { oldPassword: "anything", newPassword: "new-password-1" }, { token });
      expect(res.status).toBe(400);
      expect(res.json.error).toContain("忘记密码");
      expect(fakeUsers.get("email:codeonly@example.com").passwordHash).toBeNull();
    });

    it("前端调用的方法、路径、字段与服务端一致", () => {
      const page = read("app/profile/edit.tsx");
      expect(page).toContain("/api/auth/profile");
      expect(page).toMatch(/method: "PATCH"/);
      expect(page).toContain("/api/auth/change-password");
      expect(page).toContain("JSON.stringify({ oldPassword, newPassword })");
      expect(page).toContain('"Content-Type": "application/json"');
      expect(read("server/_core/index.ts")).toContain("registerAccountRoutes(app)");
    });
  });
});

// ---------------------------------------------------------------- 公开附属接口
describe("公开的回测、交易记录、评论 / 留言接口只认已发布商品", () => {
  const anonymous = () =>
    appRouter.createCaller({
      req: { protocol: "https", hostname: "www.eaxau.com", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
      res: { cookie: () => undefined, clearCookie: () => undefined } as any,
      user: null,
    });
  const member = () =>
    appRouter.createCaller({
      req: { protocol: "https", hostname: "www.eaxau.com", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
      res: { cookie: () => undefined, clearCookie: () => undefined } as any,
      user: fakeUsers.get("email:member@example.com"),
    });

  it.each(["draft", "archived"])("%s 商品：全部 NOT_FOUND（读和写都不行）", async (status) => {
    const created = await db.createStrategy({ title: `R3b ${status}`, platform: "MT5", pairs: "XAUUSD", status } as any);
    const id = created!.id;
    const caller = anonymous();
    const calls: Array<[string, () => Promise<unknown>]> = [
      ["strategies.backtestData", () => caller.strategies.backtestData({ strategyId: id })],
      ["comments.list", () => caller.comments.list({ strategyId: id })],
      ["trades.list", () => caller.trades.list({ strategyId: id })],
      ["trades.stats", () => caller.trades.stats({ strategyId: id })],
      ["anonymousComments.list", () => caller.anonymousComments.list({ strategyId: id })],
      ["anonymousComments.create", () => caller.anonymousComments.create({ strategyId: id, content: "hi" })],
      ["comments.create", () => member().comments.create({ strategyId: id, content: "hi" })],
    ];
    for (const [name, run] of calls) {
      await expect(run(), name).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    // 后台查询不受影响
    expect((await db.getStrategyById(id))?.status).toBe(status);
  });

  it("已发布商品照常可读；不存在的 id 也是 NOT_FOUND", async () => {
    const created = await db.createStrategy({ title: "R3b published", platform: "MT5", pairs: "XAUUSD", status: "published" } as any);
    const caller = anonymous();
    await expect(caller.strategies.backtestData({ strategyId: created!.id })).resolves.toBeDefined();
    await expect(caller.comments.list({ strategyId: created!.id })).resolves.toBeDefined();
    await expect(caller.trades.list({ strategyId: created!.id })).resolves.toBeDefined();
    await expect(caller.anonymousComments.list({ strategyId: created!.id })).resolves.toBeDefined();
    await expect(caller.trades.stats({ strategyId: 987654 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("后台回测数据仍走 admin.backtestData（不经过公开闸）", () => {
    const admin = read("server/routers/admin.ts");
    expect(admin).toMatch(/backtestData: router\(\{[\s\S]*?db\.getBacktestData\(input\.strategyId\)/);
    expect(read("lib/admin-api.ts")).toContain('adminQuery("admin.backtestData.list"');
  });
});

// ---------------------------------------------------------------- ⑦
/** 极简 HTML 头部解析：取出 <head> 里的 link / meta / script 标签和属性。 */
function headElements(html: string) {
  const head = html.slice(0, html.indexOf("</head>"));
  const out: Array<{ tag: string; attrs: Record<string, string>; raw: string }> = [];
  for (const match of head.matchAll(/<(link|meta|script)\b([^>]*)>/gi)) {
    const attrs: Record<string, string> = {};
    for (const a of match[2].matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g)) attrs[a[1].toLowerCase()] = a[2] ?? "";
    out.push({ tag: match[1].toLowerCase(), attrs, raw: match[0] });
  }
  return out;
}

const SHELL =
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>x</title><meta name="description" content="d" />' +
  '<link rel="stylesheet" href="/_expo/static/css/a.css" /><script data-eaxau-bootstrap="v1"></script></head><body><div id="root"></div></body></html>';
const STRATEGY = {
  id: 77,
  title: "黄金 EA V2.1",
  description: "真实的商品说明文字，长度足够当摘要用。",
  platform: "MT5",
  pairs: "XAUUSD",
  timeframe: "M15",
  coverImage: "https://example.com/c.png",
  price: "99.00",
  saleMode: "direct",
  productType: "ea",
};

describe("⑦ 头部标签归当前路由所有", () => {
  const pages: Array<[string, string, ReturnType<typeof homeHeadTags>]> = [
    ["/", renderHomeHtml(SHELL, { kind: "ok", strategies: [STRATEGY as any] }), homeHeadTags()],
    ["/strategy/77", renderStrategyHtml(SHELL, STRATEGY as any), strategyHeadTags(STRATEGY)],
    ["/market", renderSectionHtml(SHELL, "/market", { kind: "ok", strategies: [] })!, sectionHeadTags("/market")],
    ["/promo", renderSectionHtml(SHELL, "/promo")!, sectionHeadTags("/promo")],
    ["/auth/login", renderNoindexHtml(SHELL, "登录 - EAXAU"), noindexHeadTags()],
    ["/nope", renderNotFoundHtml(SHELL, "/nope"), noindexHeadTags()],
    ...CONTENT_PAGES.map((page) => [page.path, renderContentPageHtml(SHELL, page), contentPageHeadTags(page)] as [string, string, ReturnType<typeof homeHeadTags>]),
  ];

  it.each(pages)("%s：服务端首屏标签 = 前端 <Head> 用的同一份数据（shared/seo-head.ts）", (_path, html, tags) => {
    expect(html).toContain(renderHeadTagsHtml(tags));
  });

  it.each(pages)("%s：服务端写的 canonical / robots / hreflang / OG / Twitter / JSON-LD 全部能被交接规则识别；description 归 <Head>", (_path, html) => {
    const elements = headElements(html);
    const routeOwned = elements.filter((el) =>
      (el.tag === "link" && (el.attrs.rel === "canonical" || ("hreflang" in el.attrs))) ||
      (el.tag === "meta" && (el.attrs.name === "robots" || el.attrs.name?.startsWith("twitter:") || el.attrs.property?.startsWith("og:"))) ||
      (el.tag === "script" && el.attrs.type === "application/ld+json"),
    );
    expect(routeOwned.length).toBeGreaterThan(0);
    for (const el of routeOwned) expect(matchesServerRouteHead(el.tag, el.attrs), el.raw).toBe(true);
    // 交接不会误删：样式、启动脚本、description（带 data-rh，由 <Head> 替换）
    for (const el of elements.filter((e) => !routeOwned.includes(e))) {
      expect(matchesServerRouteHead(el.tag, el.attrs), el.raw).toBe(false);
    }
    expect(elements.find((el) => el.attrs.name === "description")?.attrs["data-rh"]).toBe("true");
  });

  it("首页 ItemList 只在服务端首屏有（依赖读库），前端标签里没有；V2 预览 / 登录页是 noindex", () => {
    const home = renderHomeHtml(SHELL, { kind: "ok", strategies: [STRATEGY as any] });
    expect(home).toContain('"@type":"ItemList"');
    expect(renderHeadTagsHtml(homeHeadTags())).not.toContain("ItemList");
    expect(noindexHeadTags()).toEqual([{ kind: "meta", name: "robots", content: "noindex,follow" }]);
    expect(sectionHeadTags(COOPERATION_ZH_PATH)).toEqual(contentPageHeadTags(requireContentPage(COOPERATION_ZH_PATH)));
  });

  it("交接：还在首屏地址（含末尾斜杠）不动；跳走后一次性移除服务端标签并通知页面接管", () => {
    const removed: string[] = [];
    const makeNode = (name: string) => ({ name, parentNode: { removeChild: () => removed.push(name) } });
    let nodes = [makeNode("canonical"), makeNode("robots"), makeNode("ld")];
    const doc = {
      querySelectorAll: (selector: string) => {
        expect(selector).toBe(SERVER_ROUTE_HEAD_SELECTOR);
        const current = nodes;
        return current as any;
      },
    };
    const handoff = createServerHeadHandoff(doc as any, "/strategy/30");
    const seen: boolean[] = [];
    handoff.subscribe(() => seen.push(handoff.isActive()));
    expect(handoff.isActive()).toBe(true);
    expect(handoff.onRouteChange("/strategy/30/")).toBe(0);
    expect(handoff.isActive()).toBe(true);
    expect(handoff.onRouteChange("/")).toBe(3);
    expect(removed).toEqual(["canonical", "robots", "ld"]);
    expect(handoff.isActive()).toBe(false);
    expect(seen).toEqual([false]);
    nodes = [makeNode("later")];
    expect(handoff.onRouteChange("/market")).toBe(0);
    expect(removed).toHaveLength(3);
  });

  it("首屏没有服务端标签（普通应用壳）：从一开始就由页面 <Head> 输出", () => {
    const handoff = createServerHeadHandoff({ querySelectorAll: () => [] as any } as any, "/profile");
    expect(handoff.isActive()).toBe(false);
    expect(createServerHeadHandoff(null, "/").isActive()).toBe(false);
    expect(normalizeRoutePath("/market/")).toBe("/market");
    expect(normalizeRoutePath("/")).toBe("/");
    expect(normalizeRoutePath("/a?b=1")).toBe("/a");
  });

  it("选择器只挑服务端那批（不带 data-rh），覆盖六类标签", () => {
    for (const piece of [
      'link[rel="canonical"]:not([data-rh])',
      'link[rel="alternate"][hreflang]:not([data-rh])',
      'meta[name="robots"]:not([data-rh])',
      'meta[property^="og:"]:not([data-rh])',
      'meta[name^="twitter:"]:not([data-rh])',
      'script[type="application/ld+json"]:not([data-rh])',
    ]) {
      expect(SERVER_ROUTE_HEAD_SELECTOR).toContain(piece);
    }
  });

  it("前端：每个可收录 / 不收录页面都把自己的标签交给 <PageHead>，根布局挂了交接组件", () => {
    expect(read("components/page-head.tsx")).toContain("tags={sectionHeadTags(path)}");
    expect(read("app/strategy/[id].tsx")).toContain("tags={strategyHeadTags(strategy)}");
    expect(read("app/strategy/[id].tsx")).toContain("<PageHead title={NOT_FOUND_TITLE} tags={noindexHeadTags()} />");
    expect(read("components/not-found-screen.tsx")).toContain("tags={noindexHeadTags()}");
    expect(read("components/content/content-article-page.tsx")).toContain("tags={contentPageHeadTags(page)}");
    for (const file of ["app/auth/login.tsx", "app/auth/register.tsx", "app/auth/forgot-password.tsx", "app/v2-preview/_layout.tsx"]) {
      expect(read(file), file).toContain("tags={noindexHeadTags()}");
    }
    expect(read("app/_layout.tsx")).toContain("<RouteHeadHandoff />");
  });
});

// ---------------------------------------------------------------- ⑧
describe("⑧ 促销、合购栏目把真实清单写进初始 HTML", () => {
  const NOW = new Date("2026-10-18T00:00:00Z");

  it("促销：名称、平台、分类、简介；截止已过写「活动已结束」；不写价格、库存、已售", () => {
    const html = promoSectionHtml(
      {
        kind: "ok",
        items: [
          { id: 1, title: "Gold <Scalper>", description: "黄金剥头皮 EA 策略资料；需以可核验证据为准。", platform: "MT5", category: "ea", promoEndTime: new Date("2026-06-30T23:59:59Z") },
          { id: 2, title: "Trend Indicator", description: null, platform: "mt4", category: "indicator", promoEndTime: "2026-12-01T00:00:00Z" },
        ],
      },
      NOW,
    );
    expect(html).toContain("<strong>Gold &lt;Scalper&gt;</strong> · MT5 · EA · 活动已结束：黄金剥头皮 EA 策略资料");
    expect(html).toContain("<strong>Trend Indicator</strong> · MT4 · 指标 · 活动截止 2026-12-01</li>");
    const list = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
    expect(list).not.toMatch(/¥|元|库存|已售|\d+\.\d\d/);
    expect(html).not.toContain("<a ");
  });

  it("促销：读不到 = 临时故障；确实没有 = 没有；都不编造商品", () => {
    expect(promoSectionHtml({ kind: "unavailable", reason: "x" }, NOW)).toContain("不代表没有促销");
    expect(promoSectionHtml({ kind: "ok", items: [] }, NOW)).toContain("当前没有进行中的促销商品");
  });

  it("合购：标题、EA 名称、截止状态；截止已过照实写；不写简介、价格、人数、联系方式", () => {
    const html = groupBuySectionHtml(
      {
        kind: "ok",
        items: [
          { id: 3, title: "对冲大师EA团购", eaName: "黄金对冲大师EA", expiresAt: new Date("2026-02-12T10:10:35Z") },
          { id: 5, title: "新合购", eaName: "新合购", expiresAt: null },
        ],
      },
      NOW,
    );
    expect(html).toContain("<strong>对冲大师EA团购</strong> · EA：黄金对冲大师EA · 截止时间已过（2026-02-12），能否参加请先联系客服确认");
    expect(html).toContain("<li><strong>新合购</strong></li>");
    expect(html).toContain('<a href="/group-buy/create">发起合购需求</a>');
    expect(html).not.toMatch(/¥|元|人均|\d+人|QQ|qq/);
    expect(groupBuySectionHtml({ kind: "unavailable", reason: "x" }, NOW)).toContain("不代表没有合购");
    expect(groupBuySectionHtml({ kind: "ok", items: [] }, NOW)).toContain("当前没有进行中的合购");
  });

  it("只读适配器：没有真实连接就是 unavailable（不走 mock）；查询只取不含价格人数的列", async () => {
    expect(await seoPromoList(async () => null)).toEqual({ kind: "unavailable", reason: "no_database_connection" });
    expect(await seoActiveGroupBuys(async () => null)).toEqual({ kind: "unavailable", reason: "no_database_connection" });

    const selected: string[][] = [];
    const fakeDb = {
      select: (columns?: unknown) => {
        selected.push(Object.keys(columns as Record<string, unknown>));
        const chain: any = {
          from: () => chain,
          where: () => chain,
          orderBy: () => chain,
          limit: async () => [{ id: 1, title: "t" }],
        };
        return chain;
      },
    };
    expect(await seoPromoList(async () => fakeDb)).toEqual({ kind: "ok", items: [{ id: 1, title: "t" }] });
    expect(await seoActiveGroupBuys(async () => fakeDb)).toEqual({ kind: "ok", items: [{ id: 1, title: "t" }] });
    expect(selected[0].sort()).toEqual(["category", "description", "id", "platform", "promoEndTime", "title"]);
    expect(selected[1].sort()).toEqual(["eaName", "expiresAt", "id", "title"]);

    const failing = { select: () => { throw new Error("boom"); } };
    expect(await seoPromoList(async () => failing)).toEqual({ kind: "unavailable", reason: "query_failed" });
  });

  it("栏目页把清单放进 #eaxau-seo 正文，H1、canonical 不变", () => {
    const html = renderSectionHtml(SHELL, "/promo", undefined, promoSectionHtml({ kind: "ok", items: [] }, NOW))!;
    expect(html).toContain('<link rel="canonical" href="https://www.eaxau.com/promo" />');
    expect(html).toMatch(/<h1>限时促销<\/h1>[\s\S]*<h2>促销商品<\/h2>[\s\S]*<h2>交付与支持<\/h2>/);
  });
});
