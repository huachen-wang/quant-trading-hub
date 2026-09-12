/**
 * 咨询授权路径的上下文桥接。
 *
 * 现状：线上 20 个已发布商品全部是 saleMode="inquiry" 且 downloadAvailable=false，
 * 唯一 CTA 是「联系客服咨询授权」→ ContactModal 只给出 Telegram / 微信 / QQ 号。
 * 客户离开页面去外部 IM 时，商品名、商品编号和页面地址全部丢失，也不知道该问什么，
 * 顾问则要重新把版本 / 授权范围 / 交付内容问一遍。这里把这段上下文变成可复制的文本。
 *
 * 纯函数、无 React / react-native 依赖，便于单测。
 */

export type InquiryContext = {
  productId?: number | string | null;
  productTitle?: string | null;
  /** MT4 / MT5 */
  platform?: string | null;
  /** EA / 指标 / 工具 */
  productTypeLabel?: string | null;
  /** 商品页绝对地址；缺省时按 productId 推导 */
  pageUrl?: string | null;
};

export const PUBLIC_SITE_ORIGIN = "https://www.eaxau.com";

/** 咨询要当场落定的四件事。用于弹窗与商品页共用同一份文案，避免两处漂移。 */
export const INQUIRY_CHECKLIST = [
  "可授权的版本与授权范围（账户数 / 有效期）",
  "报价与付款方式",
  "交付内容（文件 / 参数 / 安装说明）",
  "安装调试是否包含，需要我提供什么",
] as const;

/** 成交流程。只描述现有路径，不含时效承诺或收益承诺。 */
export const INQUIRY_FLOW_STEPS = [
  { key: "confirm", zh: "确认版本与授权", en: "Confirm version & licence", ar: "تأكيد الإصدار والترخيص" },
  { key: "quote", zh: "报价与付款", en: "Quote & payment", ar: "عرض السعر والدفع" },
  { key: "deliver", zh: "交付文件与安装", en: "Files & installation", ar: "الملفات والتثبيت" },
  { key: "after", zh: "售后走同一会话", en: "Same thread for follow-up", ar: "المتابعة في نفس المحادثة" },
] as const;

function clean(value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : "";
}

function normalizeProductId(productId?: number | string | null) {
  if (productId === null || productId === undefined) return "";
  const raw = String(productId).trim();
  return /^\d+$/.test(raw) && raw !== "0" ? raw : "";
}

/** 由商品编号推导商品页地址；编号不合法时返回空串（而不是拼出 /strategy/undefined）。 */
export function buildStrategyPageUrl(
  productId?: number | string | null,
  origin: string = PUBLIC_SITE_ORIGIN,
) {
  const id = normalizeProductId(productId);
  if (!id) return "";
  return `${origin.replace(/\/+$/, "")}/strategy/${id}`;
}

/**
 * Telegram 账号或链接 → 可打开的 https://t.me/xxx。
 * 只做跳转，不拼 ?text= —— 普通账号（非 bot）的 t.me 链接并不保证带出草稿，
 * 与其给一个可能静默失效的深链，不如「先复制再打开」。
 */
export function buildTelegramChatLink(handleOrLink?: string | null) {
  const value = clean(handleOrLink);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "").replace(/^t\.me\//i, "");
  return /^[A-Za-z0-9_]{3,32}$/.test(handle) ? `https://t.me/${handle}` : "";
}

/** 商品标题行，如「金戈铁马 V5.1（EA · MT5 · 商品编号 30）」。 */
export function buildProductLine(context: InquiryContext) {
  const title = clean(context.productTitle);
  const meta = [clean(context.productTypeLabel), clean(context.platform)].filter(Boolean);
  const id = normalizeProductId(context.productId);
  if (id) meta.push(`商品编号 ${id}`);
  if (!title) return meta.length ? meta.join(" · ") : "";
  return meta.length ? `${title}（${meta.join(" · ")}）` : title;
}

/**
 * 生成可一键复制、粘贴到 Telegram / 微信 / QQ 的咨询内容。
 * 不含价格、不含时效承诺 —— 报价仍由顾问在会话里给出。
 */
export function buildInquiryMessage(context: InquiryContext = {}) {
  const productLine = buildProductLine(context);
  const pageUrl = clean(context.pageUrl) || buildStrategyPageUrl(context.productId);

  const lines: string[] = [];
  lines.push(productLine ? `[EAXAU 咨询] ${productLine}` : "[EAXAU 咨询]");
  if (pageUrl) lines.push(`商品页：${pageUrl}`);
  lines.push("");
  lines.push("我想确认：");
  INQUIRY_CHECKLIST.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push("");
  lines.push("我的情况（请按实际修改）：");
  lines.push(`- 交易平台：${clean(context.platform) || "MT4 / MT5"}`);
  lines.push("- 券商 / 账户类型：");
  lines.push("- 是否需要代装 VPS：");
  return lines.join("\n");
}
