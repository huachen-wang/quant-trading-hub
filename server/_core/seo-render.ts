import { safeJsonLd } from "./seo-json";
import {
  NOT_FOUND_TITLE,
  SECTION_PAGE_META,
  SITE_ORIGIN,
  isPlaceholderDescription,
  plainText,
  platformShort,
  productTypeLabel,
  strategyPageMeta,
} from "../../shared/seo-meta";
import {
  homeHeadTags,
  noindexHeadTags,
  organizationJsonLd,
  pricing,
  sectionHeadTags,
  strategyHeadTags,
  type HeadTag,
} from "../../shared/seo-head";
import {
  QQ_GROUP_JOIN_URL,
  QQ_GROUP_NUMBER,
  SUPPORT_QQ,
  SUPPORT_TELEGRAM_HANDLE,
  SUPPORT_TELEGRAM_URL,
  SUPPORT_WECHAT,
  TELEGRAM_GROUP_URL,
} from "../../shared/community-contacts";

/**
 * 面向所有访客（不区分 User-Agent）的初始 HTML 正文渲染。
 *
 * 三条边界：
 * 1. 只用数据库里真实存在的字段。`totalReturn/maxDrawdown/sharpeRatio/winRate` 目前既有
 *    第三方参考值，也有按标题哈希生成的占位值（见 server/user-strategy-catalog.ts），
 *    所以一律不写进正文或结构化数据；`virtualSubscribers/virtualDownloads` 是展示用虚拟值，同样不写。
 * 2. 商品不存在 → 真 404；数据库读不到 → 503，不伪装成 404，也不拿过期缓存冒充当前数据。
 * 3. 正文块放在 #root 之外的 `#eaxau-seo`，应用挂载后由 bootstrap 脚本移除，不产生双内容。
 */

export { SITE_ORIGIN, isPlaceholderDescription, organizationJsonLd, plainText, platformShort, pricing, productTypeLabel };
export const SEO_BLOCK_ID = "eaxau-seo";

/**
 * 交流群与客服，统一来自 shared/community-contacts.ts（页面、/llms.txt、无 JS 兜底同一份）。
 * 2026-10-17：Telegram 客服原来用的 xau6000 没有公开资料页（死链），换成 hypermatch123。
 */
export const SEO_CONTACTS = {
  telegramGroupLink: TELEGRAM_GROUP_URL,
  qqGroup: QQ_GROUP_NUMBER,
  qqGroupLink: QQ_GROUP_JOIN_URL,
  qq: SUPPORT_QQ,
  wechat: SUPPORT_WECHAT,
  telegram: SUPPORT_TELEGRAM_HANDLE,
  telegramLink: SUPPORT_TELEGRAM_URL,
};

export type SeoStrategy = {
  id: number;
  title: string;
  description?: string | null;
  richDescription?: string | null;
  platform: string;
  pairs?: string | null;
  timeframe?: string | null;
  coverImage?: string | null;
  price?: string | number | null;
  isFree?: boolean | null;
  saleMode?: string | null;
  productType?: string | null;
  tags?: string | null;
  updatedAt?: Date | string | null;
};

export type StrategyLookup =
  | { kind: "ok"; strategy: SeoStrategy }
  | { kind: "missing" }
  | { kind: "unavailable"; reason: string };

export type ListLookup =
  | { kind: "ok"; strategies: SeoStrategy[] }
  | { kind: "unavailable"; reason: string };

/** 促销栏目初始 HTML 用到的字段（server/_core/seo-catalog.ts 只取这几列）。不含价格、库存、已售。 */
export type SeoPromo = {
  id: number;
  title: string;
  description?: string | null;
  platform?: string | null;
  category?: string | null;
  promoEndTime?: Date | string | null;
};

/** 合购栏目初始 HTML 用到的字段。不含简介（后台简介里写着价格和人数）、价格、人数、联系方式。 */
export type SeoGroupBuy = {
  id: number;
  title: string;
  eaName?: string | null;
  expiresAt?: Date | string | null;
};

export type PromoLookup = { kind: "ok"; items: SeoPromo[] } | { kind: "unavailable"; reason: string };
export type GroupBuyLookup = { kind: "ok"; items: SeoGroupBuy[] } | { kind: "unavailable"; reason: string };

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 头部标签（shared/seo-head.ts 生成的数据）→ 首屏 HTML。前端 <Head>（components/page-head.tsx）渲染同一份数据；
 * 站内跳转离开首屏这一页时，lib/route-head.ts 按同样的标签种类把这批服务端标签移除，由当前路由接管。
 */
export function renderHeadTagsHtml(tags: HeadTag[]): string {
  return tags
    .map((tag) => {
      switch (tag.kind) {
        case "link":
          return `    <link rel="${escapeHtml(tag.rel)}"${tag.hreflang ? ` hreflang="${escapeHtml(tag.hreflang)}"` : ""} href="${escapeHtml(tag.href)}" />`;
        case "meta":
          return `    <meta name="${escapeHtml(tag.name)}" content="${escapeHtml(tag.content)}" />`;
        case "property":
          return `    <meta property="${escapeHtml(tag.property)}" content="${escapeHtml(tag.content)}" />`;
        case "jsonld":
          return `    <script type="application/ld+json">${tag.json}</script>`;
      }
    })
    .join("\n");
}

/** 版本只从标题里已经写明的版本号取，取不到就不写，不推断。 */
export function versionFromTitle(title: string): string | null {
  const match = String(title || "").match(/\b[vV]\s?(\d+(?:\.\d+){0,3})\b/);
  return match ? "V" + match[1] : null;
}

/** 平台只认数据库里真写了的 MT4 / MT5；其它值或空一律「未提供」，不默认成 MT5。 */
export function platformLabel(platform?: string | null): string {
  const value = String(platform ?? "").trim().toUpperCase();
  if (value === "MT4") return "MetaTrader 4（MT4）";
  if (value === "MT5") return "MetaTrader 5（MT5）";
  return "未提供";
}

function contactHtml(): string {
  const qqGroup = SEO_CONTACTS.qqGroupLink
    ? `<a href="${escapeHtml(SEO_CONTACTS.qqGroupLink)}" rel="noopener noreferrer">${escapeHtml(SEO_CONTACTS.qqGroup)}</a>`
    : escapeHtml(SEO_CONTACTS.qqGroup);
  return `      <h2>交付与支持</h2>
      <p>下单或授权确认后提供安装包与授权信息，并按版本提供安装、参数说明与后续更新支持。具体版本、参数、适用环境与授权范围以顾问确认为准。</p>
      <h3>交流群</h3>
      <ul class="eaxau-seo__contacts">
        <li>Telegram 交流群：<a href="${SEO_CONTACTS.telegramGroupLink}" rel="noopener noreferrer">${escapeHtml(SEO_CONTACTS.telegramGroupLink)}</a></li>
        <li>QQ 群：${qqGroup}</li>
      </ul>
      <h3>客服</h3>
      <ul class="eaxau-seo__contacts">
        <li>客服 QQ：${escapeHtml(SEO_CONTACTS.qq)}</li>
        <li>微信：${escapeHtml(SEO_CONTACTS.wechat)}</li>
        <li>Telegram 客服：<a href="${SEO_CONTACTS.telegramLink}" rel="noopener noreferrer">${escapeHtml(SEO_CONTACTS.telegram)}</a></li>
      </ul>
      <p class="eaxau-seo__note">咨询时请附上商品名称或商品页地址。本页不展示收益、回撤或胜率数字；历史数据不代表未来结果。</p>`;
}

export function wrap(inner: string): string {
  return `\n  <div id="${SEO_BLOCK_ID}" class="eaxau-seo">\n    <main class="eaxau-seo__main">\n${inner}\n    </main>\n  </div>\n`;
}

/**
 * description 带 data-rh：前端 <Head>（expo-router 的 react-helmet）挂载后会接管并替换这一条，
 * 页面上不会出现两条 description。title 由 <Head> 直接改 document.title。
 * canonical、robots、hreflang、og、twitter、JSON-LD 不带 data-rh：首屏这一页 JS 渲染后原样保留；
 * 站内跳到别的地址时由 lib/route-head.ts 移除，改由当前路由的 <Head> 渲染（2026-10-18，R3 ⑦）。
 */
export function replaceHead(indexHtml: string, title: string, description: string, extra: string): string {
  const descriptionTag = `<meta name="description" content="${escapeHtml(description)}" data-rh="true" />`;
  let html = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  if (/<meta name="description" content="[^"]*"[^>]*>/.test(html)) {
    html = html.replace(/<meta name="description" content="[^"]*"[^>]*>/, descriptionTag);
  } else {
    html = html.replace("</head>", `${descriptionTag}\n</head>`);
  }
  return html.replace("</head>", `${extra}\n</head>`);
}

export function insertBody(indexHtml: string, block: string): string {
  if (indexHtml.includes("</body>")) return indexHtml.replace("</body>", `${block}</body>`);
  return indexHtml + block;
}

/** 商品详情页：真实字段 + 自指 canonical + 与可见内容一致的结构化数据（shared/seo-head.ts）。 */
export function renderStrategyHtml(indexHtml: string, strategy: SeoStrategy): string {
  const version = versionFromTitle(strategy.title);
  const platformText = platformLabel(strategy.platform);
  const platformKnown = platformText !== "未提供";

  /* 占位描述（如「联系我们了解详情」）不是产品事实：不当摘要、也不写进结构化数据。
     title / description 与前端 <Head> 同源（shared/seo-meta.ts），JS 渲染后不变。 */
  const { title, description, summary } = strategyPageMeta(strategy);
  const price = pricing(strategy);

  const facts: Array<[string, string]> = [["商品名称", strategy.title]];
  if (version) facts.push(["版本", version]);
  facts.push(["运行平台", platformText]);
  facts.push(["产品类型", productTypeLabel(strategy.productType)]);
  facts.push(["交易品种", strategy.pairs ? String(strategy.pairs) : "未提供"]);
  facts.push(["常用周期", strategy.timeframe ? String(strategy.timeframe) : "未提供"]);
  facts.push([
    "运行依赖",
    platformKnown
      ? `需在 ${platformShort(strategy.platform)} 终端运行，建议配合稳定网络或 VPS；点差、合约规格与交易时段按经纪商环境确认。`
      : "运行平台未在商品资料中标注，请联系确认后再安装；点差、合约规格与交易时段按经纪商环境确认。",
  ]);
  facts.push(["授权与购买", price.label]);

  const head = renderHeadTagsHtml(strategyHeadTags(strategy));

  const body = wrap(`      <nav class="eaxau-seo__crumb"><a href="/">EAXAU 首页</a> › ${escapeHtml(strategy.title)}</nav>
      <h1>${escapeHtml(strategy.title)}</h1>
      <p class="eaxau-seo__lead">${escapeHtml(summary)}</p>
      <h2>商品资料</h2>
      <dl class="eaxau-seo__facts">
${facts.map(([k, v]) => `        <dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("\n")}
      </dl>
${contactHtml()}`);

  return insertBody(replaceHead(indexHtml, title, description, head), body);
}

/** 首页：站点说明 + 真实在售商品清单。列表读不到时不编造商品，也不拿旧缓存充数。 */
export function renderHomeHtml(indexHtml: string, lookup: ListLookup): string {
  const { title, description } = SECTION_PAGE_META["/"];

  const list = lookup.kind === "ok" ? lookup.strategies : [];
  const itemLd =
    list.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "EAXAU 商品目录",
          numberOfItems: list.length,
          itemListElement: list.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_ORIGIN}/strategy/${s.id}`,
            name: s.title,
          })),
        }
      : null;

  /* 通用部分（canonical、OG、WebSite、Organization）与前端 <Head> 同源；ItemList 依赖读库，只在首屏 HTML 里有。 */
  const head =
    renderHeadTagsHtml(homeHeadTags()) +
    (itemLd ? `\n    <script type="application/ld+json">${safeJsonLd(itemLd)}</script>` : "");

  const listHtml = productListHtml(lookup);

  const body = wrap(`      <h1>${escapeHtml(SECTION_PAGE_META["/"].h1)}</h1>
      <p class="eaxau-seo__lead">${escapeHtml(description)}</p>
      <h2>在售商品</h2>
${listHtml}
${contactHtml()}`);

  return insertBody(replaceHead(indexHtml, title, description, head), body);
}

/** 不存在的地址：真 404 正文，noindex,follow，不做全站静态快照。 */
/** 商品清单（首页、策略广场共用）：读不到就写临时故障，不编造、不拿旧缓存充数。 */
function productListHtml(lookup: ListLookup): string {
  if (lookup.kind === "unavailable") {
    return `      <p class="eaxau-seo__note">商品清单这次没能读出来。这是临时故障，不代表商品下架；请稍后重试或直接联系顾问。</p>`;
  }
  if (lookup.strategies.length === 0) {
    return `      <p class="eaxau-seo__note">当前没有已发布的商品记录。</p>`;
  }
  return `      <ul class="eaxau-seo__list">
${lookup.strategies
  .map(
    (s) =>
      `        <li><a href="/strategy/${s.id}">${escapeHtml(s.title)}</a> · ${escapeHtml(platformShort(s.platform))}${
        s.pairs ? " · " + escapeHtml(String(s.pairs)) : ""
      }${s.timeframe ? " · " + escapeHtml(String(s.timeframe)) : ""} · ${escapeHtml(pricing(s).label)}</li>`,
  )
  .join("\n")}
      </ul>`;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const PROMO_CATEGORY_LABEL: Record<string, string> = {
  ea: "EA",
  indicator: "指标",
  tool: "辅助工具",
  course: "教程",
};

/**
 * 促销栏目正文（2026-10-18，代码体检 R3 ⑧）：后台真实促销商品的名称、平台、分类、活动状态和简介。
 * - 状态和页面倒计时同一口径：截止时间已过就写「活动已结束」，不把过期活动写成进行中；
 * - 不写原价、促销价、库存、已售——价格与授权范围按当次订单确认；
 * - 促销商品没有单独的详情地址（页面上是弹窗），所以条目不带链接，不编造地址；
 * - 读不到就说临时故障；确实没有就说没有。都不拿写死的演示商品顶替。
 */
export function promoSectionHtml(lookup: PromoLookup, now: Date = new Date()): string {
  if (lookup.kind === "unavailable") {
    return `      <h2>促销商品</h2>
      <p class="eaxau-seo__note">促销清单这次没能读出来。这是临时故障，不代表没有促销；请稍后重试或直接联系客服。</p>\n`;
  }
  if (lookup.items.length === 0) {
    return `      <h2>促销商品</h2>
      <p class="eaxau-seo__note">当前没有进行中的促销商品。需要某款 EA，可以联系客服说明名称和版本。</p>\n`;
  }
  const items = lookup.items.map((item) => {
    const parts = [`<strong>${escapeHtml(item.title)}</strong>`];
    const platform = String(item.platform ?? "").trim().toUpperCase();
    if (platform === "MT4" || platform === "MT5") parts.push(platform);
    const category = PROMO_CATEGORY_LABEL[String(item.category ?? "")];
    if (category) parts.push(category);
    const end = toDate(item.promoEndTime);
    if (end) parts.push(end.getTime() <= now.getTime() ? "活动已结束" : `活动截止 ${ymd(end)}`);
    const summary = plainText(item.description, 160);
    return `        <li>${parts.join(" · ")}${summary ? `：${escapeHtml(summary)}` : ""}</li>`;
  });
  return `      <h2>促销商品</h2>
      <ul class="eaxau-seo__list">
${items.join("\n")}
      </ul>
      <p class="eaxau-seo__note">价格、库存、授权范围与交付内容以当次订单确认为准；下单前请联系客服确认版本。</p>\n`;
}

/**
 * 合购栏目正文（2026-10-18，R3 ⑧）：状态为进行中的合购的标题和 EA 名称。
 * - 截止时间已过的照实写「截止时间已过」，请先找客服确认还能不能参加，不写成正在拼团；
 * - 不写简介、价格、人数和联系方式（后台简介里混着价格和人数）；
 * - 合购没有单独的详情地址，条目不带链接；发起合购需求的页面是 /group-buy/create。
 */
export function groupBuySectionHtml(lookup: GroupBuyLookup, now: Date = new Date()): string {
  const create = `      <p><a href="/group-buy/create">发起合购需求</a></p>\n`;
  if (lookup.kind === "unavailable") {
    return `      <h2>进行中的合购</h2>
      <p class="eaxau-seo__note">合购清单这次没能读出来。这是临时故障，不代表没有合购；请稍后重试或直接联系客服。</p>
${create}`;
  }
  if (lookup.items.length === 0) {
    return `      <h2>进行中的合购</h2>
      <p class="eaxau-seo__note">当前没有进行中的合购。</p>
${create}`;
  }
  const items = lookup.items.map((item) => {
    const parts = [`<strong>${escapeHtml(item.title)}</strong>`];
    if (item.eaName && item.eaName.trim() && item.eaName.trim() !== item.title.trim()) {
      parts.push(`EA：${escapeHtml(item.eaName.trim())}`);
    }
    const expires = toDate(item.expiresAt);
    if (expires) {
      parts.push(
        expires.getTime() <= now.getTime()
          ? `截止时间已过（${ymd(expires)}），能否参加请先联系客服确认`
          : `截止 ${ymd(expires)}`,
      );
    }
    return `        <li>${parts.join(" · ")}</li>`;
  });
  return `      <h2>进行中的合购</h2>
      <ul class="eaxau-seo__list">
${items.join("\n")}
      </ul>
      <p class="eaxau-seo__note">价格、人数与授权范围按合购规则和订单确认。</p>
${create}`;
}

/**
 * 栏目页（/market、/promo、/group-buy、/subscribe；/cooperation 走中英内容页）：
 * 自己的 title、description、canonical、H1 和交流群 / 客服。/market 额外列出全部已发布商品，
 * 让不跑 JS 的爬虫也能从这一页走到每个商品页；/promo、/group-buy 列出后台真实清单（extraBody，
 * 见 promoSectionHtml / groupBuySectionHtml）。不写促销价格、合购人数等页面数字。
 */
export function renderSectionHtml(
  indexHtml: string,
  path: string,
  lookup?: ListLookup,
  extraBody = "",
): string | null {
  const meta = SECTION_PAGE_META[path];
  if (!meta || path === "/") return null;
  const head = renderHeadTagsHtml(sectionHeadTags(path));
  const list = lookup ? `      <h2>全部商品</h2>\n${productListHtml(lookup)}\n` : "";
  const body = wrap(`      <nav class="eaxau-seo__crumb"><a href="/">EAXAU 首页</a> › ${escapeHtml(meta.h1)}</nav>
      <h1>${escapeHtml(meta.h1)}</h1>
      <p class="eaxau-seo__lead">${escapeHtml(meta.description)}</p>
${list}${extraBody}${contactHtml()}`);
  return insertBody(replaceHead(indexHtml, meta.title, meta.description, head), body);
}

/** 不收录的页面（登录、注册、找回密码、V2 预览）：标题 + noindex，不放正文。 */
export function renderNoindexHtml(indexHtml: string, title: string): string {
  const head = renderHeadTagsHtml(noindexHeadTags());
  return replaceHead(indexHtml, title, "EAXAU 账户与预览页面。", head);
}

export function renderNotFoundHtml(indexHtml: string, pathname: string): string {
  const title = NOT_FOUND_TITLE;
  const description = "这个地址在 EAXAU 上没有对应内容。";
  const head = renderHeadTagsHtml(noindexHeadTags());
  const body = wrap(`      <h1>页面不存在</h1>
      <p class="eaxau-seo__lead">地址 <code>${escapeHtml(pathname)}</code> 没有对应的商品或页面。它可能从未存在，或者已经下架。</p>
      <p><a href="/">回商城</a></p>
${contactHtml()}`);
  return insertBody(replaceHead(indexHtml, title, description, head), body);
}

/** 数据源暂时读不到：503，不是 404，也不展示任何可能过期的数据。 */
export function renderUnavailableHtml(indexHtml: string): string {
  const title = "内容暂时无法读取 - EAXAU";
  const description = "商品数据暂时读取失败，请稍后重试。";
  const head = renderHeadTagsHtml(noindexHeadTags());
  const body = wrap(`      <h1>内容暂时无法读取</h1>
      <p class="eaxau-seo__lead">商品数据这次没能读出来。这是临时故障，不代表商品不存在或已下架；请稍后重试。</p>
      <p><a href="/">回到 EAXAU 首页</a></p>
${contactHtml()}`);
  return insertBody(replaceHead(indexHtml, title, description, head), body);
}
