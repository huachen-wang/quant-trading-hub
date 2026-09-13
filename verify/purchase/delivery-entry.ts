/**
 * 交付读取入口（隔离验收专用）。
 *
 * 挂载的是 `server/_core/secure-download.ts` 里**生产同一个** `handleSecureDownload`，
 * 只通过已有的 NODE_ENV=test 依赖注入口把 SSRF 地址策略放开到回环地址——
 * 因为隔离环境没有公网出口，合成发包源只能跑在 127.0.0.1 上，
 * 而生产策略（正确地）拒绝私有地址。
 *
 * 也就是说：token 校验、购买复核（hasUserPurchased）、订单快照解析、
 * 上游取包、大小限制、响应头、下载计数 —— 全是生产代码路径；
 * 唯一被替换的是「这个 IP 允不允许连」这一个判断。
 *
 * 生产真实路由 /api/download/secure 的鉴权行为在主服务（3410）上单独验证。
 *
 * 用法：NODE_ENV=test DATABASE_URL=... DOWNLOAD_SIGNING_SECRET=... \
 *        npx tsx verify/purchase/delivery-entry.ts [port]
 */
import express from "express";
import { createSecureDownloadHandlerForTests } from "../../server/_core/secure-download";

const PORT = Number(process.argv[2] || 3411);

const app = express();
app.get(
  "/api/download/secure",
  createSecureDownloadHandlerForTests({
    // 合成发包源在 127.0.0.1；除此之外不放行任何地址。
    isAddressAllowed: ({ address }) => address === "127.0.0.1",
  }),
);

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[delivery-entry] listening on http://127.0.0.1:${PORT}/api/download/secure`);
});
