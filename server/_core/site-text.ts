import { SITE_ORIGIN, platformShort, pricing, type ListLookup } from "./seo-render";
import {
  QQ_GROUP_JOIN_URL,
  QQ_GROUP_NUMBER,
  SUPPORT_QQ,
  SUPPORT_TELEGRAM_HANDLE,
  SUPPORT_TELEGRAM_URL,
  SUPPORT_WECHAT,
  TELEGRAM_GROUP_URL,
} from "../../shared/community-contacts";

/** robots.txt 里 `*` 组的禁止规则；AI 爬虫各组用同一份，后台照样不让爬。 */
export const ROBOTS_DISALLOW: readonly string[] = ["/admin", "/api/", "/oauth/"];

/** 2026-10-15 六站 GEO 那一批 AI 爬虫，每个单独写一组。 */
export const AI_CRAWLERS: readonly string[] = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

function robotsGroup(agent: string): string {
  return [`User-agent: ${agent}`, "Allow: /", ...ROBOTS_DISALLOW.map((rule) => `Disallow: ${rule}`)].join("\n");
}

export function renderRobotsTxt(): string {
  return (
    [robotsGroup("*"), ...AI_CRAWLERS.map(robotsGroup), `Sitemap: ${SITE_ORIGIN}/sitemap.xml`].join("\n\n") +
    "\n"
  );
}

const MAIN_PAGES: Array<{ path: string; title: string; description: string }> = [
  {
    path: "/",
    title: "EA 商城首页 / EA marketplace",
    description:
      "MT4 / MT5 的 EA、指标与交易工具目录；商品页区分直接购买与咨询授权。 Catalogue of MT4 / MT5 EAs, indicators and trading tools; product pages separate direct purchase from licensing enquiries.",
  },
  {
    path: "/market",
    title: "策略广场 / Strategy catalogue",
    description: "按平台、热度、最新筛选全部商品。 Browse all products by platform, popularity or recency.",
  },
  {
    path: "/group-buy",
    title: "合购撮合台 / Group buys",
    description: "发起或参与同一款 EA 的合购。 Start or join a group purchase of the same EA.",
  },
  {
    path: "/subscribe",
    title: "订阅 / Subscribe",
    description: "订阅新策略上架通知、EA 试用材料与部署指导。 Subscribe to new-listing notices, EA trial materials and setup guidance.",
  },
  {
    path: "/cooperation",
    title: "工作室合作与授权 / Studio cooperation",
    description:
      "核对 EA 来源与许可，明确成品、源码及定制项目的交付物、使用范围、验收和支持；正式合作以可核验的授权依据、书面范围和签署文件为准。 Confirm the source and licence, and define deliverables, permitted use, acceptance and support for compiled, source-code or custom work.",
  },
  {
    path: "/en/cooperation",
    title: "Studio cooperation (English)",
    description:
      "English version of the studio cooperation page: licensing scope, source-code and custom delivery, written quote and acceptance.",
  },
  {
    path: "/guides/ea-requirements-and-acceptance",
    title: "EA 需求与验收指南 / EA requirements and acceptance guide",
    description:
      "可复制的需求模板、示例表与交付清单；示例只是写法示范，不是已交付项目或报价。 A copyable brief template, an illustrative example and a delivery checklist; the example is not a delivered project or a quote.",
  },
  {
    path: "/en/guides/ea-requirements-and-acceptance",
    title: "EA requirements and acceptance guide (English)",
    description:
      "English version of the guide: environment, features, rights, deliverables and acceptance checks for EA development or source licensing.",
  },
  {
    path: "/faq",
    title: "常见问题 / FAQ",
    description:
      "商品页写明哪些信息、第一次买 EA 先核对什么、MT4 与 MT5 能否通用、成品是否含源码、交付什么、怎么验收、怎么联系客服。 What product pages state, what to check before buying an EA, MT4 vs MT5, source code, deliverables, acceptance and support contacts.",
  },
  {
    path: "/en/faq",
    title: "FAQ (English)",
    description: "English version of the FAQ page.",
  },
  {
    path: "/promo",
    title: "限时促销 / Promotions",
    description: "当前促销商品，联系客服确认后购买。 Current promotions; contact support to confirm before buying.",
  },
];

/**
 * 咨询到交付的四步与交付说明（2026-10-18，Part B：收件/gpt/shared/GPT-14/eaxau/llms.txt 草稿里能逐句对上站内原文的部分）。
 * 中文四步逐字取自合作页（shared/content-pages/cooperation.ts），英文取自英文合作页；交付说明取自商品页预渲染
 * （server/_core/seo-render.ts 的「交付与支持」）。tests/part-b-merge.test.ts 核对它们和原文一致。
 * 草稿里的价格口径、退款、权属核验结论没有收（待站主确认）。
 */
export const LLMS_PROCESS_STEPS: ReadonlyArray<{ zh: string; en: string }> = [
  {
    zh: "说明需求。提供产品链接或简短说明，写明平台、用途和希望得到的交付物。",
    en: "Describe the requirement. Share a product link or short brief, the platform, intended use and desired deliverables.",
  },
  {
    zh: "核对来源与可行性。确认授权方、已有材料、技术环境及缺少的信息。",
    en: "Check rights and feasibility. Establish the licensing party, available materials, technical environment and missing information.",
  },
  {
    zh: "确认书面报价。把范围、费用、付款安排、验收和支持写清楚，再启动约定工作。",
    en: "Agree a written quote. Specify scope, fees, payment arrangements, acceptance and support before starting the agreed work.",
  },
  {
    zh: "按清单交付与验收。核对文件、功能和许可范围，记录需要修订的事项及处理结果。",
    en: "Deliver and review against the list. Check files, functionality and licensing scope; record revisions and their resolution.",
  },
];

export const LLMS_DELIVERY_NOTE = {
  zh: "下单或授权确认后提供安装包与授权信息，并按版本提供安装、参数说明与后续更新支持。具体版本、参数、适用环境与授权范围以顾问确认为准。",
  en: "Once an order or license is confirmed, EAXAU provides the installation package and license information, with installation, parameter notes and update support according to the version. The exact version, parameters, environment and license scope are as confirmed by the adviser.",
};

/**
 * /llms.txt：写给 AI 看的站点概述（格式参照 niubang.ai/llms.txt）。
 * 只写定位、主要页面、联系方式和风险声明；商品清单与首页预渲染同源（只读、只取已发布），
 * 读不到就整段省略，不编造、不拿旧缓存充数。不写收益、回撤、胜率数字。
 */
export function renderLlmsTxt(lookup: ListLookup): string {
  const qqGroup = QQ_GROUP_JOIN_URL ? `[${QQ_GROUP_NUMBER}](${QQ_GROUP_JOIN_URL})` : QQ_GROUP_NUMBER;
  const lines: string[] = [
    "# EAXAU（AI量化联盟）",
    "",
    "> EAXAU（eaxau.com，AI量化联盟）是 MT4 / MT5 EA、指标与量化交易工具商城。每个商品页写明运行平台、交易品种、常用周期、运行依赖与授权交付方式；价格与授权范围按订单确认。 EAXAU (eaxau.com) is a marketplace for MT4 / MT5 Expert Advisors (EAs), indicators and trading tools. Each product page states the platform, symbols, timeframe, runtime requirements and licensing/delivery terms; price and licence scope are confirmed per order.",
    "",
    "外汇、贵金属等杠杆交易有风险，EA 和策略的历史表现不代表未来收益。 Leveraged trading in forex and metals involves risk, and the past performance of an EA or strategy does not guarantee future results.",
    "",
    "## 联系方式 / Contact",
    "",
    "交流群 / Community groups:",
    `- [Telegram 交流群 / Telegram group](${TELEGRAM_GROUP_URL})`,
    `- QQ 群 / QQ group: ${qqGroup}`,
    "",
    "客服 / Customer support:",
    `- 客服 QQ / Support QQ: ${SUPPORT_QQ}`,
    `- 微信 / WeChat: ${SUPPORT_WECHAT}`,
    `- [Telegram 客服 ${SUPPORT_TELEGRAM_HANDLE} / Telegram support](${SUPPORT_TELEGRAM_URL})`,
    "",
    "咨询时请附上商品名称或商品页地址。 Please include the product name or page URL when you ask.",
    "",
    "## 咨询到交付 / From enquiry to delivery",
    "",
    ...LLMS_PROCESS_STEPS.map((step, index) => `${index + 1}. ${step.zh} ${step.en}`),
    "",
    `${LLMS_DELIVERY_NOTE.zh} ${LLMS_DELIVERY_NOTE.en}`,
    "",
    "## 主要页面 / Main pages",
    "",
    ...MAIN_PAGES.map((page) => `- [${page.title}](${SITE_ORIGIN}${page.path}): ${page.description}`),
  ];

  if (lookup.kind === "ok" && lookup.strategies.length > 0) {
    lines.push("", "## 在售商品 / Products", "");
    for (const s of lookup.strategies) {
      const meta = [platformShort(s.platform), s.pairs ? String(s.pairs) : "", s.timeframe ? String(s.timeframe) : "", pricing(s).label]
        .filter(Boolean)
        .join(" · ");
      lines.push(`- [${s.title.replace(/[\[\]]/g, "")}](${SITE_ORIGIN}/strategy/${s.id}): ${meta}`);
    }
  }

  return lines.join("\n") + "\n";
}
