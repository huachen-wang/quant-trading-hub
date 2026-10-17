import { useSyncExternalStore } from "react";

/**
 * 首屏服务端头部标签的「交接」（2026-10-18，代码体检 R3 ⑦）。
 *
 * 服务端预渲染（server/_core/seo-render.ts、seo-content-pages.ts）把首屏这一页的 canonical、robots、
 * hreflang、og:*、twitter:*、JSON-LD 直接写进 HTML，它们不带 react-helmet 的 data-rh 标记，
 * 所以 <Head> 不会碰它们。原来站内跳转以后它们一直留着：canonical、OG、结构化数据还是第一页的，
 * 从 V2 预览跳回首页时 `noindex` 也没走。
 *
 * 现在的规则：
 * - 还停在首屏那个地址：沿用服务端标签（首页商品 ItemList 这类只有服务端读库才有的数据也保留），
 *   页面的 <Head> 这时只管 title / description，不重复输出；
 * - 一旦跳到别的地址：把这批服务端标签全部移除（只移除不带 data-rh 的，<Head> 自己的不动），
 *   之后每一页的 canonical / robots / hreflang / OG / JSON-LD 都由当前路由的 <Head> 渲染
 *   （components/page-head.tsx，数据来自 shared/seo-head.ts，和服务端同一份）。
 */

type HeadRule = {
  tag: "link" | "meta" | "script";
  attr: string;
  equals?: string;
  startsWith?: string;
  /** 还必须带着这个属性（hreflang 备用链接）。 */
  requires?: string;
};

/** 服务端写的、归「当前路由」所有的头部标签种类。带 data-rh 的是 <Head> 自己管的，不在此列。 */
export const SERVER_ROUTE_HEAD_RULES: readonly HeadRule[] = [
  { tag: "link", attr: "rel", equals: "canonical" },
  { tag: "link", attr: "rel", equals: "alternate", requires: "hreflang" },
  { tag: "meta", attr: "name", equals: "robots" },
  { tag: "meta", attr: "property", startsWith: "og:" },
  { tag: "meta", attr: "name", startsWith: "twitter:" },
  { tag: "script", attr: "type", equals: "application/ld+json" },
];

/** 同一组规则写成 CSS 选择器，给 document.querySelectorAll 用。 */
export const SERVER_ROUTE_HEAD_SELECTOR = SERVER_ROUTE_HEAD_RULES.map((rule) => {
  const value = rule.equals !== undefined ? `="${rule.equals}"` : `^="${rule.startsWith}"`;
  return `${rule.tag}[${rule.attr}${value}]${rule.requires ? `[${rule.requires}]` : ""}:not([data-rh])`;
}).join(", ");

/** 同一组规则的纯函数版（测试拿服务端 HTML 逐个标签核对用）。 */
export function matchesServerRouteHead(tag: string, attrs: Record<string, string>): boolean {
  if ("data-rh" in attrs) return false;
  return SERVER_ROUTE_HEAD_RULES.some((rule) => {
    if (rule.tag !== tag.toLowerCase()) return false;
    const value = attrs[rule.attr];
    if (value === undefined) return false;
    if (rule.equals !== undefined && value !== rule.equals) return false;
    if (rule.startsWith !== undefined && !value.startsWith(rule.startsWith)) return false;
    if (rule.requires && !(rule.requires in attrs)) return false;
    return true;
  });
}

/** 地址比较时忽略末尾斜杠（/market/ 与 /market 是同一页）。 */
export function normalizeRoutePath(pathname: string): string {
  const path = (pathname || "/").split(/[?#]/)[0] || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
}

type HeadDocument = Pick<Document, "querySelectorAll">;

export type ServerHeadHandoff = {
  /** 服务端标签还在（= 还停在首屏那一页）。 */
  isActive(): boolean;
  /** 路由变了就调用：离开首屏地址时移除服务端标签，返回这次移除了几个。 */
  onRouteChange(pathname: string): number;
  subscribe(listener: () => void): () => void;
};

export function createServerHeadHandoff(doc: HeadDocument | null, initialPathname: string): ServerHeadHandoff {
  const initialPath = normalizeRoutePath(initialPathname);
  let active = !!doc && doc.querySelectorAll(SERVER_ROUTE_HEAD_SELECTOR).length > 0;
  const listeners = new Set<() => void>();
  return {
    isActive: () => active,
    onRouteChange(pathname) {
      if (!active || !doc) return 0;
      if (normalizeRoutePath(pathname) === initialPath) return 0;
      const nodes = Array.from(doc.querySelectorAll(SERVER_ROUTE_HEAD_SELECTOR));
      for (const node of nodes) node.parentNode?.removeChild(node);
      active = false;
      for (const listener of Array.from(listeners)) listener();
      return nodes.length;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const isBrowser = typeof document !== "undefined" && typeof window !== "undefined";

/** 全站唯一的一份：模块第一次加载时（应用挂载前）记下首屏地址和服务端标签是否存在。 */
export const serverHeadHandoff = createServerHeadHandoff(
  isBrowser ? document : null,
  isBrowser ? window.location.pathname : "/",
);

/** 服务端标签是否还在。为 true 时页面的 <Head> 不重复输出 canonical / OG / JSON-LD。 */
export function useServerHeadActive(): boolean {
  return useSyncExternalStore(
    serverHeadHandoff.subscribe,
    serverHeadHandoff.isActive,
    () => false,
  );
}
