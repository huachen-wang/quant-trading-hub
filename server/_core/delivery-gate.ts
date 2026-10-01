/**
 * Delivery gate — 交付门禁的单一判定源。
 *
 * "strategies.downloadUrl 有值" 不等于 "这行是可交付的文件"。券商开户推荐链接、空值、
 * 未发布、仅咨询授权的商品都不能在线成交，也不能签发下载 token。
 *
 * 这些纯函数被以下位置共用，保证前端 DTO、下单闸、付款闸、免费领取和最后一跳的
 * 下载路由说的是同一套话：
 *   - toPublicStrategy            详情页 DTO 的 downloadAvailable
 *   - orders.create               服务端重复核验，不依赖前端 DTO
 *   - payments.initiate           收款前再核一次（建单后商品被改成开户链接的情况）
 *   - downloads.claimFree         免费商品：有真文件才签 token；缺文件明确转咨询
 *   - /api/download/secure        token 之外再核一次权利与文件性质
 *   - orders.detail               success 页面只按这里给出的真实交付状态出文案
 *
 * 无数据库、无网络依赖，可直接单测。
 */
import { shouldUseContactForDownload } from "../../lib/download-links";

export type StrategyDeliveryInput = {
  status?: string | null;
  saleMode?: string | null;
  isFree?: boolean | number | null;
  downloadUrl?: string | null;
};

export type StrategyDelivery =
  | { mode: "file"; downloadUrl: string }
  | { mode: "contact"; reason: "no_file" | "broker_link" };

/** 只看 downloadUrl：真文件 → file；空值或开户推荐链接 → contact。 */
export function classifyStrategyDelivery(
  strategy: StrategyDeliveryInput | null | undefined,
): StrategyDelivery {
  const downloadUrl = strategy?.downloadUrl?.trim() ?? "";
  if (!downloadUrl) return { mode: "contact", reason: "no_file" };
  if (shouldUseContactForDownload(downloadUrl)) {
    return { mode: "contact", reason: "broker_link" };
  }
  return { mode: "file", downloadUrl };
}

export type PurchaseGateReason =
  | "unpublished"
  | "inquiry_only"
  | "free"
  | "no_file"
  | "broker_link";

export type PurchaseGateResult =
  | { ok: true; downloadUrl: string }
  | {
      ok: false;
      reason: PurchaseGateReason;
      code: "NOT_FOUND" | "PRECONDITION_FAILED";
      message: string;
    };

export const PURCHASE_GATE_MESSAGES: Record<PurchaseGateReason, string> = {
  unpublished: "商品不存在或已下架",
  inquiry_only: "此商品仅支持商务咨询授权，无法下单",
  free: "免费商品无需下单，请登录后在商品页直接获取文件",
  no_file: "此 EA 文件尚未完成受控交付配置",
  broker_link: "此 EA 需客服确认交付方式，暂不支持在线下单，请联系客服",
};

function purchaseGateFailure(reason: PurchaseGateReason): PurchaseGateResult {
  return {
    ok: false,
    reason,
    code: reason === "unpublished" ? "NOT_FOUND" : "PRECONDITION_FAILED",
    message: PURCHASE_GATE_MESSAGES[reason],
  };
}

/**
 * orders.create 的服务端闸：已发布 + 直购 + 付费 + 真文件才允许建单。
 * 判定顺序与改动前 orders.create 的四条 throw 保持一致，只是把
 * "有 downloadUrl" 收紧为 "downloadUrl 是真文件"。
 */
export function assessStrategyPurchase(
  strategy: StrategyDeliveryInput | null | undefined,
): PurchaseGateResult {
  if (!strategy || strategy.status !== "published") {
    return purchaseGateFailure("unpublished");
  }
  if (strategy.saleMode !== "direct") return purchaseGateFailure("inquiry_only");
  if (strategy.isFree) return purchaseGateFailure("free");
  const delivery = classifyStrategyDelivery(strategy);
  if (delivery.mode === "contact") return purchaseGateFailure(delivery.reason);
  return { ok: true, downloadUrl: delivery.downloadUrl };
}

export type FreeClaimReason =
  | "unpublished"
  | "inquiry_only"
  | "not_free"
  | "no_file"
  | "broker_link";

export type FreeClaimResult =
  | { ok: true; downloadUrl: string }
  | { ok: false; reason: FreeClaimReason };

export const FREE_CLAIM_MESSAGES: Record<FreeClaimReason, string> = {
  unpublished: "商品不存在或已下架",
  inquiry_only: "此商品仅支持商务咨询授权，请联系客服",
  not_free: "此商品为付费商品，请通过下单购买后下载",
  no_file: "此 EA 文件尚未完成受控交付配置，请联系客服获取",
  broker_link: "此 EA 需客服确认交付方式，请联系客服获取",
};

/**
 * 免费商品领取：已发布 + 直购 + isFree + 真文件。
 * 缺文件 / 开户链接 → 调用方应明确转人工咨询，不签 token、不建单、不伪造付款。
 */
export function assessFreeClaim(
  strategy: StrategyDeliveryInput | null | undefined,
): FreeClaimResult {
  if (!strategy || strategy.status !== "published") {
    return { ok: false, reason: "unpublished" };
  }
  if (strategy.saleMode !== "direct") return { ok: false, reason: "inquiry_only" };
  if (!strategy.isFree) return { ok: false, reason: "not_free" };
  const delivery = classifyStrategyDelivery(strategy);
  if (delivery.mode === "contact") return { ok: false, reason: delivery.reason };
  return { ok: true, downloadUrl: delivery.downloadUrl };
}

export function isFreeStrategyClaimable(
  strategy: StrategyDeliveryInput | null | undefined,
): boolean {
  return assessFreeClaim(strategy).ok;
}

/** orders.detail 给 success 页面的真实交付状态。 */
export type OrderDelivery =
  | { status: "awaiting_payment"; orderStatus: string }
  | { status: "refunded" }
  | { status: "ready"; downloadUrl: string; expiresInMinutes: number }
  | { status: "contact"; reason: "promo" | "no_file" | "broker_link" }
  | { status: "unavailable"; reason: "product_missing" | "signing_unavailable" };

export function describeOrderDelivery(input: {
  order: { status: string; productKind: string };
  product: StrategyDeliveryInput | null | undefined;
  /** 只在确认是真文件之后才调用；抛错表示签名密钥不可用。 */
  signDownloadPath: () => string;
  tokenTtlMinutes: number;
}): OrderDelivery {
  const { order, product } = input;
  if (order.status === "refunded") return { status: "refunded" };
  if (order.status !== "paid") {
    return { status: "awaiting_payment", orderStatus: order.status };
  }
  if (order.productKind !== "strategy") return { status: "contact", reason: "promo" };
  if (!product) return { status: "unavailable", reason: "product_missing" };
  const delivery = classifyStrategyDelivery(product);
  if (delivery.mode === "contact") return { status: "contact", reason: delivery.reason };
  try {
    return {
      status: "ready",
      downloadUrl: input.signDownloadPath(),
      expiresInMinutes: input.tokenTtlMinutes,
    };
  } catch {
    // DOWNLOAD_SIGNING_SECRET 缺失时 signDownloadToken 会抛。已付款订单不能因此
    // 整个查询失败、在页面上变成"订单不存在"；要如实说"付款已记录，下载暂不可用"。
    return { status: "unavailable", reason: "signing_unavailable" };
  }
}
