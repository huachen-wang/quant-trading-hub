import { COOPERATION_EN_MARKDOWN, COOPERATION_ZH_MARKDOWN } from "./cooperation";
import { GUIDE_EN_MARKDOWN, GUIDE_ZH_MARKDOWN } from "./ea-requirements-guide";
import { FAQ_EN_MARKDOWN, FAQ_ZH_MARKDOWN } from "./faq";
import { inlineText, parseContentMarkdown, type ContentBlock } from "./markdown";
import { COOPERATION_EN_PATH, COOPERATION_ZH_PATH, FAQ_EN_PATH, FAQ_ZH_PATH, GUIDE_EN_PATH, GUIDE_ZH_PATH } from "./paths";

export * from "./paths";
export type { ContentBlock, ContentLink, InlineNode } from "./markdown";
export { inlineText, parseContentMarkdown } from "./markdown";

/**
 * 中英双语内容页（2026-10-18：C03 合作页、C04 需求与验收指南；同日晚：常见问题）。
 *
 * 一处定义，三处使用：
 * - 前端页面（app/cooperation.tsx、app/en/…、app/guides/…）渲染可见正文；
 * - 服务端预渲染（server/_core/seo-content-pages.ts）把同一份正文写进原始 HTML；
 * - sitemap 和 hreflang 用这里的地址与语言对应关系。
 * 正文只写稿件 PUBLIC 区块里的内容，不写收益、胜率、价格或按哈希生成的展示数字。
 */

export type ContentLang = "zh-CN" | "en";

export type ContentPage = {
  path: string;
  lang: ContentLang;
  title: string;
  description: string;
  /** 结构化数据类型：合作页是普通网页，指南是说明文章，常见问题是 FAQPage（只含页面上看得到的问答）。
   *  都不写 Product / 价格 / 评价。 */
  schemaType: "WebPage" | "Article" | "FAQPage";
  /** 正文真实更新日期（YYYY-MM-DD），sitemap 的 lastmod 用它，不随每次请求变化。 */
  lastmod: string;
  /** 同一篇内容在各语言下的地址，用于 hreflang 与页面上的语言切换。 */
  alternates: Record<ContentLang, string>;
  /** 面包屑：最后一项是本页（不带链接）。 */
  breadcrumb: { label: string; href?: string }[];
  markdown: string;
};

const COOPERATION_ALTERNATES: Record<ContentLang, string> = {
  "zh-CN": COOPERATION_ZH_PATH,
  en: COOPERATION_EN_PATH,
};

const GUIDE_ALTERNATES: Record<ContentLang, string> = {
  "zh-CN": GUIDE_ZH_PATH,
  en: GUIDE_EN_PATH,
};

const FAQ_ALTERNATES: Record<ContentLang, string> = {
  "zh-CN": FAQ_ZH_PATH,
  en: FAQ_EN_PATH,
};

const PAGES: ContentPage[] = [
  {
    path: COOPERATION_ZH_PATH,
    lang: "zh-CN",
    title: "EA 工作室合作｜授权范围、源码与定制交付｜EAXAU",
    description:
      "EAXAU 工作室合作与授权：核对 EA 来源与许可，明确成品、源码及定制项目的交付物、使用范围、验收和支持。带产品链接或需求说明咨询。",
    schemaType: "WebPage",
    lastmod: "2026-10-18",
    alternates: COOPERATION_ALTERNATES,
    breadcrumb: [{ label: "EAXAU 首页", href: "/" }, { label: "工作室合作与授权" }],
    markdown: COOPERATION_ZH_MARKDOWN,
  },
  {
    path: COOPERATION_EN_PATH,
    lang: "en",
    title: "EA Studio Cooperation | Licensing, Source Code & Delivery | EAXAU",
    description:
      "Discuss EA studio cooperation with EAXAU. Define licensing rights, compiled or source-code deliverables, custom development, acceptance criteria and support before agreeing a quote.",
    schemaType: "WebPage",
    lastmod: "2026-10-18",
    alternates: COOPERATION_ALTERNATES,
    breadcrumb: [{ label: "EAXAU home", href: "/" }, { label: "Studio cooperation" }],
    markdown: COOPERATION_EN_MARKDOWN,
  },
  {
    path: GUIDE_ZH_PATH,
    lang: "zh-CN",
    title: "EA 定制与源码授权需求怎么写｜交付验收清单｜EAXAU",
    description:
      "用可复制的清单说明 EA 定制或源码授权需求：运行环境、功能样例、使用权、交付文件、验收和修改范围。附明确标注的示例，便于核对报价。",
    schemaType: "Article",
    lastmod: "2026-10-18",
    alternates: GUIDE_ALTERNATES,
    breadcrumb: [
      { label: "EAXAU 首页", href: "/" },
      { label: "工作室合作与授权", href: COOPERATION_ZH_PATH },
      { label: "需求与验收指南" },
    ],
    markdown: GUIDE_ZH_MARKDOWN,
  },
  {
    path: GUIDE_EN_PATH,
    lang: "en",
    title: "EA Development & Source Licensing | Requirements Checklist | EAXAU",
    description:
      "Prepare an EA development or source-code licensing brief. Define environment, features, rights, deliverables and acceptance checks, with a clearly labelled example.",
    schemaType: "Article",
    lastmod: "2026-10-18",
    alternates: GUIDE_ALTERNATES,
    breadcrumb: [
      { label: "EAXAU home", href: "/" },
      { label: "Studio cooperation", href: COOPERATION_EN_PATH },
      { label: "Requirements and acceptance guide" },
    ],
    markdown: GUIDE_EN_MARKDOWN,
  },
  {
    path: FAQ_ZH_PATH,
    lang: "zh-CN",
    title: "常见问题｜EA 选购、源码授权、交付与验收｜EAXAU",
    description:
      "EAXAU 常见问题：商品页写明哪些信息、第一次买 EA 先核对什么、MT4 与 MT5 能否通用、成品是否含源码、交付什么、怎么验收、怎么联系客服。",
    schemaType: "FAQPage",
    lastmod: "2026-10-18",
    alternates: FAQ_ALTERNATES,
    breadcrumb: [{ label: "EAXAU 首页", href: "/" }, { label: "常见问题" }],
    markdown: FAQ_ZH_MARKDOWN,
  },
  {
    path: FAQ_EN_PATH,
    lang: "en",
    title: "FAQ | EA Licensing, Source Code, Delivery & Acceptance | EAXAU",
    description:
      "Answers to common EAXAU questions: what product pages state, what to check before buying an EA, MT4 vs MT5, source code, deliverables, acceptance and how to contact support.",
    schemaType: "FAQPage",
    lastmod: "2026-10-18",
    alternates: FAQ_ALTERNATES,
    breadcrumb: [{ label: "EAXAU home", href: "/" }, { label: "FAQ" }],
    markdown: FAQ_EN_MARKDOWN,
  },
];

export const CONTENT_PAGES: readonly ContentPage[] = PAGES;

const BY_PATH = new Map(PAGES.map((page) => [page.path, page]));

/** 按地址取内容页；末尾斜杠忽略，大小写敏感（与 Expo Router 的文件名一致）。 */
export function findContentPage(pathname: string): ContentPage | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return BY_PATH.get(path) ?? null;
}

export function requireContentPage(path: string): ContentPage {
  const page = findContentPage(path);
  if (!page) throw new Error(`没有这个内容页：${path}`);
  return page;
}

const BLOCK_CACHE = new Map<string, ContentBlock[]>();

export function contentBlocks(page: ContentPage): ContentBlock[] {
  let blocks = BLOCK_CACHE.get(page.path);
  if (!blocks) {
    blocks = parseContentMarkdown(page.markdown);
    BLOCK_CACHE.set(page.path, blocks);
  }
  return blocks;
}

/** 页面 H1（正文第一行 `# `）。 */
export function contentH1(page: ContentPage): string {
  const first = contentBlocks(page).find((block) => block.type === "heading" && block.level === 1);
  if (!first || first.type !== "heading") throw new Error(`内容页缺 H1：${page.path}`);
  return first.text;
}

/** 首屏（H1 到第一个 H2 之前）与正文（第一个 H2 起）。合作页首屏套原有的深色横幅。 */
export function splitHero(blocks: ContentBlock[]): { hero: ContentBlock[]; body: ContentBlock[] } {
  const index = blocks.findIndex((block) => block.type === "heading" && block.level === 2);
  if (index === -1) return { hero: blocks, body: [] };
  return { hero: blocks.slice(0, index), body: blocks.slice(index) };
}

/** 另一种语言的版本（语言切换链接用）。 */
export function otherLanguage(page: ContentPage): { lang: ContentLang; path: string; label: string } {
  const lang: ContentLang = page.lang === "en" ? "zh-CN" : "en";
  return { lang, path: page.alternates[lang], label: lang === "en" ? "English" : "中文" };
}

/**
 * 常见问题页的问答（FAQPage 结构化数据用）：每个 H2 是一个问题，到下一个标题之前的段落 / 列表是答案。
 * 答案取页面上同一份正文的纯文本（链接只留文字），保证结构化数据只含页面上看得到的内容。
 */
export function faqEntries(page: ContentPage): { question: string; answer: string }[] {
  if (page.schemaType !== "FAQPage") return [];
  const entries: { question: string; answer: string }[] = [];
  let current: { question: string; parts: string[] } | null = null;
  const flush = () => {
    if (current && current.parts.length > 0) entries.push({ question: current.question, answer: current.parts.join("\n") });
  };
  for (const block of contentBlocks(page)) {
    if (block.type === "heading") {
      flush();
      current = block.level === 2 ? { question: block.text, parts: [] } : null;
      continue;
    }
    if (!current) continue;
    if (block.type === "paragraph") current.parts.push(inlineText(block.inlines));
    else if (block.type === "list") current.parts.push(...block.items.map((item) => inlineText(item)));
    else if (block.type === "cta") current.parts.push(block.links.map((link) => link.text).join(" · "));
  }
  flush();
  return entries;
}
