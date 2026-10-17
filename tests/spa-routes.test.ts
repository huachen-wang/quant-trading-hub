import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DYNAMIC_SPA_ROUTES, STATIC_SPA_ROUTES, isKnownSpaRoute } from "../server/_core/spa-routes";

const appDir = resolve(__dirname, "..", "app");

/** 把 app/ 下的页面文件换算成网址：去掉 (group)、index 归到上一级；_layout、+html、+not-found 不是页面。 */
function routesFromAppDir(): string[] {
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx|ts|jsx|js)$/.test(name)) continue;
      const base = name.replace(/\.(tsx|ts|jsx|js)$/, "");
      if (base.startsWith("_") || base.startsWith("+")) continue;
      const segments = relative(appDir, full)
        .replace(/\.(tsx|ts|jsx|js)$/, "")
        .split(/[\\/]/)
        .filter((segment) => !/^\(.+\)$/.test(segment));
      if (segments[segments.length - 1] === "index") segments.pop();
      routes.push("/" + segments.join("/"));
    }
  };
  walk(appDir);
  return routes.map((route) => (route === "/" ? "/" : route.replace(/\/$/, ""))).sort();
}

describe("真实页面清单与 app/ 目录一致", () => {
  it("app/ 里每个页面都在清单里，清单里没有不存在的页面", () => {
    const fromFiles = routesFromAppDir().filter((route) => route !== "/strategy/[id]");
    const declared = [...STATIC_SPA_ROUTES, ...DYNAMIC_SPA_ROUTES].sort();
    expect(declared).toEqual(fromFiles);
  });
});

describe("isKnownSpaRoute：只有真实页面给 200", () => {
  it.each([
    "/",
    "/market",
    "/market/",
    "/cooperation",
    "/promo",
    "/group-buy",
    "/group-buy/create",
    "/subscribe",
    "/moments",
    "/favorites",
    "/profile",
    "/profile/edit",
    "/search",
    "/auth/login",
    "/checkout/new",
    "/checkout/EA20261017001",
    "/admin",
    "/admin/orders",
    "/oauth/callback",
    "/v2-preview",
    "/v2-preview/accounts",
    "/v2-preview/accounts/12",
    "/v2-preview/strategies/gold-momentum",
    "/v2-preview/ea-library",
    "/en/cooperation",
    "/guides/ea-requirements-and-acceptance",
    "/en/guides/ea-requirements-and-acceptance",
    "/faq",
    "/en/faq",
  ])("%s 是真实页面", (path) => {
    expect(isKnownSpaRoute(path)).toBe(true);
  });

  it.each([
    "/this-page-does-not-exist-xyz",
    "/market/extra",
    "/wp-login.php",
    "/tutorials/mt4",
    "/faq/extra", // 2026-10-18 起 /faq 是真实页面（常见问题），这里换成它下面不存在的地址
    "/tools",
    "/admin/does-not-exist",
    "/checkout",
    "/checkout/a/b",
    "/v2-preview/strategies",
    "/v2-preview/accounts/1/2",
    "/(tabs)",
    "/_sitemap",
    "/+not-found",
    "/en",
    "/guides",
    "/en/guides",
    "/en/market",
  ])("%s 不存在 → 404", (path) => {
    expect(isKnownSpaRoute(path)).toBe(false);
  });
});
