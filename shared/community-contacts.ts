/**
 * 全站统一的「交流群」与「客服」入口（2026-10-17 Nathan）。
 *
 * 顶栏「加入交流群」、页脚、商品详情页购买区、手机悬浮按钮、服务端预渲染、/llms.txt
 * 都从这里取，不要在页面里再写死号码。
 *
 * - 交流群两项是固定配置，不进后台设置。
 * - 客服三项（QQ / 微信 / Telegram）后台「联系方式设置」可改（site_settings 的 contact_*），
 *   页面优先读后台值，读不到才用这里的兜底；服务端预渲染和 /llms.txt 直接用这里的值。
 * - scripts/inject-web-bootstrap.js 是 CommonJS，不能 import 这个文件，
 *   由 tests/community-contacts.test.ts 断言两边不漂移。
 *
 * 文案只用「交流群」「客服」两个词，不写站点之间的关系。
 */

export const TELEGRAM_GROUP_URL = "https://t.me/nbmarketchat";

/** QQ 群号。 */
export const QQ_GROUP_NUMBER = "951703741";

/**
 * QQ 群的加群链接。拿到后填在这里，所有入口自动从「复制群号」变成「打开链接」。
 * 留空时只显示群号。
 */
export const QQ_GROUP_JOIN_URL = "";

export const SUPPORT_QQ = "3832001817";

/** 微信 1 号 oooiniooo0624（10/15 带来过 GPT 推荐的客户）+ 现有的微信 2 号，照现状保留。 */
export const SUPPORT_WECHAT = "oooiniooo0624 / xau6000";

export const SUPPORT_TELEGRAM_HANDLE = "@hypermatch123";
export const SUPPORT_TELEGRAM_URL = "https://t.me/hypermatch123";

export type CommunityGroupKey = "community" | "support";

export type CommunityEntry = {
  id: "tg-group" | "qq-group" | "support-qq" | "support-wechat" | "support-telegram";
  group: CommunityGroupKey;
  icon: "telegram" | "qq" | "wechat";
  label: { zh: string; en: string; ar: string };
  value: string;
  /** 有链接就点击打开；没有就点击复制 value。 */
  href: string | null;
};

export type ContactSettingsLike = Record<string, string | null | undefined> | null | undefined;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 后台微信设置线上填的是「微信号oooiniooo0624 微信号xau6000」。
 * 展示位自己有「微信」标签，这里只收掉重复的前缀、统一分隔符；
 * 出现看不懂的写法就原样返回，一个字不改。
 */
export function normalizeWechatContacts(value: string | null | undefined): string {
  const raw = clean(value);
  if (!raw) return "";
  const parts = raw.split(/[\s/、，,]+/u).filter(Boolean);
  const ids: string[] = [];
  for (const part of parts) {
    const matched = /^(?:微信号?|wechat|wx)?[:：]?([A-Za-z][A-Za-z0-9_-]{5,19})$/iu.exec(part);
    if (!matched) return raw;
    if (!ids.includes(matched[1])) ids.push(matched[1]);
  }
  return ids.join(" / ");
}

function normalizeQq(value: string | null | undefined): string {
  const raw = clean(value);
  if (!raw) return "";
  const parts = raw.split(/[\s/、，,]+/u).filter(Boolean);
  const numbers: string[] = [];
  for (const part of parts) {
    const matched = /^(?:qq)?(\d{5,12})$/iu.exec(part);
    if (!matched) return raw;
    if (!numbers.includes(matched[1])) numbers.push(matched[1]);
  }
  return numbers.join(" / ");
}

function telegramUrl(handleOrLink: string): string {
  if (!handleOrLink) return "";
  if (/^https:\/\/t\.me\/[A-Za-z0-9_]{3,32}\/?$/i.test(handleOrLink)) return handleOrLink.replace(/\/$/, "");
  const handle = handleOrLink.replace(/^@/, "").replace(/^(?:https?:\/\/)?t\.me\//i, "");
  return /^[A-Za-z0-9_]{3,32}$/.test(handle) ? `https://t.me/${handle}` : "";
}

function telegramHandle(url: string): string {
  const matched = /^https:\/\/t\.me\/([A-Za-z0-9_]{3,32})$/i.exec(url);
  return matched ? `@${matched[1]}` : "";
}

/**
 * 交流群 + 客服的完整列表。传入后台联系设置（siteSettings.getContact 的返回）时，
 * 客服三项用后台值；不传或读不到就用本文件的兜底。
 */
export function buildCommunityEntries(settings?: ContactSettingsLike): CommunityEntry[] {
  const qqGroupHref = clean(QQ_GROUP_JOIN_URL) || null;

  const supportQq = normalizeQq(settings?.contact_qq) || SUPPORT_QQ;
  const supportWechat = normalizeWechatContacts(settings?.contact_wechat) || SUPPORT_WECHAT;
  const tgUrl =
    telegramUrl(clean(settings?.contact_telegram_link)) ||
    telegramUrl(clean(settings?.contact_telegram)) ||
    SUPPORT_TELEGRAM_URL;
  const tgHandle = telegramHandle(tgUrl) || SUPPORT_TELEGRAM_HANDLE;

  return [
    {
      id: "tg-group",
      group: "community",
      icon: "telegram",
      label: { zh: "Telegram 交流群", en: "Telegram group", ar: "مجموعة تيليجرام" },
      value: TELEGRAM_GROUP_URL.replace(/^https:\/\//, ""),
      href: TELEGRAM_GROUP_URL,
    },
    {
      id: "qq-group",
      group: "community",
      icon: "qq",
      label: { zh: "QQ 群", en: "QQ group", ar: "مجموعة QQ" },
      value: QQ_GROUP_NUMBER,
      href: qqGroupHref,
    },
    {
      id: "support-qq",
      group: "support",
      icon: "qq",
      label: { zh: "客服 QQ", en: "Support QQ", ar: "دعم QQ" },
      value: supportQq,
      href: null,
    },
    {
      id: "support-wechat",
      group: "support",
      icon: "wechat",
      label: { zh: "微信", en: "WeChat", ar: "WeChat" },
      value: supportWechat,
      href: null,
    },
    {
      id: "support-telegram",
      group: "support",
      icon: "telegram",
      label: { zh: "Telegram 客服", en: "Telegram support", ar: "دعم تيليجرام" },
      value: tgHandle,
      href: tgUrl,
    },
  ];
}
