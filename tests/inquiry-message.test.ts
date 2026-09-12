import { describe, expect, it } from "vitest";
import {
  INQUIRY_CHECKLIST,
  buildInquiryMessage,
  buildProductLine,
  buildStrategyPageUrl,
  buildTelegramChatLink,
} from "../lib/inquiry-message";

describe("buildStrategyPageUrl", () => {
  it("builds an absolute product url from a numeric id", () => {
    expect(buildStrategyPageUrl(30)).toBe("https://www.eaxau.com/strategy/30");
    expect(buildStrategyPageUrl("104")).toBe("https://www.eaxau.com/strategy/104");
    expect(buildStrategyPageUrl(30, "https://www.eaxau.com/")).toBe("https://www.eaxau.com/strategy/30");
  });

  it("never emits a broken url for a missing or zero id", () => {
    expect(buildStrategyPageUrl(undefined)).toBe("");
    expect(buildStrategyPageUrl(null)).toBe("");
    expect(buildStrategyPageUrl(0)).toBe("");
    expect(buildStrategyPageUrl("abc")).toBe("");
  });
});

describe("buildTelegramChatLink", () => {
  it("normalises the handle shapes stored in site settings", () => {
    expect(buildTelegramChatLink("@xau6000")).toBe("https://t.me/xau6000");
    expect(buildTelegramChatLink("xau6000")).toBe("https://t.me/xau6000");
    expect(buildTelegramChatLink("t.me/xau6000")).toBe("https://t.me/xau6000");
    expect(buildTelegramChatLink("https://t.me/xau6000")).toBe("https://t.me/xau6000");
  });

  it("returns empty for unusable values instead of a dead link", () => {
    expect(buildTelegramChatLink("")).toBe("");
    expect(buildTelegramChatLink(null)).toBe("");
    expect(buildTelegramChatLink("@ab")).toBe("");
    expect(buildTelegramChatLink("联系客服")).toBe("");
  });
});

describe("buildProductLine", () => {
  it("combines title, type, platform and id", () => {
    expect(
      buildProductLine({ productTitle: "金戈铁马 V5.1", productTypeLabel: "EA", platform: "MT5", productId: 30 }),
    ).toBe("金戈铁马 V5.1（EA · MT5 · 商品编号 30）");
  });

  it("degrades gracefully when fields are missing", () => {
    expect(buildProductLine({ productTitle: "V4 Grid Bot EA v1.0" })).toBe("V4 Grid Bot EA v1.0");
    expect(buildProductLine({})).toBe("");
  });
});

describe("buildInquiryMessage", () => {
  const ctx = {
    productId: 30,
    productTitle: "金戈铁马 V5.1 永不爆仓版本",
    productTypeLabel: "EA",
    platform: "MT5",
  };

  it("carries product identity and the page url across to the IM app", () => {
    const msg = buildInquiryMessage(ctx);
    expect(msg).toContain("金戈铁马 V5.1 永不爆仓版本");
    expect(msg).toContain("商品编号 30");
    expect(msg).toContain("https://www.eaxau.com/strategy/30");
    expect(msg.startsWith("[EAXAU 咨询]")).toBe(true);
  });

  it("asks every question the advisor otherwise has to re-ask", () => {
    const msg = buildInquiryMessage(ctx);
    INQUIRY_CHECKLIST.forEach((item) => expect(msg).toContain(item));
    expect(msg).toContain("券商 / 账户类型：");
    expect(msg).toContain("是否需要代装 VPS：");
  });

  it("prefers an explicit pageUrl over the derived one", () => {
    expect(buildInquiryMessage({ ...ctx, pageUrl: "https://www.eaxau.com/promo" })).toContain(
      "商品页：https://www.eaxau.com/promo",
    );
  });

  it("makes no price, profit or response-time promise", () => {
    const msg = buildInquiryMessage(ctx);
    expect(msg).not.toMatch(/¥|\$|USD|USDT/);
    expect(msg).not.toMatch(/小时内|分钟内|保证|承诺|收益|不爆仓回复/);
  });

  it("stays usable with no context at all", () => {
    const msg = buildInquiryMessage();
    expect(msg.startsWith("[EAXAU 咨询]")).toBe(true);
    expect(msg).not.toContain("undefined");
    expect(msg).not.toContain("商品页：");
    expect(msg).toContain("MT4 / MT5");
  });
});
