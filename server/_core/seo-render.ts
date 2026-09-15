import { safeJsonLd } from "./seo-json";

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

export const SITE_ORIGIN = "https://www.eaxau.com";
export const SEO_BLOCK_ID = "eaxau-seo";

/** 与 components/contact-modal.tsx / scripts/inject-web-bootstrap.js 同一批现有联系方式，不新增渠道。 */
export const SEO_CONTACTS = {
  telegram: "@xau6000",
  telegramLink: "https://t.me/xau6000",
  wechat: "oooiniooo0624 / xau6000",
  qq: "1226426670 / 3832001817",
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

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 富文本只用于取纯文本摘要，绝不把未经清洗的 HTML 放进初始正文。 */
export function plainText(value: unknown, limit = 320): string {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
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

export function platformShort(platform?: string | null): string {
  const value = String(platform ?? "").trim().toUpperCase();
  return value === "MT4" || value === "MT5" ? value : "平台未提供";
}

/**
 * 旧种子目录（server/user-strategy-catalog.ts）把「联系我们了解详情」之类的占位文案写进了
 * description。占位不是产品事实，不能当摘要或结构化数据的 description 用。
 */
const PLACEHOLDER_DESCRIPTIONS = [
  "联系我们了解详情",
  "待补充",
  "暂无描述",
  "暂无介绍",
  "待校准",
];

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

/** 只有 direct + 正价才算可直接购买；其余一律「联系咨询授权」，不写 0 元。
 *  库里没有库存字段，所以任何情况下都不断言 availability。 */
export function pricing(strategy: SeoStrategy): { label: string; directPrice: number | null } {
  const raw = strategy.price;
  const value = raw === null || raw === undefined ? NaN : Number(raw);
  const direct = strategy.saleMode === "direct" && Number.isFinite(value) && value > 0;
  if (direct) return { label: `直接购买 ¥${value.toFixed(2)} CNY`, directPrice: value };
  return { label: "联系咨询授权（价格与授权范围按订单确认）", directPrice: null };
}

function absolute(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return SITE_ORIGIN + (url.startsWith("/") ? url : "/" + url);
}

function contactHtml(): string {
  return `      <h2>交付与支持</h2>
      <p>下单或授权确认后提供安装包与授权信息，并按版本提供安装、参数说明与后续更新支持。具体版本、参数、适用环境与授权范围以顾问确认为准。</p>
      <ul class="eaxau-seo__contacts">
        <li>Telegram：<a href="${SEO_CONTACTS.telegramLink}" rel="noopener noreferrer">${escapeHtml(SEO_CONTACTS.telegram)}</a></li>
        <li>WeChat：${escapeHtml(SEO_CONTACTS.wechat)}</li>
        <li>QQ：${escapeHtml(SEO_CONTACTS.qq)}</li>
      </ul>
      <p class="eaxau-seo__note">咨询时请附上商品名称或商品页地址。本页不展示收益、回撤或胜率数字；历史数据不代表未来结果。</p>`;
}

function wrap(inner: string): string {
  return `\n  <div id="${SEO_BLOCK_ID}" class="eaxau-seo">\n    <main class="eaxau-seo__main">\n${inner}\n    </main>\n  </div>\n`;
}

function replaceHead(indexHtml: string, title: string, description: string, extra: string): string {
  let html = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  if (/<meta name="description" content="[^"]*"\s*\/?>/.test(html)) {
    html = html.replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    );
  } else {
    html = html.replace("</head>", `<meta name="description" content="${escapeHtml(description)}" />\n</head>`);
  }
  return html.replace("</head>", `${extra}\n</head>`);
}

function insertBody(indexHtml: string, block: string): string {
  if (indexHtml.includes("</body>")) return indexHtml.replace("</body>", `${block}</body>`);
  return indexHtml + block;
}

/** 商品详情页：真实字段 + 自指 canonical + 与可见内容一致的结构化数据。 */
export function renderStrategyHtml(indexHtml: string, strategy: SeoStrategy): string {
  const url = `${SITE_ORIGIN}/strategy/${strategy.id}`;
  const version = versionFromTitle(strategy.title);
  const platformText = platformLabel(strategy.platform);
  const platformKnown = platformText !== "未提供";

  /* 占位描述（如「联系我们了解详情」）不是产品事实：不当摘要、也不写进结构化数据。 */
  const rawSummary = plainText(strategy.description) || plainText(strategy.richDescription);
  const hasRealSummary = !!rawSummary && !isPlaceholderDescription(rawSummary);
  const fallbackSummary = platformKnown
    ? `${strategy.title}：${platformShort(strategy.platform)} ${productTypeLabel(strategy.productType)}的商品资料、运行环境与授权交付说明。`
    : `${strategy.title}：${productTypeLabel(strategy.productType)}的商品资料与授权交付说明；运行平台待确认。`;
  const summary = hasRealSummary ? rawSummary : fallbackSummary;
  const title = `${strategy.title} - ${productTypeLabel(strategy.productType)} | EAXAU`;
  const description = plainText(summary, 160);
  const price = pricing(strategy);
  const image = absolute(strategy.coverImage);

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

  const head = `    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index,follow" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />${image ? `\n    <meta property="og:image" content="${escapeHtml(image)}" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <script type="application/ld+json">${safeJsonLd(productLd)}</script>`;

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
  const title = "EAXAU · MT4 / MT5 EA、指标与量化交易工具商城";
  const description =
    "EAXAU（AI量化联盟）提供 MT4 / MT5 的 EA 自动交易程序、指标与量化交易工具。每个商品页写明运行平台、交易品种、常用周期、运行依赖与授权交付方式；价格与授权范围按订单确认。";
  const url = `${SITE_ORIGIN}/`;

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

  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "EAXAU",
    alternateName: "AI量化联盟",
    url,
    description,
  };

  const head = `    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index,follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <script type="application/ld+json">${safeJsonLd(siteLd)}</script>${
      itemLd ? `\n    <script type="application/ld+json">${safeJsonLd(itemLd)}</script>` : ""
    }`;

  const listHtml =
    lookup.kind === "unavailable"
      ? `      <p class="eaxau-seo__note">商品清单这次没能读出来。这是临时故障，不代表商品下架；请稍后重试或直接联系顾问。</p>`
      : list.length === 0
        ? `      <p class="eaxau-seo__note">当前没有已发布的商品记录。</p>`
        : `      <ul class="eaxau-seo__list">
${list
  .map(
    (s) =>
      `        <li><a href="/strategy/${s.id}">${escapeHtml(s.title)}</a> · ${escapeHtml(platformShort(s.platform))}${
        s.pairs ? " · " + escapeHtml(String(s.pairs)) : ""
      }${s.timeframe ? " · " + escapeHtml(String(s.timeframe)) : ""} · ${escapeHtml(pricing(s).label)}</li>`,
  )
  .join("\n")}
      </ul>`;

  const body = wrap(`      <h1>EAXAU · MT4 / MT5 EA、指标与量化交易工具</h1>
      <p class="eaxau-seo__lead">${escapeHtml(description)}</p>
      <h2>在售商品</h2>
${listHtml}
${contactHtml()}`);

  return insertBody(replaceHead(indexHtml, title, description, head), body);
}

/** 不存在的地址：真 404 正文，noindex,follow，不做全站静态快照。 */
export function renderNotFoundHtml(indexHtml: string, pathname: string): string {
  const title = "页面不存在 - EAXAU";
  const description = "这个地址在 EAXAU 上没有对应内容。";
  const head = `    <meta name="robots" content="noindex,follow" />`;
  const body = wrap(`      <h1>页面不存在</h1>
      <p class="eaxau-seo__lead">地址 <code>${escapeHtml(pathname)}</code> 没有对应的商品或页面。它可能从未存在，或者已经下架。</p>
      <p><a href="/">回到 EAXAU 首页查看在售商品</a></p>`);
  return insertBody(replaceHead(indexHtml, title, description, head), body);
}

/** 数据源暂时读不到：503，不是 404，也不展示任何可能过期的数据。 */
export function renderUnavailableHtml(indexHtml: string): string {
  const title = "内容暂时无法读取 - EAXAU";
  const description = "商品数据暂时读取失败，请稍后重试。";
  const head = `    <meta name="robots" content="noindex,follow" />`;
  const body = wrap(`      <h1>内容暂时无法读取</h1>
      <p class="eaxau-seo__lead">商品数据这次没能读出来。这是临时故障，不代表商品不存在或已下架；请稍后重试。</p>
      <p><a href="/">回到 EAXAU 首页</a></p>
${contactHtml()}`);
  return insertBody(replaceHead(indexHtml, title, description, head), body);
}
