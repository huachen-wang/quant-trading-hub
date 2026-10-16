/**
 * 每个页面自己的 title / description（2026-10-17 第三批）。
 *
 * 服务端预渲染（server/_core/seo-render.ts）和前端 <Head>（components/page-head.tsx）都从这里取，
 * 保证「不跑 JS 看到的标题」和「JS 渲染后的标题」是同一个，不会再被全局通用标题覆盖。
 * 只写页面上真实存在的内容，不写收益、胜率等数字。
 */

export const SITE_ORIGIN = "https://www.eaxau.com";

export type PageMeta = {
  title: string;
  description: string;
  /** 预渲染正文里的 H1。 */
  h1: string;
};

/** 可收录的栏目页。 */
export const SECTION_PAGE_META: Readonly<Record<string, PageMeta>> = {
  "/": {
    title: "EAXAU · MT4 / MT5 EA、指标与量化交易工具商城",
    description:
      "EAXAU（AI量化联盟）提供 MT4 / MT5 的 EA 自动交易程序、指标与量化交易工具。每个商品页写明运行平台、交易品种、常用周期、运行依赖与授权交付方式；价格与授权范围按订单确认。",
    h1: "EAXAU · MT4 / MT5 EA、指标与量化交易工具",
  },
  "/market": {
    title: "策略广场 · MT4 / MT5 EA、指标与工具目录 | EAXAU",
    description:
      "按平台、热度和上架时间浏览 EAXAU 全部 MT4 / MT5 EA、指标与交易工具；每个商品页写明运行平台、交易品种、常用周期与授权交付方式。",
    h1: "策略广场：MT4 / MT5 EA、指标与工具目录",
  },
  "/cooperation": {
    title: "工作室合作与授权 | EAXAU",
    description:
      "EAXAU 工作室合作与授权：策略筛选、技术适配与授权核验；正式合作以授权证明、可复核证据与签署合同为准。",
    h1: "工作室合作与授权",
  },
  "/promo": {
    title: "限时促销 | EAXAU",
    description: "EAXAU 限时促销商品。下单前请联系客服确认版本、授权范围与交付方式。",
    h1: "限时促销",
  },
  "/group-buy": {
    title: "合购撮合台 | EAXAU",
    description: "在 EAXAU 发起或参与同一款 EA 的合购；价格、人数与授权范围按合购规则和订单确认。",
    h1: "合购撮合台",
  },
  "/subscribe": {
    title: "订阅 · 新策略上架通知 | EAXAU",
    description: "订阅 EAXAU 新策略上架通知、EA 试用材料与部署指导。",
    h1: "订阅新策略上架通知",
  },
};

/** 不收录的页面：登录、注册、找回密码、V2 预览。标题照常给，正文不放。 */
export function noindexPageTitle(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/auth/login") return "登录 - EAXAU";
  if (path === "/auth/register") return "注册 - EAXAU";
  if (path === "/auth/forgot-password") return "找回密码 - EAXAU";
  if (path === "/v2-preview" || path.startsWith("/v2-preview/")) return "方案预览 - EAXAU";
  return null;
}

export const NOT_FOUND_TITLE = "页面不存在 - EAXAU";

// ---------- 商品详情页 ----------

/** 富文本只用于取纯文本摘要。 */
export function plainText(value: unknown, limit = 320): string {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
}

export function platformShort(platform?: string | null): string {
  const value = String(platform ?? "").trim().toUpperCase();
  return value === "MT4" || value === "MT5" ? value : "平台未提供";
}

/**
 * 旧种子目录把「联系我们了解详情」之类的占位文案写进了 description。
 * 占位不是产品事实，不能当摘要或结构化数据的 description 用。
 */
const PLACEHOLDER_DESCRIPTIONS = ["联系我们了解详情", "待补充", "暂无描述", "暂无介绍", "待校准"];

export function isPlaceholderDescription(text: string): boolean {
  const value = text.trim();
  if (value.length < 12) return true;
  return PLACEHOLDER_DESCRIPTIONS.some((p) => value === p || value.replace(/[。.\s]/g, "") === p);
}

export function productTypeLabel(productType?: string | null): string {
  if (productType === "indicator") return "指标";
  if (productType === "tool") return "交易工具";
  return "EA 自动交易程序";
}

export type StrategyMetaInput = {
  title: string;
  description?: string | null;
  richDescription?: string | null;
  platform?: string | null;
  productType?: string | null;
};

/** 商品详情页的 title / description / 摘要：服务端和前端同一套规则。 */
export function strategyPageMeta(strategy: StrategyMetaInput): {
  title: string;
  description: string;
  summary: string;
  hasRealSummary: boolean;
} {
  const platformValue = String(strategy.platform ?? "").trim().toUpperCase();
  const platformKnown = platformValue === "MT4" || platformValue === "MT5";
  const rawSummary = plainText(strategy.description) || plainText(strategy.richDescription);
  const hasRealSummary = !!rawSummary && !isPlaceholderDescription(rawSummary);
  const fallbackSummary = platformKnown
    ? `${strategy.title}：${platformShort(strategy.platform)} ${productTypeLabel(strategy.productType)}的商品资料、运行环境与授权交付说明。`
    : `${strategy.title}：${productTypeLabel(strategy.productType)}的商品资料与授权交付说明；运行平台待确认。`;
  const summary = hasRealSummary ? rawSummary : fallbackSummary;
  return {
    title: `${strategy.title} - ${productTypeLabel(strategy.productType)} | EAXAU`,
    description: plainText(summary, 160),
    summary,
    hasRealSummary,
  };
}
