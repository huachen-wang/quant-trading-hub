import { describe, expect, it } from "vitest";
import {
  buildStrategyPlaceholderContent,
  shouldGenerateStrategyPlaceholder,
  STRATEGY_PLACEHOLDER_VERSION,
} from "./strategy-placeholder-content";

describe("strategy placeholder content", () => {
  it("generates category-aware copy with an explicit placeholder notice", () => {
    const html = buildStrategyPlaceholderContent({
      title: "Gold Breakout Pro",
      description: "Gold Breakout Pro 聚焦关键区间的突破确认。",
      platform: "MT5",
      pairs: "XAUUSD",
      timeframe: "M15",
      tags: "黄金,突破,短线",
    });

    expect(html).toContain(STRATEGY_PLACEHOLDER_VERSION);
    expect(html).toContain("模板说明");
    expect(html).toContain("结构突破与快速执行");
    expect(html).toContain("波动扩张与关键区间突破");
    expect(html).toContain("不代表已完成回测或实盘核验");
    expect(html).not.toContain("<p>Gold Breakout Pro 聚焦");
  });

  it("escapes catalog text before putting it into HTML", () => {
    const html = buildStrategyPlaceholderContent({
      title: "Unsafe <script>",
      description: "<img src=x onerror=alert(1)>",
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("only replaces empty or legacy generated content", () => {
    expect(shouldGenerateStrategyPlaceholder(null, "摘要")).toBe(true);
    expect(shouldGenerateStrategyPlaceholder("<p>摘要</p>", "摘要")).toBe(true);
    expect(shouldGenerateStrategyPlaceholder("<h2>人工内容</h2>", "摘要")).toBe(
      false,
    );
  });
});
