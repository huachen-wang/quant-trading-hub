import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, ROBOTS_DISALLOW, renderLlmsTxt, renderRobotsTxt } from "../server/_core/site-text";

describe("robots.txt", () => {
  const robots = renderRobotsTxt();
  const groups = robots.split(/\n\n+/);

  it("保留原来 * 组的规则和 sitemap", () => {
    expect(groups[0]).toBe(["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", "Disallow: /oauth/"].join("\n"));
    expect(robots).toContain("Sitemap: https://www.eaxau.com/sitemap.xml");
  });

  it("10/15 那 11 个 AI 爬虫各一组，禁止规则和 * 组一样", () => {
    expect(AI_CRAWLERS).toHaveLength(11);
    for (const agent of [
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
    ]) {
      const group = groups.find((g) => g.startsWith(`User-agent: ${agent}\n`));
      expect(group, agent).toBeTruthy();
      for (const rule of ROBOTS_DISALLOW) expect(group).toContain(`Disallow: ${rule}`);
    }
  });
});

describe("/llms.txt", () => {
  const strategies = [
    { id: 30, title: "金戈铁马 V5.1", platform: "MT5", pairs: "XAUUSD", timeframe: "M5", saleMode: "inquiry", price: "0" },
    { id: 31, title: "Some [Tool]", platform: "MT4", saleMode: "direct", price: "99" },
  ];

  it("写定位、主要页面、交流群和客服、风险声明", () => {
    const text = renderLlmsTxt({ kind: "ok", strategies });
    expect(text.startsWith("# EAXAU")).toBe(true);
    expect(text).toContain("> EAXAU（eaxau.com，AI量化联盟）");
    expect(text).toContain("历史表现不代表未来收益");
    for (const value of [
      "https://t.me/nbmarketchat",
      "951703741",
      "3832001817",
      "oooiniooo0624",
      "@hypermatch123",
      "https://t.me/hypermatch123",
    ]) {
      expect(text).toContain(value);
    }
    for (const path of ["/market", "/group-buy", "/subscribe", "/cooperation", "/promo"]) {
      expect(text).toContain(`(https://www.eaxau.com${path})`);
    }
    expect(text).toContain("[金戈铁马 V5.1](https://www.eaxau.com/strategy/30)");
    expect(text).toContain("[Some Tool](https://www.eaxau.com/strategy/31)");
    expect(text).not.toContain("t.me/xau6000");
    expect(text).not.toMatch(/NB\.market|旗下/);
  });

  it("商品清单读不到就整段省略，不编造", () => {
    const text = renderLlmsTxt({ kind: "unavailable", reason: "db" });
    expect(text).not.toContain("## 在售商品");
    expect(text).toContain("https://t.me/nbmarketchat");
  });

  it("不写收益、胜率、回撤数字", () => {
    const text = renderLlmsTxt({ kind: "ok", strategies });
    expect(text).not.toMatch(/胜率|回撤|夏普|\d+(\.\d+)?%/);
  });
});
