/**
 * Order Utilities — 订单工具
 */

import crypto from "node:crypto";

/**
 * 生成订单号
 *
 * 格式：EX{YYYYMMDD}{8 位 hex 随机}
 * 例：EX2026050312AB34CD
 *
 * 长度 18 字符，short enough 给用户记，long enough 防爆破。
 */
export function generateOrderNo(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const date = `${yyyy}${mm}${dd}`;
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `EX${date}${random}`;
}

/**
 * 默认订单过期时间：30 分钟
 */
export function getOrderExpiresAt(minutes = 30): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * 检查订单是否过期
 */
export function isOrderExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}
