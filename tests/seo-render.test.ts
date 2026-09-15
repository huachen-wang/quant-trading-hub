import { describe, expect, it } from "vitest";
import {
  isPlaceholderDescription,
  platformLabel,
  platformShort,
  pricing,
  renderHomeHtml,
  renderNotFoundHtml,
  renderStrategyHtml,
  renderUnavailableHtml,
  versionFromTitle,
  type SeoStrategy,
} from "../server/_core/seo-render";

/** 与 Expo web export 产物同形状的最小骨架。 */
const SHELL = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>EAXAU</title>
    <meta name="description" content="old" />
  </head>
  <body>
    <div id="eaxau-boot"></div>
    <div id="root"></div>
    <script src="/_expo/static/js/web/entry-abc.js" defer></script>
  </body>
</html>`;

const BASE: SeoStrategy = {
  id: 98,
  title: "Sharkyra Gold v1.2",
  description:
    "Sharkyra Gold v1.2 面向黄金日内波动，组合方向判断、入场过滤与风险约束。本介绍根据用户提供的 EA 文件名录整理，具体版本、参数、适用环境与授权范围请联系确认。",
  platform: "MT5",
  pairs: "XAUUSD",
  timeframe: "M5,M15",
  price: "0.00",
  isFree: true,
  saleMode: "inquiry",
  productType: "ea",
};

function ldBlocks(html: string): any[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) =>
    JSON.parse(m[1].replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&")),
  );
}

describe("初始 HTML 对所有访客一致且只写真实字段", () => {
  it("商品页给出 h1、自指 canonical 和真实资料字段", () => {
    const html = renderStrategyHtml(SHELL, BASE);
    expect(html).toContain('<link rel="canonical" href="https://www.eaxau.com/strategy/98" />');
    expect(html).toContain("<h1>Sharkyra Gold v1.2</h1>");
    expect(html).toContain("MetaTrader 5（MT5）");
    expect(html).toContain("XAUUSD");
    expect(html).toContain("M5,M15");
    expect(html).toContain("联系咨询授权");
    /* 应用容器保持唯一，正文块在 #root 之外，不产生双根渲染 */
    expect(html.match(/id="root"/g)).toHaveLength(1);
    expect(html.match(/id="eaxau-seo"/g)).toHaveLength(1);
    expect(html.indexOf('id="eaxau-seo"')).toBeGreaterThan(html.indexOf('id="root"'));
  });

  it("绝不输出收益/回撤/胜率/虚拟订阅这类不可信数字", () => {
    const html = renderStrategyHtml(SHELL, {
      ...BASE,
      // 这些字段即便存在也不该出现在初始 HTML 里
      ...( { totalReturn: "86.40", maxDrawdown: "14.80", sharpeRatio: "2.10", winRate: "72.60", virtualSubscribers: 999 } as any),
    });
    for (const forbidden of ["86.40", "14.80", "2.10", "72.60", "999"]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it("咨询制商品不写 offers；只有真实直购正价才写，且不断言 availability", () => {
    const inquiry = ldBlocks(renderStrategyHtml(SHELL, BASE))[0];
    expect(inquiry.offers).toBeUndefined();

    const direct = ldBlocks(
      renderStrategyHtml(SHELL, { ...BASE, id: 30, saleMode: "direct", price: "2000.00", isFree: false }),
    )[0];
    expect(direct.offers.price).toBe("2000.00");
    expect(direct.offers.priceCurrency).toBe("CNY");
    expect(direct.offers.availability).toBeUndefined();
    expect(direct.offers.seller.name).toBe("EAXAU");
  });

  it("不把第三方来源商品冒称自有品牌", () => {
    const ld = ldBlocks(renderStrategyHtml(SHELL, BASE))[0];
    expect(ld.brand).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain("AI量化联盟");
  });

  it("占位描述不当摘要，也不写进结构化数据", () => {
    const html = renderStrategyHtml(SHELL, { ...BASE, id: 30, title: "金戈铁马 V5.1", description: "联系我们了解详情", pairs: null });
    expect(html).not.toContain("联系我们了解详情");
    expect(ldBlocks(html)[0].description).toBeUndefined();
    /* pairs 为空就写未提供，不猜品种 */
    expect(html).toContain("未提供");
  });

  it("平台未知时不默认成 MT5", () => {
    expect(platformLabel(null)).toBe("未提供");
    expect(platformLabel("")).toBe("未提供");
    expect(platformLabel("cTrader")).toBe("未提供");
    expect(platformLabel("mt4")).toBe("MetaTrader 4（MT4）");
    expect(platformShort(undefined)).toBe("平台未提供");
    const html = renderStrategyHtml(SHELL, { ...BASE, platform: "" as any });
    expect(html).not.toContain("MetaTrader 5");
    expect(html).toContain("运行平台未在商品资料中标注");
  });

  it("标题里的版本号才写版本，写不出就不写", () => {
    expect(versionFromTitle("Sharkyra Gold v1.2")).toBe("V1.2");
    expect(versionFromTitle("金戈铁马 V5.1")).toBe("V5.1");
    expect(versionFromTitle("Quantum Bitcoin")).toBeNull();
    expect(renderStrategyHtml(SHELL, { ...BASE, title: "Quantum Bitcoin" })).not.toContain("<dt>版本</dt>");
  });

  it("数据库文本里的标签和引号被转义，不会破出 HTML 或 JSON-LD", () => {
    const html = renderStrategyHtml(SHELL, {
      ...BASE,
      title: '<img src=x onerror=alert(1)>"</script>',
      description: "</script><script>alert(2)</script> 正常说明文字放在后面确保长度足够",
    });
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).not.toContain("<script>alert(2)</script>");
    /* 应用自己的入口脚本仍然只有一个，没有被注入的内容顶掉 */
    expect(html.match(/_expo\/static\/js\/web\/entry-abc\.js/g)).toHaveLength(1);
    expect(() => ldBlocks(html)).not.toThrow();
  });
});

describe("404 与数据源故障是两件事", () => {
  it("不存在的地址给 noindex 的 404 正文", () => {
    const html = renderNotFoundHtml(SHELL, "/strategy/99999999");
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
    expect(html).toContain("页面不存在");
    expect(html).toContain("/strategy/99999999");
    expect(html).not.toContain('rel="canonical"');
  });

  it("数据源故障页说临时故障，且不把数据库原始报错泄露给访客", () => {
    const html = renderUnavailableHtml(SHELL);
    expect(html).toContain("临时故障");
    expect(html).toContain("不代表商品不存在或已下架");
    for (const leak of ["ECONNREFUSED", "ETIMEDOUT", "mysql", "getStrategyById", "at Object."]) {
      expect(html).not.toContain(leak);
    }
  });
});

describe("首页", () => {
  it("列出真实商品并给自指 canonical", () => {
    const html = renderHomeHtml(SHELL, {
      kind: "ok",
      strategies: [BASE, { ...BASE, id: 99, title: "Silver Trend Trader EA v4", platform: "MT4", pairs: "XAGUSD" }],
    });
    expect(html).toContain('<link rel="canonical" href="https://www.eaxau.com/" />');
    expect(html).toContain('<a href="/strategy/98">Sharkyra Gold v1.2</a>');
    expect(html).toContain("MT4");
    const types = ldBlocks(html).map((b) => b["@type"]);
    expect(types).toContain("WebSite");
    expect(types).toContain("ItemList");
  });

  it("清单读不到时不编造商品、不输出原始报错，也不写空的 ItemList", () => {
    const html = renderHomeHtml(SHELL, { kind: "unavailable", reason: "ECONNREFUSED 10.0.0.1:3306" });
    expect(html).not.toContain("ECONNREFUSED");
    expect(html).toContain("临时故障");
    expect(ldBlocks(html).map((b) => b["@type"])).not.toContain("ItemList");
  });
});

describe("价格口径", () => {
  it("只有 direct 且正价才算直购", () => {
    expect(pricing({ ...BASE, saleMode: "direct", price: "2000.00" }).directPrice).toBe(2000);
    expect(pricing({ ...BASE, saleMode: "inquiry", price: "2000.00" }).directPrice).toBeNull();
    expect(pricing({ ...BASE, saleMode: "direct", price: "0.00" }).directPrice).toBeNull();
    expect(pricing({ ...BASE, saleMode: "direct", price: null }).directPrice).toBeNull();
  });

  it("占位描述判定", () => {
    expect(isPlaceholderDescription("联系我们了解详情")).toBe(true);
    expect(isPlaceholderDescription("暂无描述。")).toBe(true);
    expect(isPlaceholderDescription(BASE.description!)).toBe(false);
  });
});
