/**
 * 每个页面「自己的」头部标签：canonical、robots、hreflang、Open Graph、Twitter、JSON-LD（2026-10-18，代码体检 R3 ⑦）。
 *
 * 原来这些标签只由服务端预渲染写进首屏 HTML（server/_core/seo-render.ts），前端 <Head> 只管 title 和
 * description。站内跳转以后，canonical / OG / JSON-LD 还停在第一次打开的那一页；从预览页跳回首页，
 * `noindex` 也一直留着。现在：
 * - 这里按路由生成标签数据（纯数据，不含 HTML），服务端把它序列化进首屏 HTML，前端 <Head> 渲染同一份；
 * - 首屏打开的那一页沿用服务端标签（含首页商品 ItemList 这类只有服务端读库才有的结构化数据）；
 * - 一旦站内跳到别的地址，前端移除服务端写的这批标签（lib/route-head.ts），由当前路由的 <Head> 接管。
 *
 * 只写页面上真实存在的信息；不写收益、胜率、回撤、虚拟下载 / 订阅数。
 */

import {
  QQ_GROUP_NUMBER,
  SUPPORT_QQ,
  SUPPORT_TELEGRAM_HANDLE,
  SUPPORT_TELEGRAM_URL,
  SUPPORT_WECHAT,
  TELEGRAM_GROUP_URL,
} from "./community-contacts";
import { contentH1, findContentPage, otherLanguage, type ContentLang, type ContentPage } from "./content-pages";
import { SECTION_PAGE_META, SITE_ORIGIN, productTypeLabel, strategyPageMeta } from "./seo-meta";
import { safeJsonLd } from "./seo-json";

export type HeadTag =
  | { kind: "link"; rel: string; href: string; hreflang?: string }
  | { kind: "meta"; name: string; content: string }
  | { kind: "property"; property: string; content: string }
  | { kind: "jsonld"; json: string };

const link = (rel: string, href: string, hreflang?: string): HeadTag =>
  hreflang ? { kind: "link", rel, hreflang, href } : { kind: "link", rel, href };
const meta = (name: string, content: string): HeadTag => ({ kind: "meta", name, content });
const property = (name: string, content: string): HeadTag => ({ kind: "property", property: name, content });
const jsonLd = (value: unknown): HeadTag => ({ kind: "jsonld", json: safeJsonLd(value) });

export const ROBOTS_INDEX = "index,follow";
export const ROBOTS_NOINDEX = "noindex,follow";

function socialTags(opts: {
  ogType: string;
  title: string;
  description: string;
  url: string;
  image?: string | null;
  twitterCard: string;
  locale?: { self: string; alternate: string };
}): HeadTag[] {
  const tags: HeadTag[] = [property("og:type", opts.ogType)];
  if (opts.locale) {
    tags.push(property("og:locale", opts.locale.self), property("og:locale:alternate", opts.locale.alternate));
  }
  tags.push(
    property("og:title", opts.title),
    property("og:description", opts.description),
    property("og:url", opts.url),
  );
  if (opts.image) tags.push(property("og:image", opts.image));
  tags.push(
    meta("twitter:card", opts.twitterCard),
    meta("twitter:title", opts.title),
    meta("twitter:description", opts.description),
  );
  return tags;
}

// ---------------------------------------------------------------- 首页与栏目页

/** 首页结构化数据里的客服入口：客服链接写 Telegram，QQ 和微信写在 description 里。 */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "EAXAU",
    alternateName: "AI量化联盟",
    url: `${SITE_ORIGIN}/`,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: SUPPORT_TELEGRAM_URL,
        availableLanguage: ["zh-CN", "en"],
        description: `客服 QQ ${SUPPORT_QQ} · 微信 ${SUPPORT_WECHAT} · Telegram ${SUPPORT_TELEGRAM_HANDLE}；交流群：Telegram ${TELEGRAM_GROUP_URL} · QQ 群 ${QQ_GROUP_NUMBER}`,
      },
    ],
  };
}

/** 首页：栏目通用标签 + WebSite、Organization。商品 ItemList 依赖服务端读库，只在首屏 HTML 里有。 */
export function homeHeadTags(): HeadTag[] {
  const { title, description } = SECTION_PAGE_META["/"];
  const url = `${SITE_ORIGIN}/`;
  return [
    link("canonical", url),
    meta("robots", ROBOTS_INDEX),
    ...socialTags({ ogType: "website", title, description, url, twitterCard: "summary" }),
    jsonLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "EAXAU",
      alternateName: "AI量化联盟",
      url,
      description,
    }),
    jsonLd(organizationJsonLd()),
  ];
}

/** 栏目页（/market、/promo、/group-buy、/subscribe）。中英内容页走 contentPageHeadTags。 */
export function sectionHeadTags(path: string): HeadTag[] {
  if (path === "/") return homeHeadTags();
  const contentPage = findContentPage(path);
  if (contentPage) return contentPageHeadTags(contentPage);
  const meta_ = SECTION_PAGE_META[path];
  if (!meta_) return [];
  const url = `${SITE_ORIGIN}${path}`;
  return [
    link("canonical", url),
    meta("robots", ROBOTS_INDEX),
    ...socialTags({ ogType: "website", title: meta_.title, description: meta_.description, url, twitterCard: "summary" }),
  ];
}

/** 不收录的页面（登录、注册、找回密码、V2 预览）与 404：只有 robots。 */
export function noindexHeadTags(): HeadTag[] {
  return [meta("robots", ROBOTS_NOINDEX)];
}

// ---------------------------------------------------------------- 商品详情页

export type SeoStrategyInput = {
  id: number;
  title: string;
  description?: string | null;
  richDescription?: string | null;
  platform?: string | null;
  coverImage?: string | null;
  price?: string | number | null;
  saleMode?: string | null;
  productType?: string | null;
};

/** 只有 direct + 正价才算可直接购买；其余一律「联系咨询授权」，不写 0 元。
 *  库里没有库存字段，所以任何情况下都不断言 availability。 */
export function pricing(strategy: { price?: string | number | null; saleMode?: string | null }): {
  label: string;
  directPrice: number | null;
} {
  const raw = strategy.price;
  const value = raw === null || raw === undefined ? NaN : Number(raw);
  const direct = strategy.saleMode === "direct" && Number.isFinite(value) && value > 0;
  if (direct) return { label: `直接购买 ¥${value.toFixed(2)} CNY`, directPrice: value };
  return { label: "联系咨询授权（价格与授权范围按订单确认）", directPrice: null };
}

export function absoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return SITE_ORIGIN + (url.startsWith("/") ? url : "/" + url);
}

/** 商品 JSON-LD：只写真实字段；只有真实直购正价才写 offers；不写 brand、availability、评分。 */
export function productJsonLd(strategy: SeoStrategyInput): Record<string, unknown> {
  const url = `${SITE_ORIGIN}/strategy/${strategy.id}`;
  const { description, hasRealSummary } = strategyPageMeta(strategy);
  const price = pricing(strategy);
  const image = absoluteUrl(strategy.coverImage);
  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: strategy.title,
    url,
    category: productTypeLabel(strategy.productType),
  };
  /* 目录里混有第三方来源条目（MQL5 Market / EAHub 公开参考），
     无法逐条证明品牌归属，所以不写 brand，不把第三方产品冒称自有品牌。 */
  if (hasRealSummary) productLd.description = description;
  if (image) productLd.image = image;
  /* 只有真实直购正价才写 offers；咨询制不写 0 元。
     库里没有库存字段，所以任何情况下都不写 availability。EAXAU 是销售方，这一点是真的。 */
  if (price.directPrice !== null) {
    productLd.offers = {
      "@type": "Offer",
      url,
      price: price.directPrice.toFixed(2),
      priceCurrency: "CNY",
      seller: { "@type": "Organization", name: "EAXAU" },
    };
  }
  return productLd;
}

export function strategyHeadTags(strategy: SeoStrategyInput): HeadTag[] {
  const url = `${SITE_ORIGIN}/strategy/${strategy.id}`;
  const { title, description } = strategyPageMeta(strategy);
  return [
    link("canonical", url),
    meta("robots", ROBOTS_INDEX),
    ...socialTags({
      ogType: "product",
      title,
      description,
      url,
      image: absoluteUrl(strategy.coverImage),
      twitterCard: "summary_large_image",
    }),
    jsonLd(productJsonLd(strategy)),
  ];
}

// ---------------------------------------------------------------- 中英内容页

/** 只写页面上真实存在的信息：类型、标题、描述、语言、地址、发布方。不写日期、作者、价格、评分。 */
export function contentJsonLd(page: ContentPage): Record<string, unknown> {
  const url = `${SITE_ORIGIN}${page.path}`;
  const site = { "@type": "WebSite", name: "EAXAU", url: `${SITE_ORIGIN}/` };
  const publisher = { "@type": "Organization", name: "EAXAU", url: `${SITE_ORIGIN}/` };
  const base = {
    "@context": "https://schema.org",
    "@type": page.schemaType,
    description: page.description,
    url,
    inLanguage: page.lang,
    isPartOf: site,
    publisher,
  };
  if (page.schemaType === "Article") {
    return { ...base, headline: contentH1(page), mainEntityOfPage: url };
  }
  return { ...base, name: contentH1(page) };
}

export const OG_LOCALE: Record<ContentLang, string> = { "zh-CN": "zh_CN", en: "en_US" };

export function contentPageHeadTags(page: ContentPage): HeadTag[] {
  const url = `${SITE_ORIGIN}${page.path}`;
  const other = otherLanguage(page);
  return [
    link("canonical", url),
    ...(Object.entries(page.alternates) as [ContentLang, string][]).map(([lang, path]) =>
      link("alternate", `${SITE_ORIGIN}${path}`, lang),
    ),
    link("alternate", `${SITE_ORIGIN}${page.alternates["zh-CN"]}`, "x-default"),
    meta("robots", ROBOTS_INDEX),
    ...socialTags({
      ogType: page.schemaType === "Article" ? "article" : "website",
      title: page.title,
      description: page.description,
      url,
      twitterCard: "summary",
      locale: { self: OG_LOCALE[page.lang], alternate: OG_LOCALE[other.lang] },
    }),
    jsonLd(contentJsonLd(page)),
  ];
}
