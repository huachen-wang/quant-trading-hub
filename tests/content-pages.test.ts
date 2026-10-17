import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  CONTENT_PAGES,
  COOPERATION_EN_PATH,
  COOPERATION_ZH_PATH,
  GUIDE_EN_PATH,
  GUIDE_ZH_PATH,
  contentBlocks,
  contentH1,
  findContentPage,
  inlineText,
  parseContentMarkdown,
  type ContentBlock,
  type InlineNode,
} from "../shared/content-pages";
import { SECTION_PAGE_META } from "../shared/seo-meta";
import { SUPPORT_TELEGRAM_URL } from "../shared/community-contacts";
import {
  blocksHtml,
  contentSitemapEntries,
  inlineHtml,
  renderContentPageHtml,
  setHtmlLang,
} from "../server/_core/seo-content-pages";
import { escapeHtml } from "../server/_core/seo-render";
import { isKnownSpaRoute } from "../server/_core/spa-routes";

/**
 * 2026-10-18 C03 / C04：合作页与需求验收指南（中英各一份）。
 * 正文来源、链接、预渲染、hreflang、sitemap 和启动兜底文案。
 */

const repoRoot = resolve(__dirname, "..");

/** 用真实的 inject-web-bootstrap.js 产出的模板：Expo 导出写死 lang="en"，并带商城首页的兜底文案。 */
function injectedShell(): string {
  const dir = mkdtempSync(join(tmpdir(), "eaxau-content-"));
  mkdirSync(join(dir, "web-build"));
  writeFileSync(
    join(dir, "web-build", "index.html"),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>EAXAU</title>
  </head>
  <body>
    <noscript>
      You need to enable JavaScript to run this app.
    </noscript>
    <div id="root"></div>
    <script src="/_expo/static/js/web/entry-abc.js" defer></script>
  </body>
</html>`,
  );
  execFileSync("node", [join(repoRoot, "scripts", "inject-web-bootstrap.js")], { cwd: dir, encoding: "utf-8" });
  return readFileSync(join(dir, "web-build", "index.html"), "utf-8");
}

function allInlines(blocks: ContentBlock[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph") out.push(...block.inlines);
    if (block.type === "cta") out.push(...block.links.map((link) => ({ kind: "link" as const, ...link })));
    if (block.type === "list") block.items.forEach((item) => out.push(...item));
    if (block.type === "quote") block.lines.forEach((line) => out.push(...line));
    if (block.type === "table") {
      block.header.forEach((cell) => out.push(...cell));
      block.rows.forEach((row) => row.forEach((cell) => out.push(...cell)));
    }
  }
  return out;
}

function links(path: string): string[] {
  return allInlines(contentBlocks(findContentPage(path)!))
    .filter((node): node is Extract<InlineNode, { kind: "link" }> => node.kind === "link")
    .map((node) => node.href);
}

function plain(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => (block.type === "heading" ? block.text : inlineText(allInlines([block]))))
    .join("\n");
}

describe("解析器", () => {
  it("标题、表格、列表、引用、按钮行、加粗与链接", () => {
    const blocks = parseContentMarkdown(`# 标题

第一段 **加粗** 与 [链接](/cooperation)。
第二行

[按钮一](https://t.me/x) · [按钮二](/)

| 甲 | 乙 |
|---|---|
| 1 | 2 |

- 一
- 二

1. **步骤。**说明

> 第一行
> 第二行`);
    expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "cta", "table", "list", "list", "quote"]);
    const paragraph = blocks[1] as Extract<ContentBlock, { type: "paragraph" }>;
    expect(paragraph.inlines).toContainEqual({ kind: "strong", text: "加粗" });
    expect(paragraph.inlines).toContainEqual({ kind: "link", text: "链接", href: "/cooperation" });
    expect(paragraph.inlines).toContainEqual({ kind: "break" });
    expect((blocks[2] as any).links).toHaveLength(2);
    expect((blocks[5] as any).ordered).toBe(true);
    expect((blocks[6] as any).lines).toHaveLength(2);
  });

  it("表格列数不一致直接报错，不静默丢列", () => {
    expect(() => parseContentMarkdown("| a | b |\n|---|---|\n| 1 |")).toThrow();
  });
});

describe("六个内容页的正文（合作页、指南、常见问题，各中英一份）", () => {
  it("每页恰好一个 H1，标题与描述各不相同", () => {
    for (const page of CONTENT_PAGES) {
      const h1s = contentBlocks(page).filter((block) => block.type === "heading" && block.level === 1);
      expect(h1s, page.path).toHaveLength(1);
      expect(page.description.length).toBeGreaterThan(40);
    }
    expect(new Set(CONTENT_PAGES.map((page) => page.title)).size).toBe(CONTENT_PAGES.length);
    expect(new Set(CONTENT_PAGES.map((page) => page.description)).size).toBe(CONTENT_PAGES.length);
  });

  it("合作页：五类合作的表格、授权确认五项、四步、可复制清单、四个问答", () => {
    for (const path of [COOPERATION_ZH_PATH, COOPERATION_EN_PATH]) {
      const blocks = contentBlocks(findContentPage(path)!);
      const tables = blocks.filter((block) => block.type === "table") as Extract<ContentBlock, { type: "table" }>[];
      expect(tables).toHaveLength(1);
      expect(tables[0].rows).toHaveLength(5);
      const lists = blocks.filter((block) => block.type === "list") as Extract<ContentBlock, { type: "list" }>[];
      expect(lists.map((list) => [list.ordered, list.items.length])).toEqual([
        [false, 5],
        [true, 4],
      ]);
      const quote = blocks.find((block) => block.type === "quote") as Extract<ContentBlock, { type: "quote" }>;
      expect(quote.lines).toHaveLength(6);
      const faq = blocks.filter(
        (block) => block.type === "paragraph" && block.inlines[0]?.kind === "strong" && block.inlines.some((n) => n.kind === "break"),
      );
      expect(faq, path).toHaveLength(4);
    }
  });

  it("指南：完整模板（11 行）、示例表（3 列 4 行，标明是示例）、交付表（5 行）", () => {
    for (const path of [GUIDE_ZH_PATH, GUIDE_EN_PATH]) {
      const blocks = contentBlocks(findContentPage(path)!);
      const tables = blocks.filter((block) => block.type === "table") as Extract<ContentBlock, { type: "table" }>[];
      expect(tables.map((table) => [table.header.length, table.rows.length])).toEqual([
        [3, 4],
        [2, 5],
      ]);
      const quote = blocks.find((block) => block.type === "quote") as Extract<ContentBlock, { type: "quote" }>;
      expect(quote.lines).toHaveLength(11);
    }
    expect(plain(contentBlocks(findContentPage(GUIDE_ZH_PATH)!))).toContain("下面只是需求写法示例，不是已交付项目或报价。");
    expect(plain(contentBlocks(findContentPage(GUIDE_EN_PATH)!))).toContain(
      "This is an example of how to write a requirement, not a delivered project or a quote.",
    );
  });

  it("站内链接都指向真实页面；站外只链到现有的 Telegram 客服", () => {
    for (const page of CONTENT_PAGES) {
      for (const href of links(page.path)) {
        if (/^https?:/.test(href)) {
          expect(href, page.path).toBe(SUPPORT_TELEGRAM_URL);
        } else {
          expect(isKnownSpaRoute(href), `${page.path} → ${href}`).toBe(true);
        }
      }
    }
  });

  it("合作页的交付清单段链到同语言的指南，指南链回同语言的合作页", () => {
    expect(links(COOPERATION_ZH_PATH)).toContain(GUIDE_ZH_PATH);
    expect(links(COOPERATION_EN_PATH)).toContain(GUIDE_EN_PATH);
    expect(links(GUIDE_ZH_PATH)).toContain(COOPERATION_ZH_PATH);
    expect(links(GUIDE_EN_PATH)).toContain(COOPERATION_EN_PATH);
    expect(links(COOPERATION_EN_PATH)).not.toContain(GUIDE_ZH_PATH);
    expect(links(GUIDE_EN_PATH)).not.toContain(COOPERATION_ZH_PATH);
  });

  it("不写收益、胜率、价格、工期承诺或展示用数字", () => {
    for (const page of CONTENT_PAGES) {
      const text = plain(contentBlocks(page)) + page.title + page.description;
      expect(text, page.path).not.toMatch(/\d+(\.\d+)?\s*%|胜率|收益率|回撤|¥|￥|\bUSDT\b|\bUSD\b|\$\d|win rate|drawdown/i);
      /* 除了客服号码，正文里不出现 3 位以上的数字（展示用的哈希数字、销量、人数都不该有） */
      const withoutContacts = text.replace(/3832001817|oooiniooo0624|xau6000/g, "");
      expect(withoutContacts, page.path).not.toMatch(/\d{3,}/);
    }
  });

  it("中英互为翻译：地址对应关系一致，且都是自己的语言", () => {
    for (const page of CONTENT_PAGES) {
      expect(page.alternates[page.lang]).toBe(page.path);
      for (const path of Object.values(page.alternates)) {
        const other = findContentPage(path)!;
        expect(other.alternates).toEqual(page.alternates);
      }
      const text = plain(contentBlocks(page));
      if (page.lang === "en") expect(text, page.path).not.toMatch(/[一-鿿]/);
      else expect(text, page.path).toMatch(/[一-鿿]/);
    }
  });

  it("合作页的栏目标题和前端 <Head> 用同一份标题与描述", () => {
    const page = findContentPage(COOPERATION_ZH_PATH)!;
    expect(SECTION_PAGE_META["/cooperation"]).toEqual({ title: page.title, description: page.description, h1: contentH1(page) });
    expect(findContentPage("/cooperation/")).toBe(page);
    expect(findContentPage("/en")).toBeNull();
  });

  it("新页面都有前端路由文件", () => {
    const files: Record<string, string> = {
      [COOPERATION_EN_PATH]: "app/en/cooperation.tsx",
      [GUIDE_ZH_PATH]: "app/guides/ea-requirements-and-acceptance.tsx",
      [GUIDE_EN_PATH]: "app/en/guides/ea-requirements-and-acceptance.tsx",
      "/faq": "app/faq.tsx",
      "/en/faq": "app/en/faq.tsx",
    };
    for (const [path, file] of Object.entries(files)) {
      expect(isKnownSpaRoute(path)).toBe(true);
      expect(readFileSync(join(repoRoot, file), "utf-8")).toContain("<ContentArticlePage path=");
    }
    const cooperation = readFileSync(join(repoRoot, "app/cooperation.tsx"), "utf-8");
    expect(cooperation).toContain("<ContentBlocks blocks={HERO_BLOCKS}");
    expect(cooperation).toContain("<ContentBlocks blocks={BODY_BLOCKS}");
  });
});

describe("预渲染（原始 HTML）", () => {
  let shell = "";
  beforeAll(() => {
    shell = injectedShell();
    expect(shell).toContain('<html lang="en">');
    expect(shell).toContain("商品列表这次没能加载出来");
  });

  it("每个页面：本页 lang、H1、正文全部标题与表格、自指 canonical、hreflang", () => {
    for (const page of CONTENT_PAGES) {
      const html = renderContentPageHtml(shell, page);
      expect(html).toContain(`<html lang="${page.lang}">`);
      expect(html.match(/<html/g)).toHaveLength(1);
      expect(html).toContain(`<title>${escapeHtml(page.title)}</title>`);
      expect(html).toContain(`<link rel="canonical" href="https://www.eaxau.com${page.path}" />`);
      expect(html.match(/rel="canonical"/g)).toHaveLength(1);
      expect(html).toContain(`<link rel="alternate" hreflang="zh-CN" href="https://www.eaxau.com${page.alternates["zh-CN"]}" />`);
      expect(html).toContain(`<link rel="alternate" hreflang="en" href="https://www.eaxau.com${page.alternates.en}" />`);
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="https://www.eaxau.com${page.alternates["zh-CN"]}" />`);
      const seo = html.slice(html.indexOf('id="eaxau-seo"'));
      for (const block of contentBlocks(page)) {
        if (block.type === "heading") expect(seo).toContain(`<h${block.level}>`);
        if (block.type === "table") {
          for (const row of block.rows) for (const cell of row) expect(seo).toContain(`<td>${inlineHtml(cell)}</td>`);
        }
      }
      expect(seo).toContain(blocksHtml(contentBlocks(page)));
      /* H1 和首段在正文块最前面 */
      expect(seo.indexOf(`<h1>`)).toBeLessThan(seo.indexOf("<p>"));
      expect(html.match(/id="root"/g)).toHaveLength(1);
      expect(html.indexOf('id="eaxau-seo"')).toBeGreaterThan(html.indexOf('id="root"'));
    }
  });

  it("商城首页的兜底文案不再出现在内容页；无 JS 时直接露出正文", () => {
    for (const page of CONTENT_PAGES) {
      const html = renderContentPageHtml(shell, page);
      expect(html, page.path).not.toContain("商品列表");
      expect(html).not.toContain("MT4 / MT5 EA、指标与交易工具");
      const noscript = html.match(/<noscript[\s\S]*?<\/noscript>/)![0];
      expect(noscript).toContain("#eaxau-boot { display: none !important; }");
      expect(noscript).toContain("#root { display: none !important; }");
      expect(noscript).not.toContain("eaxau-fallback");
      /* 启动兜底（14 秒还没挂载）仍保留联系方式 */
      expect(html).toContain('id="eaxau-boot-fallback"');
      expect(html).toContain("https://t.me/hypermatch123");
    }
    const en = renderContentPageHtml(shell, findContentPage(COOPERATION_EN_PATH)!);
    const boot = en.slice(en.indexOf('id="eaxau-boot"'), en.indexOf("</noscript>"));
    expect(boot).toContain("Support QQ");
    expect(boot).not.toMatch(/[一-鿿]/);
  });

  it("结构化数据只有 WebPage / Article / FAQPage，不写价格、评价、作者或日期", () => {
    for (const page of CONTENT_PAGES) {
      const html = renderContentPageHtml(shell, page);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) =>
        JSON.parse(m[1].replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&")),
      );
      expect(blocks).toHaveLength(1);
      expect(blocks[0]["@type"]).toBe(page.schemaType);
      expect(blocks[0].inLanguage).toBe(page.lang);
      expect(blocks[0].url).toBe(`https://www.eaxau.com${page.path}`);
      const json = JSON.stringify(blocks[0]);
      for (const key of ["offers", "price", "aggregateRating", "review", "author", "datePublished", "dateModified"]) {
        expect(json).not.toContain(`"${key}"`);
      }
    }
    expect(findContentPage(GUIDE_ZH_PATH)!.schemaType).toBe("Article");
    expect(findContentPage(COOPERATION_ZH_PATH)!.schemaType).toBe("WebPage");
    expect(findContentPage("/faq")!.schemaType).toBe("FAQPage");
    expect(findContentPage("/en/faq")!.schemaType).toBe("FAQPage");
  });

  it("页面上的语言切换指向同一篇内容的翻译，不是英文首页", () => {
    const zh = renderContentPageHtml(shell, findContentPage(GUIDE_ZH_PATH)!);
    expect(zh).toContain(`<a href="${GUIDE_EN_PATH}" hreflang="en" lang="en">English</a>`);
    const en = renderContentPageHtml(shell, findContentPage(GUIDE_EN_PATH)!);
    expect(en).toContain(`<a href="${GUIDE_ZH_PATH}" hreflang="zh-CN" lang="zh-CN">中文</a>`);
  });

  it("setHtmlLang 替换已有 lang，或补上", () => {
    expect(setHtmlLang('<html lang="en" dir="ltr"><head>', "zh-CN")).toBe('<html lang="zh-CN" dir="ltr"><head>');
    expect(setHtmlLang("<html><head>", "en")).toBe('<html lang="en"><head>');
  });

  it("sitemap 条目：六个地址、真实更新日期、中英 hreflang", () => {
    const xml = contentSitemapEntries();
    for (const page of CONTENT_PAGES) {
      expect(xml).toContain(`<loc>https://www.eaxau.com${page.path}</loc>`);
    }
    expect(xml.match(/<url>/g)).toHaveLength(6);
    expect(xml.match(/<lastmod>2026-10-18<\/lastmod>/g)).toHaveLength(6);
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="en" href="https://www.eaxau.com${GUIDE_EN_PATH}" />`);
  });
});
