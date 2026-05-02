/**
 * Feature Flags
 *
 * 功能开关 —— 用环境变量控制，可在 Railway 后台直接改，无需改代码重新部署。
 *
 * 当前支持的开关：
 *   ENABLE_PHONE_VERIFICATION  — 是否启用手机号验证（短信通道）
 *                                  默认 false。等阿里云签名审核通过后改为 true。
 *   ENABLE_USDT_PAYMENT        — 是否启用 USDT 支付（Bundle A.3 用）
 *                                  默认 true。
 *   ENABLE_ZPAY                — 是否启用 ZPay 聚合支付
 *                                  默认 true（前提：.env 配齐 ZPAY_*）
 */

function flag(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultValue;
  return v === "true" || v === "1" || v === "yes";
}

export function isPhoneVerificationEnabled(): boolean {
  return flag("ENABLE_PHONE_VERIFICATION", false);
}

export function isUsdtPaymentEnabled(): boolean {
  return flag("ENABLE_USDT_PAYMENT", true);
}

export function isZpayEnabled(): boolean {
  return flag("ENABLE_ZPAY", true);
}

/**
 * 给前端用的 feature flags 集合（通过 tRPC 暴露）
 */
export interface PublicFeatureFlags {
  phoneVerification: boolean;
  usdtPayment: boolean;
  zpay: boolean;
}

export function getPublicFeatureFlags(): PublicFeatureFlags {
  return {
    phoneVerification: isPhoneVerificationEnabled(),
    usdtPayment: isUsdtPaymentEnabled(),
    zpay: isZpayEnabled(),
  };
}
