import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  QQ_GROUP_NUMBER,
  SUPPORT_QQ,
  SUPPORT_TELEGRAM_HANDLE,
  SUPPORT_TELEGRAM_URL,
  SUPPORT_WECHAT,
  TELEGRAM_GROUP_URL,
  buildCommunityEntries,
  normalizeWechatContacts,
} from "../shared/community-contacts";
import { SUPPORT_QQ_FALLBACK } from "../lib/support-faq";
import { SEO_CONTACTS, renderHomeHtml, renderStrategyHtml } from "../server/_core/seo-render";

const repoRoot = resolve(__dirname, "..");

const SHELL = `<!DOCTYPE html><html><head><title>EAXAU</title></head><body><div id="root"></div></body></html>`;

describe("交流群与客服：同一份号码（2026-10-17 Nathan）", () => {
  it("号码逐字照抄", () => {
    expect(TELEGRAM_GROUP_URL).toBe("https://t.me/nbmarketchat");
    expect(QQ_GROUP_NUMBER).toBe("951703741");
    expect(SUPPORT_QQ).toBe("3832001817");
    expect(SUPPORT_WECHAT).toBe("oooiniooo0624 / xau6000");
    expect(SUPPORT_TELEGRAM_HANDLE).toBe("@hypermatch123");
    expect(SUPPORT_TELEGRAM_URL).toBe("https://t.me/hypermatch123");
  });

  it("在线咨询面板的 QQ 兜底和这里是同一个号", () => {
    expect(SUPPORT_QQ_FALLBACK).toBe(SUPPORT_QQ);
  });

  it("没有后台设置时用兜底，交流群在前、客服在后", () => {
    const entries = buildCommunityEntries(undefined);
    expect(entries.map((e) => e.id)).toEqual([
      "tg-group",
      "qq-group",
      "support-qq",
      "support-wechat",
      "support-telegram",
    ]);
    expect(entries.map((e) => e.group)).toEqual(["community", "community", "support", "support", "support"]);
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId["tg-group"].href).toBe("https://t.me/nbmarketchat");
    expect(byId["qq-group"].value).toBe("951703741");
    expect(byId["support-qq"].value).toBe("3832001817");
    expect(byId["support-wechat"].value).toBe("oooiniooo0624 / xau6000");
    expect(byId["support-telegram"]).toMatchObject({ value: "@hypermatch123", href: "https://t.me/hypermatch123" });
  });

  it("后台线上那种写法（带前缀）收成干净号码，号码本身不改", () => {
    const entries = buildCommunityEntries({
      contact_qq: "QQ3832001817",
      contact_wechat: "微信号oooiniooo0624 微信号xau6000",
      contact_telegram: "@hypermatch123",
      contact_telegram_link: "https://t.me/hypermatch123",
    });
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId["support-qq"].value).toBe("3832001817");
    expect(byId["support-wechat"].value).toBe("oooiniooo0624 / xau6000");
    expect(byId["support-telegram"].href).toBe("https://t.me/hypermatch123");
  });

  it("后台改了 Telegram 客服，页面跟着后台走", () => {
    const entries = buildCommunityEntries({ contact_telegram: "someone_else", contact_telegram_link: "" });
    expect(entries.find((e) => e.id === "support-telegram")).toMatchObject({
      value: "@someone_else",
      href: "https://t.me/someone_else",
    });
  });

  it("微信写法看不懂就原样显示，不改运营填的内容", () => {
    expect(normalizeWechatContacts("微信号oooiniooo0624 微信号xau6000")).toBe("oooiniooo0624 / xau6000");
    expect(normalizeWechatContacts("oooiniooo0624 / xau6000")).toBe("oooiniooo0624 / xau6000");
    expect(normalizeWechatContacts("加微信请备注 EA")).toBe("加微信请备注 EA");
    expect(normalizeWechatContacts("")).toBe("");
  });

  it("服务端预渲染用的是同一份号码", () => {
    expect(SEO_CONTACTS).toMatchObject({
      telegramGroupLink: TELEGRAM_GROUP_URL,
      qqGroup: QQ_GROUP_NUMBER,
      qq: SUPPORT_QQ,
      wechat: SUPPORT_WECHAT,
      telegram: SUPPORT_TELEGRAM_HANDLE,
      telegramLink: SUPPORT_TELEGRAM_URL,
    });
    const home = renderHomeHtml(SHELL, { kind: "ok", strategies: [] });
    const product = renderStrategyHtml(SHELL, {
      id: 1,
      title: "Sample EA v1.0",
      platform: "MT5",
      description: "这是一段足够长的真实商品介绍，用来通过占位描述检查。",
    });
    for (const html of [home, product]) {
      for (const value of ["https://t.me/nbmarketchat", "951703741", "3832001817", "oooiniooo0624", "https://t.me/hypermatch123"]) {
        expect(html).toContain(value);
      }
      expect(html).toContain("<h3>交流群</h3>");
      expect(html).toContain("<h3>客服</h3>");
      expect(html).not.toContain("t.me/xau6000");
    }
  });

  it("首页结构化数据带客服 contactPoint，不写站点之间的关系", () => {
    const home = renderHomeHtml(SHELL, { kind: "ok", strategies: [] });
    const blocks = [...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) =>
      JSON.parse(m[1].replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&")),
    );
    const org = blocks.find((b) => b["@type"] === "Organization");
    expect(org).toBeTruthy();
    expect(org.contactPoint[0].url).toBe("https://t.me/hypermatch123");
    expect(org.contactPoint[0].description).toContain("3832001817");
    expect(org.sameAs).toBeUndefined();
    expect(JSON.stringify(org)).not.toMatch(/NB\.market|旗下/);
  });
});

/** 全仓源码里不再出现 Telegram 死链 t.me/xau6000 和 t.me/eaxau（微信号 xau6000 不算）。 */
describe("Telegram 死链不回来", () => {
  const ROOTS = ["app", "components", "lib", "server", "shared", "scripts", "constants", "hooks"];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?|mjs|cjs|sql|json)$/.test(name)) files.push(full);
    }
  };
  for (const root of ROOTS) {
    try {
      walk(join(repoRoot, root));
    } catch {
      // 目录不存在就跳过
    }
  }

  it("扫到了源码", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("没有 t.me/xau6000、t.me/eaxau、@xau6000 这样的 Telegram 写法", () => {
    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      if (/t\.me\/xau6000\b|t\.me\/eaxau\b|@xau6000\b|t\.me\/quanttradingea\b/i.test(source)) {
        hits.push(relative(repoRoot, file));
      }
    }
    expect(hits).toEqual([]);
  });
});
