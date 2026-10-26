import type { Request, Response } from "express";
import { isProductionRuntime } from "./runtime-env";

export function allowedAuthOrigins(): Set<string> {
  return new Set([
    "https://eaxau.com", "https://www.eaxau.com",
    ...(process.env.CORS_ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean),
    ...(!isProductionRuntime() ? ["http://localhost:8081", "http://localhost:3000"] : []),
  ]);
}

/** JSON 阻断简单表单；Origin 使用固定白名单，不能信任请求 Host。无 Origin 的原生客户端可用。 */
export function requireAuthSource(req: Request, res: Response, jsonOnly = false): boolean {
  const origin = req.headers.origin;
  if ((origin && !allowedAuthOrigins().has(origin)) || (!origin && req.headers["sec-fetch-site"] === "cross-site")) {
    res.status(403).json({ error: "请求来源不受信任" });
    return false;
  }
  if (jsonOnly && !req.is("application/json")) {
    res.status(415).json({ error: "请求格式不正确" });
    return false;
  }
  return true;
}
