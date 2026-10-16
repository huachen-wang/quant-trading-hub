import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { JGTM_BRAND_IMAGE, resolveStrategyArtwork } from "../lib/strategy-artwork";
import { renderNoindexHtml, renderSectionHtml, renderStrategyHtml } from "../server/_core/seo-render";
import { SECTION_PAGE_META, noindexPageTitle, strategyPageMeta } from "../shared/seo-meta";

const repoRoot = resolve(__dirname, "..");
const SHELL = `<!DOCTYPE html><html><head><title>EAXAU</title></head><body><div id="root"></div></body></html>`;

describe("每页自己的标题（2026-10-17 第三批）", () => {
  it("栏目页标题各不相同，也不是全站通用标题", () => {
    const titles = Object.values(SECTION_PAGE_META).map((m) => m.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).not.toContain("EA商城｜MT4/MT5量化交易软件与策略工具 - EAXAU");
    for (const meta of Object.values(SECTION_PAGE_META)) {
      expect(meta.description.length).toBeGreaterThan(20);
      expect(meta.description).not.toMatch(/\d+(\.\d+)?%|胜率|回撤|稳赚|不爆仓/);
    }
  });

  it("商品页：服务端预渲染和前端 <Head> 用同一个标题和描述", () => {
    const strategy = {
      id: 30,
      title: "金戈铁马 V5.1",
      platform: "MT5",
      description: "一段足够长、可以当摘要使用的真实商品介绍文字，用来验证描述同源。",
      productType: "ea",
    };
    const meta = strategyPageMeta(strategy);
    expect(meta.title).toBe("金戈铁马 V5.1 - EA 自动交易程序 | EAXAU");
    const html = renderStrategyHtml(SHELL, strategy);
    expect(html).toContain(`<title>${meta.title}</title>`);
    expect(html).toContain(`<meta name="description" content="${meta.description}" data-rh="true" />`);
  });

  it("每个可收录页面的前端都挂了 <Head>", () => {
    const files: Record<string, string> = {
      "/": "app/index.tsx",
      "/market": "app/(tabs)/market.tsx",
      "/cooperation": "app/cooperation.tsx",
      "/promo": "app/promo.tsx",
      "/group-buy": "app/(tabs)/group-buy.tsx",
      "/subscribe": "app/(tabs)/subscribe.tsx",
    };
    for (const [path, file] of Object.entries(files)) {
      expect(readFileSync(join(repoRoot, file), "utf-8"), file).toContain(`<SectionHead path="${path}" />`);
    }
    expect(readFileSync(join(repoRoot, "app/strategy/[id].tsx"), "utf-8")).toContain("strategyPageMeta(strategy)");
  });

  it("栏目页预渲染：title、description、canonical、H1、交流群；/market 带商品清单", () => {
    const html = renderSectionHtml(SHELL, "/market", {
      kind: "ok",
      strategies: [{ id: 30, title: "金戈铁马 V5.1", platform: "MT5" }],
    })!;
    expect(html).toContain(`<title>${SECTION_PAGE_META["/market"].title}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://www.eaxau.com/market" />');
    expect(html).toContain("<h1>策略广场：MT4 / MT5 EA、指标与工具目录</h1>");
    expect(html).toContain('<a href="/strategy/30">金戈铁马 V5.1</a>');
    expect(html).toContain("https://t.me/nbmarketchat");
    expect(renderSectionHtml(SHELL, "/promo")).not.toContain("全部商品");
    expect(renderSectionHtml(SHELL, "/nope")).toBeNull();
  });

  it("登录、注册、找回密码、V2 预览不收录", () => {
    for (const path of ["/auth/login", "/auth/register", "/auth/forgot-password", "/v2-preview", "/v2-preview/accounts/1"]) {
      const title = noindexPageTitle(path);
      expect(title, path).toBeTruthy();
      expect(renderNoindexHtml(SHELL, title!)).toContain('<meta name="robots" content="noindex,follow" />');
    }
    for (const path of ["/", "/market", "/strategy/1", "/v2-previewx"]) {
      expect(noindexPageTitle(path), path).toBeNull();
    }
  });
});

describe("金戈铁马用自家品牌图", () => {
  it("卡片和详情页不再套别家 EA 的图", () => {
    const artwork = resolveStrategyArtwork({ title: "金戈铁马 V5.1", tags: "", pairs: "" });
    expect(artwork.image).toBe("https://fx.nb.market/avatars/jgtm-brand.webp");
    expect(JGTM_BRAND_IMAGE).toBe(artwork.image);
    expect(artwork.imageFit).toBe("contain");
    const other = resolveStrategyArtwork({ title: "Quantum Queen", tags: "", pairs: "" });
    expect(other.image).not.toBe(JGTM_BRAND_IMAGE);
    expect(other.imageFit).toBeUndefined();
  });

  it("og:image 用库里的 coverImage（外链图在 CSP 的 img-src https: 范围内）", () => {
    const html = renderStrategyHtml(SHELL, {
      id: 30,
      title: "金戈铁马 V5.1",
      platform: "MT5",
      coverImage: "https://fx.nb.market/avatars/jgtm-brand.webp",
    });
    expect(html).toContain('<meta property="og:image" content="https://fx.nb.market/avatars/jgtm-brand.webp" />');
  });
});
