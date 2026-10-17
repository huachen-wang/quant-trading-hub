import { SEO_CONTACTS, SITE_ORIGIN, escapeHtml, insertBody, renderHeadTagsHtml, replaceHead, wrap } from "./seo-render";
import {
  CONTENT_PAGES,
  contentBlocks,
  contentH1,
  otherLanguage,
  type ContentBlock,
  type ContentLang,
  type ContentPage,
  type InlineNode,
} from "../../shared/content-pages";
import { contentJsonLd, contentPageHeadTags } from "../../shared/seo-head";

/* 结构化数据与头部标签的生成搬到 shared/seo-head.ts（前端 <Head> 用同一份，2026-10-18 R3 ⑦）。 */
export { contentJsonLd };

/**
 * 中英双语内容页（合作页、需求与验收指南）的初始 HTML（2026-10-18）。
 *
 * 和商品页、栏目页同一套做法（见 ./seo-render.ts）：正文块放在 #root 之外的 #eaxau-seo，
 * 应用挂载后由 bootstrap 脚本移除；所有 User-Agent 拿到同一份字节。
 * 额外做三件事：
 * 1. <html lang> 按本页语言写（Expo 导出的模板写死 lang="en"）；
 * 2. 自指 canonical + 中英 hreflang；
 * 3. 启动兜底和无 JS 兜底原本写的是「商品列表这次没能加载出来」——那是商城首页的话，
 *    在这些页面换成本页的说法；无 JS 时直接露出正文，不再先占满一屏联系卡。
 */

function linkHtml(text: string, href: string): string {
  const external = /^https?:\/\//i.test(href);
  return `<a href="${escapeHtml(href)}"${external ? ' rel="noopener noreferrer"' : ""}>${escapeHtml(text)}</a>`;
}

export function inlineHtml(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === "text") return escapeHtml(node.text);
      if (node.kind === "strong") return `<strong>${escapeHtml(node.text)}</strong>`;
      if (node.kind === "link") return linkHtml(node.text, node.href);
      return "<br />";
    })
    .join("");
}

export function blocksHtml(blocks: ContentBlock[]): string {
  const indent = "        ";
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${indent}<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
        case "paragraph":
          return `${indent}<p>${inlineHtml(block.inlines)}</p>`;
        case "cta":
          return `${indent}<p class="eaxau-seo__cta">${block.links.map((link) => linkHtml(link.text, link.href)).join(" · ")}</p>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          return `${indent}<${tag}>\n${block.items
            .map((item) => `${indent}  <li>${inlineHtml(item)}</li>`)
            .join("\n")}\n${indent}</${tag}>`;
        }
        case "table": {
          const columns = block.header.length;
          const head = block.header.map((cell) => `<th scope="col">${inlineHtml(cell)}</th>`).join("");
          const body = block.rows
            .map((row) => `${indent}      <tr>${row.map((cell) => `<td>${inlineHtml(cell)}</td>`).join("")}</tr>`)
            .join("\n");
          return `${indent}<div class="eaxau-seo__table eaxau-seo__table--${columns}">\n${indent}  <table>\n${indent}    <thead><tr>${head}</tr></thead>\n${indent}    <tbody>\n${body}\n${indent}    </tbody>\n${indent}  </table>\n${indent}</div>`;
        }
        case "quote":
          return `${indent}<blockquote class="eaxau-seo__template"><p>${block.lines.map(inlineHtml).join("<br />\n")}</p></blockquote>`;
      }
    })
    .join("\n");
}

const CONTACT_LABELS: Record<ContentLang, Record<string, string>> = {
  "zh-CN": {
    heading: "交流群与客服",
    tgGroup: "Telegram 交流群",
    qqGroup: "QQ 群",
    qq: "客服 QQ",
    wechat: "微信",
    telegram: "Telegram 客服",
  },
  en: {
    heading: "Groups and support",
    tgGroup: "Telegram group",
    qqGroup: "QQ group",
    qq: "Support QQ",
    wechat: "WeChat",
    telegram: "Telegram support",
  },
};

function contactsHtml(lang: ContentLang): string {
  const l = CONTACT_LABELS[lang];
  const sep = lang === "en" ? ": " : "：";
  const qqGroup = SEO_CONTACTS.qqGroupLink
    ? linkHtml(SEO_CONTACTS.qqGroup, SEO_CONTACTS.qqGroupLink)
    : escapeHtml(SEO_CONTACTS.qqGroup);
  return `      <h2>${l.heading}</h2>
      <ul class="eaxau-seo__contacts">
        <li>${l.tgGroup}${sep}${linkHtml(SEO_CONTACTS.telegramGroupLink, SEO_CONTACTS.telegramGroupLink)}</li>
        <li>${l.qqGroup}${sep}${qqGroup}</li>
        <li>${l.qq}${sep}${escapeHtml(SEO_CONTACTS.qq)}</li>
        <li>${l.wechat}${sep}${escapeHtml(SEO_CONTACTS.wechat)}</li>
        <li>${l.telegram}${sep}${linkHtml(SEO_CONTACTS.telegram, SEO_CONTACTS.telegramLink)}</li>
      </ul>`;
}

/** 把 <html> 的 lang 改成本页语言（没有就加上）。 */
export function setHtmlLang(html: string, lang: string): string {
  return html.replace(/<html(\s[^>]*)?>/i, (_tag, attrs: string | undefined) => {
    const rest = (attrs ?? "").replace(/\slang=("[^"]*"|'[^']*'|[^\s>]*)/i, "");
    return `<html lang="${lang}"${rest}>`;
  });
}

const FALLBACK_COPY: Record<ContentLang, { blurb: string; note: string; status: string }> = {
  "zh-CN": {
    blurb: "页面脚本没能加载完成，可以刷新重试；也可以直接用下面任一方式联系。",
    note: "咨询时可附上产品链接或需求说明。",
    status: "正在连接",
  },
  en: {
    blurb: "The page script did not finish loading. Refresh to try again, or contact us using any option below.",
    note: "Include a product link or a short brief when you ask.",
    status: "Loading",
  },
};

const EN_FALLBACK_LABELS: Record<string, string> = {
  "Telegram 交流群": "Telegram group",
  "QQ 群": "QQ group",
  "客服 QQ": "Support QQ",
  微信: "WeChat",
  "Telegram 客服": "Telegram support",
  交流群: "Groups",
  客服: "Support",
};

/** 无 JS：隐藏启动遮罩和空的应用容器，正文（含联系方式）直接可读。 */
const CONTENT_NOSCRIPT = `<noscript data-eaxau-bootstrap="v1">
    <style>#eaxau-boot { display: none !important; } #root { display: none !important; } body { overflow: auto !important; }</style>
  </noscript>`;

/**
 * 启动兜底（脚本 14 秒还没挂载时显示）与无 JS 兜底：只改文字，不改加载逻辑。
 * 原文是商城首页的「商品列表这次没能加载出来」，在内容页会被读者和爬虫当成本页内容。
 */
export function localizeBootFallback(html: string, page: ContentPage): string {
  const copy = FALLBACK_COPY[page.lang];
  const name = page.breadcrumb[page.breadcrumb.length - 1]?.label ?? contentH1(page);
  let out = html
    .replace(/<p class="eaxau-fallback__title">[^<]*<\/p>/g, `<p class="eaxau-fallback__title">EAXAU · ${escapeHtml(name)}</p>`)
    .replace(/<p class="eaxau-fallback__blurb">[^<]*<\/p>/g, `<p class="eaxau-fallback__blurb">${escapeHtml(copy.blurb)}</p>`)
    .replace(/<p class="eaxau-fallback__note">[^<]*<\/p>/g, `<p class="eaxau-fallback__note">${escapeHtml(copy.note)}</p>`)
    .replace(/<noscript data-eaxau-bootstrap="v1">[\s\S]*?<\/noscript>/, CONTENT_NOSCRIPT);
  if (page.lang === "en") {
    out = out
      .replace(/(<span class="eaxau-fallback__label">)([^<]*)(<\/span>)/g, (m, a, label, b) =>
        EN_FALLBACK_LABELS[label] ? `${a}${EN_FALLBACK_LABELS[label]}${b}` : m,
      )
      .replace(/(<p class="eaxau-fallback__group">)([^<]*)(<\/p>)/g, (m, a, label, b) =>
        EN_FALLBACK_LABELS[label] ? `${a}${EN_FALLBACK_LABELS[label]}${b}` : m,
      )
      .replace(/<div class="eaxau-boot__status">[^<]*<\/div>/, `<div class="eaxau-boot__status">${copy.status}</div>`);
  }
  return out;
}

/** 表格在窄屏横向滚动（不截掉任何一列），模板块与按钮行的样式。只作用于 #eaxau-seo。 */
const CONTENT_STYLE = `<style data-eaxau-content="v1">
      .eaxau-seo__lang { margin: 0 0 12px; font-size: 13px; }
      .eaxau-seo__cta a { font-weight: 700; }
      .eaxau-seo__table { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 8px 0 16px; }
      .eaxau-seo table { border-collapse: collapse; width: 100%; font-size: 14px; }
      .eaxau-seo__table--3 table { min-width: 600px; }
      .eaxau-seo th, .eaxau-seo td { border: 1px solid rgba(148, 163, 184, 0.35); padding: 8px 10px; text-align: left; vertical-align: top; }
      .eaxau-seo th { color: #d8bc83; background: rgba(216, 188, 131, 0.06); }
      .eaxau-seo blockquote { margin: 12px 0; padding: 12px 16px; border-left: 3px solid #d8bc83; background: rgba(216, 188, 131, 0.06); }
      .eaxau-seo blockquote p { margin: 0; }
    </style>`;

export function renderContentPageHtml(indexHtml: string, page: ContentPage): string {
  const other = otherLanguage(page);
  const head = `${renderHeadTagsHtml(contentPageHeadTags(page))}
    ${CONTENT_STYLE}`;

  const crumbs = page.breadcrumb
    .map((crumb) => (crumb.href ? linkHtml(crumb.label, crumb.href) : escapeHtml(crumb.label)))
    .join(" › ");

  const body = wrap(`      <nav class="eaxau-seo__crumb">${crumbs}</nav>
      <p class="eaxau-seo__lang"><a href="${other.path}" hreflang="${other.lang}" lang="${other.lang}">${other.label}</a></p>
      <article>
${blocksHtml(contentBlocks(page))}
      </article>
${contactsHtml(page.lang)}`);

  const withHead = replaceHead(setHtmlLang(indexHtml, page.lang), page.title, page.description, head);
  return insertBody(localizeBootFallback(withHead, page), body);
}

/** sitemap 里内容页的条目：真实更新日期 + 中英 hreflang（xhtml:link）。 */
export function contentSitemapEntries(): string {
  return CONTENT_PAGES.map((page) => {
    const links = [
      ...(Object.entries(page.alternates) as [ContentLang, string][]).map(
        ([lang, path]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE_ORIGIN}${path}" />`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${page.alternates["zh-CN"]}" />`,
    ].join("\n");
    return `
  <url>
    <loc>${SITE_ORIGIN}${page.path}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
${links}
  </url>`;
  }).join("");
}
