/**
 * 2026-10-18 Part B：合并 GPT 草稿里能逐句对上站内现有内容的部分（常见问题页 + /llms.txt 的咨询到交付）。
 * 这里核对：每个答案都有站内出处；FAQPage 结构化数据只含页面上看得到的问答；不带价格、退款、主体、试用等待定内容。
 */
import { describe, expect, it } from "vitest";
import {
  CONTENT_PAGES,
  FAQ_EN_PATH,
  FAQ_ZH_PATH,
  contentBlocks,
  faqEntries,
  inlineText,
  requireContentPage,
  type ContentBlock,
} from "../shared/content-pages";
import { COOPERATION_EN_MARKDOWN, COOPERATION_ZH_MARKDOWN } from "../shared/content-pages/cooperation";
import { GUIDE_EN_MARKDOWN, GUIDE_ZH_MARKDOWN } from "../shared/content-pages/ea-requirements-guide";
import { SECTION_PAGE_META } from "../shared/seo-meta";
import { contentJsonLd } from "../shared/seo-head";
import { renderContentPageHtml } from "../server/_core/seo-content-pages";
import { renderStrategyHtml } from "../server/_core/seo-render";
import { LLMS_DELIVERY_NOTE, LLMS_PROCESS_STEPS, renderLlmsTxt } from "../server/_core/site-text";

const SHELL = '<!DOCTYPE html><html lang="en"><head><title>x</title></head><body><div id="root"></div></body></html>';
const zh = requireContentPage(FAQ_ZH_PATH);
const en = requireContentPage(FAQ_EN_PATH);

function pageText(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "heading") return block.text;
      if (block.type === "paragraph") return inlineText(block.inlines);
      if (block.type === "list") return block.items.map((item) => inlineText(item)).join("\n");
      return "";
    })
    .join("\n");
}

/** 去掉 Markdown 的加粗和链接语法，只留文字。 */
function md(markdown: string): string {
  return markdown.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

describe("常见问题页（/faq、/en/faq）", () => {
  it("中英问答一一对应，每个问题都有答案", () => {
    const zhEntries = faqEntries(zh);
    const enEntries = faqEntries(en);
    expect(zhEntries.length).toBe(11);
    expect(enEntries.length).toBe(zhEntries.length);
    for (const entry of [...zhEntries, ...enEntries]) {
      expect(entry.question.length).toBeGreaterThan(4);
      expect(entry.answer.length).toBeGreaterThan(20);
    }
    expect(faqEntries(requireContentPage("/cooperation"))).toEqual([]);
  });

  it("每个答案都有站内出处（首页描述、合作页、指南、商品页预渲染、llms 风险声明）", () => {
    const zhText = pageText(contentBlocks(zh));
    const enText = pageText(contentBlocks(en));
    const productHtml = renderStrategyHtml(SHELL, { id: 1, title: "T", platform: "MT5" } as any);
    const llms = renderLlmsTxt({ kind: "unavailable", reason: "x" });
    const sources: Array<[string, string, string]> = [
      // [FAQ 里的原句, 出处全文, 出处名]
      ["每个商品页写明运行平台、交易品种、常用周期、运行依赖与授权交付方式；价格与授权范围按订单确认", SECTION_PAGE_META["/"].description, "首页描述"],
      ["不一定。成品授权与源码许可需要分别确认，不能从商品名称推断。", md(COOPERATION_ZH_MARKDOWN), "合作页"],
      ["取得一个文件，不等于同时取得全部使用权", md(COOPERATION_ZH_MARKDOWN), "合作页"],
      ["需要评估具体实现、依赖和目标环境", md(COOPERATION_ZH_MARKDOWN), "合作页"],
      ["首次咨询只需业务和技术需求", md(COOPERATION_ZH_MARKDOWN), "合作页"],
      ["下单或授权确认后提供安装包与授权信息，并按版本提供安装、参数说明与后续更新支持", productHtml, "商品页预渲染"],
      ["建议配合稳定网络或 VPS；点差、合约规格与交易时段按经纪商环境确认", productHtml, "商品页预渲染"],
      ["交易结果本身不能替代对代码功能和交付物的验收", md(GUIDE_ZH_MARKDOWN), "指南"],
      ["外汇、贵金属等杠杆交易有风险，EA 和策略的历史表现不代表未来收益", llms, "llms.txt"],
      ["Compiled-product access and source-code licensing must be confirmed separately.", md(COOPERATION_EN_MARKDOWN), "合作页 EN"],
      ["Receiving a file does not establish every right to use it.", md(COOPERATION_EN_MARKDOWN), "合作页 EN"],
      ["before sharing restricted materials, confirm your right to provide them and use an agreed handover channel", md(COOPERATION_EN_MARKDOWN).replace("Before sharing", "before sharing"), "合作页 EN"],
      ["Trading outcomes do not replace acceptance of code functionality and deliverables.", md(GUIDE_EN_MARKDOWN), "指南 EN"],
      ["Leveraged trading in forex and metals involves risk, and the past performance of an EA or strategy does not guarantee future results.", llms, "llms.txt"],
      ["price and licence scope are confirmed per order".replace("licence", "license"), llms.replace("licence", "license"), "llms.txt"],
    ];
    for (const [sentence, source, name] of sources) {
      const faq = /[一-鿿]/.test(sentence) ? zhText : enText;
      expect(faq, sentence).toContain(sentence);
      expect(source, `${name}：${sentence}`).toContain(sentence);
    }
  });

  it("不收待定内容：价格、付款、退款、主体、试用、促销 / 合购规则、争议受理", () => {
    for (const page of [zh, en]) {
      const text = pageText(contentBlocks(page)) + page.title + page.description;
      expect(text, page.path).not.toMatch(/¥|￥|元\/|退款|退费|主体|登记|试用|促销|合购|争议|待定|待 Nathan|【|refund|trial|promotion|group[- ]buy|dispute|pending|legal name|\d+\s*(元|CNY|USD|USDT)/i);
    }
  });

  it("FAQPage 结构化数据：问答与页面逐字一致，只在常见问题页出现，不写价格、评分、作者、日期", () => {
    for (const page of [zh, en]) {
      const html = renderContentPageHtml(SHELL, page);
      const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) =>
        JSON.parse(m[1].replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&")),
      );
      expect(scripts).toHaveLength(1);
      const ld = scripts[0];
      expect(ld).toEqual(contentJsonLd(page));
      expect(ld["@type"]).toBe("FAQPage");
      expect(ld.inLanguage).toBe(page.lang);
      const article = html.slice(html.indexOf("<article>"), html.indexOf("</article>"));
      const visible = pageText(contentBlocks(page));
      expect(ld.mainEntity).toHaveLength(faqEntries(page).length);
      for (const q of ld.mainEntity) {
        expect(q["@type"]).toBe("Question");
        expect(article).toContain(`<h2>${q.name.replace(/&/g, "&amp;")}</h2>`);
        expect(q.acceptedAnswer["@type"]).toBe("Answer");
        for (const line of String(q.acceptedAnswer.text).split("\n")) expect(visible).toContain(line);
      }
      const json = JSON.stringify(ld);
      for (const key of ["offers", "price", "aggregateRating", "review", "author", "datePublished", "dateModified"]) {
        expect(json).not.toContain(`"${key}"`);
      }
    }
    for (const page of CONTENT_PAGES.filter((p) => p.schemaType !== "FAQPage")) {
      expect(JSON.stringify(contentJsonLd(page))).not.toContain('"mainEntity":');
    }
  });
});

describe("/llms.txt：咨询到交付（GPT-14 草稿中能对上原文的部分）", () => {
  it("四步逐字取自中英合作页，交付说明取自商品页预渲染", () => {
    const zhSteps = md(COOPERATION_ZH_MARKDOWN);
    const enSteps = md(COOPERATION_EN_MARKDOWN);
    for (const step of LLMS_PROCESS_STEPS) {
      expect(zhSteps).toContain(step.zh);
      expect(enSteps).toContain(step.en);
    }
    const productHtml = renderStrategyHtml(SHELL, { id: 1, title: "T", platform: "MT5" } as any);
    expect(productHtml).toContain(LLMS_DELIVERY_NOTE.zh.split("。")[0]);
    expect(productHtml).toContain(LLMS_DELIVERY_NOTE.zh.split("。")[1]);
  });

  it("llms.txt 带上四步、交付说明和常见问题页；不带价格或待定条款", () => {
    const text = renderLlmsTxt({ kind: "unavailable", reason: "x" });
    expect(text).toContain("## 咨询到交付 / From enquiry to delivery");
    expect(text).toContain(`1. ${LLMS_PROCESS_STEPS[0].zh} ${LLMS_PROCESS_STEPS[0].en}`);
    expect(text).toContain(LLMS_DELIVERY_NOTE.en);
    expect(text).toContain("(https://www.eaxau.com/faq)");
    expect(text).toContain("(https://www.eaxau.com/en/faq)");
    expect(text).not.toMatch(/¥|￥|退款|refund|待定|pending|待 Nathan/i);
  });
});
