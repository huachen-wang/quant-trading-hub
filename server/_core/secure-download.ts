/**
 * Secure Download — HMAC 签名下载 URL
 *
 * 解决问题：
 *   现状：strategies.downloadUrl 直接返回给前端，未付款用户也能 F12 拿到链接绕过付款。
 *
 * 方案：
 *   1. 用户已付款（orders.status='paid'）后，调用 trpc.downloads.getSignedUrl
 *   2. 后端验证用户对该商品的购买权限
 *   3. 生成短期签名 URL：/api/download/secure?token=...
 *   4. 用户点链接 → 后端验证 token → 流式代理转发实际 downloadUrl 内容
 *      （实际 downloadUrl 永远不暴露给前端）
 *
 * 简化版（A.B 实装）：
 *   暂不做流式代理（需要 fetch + pipe，复杂），先做 token 验证 + redirect 到实际 URL。
 *   redirect 模式仍然有"用户拿到 redirect 后地址"的可能，但比直接暴露好得多。
 *
 * 完整版（未来 phase）：
 *   把 EA 文件存到自己的 S3/R2 → 后端流式代理 → 永远不暴露原始 URL
 */

import crypto from "node:crypto";

const SECRET = process.env.DOWNLOAD_SIGNING_SECRET || process.env.COOKIE_SECRET || "fallback-please-set-DOWNLOAD_SIGNING_SECRET";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 分钟有效期

interface SignedTokenPayload {
  userId: number;
  productKind: "strategy" | "promo";
  productId: number;
  expiresAt: number; // unix ms
  // hash 防止用户篡改
  sig: string;
}

/**
 * 生成签名 token
 */
export function signDownloadToken(opts: {
  userId: number;
  productKind: "strategy" | "promo";
  productId: number;
}): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payloadStr = `${opts.userId}.${opts.productKind}.${opts.productId}.${expiresAt}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payloadStr).digest("hex");
  return Buffer.from(`${payloadStr}.${sig}`).toString("base64url");
}

/**
 * 验证签名 token
 */
export function verifyDownloadToken(token: string): {
  ok: boolean;
  userId?: number;
  productKind?: string;
  productId?: number;
  error?: string;
} {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 5) return { ok: false, error: "Invalid token format" };

    const [userIdStr, productKind, productIdStr, expiresAtStr, sig] = parts;
    const expectedPayload = `${userIdStr}.${productKind}.${productIdStr}.${expiresAtStr}`;
    const expectedSig = crypto.createHmac("sha256", SECRET).update(expectedPayload).digest("hex");

    if (sig !== expectedSig) {
      return { ok: false, error: "Invalid signature" };
    }

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || expiresAt < Date.now()) {
      return { ok: false, error: "Token expired" };
    }

    return {
      ok: true,
      userId: parseInt(userIdStr, 10),
      productKind,
      productId: parseInt(productIdStr, 10),
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Token verification failed" };
  }
}

/**
 * Express 路由：处理签名下载请求
 *
 * 挂载在 server/_core/index.ts：
 *   app.get("/api/download/secure", secureDownloadHandler);
 */
import type { Request, Response } from "express";
import { getStrategyById, hasUserPurchased, recordDownload } from "../db";

export async function secureDownloadHandler(req: Request, res: Response) {
  const token = String(req.query.token || "");
  if (!token) {
    return res.status(400).send("Missing token");
  }

  const verifyResult = verifyDownloadToken(token);
  if (!verifyResult.ok) {
    return res.status(403).send(`Forbidden: ${verifyResult.error}`);
  }

  // 二次验证：从 DB 再确认用户对该商品有权限
  // （即便 token 有效，也要确保用户付款记录还在）
  const purchased = await hasUserPurchased(verifyResult.userId!, verifyResult.productId!);
  if (!purchased) {
    return res.status(403).send("Forbidden: no purchase record");
  }

  const strategy = await getStrategyById(verifyResult.productId!);
  if (!strategy?.downloadUrl) {
    return res.status(404).send("Download URL not found");
  }

  // 记录下载（用于统计）
  try {
    await recordDownload(verifyResult.userId!, verifyResult.productId!);
  } catch {
    // 忽略统计错误
  }

  // 重定向到实际下载链接
  // 注意：用户拿到 redirect 之后的 URL 后还是能复用，但每次都要先来这里换 token
  // 真正的安全方式是把文件放在自己 storage + 流式代理。这是简化版。
  res.redirect(strategy.downloadUrl);
}

/**
 * Express 注册函数 — 挂载到 server/_core/index.ts
 */
export function registerSecureDownloadRoute(app: any) {
  app.get("/api/download/secure", secureDownloadHandler);
  console.log("[secure-download] route registered: /api/download/secure");
}
