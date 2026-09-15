import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * 真实 HTTP 行为回归。单测渲染函数不够：c6fcd9c 的问题正是出在路由把
 * db.ts 的 mock 兜底当成真实商品发了出去，渲染函数本身是对的。
 *
 * 这里起真的服务端进程，在「没有 DATABASE_URL」和「DATABASE_URL 指向打不开的库」
 * 两种情况下抓真实响应，断言：
 *   - 绝不把 mock 商品渲染成 200 的商品页；
 *   - 数据源读不到是 503 + Retry-After，不是 404、也不是 200 空清单；
 *   - 静态资源与非 SEO 路由不受影响（购买 / 下载入口仍由应用接管）。
 */

const repoRoot = resolve(__dirname, "..");
const tsx = join(repoRoot, "node_modules/.bin/tsx");

function makeWebBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), "eaxau-http-"));
  mkdirSync(join(dir, "web-build/_expo/static/js/web"), { recursive: true });
  mkdirSync(join(dir, "web-build/_expo/static/css"), { recursive: true });
  writeFileSync(
    join(dir, "web-build/index.html"),
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>EAXAU</title>` +
      `<link rel="stylesheet" href="/_expo/static/css/web-local.css"></head>` +
      `<body><div id="eaxau-boot"></div><div id="root"></div>` +
      `<script src="/_expo/static/js/web/entry-local.js" defer></script></body></html>`,
  );
  writeFileSync(join(dir, "web-build/_expo/static/js/web/entry-local.js"), 'console.log("entry");');
  writeFileSync(join(dir, "web-build/_expo/static/css/web-local.css"), "body{}");
  return dir;
}

type Server = { child: ChildProcess; base: string };

async function start(env: Record<string, string | undefined>, cwd: string): Promise<Server> {
  const port = 21000 + Math.floor(Math.random() * 12000);
  const child = spawn(tsx, [join(repoRoot, "server/_core/index.ts")], {
    cwd,
    env: { ...process.env, ...env, NODE_ENV: "development", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error("server did not start in time")), 90_000);
    const onData = (buf: Buffer) => {
      if (buf.toString().includes("server listening on port")) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        resolveReady();
      }
    };
    child.stdout?.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      rejectReady(new Error("server exited early: " + code));
    });
  });
  return { child, base: `http://127.0.0.1:${port}` };
}

const UA_HUMAN =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";
const UA_BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

async function fetchAs(base: string, path: string, ua: string) {
  const res = await fetch(base + path, { headers: { "User-Agent": ua } });
  return { status: res.status, body: await res.text(), headers: res.headers };
}

describe("没有真实数据库时的 HTTP 行为", () => {
  let server: Server;
  let workdir: string;

  beforeAll(async () => {
    workdir = makeWebBuild();
    /* 关键：不设 DATABASE_URL —— db.ts 的业务函数在这种情况下会返回 mock 商品 */
    server = await start({ DATABASE_URL: undefined }, workdir);
  }, 120_000);

  afterAll(() => server?.child.kill("SIGTERM"));

  it("商品页给 503 + Retry-After，绝不把 mock 商品渲染成 200 商品页", async () => {
    const got = await fetchAs(server.base, "/strategy/1", UA_HUMAN);
    expect(got.status).toBe(503);
    expect(got.headers.get("retry-after")).toBe("120");
    expect(got.body).toContain("内容暂时无法读取");
    /* db.ts 的 mock 目录里有这些名字；一旦出现就说明 mock 漏出去了 */
    for (const mockName of ["SuperTrend", "Quantum Queen", "Quantum King", "Wave Rider"]) {
      expect(got.body).not.toContain(mockName);
    }
    expect(got.body).not.toContain('"@type":"Product"');
    expect(got.body).not.toContain('rel="canonical"');
  });

  it("首页给 503，而不是 200 空清单（200 会让搜索引擎收走「这站没有商品」）", async () => {
    const got = await fetchAs(server.base, "/", UA_HUMAN);
    expect(got.status).toBe(503);
    expect(got.headers.get("retry-after")).toBe("120");
    expect(got.body).not.toContain('"@type":"ItemList"');
    for (const mockName of ["SuperTrend", "Quantum Queen"]) {
      expect(got.body).not.toContain(mockName);
    }
  });

  it("读不到库时不把不存在的 id 说成 404", async () => {
    const got = await fetchAs(server.base, "/strategy/99999999", UA_HUMAN);
    expect(got.status).toBe(503);
  });

  it("/strategy 命名空间里不可能存在的地址一律真 404，且不查库", async () => {
    /* 这些 id 永远不会对应商品：不该返回 200 的 SPA 壳，也不该因为库读不到而变 503 */
    for (const path of [
      "/strategy/abc",
      "/strategy/-1",
      "/strategy/1.5",
      "/strategy/01",
      "/strategy/ 1",
      "/strategy/30/extra",
      "/strategy/",
      "/strategy",
      "/strategy/99999999999999999999",
    ]) {
      const got = await fetchAs(server.base, path, UA_HUMAN);
      expect(got.status, `${path} 应为 404`).toBe(404);
      expect(got.body).toContain("页面不存在");
      expect(got.body).toContain('content="noindex,follow"');
      expect(got.body).not.toContain('"@type":"Product"');
      /* 关键：没查库，所以即便此刻数据库不可用也不会变成 503 */
      expect(got.headers.get("retry-after")).toBeNull();
    }
  });

  it("合法正整数 id 在库读不到时才是 503", async () => {
    for (const path of ["/strategy/1", "/strategy/30", "/strategy/99999999"]) {
      const got = await fetchAs(server.base, path, UA_HUMAN);
      expect(got.status, `${path} 应为 503`).toBe(503);
      expect(got.headers.get("retry-after")).toBe("120");
    }
  });

  it("普通 UA 与 Googlebot 拿到同一份字节", async () => {
    for (const path of ["/", "/strategy/1", "/strategy/99999999"]) {
      const human = await fetchAs(server.base, path, UA_HUMAN);
      const bot = await fetchAs(server.base, path, UA_BOT);
      expect(bot.status).toBe(human.status);
      expect(bot.body).toBe(human.body);
    }
  });

  it("静态资源与 API 前缀不受 SEO 渲染影响，购买/下载路由仍归应用", async () => {
    const asset = await fetchAs(server.base, "/_expo/static/js/web/entry-local.js", UA_HUMAN);
    expect(asset.status).toBe(200);
    expect(asset.body).toContain("entry");

    /* /api/* 不会被 SEO 处理器接管：不该返回 SEO 正文块 */
    const api = await fetchAs(server.base, "/api/download/secure", UA_HUMAN);
    expect(api.body).not.toContain('id="eaxau-seo"');
  });
});

describe("数据库配置了但连不上时的 HTTP 行为", () => {
  let server: Server;
  let workdir: string;

  beforeAll(async () => {
    workdir = makeWebBuild();
    server = await start({ DATABASE_URL: "mysql://u:p@127.0.0.1:59999/none" }, workdir);
  }, 120_000);

  afterAll(() => server?.child.kill("SIGTERM"));

  it("商品页 503，且不把数据库原始报错写给访客", async () => {
    const got = await fetchAs(server.base, "/strategy/1", UA_HUMAN);
    expect(got.status).toBe(503);
    for (const leak of ["ECONNREFUSED", "ETIMEDOUT", "mysql://", "59999", "at Object."]) {
      expect(got.body).not.toContain(leak);
    }
  });

  it("首页 503", async () => {
    expect((await fetchAs(server.base, "/", UA_HUMAN)).status).toBe(503);
  });
});
