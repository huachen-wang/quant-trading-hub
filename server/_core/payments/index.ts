/**
 * Payment Gateway Registry
 *
 * 注册所有可用的支付网关。前端通过 trpc.payments.listMethods 拿到这里的列表。
 * 新增网关时只需要：
 *   1. 实现 PaymentGateway 接口
 *   2. 在这里注册
 */

import type { PaymentGateway } from "./gateway";
import { zpayGateway } from "./zpay";
import { usdtGateway } from "./usdt-manual";

const allGateways: PaymentGateway[] = [zpayGateway, usdtGateway];

/**
 * 列出所有当前启用的网关
 */
export function listEnabledGateways(): PaymentGateway[] {
  return allGateways.filter((g) => g.isEnabled());
}

/**
 * 按名字查找网关
 */
export function getGatewayByName(name: string): PaymentGateway | null {
  return allGateways.find((g) => g.name === name) || null;
}

/**
 * 按支付方式查找合适的网关
 * （比如 method='alipay' 自动找到 ZPay）
 */
export function getGatewayForMethod(method: string): PaymentGateway | null {
  return (
    listEnabledGateways().find((g) => g.getSupportedMethods().includes(method)) ||
    null
  );
}

/**
 * 公开给前端的支付方式列表
 */
export interface PublicPaymentMethod {
  /** method 标识，如 alipay / wxpay / usdt */
  method: string;
  /** 网关名 */
  gateway: string;
  /** 显示名 */
  label: string;
  /** 显示图标（emoji） */
  icon: string;
  /** 备注 */
  hint?: string;
}

export function getPublicPaymentMethods(): PublicPaymentMethod[] {
  const result: PublicPaymentMethod[] = [];
  for (const gw of listEnabledGateways()) {
    for (const m of gw.getSupportedMethods()) {
      const meta = methodMeta[m];
      if (!meta) continue;
      result.push({
        method: m,
        gateway: gw.name,
        ...meta,
      });
    }
  }
  return result;
}

const methodMeta: Record<string, { label: string; icon: string; hint?: string }> = {
  alipay: { label: "支付宝", icon: "💙", hint: "扫码支付，秒到账" },
  wxpay: { label: "微信支付", icon: "💚", hint: "扫码支付，秒到账" },
  usdt: { label: "USDT", icon: "🪙", hint: "锁定报价 · 链上 TxID 对账" },
};
