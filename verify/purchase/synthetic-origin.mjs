/**
 * 合成发包源（隔离验收专用）。
 *
 * 只在 127.0.0.1 上提供两个**带标识的合成文件**，冒充商品的受控存储地址。
 * 不是真实 EA，不含任何生产资产，也不对外网暴露。
 *
 * 用法：node verify/purchase/synthetic-origin.mjs [port]
 *   GET /v1.ex5 -> 合成包 v1
 *   GET /v2.ex5 -> 合成包 v2（用来验证「付款商品与发包版本不一致」）
 */
import { createServer } from "node:http";

const PORT = Number(process.argv[2] || 3498);

export const SYNTHETIC_FILES = {
  "/v1.ex5": "EAXAU-SYNTHETIC-TEST-ARTIFACT|version=v1|not-a-real-ea|" + "A".repeat(64) + "\n",
  "/v2.ex5": "EAXAU-SYNTHETIC-TEST-ARTIFACT|version=v2|not-a-real-ea|" + "B".repeat(64) + "\n",
};

const server = createServer((req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  const body = SYNTHETIC_FILES[path];
  if (!body) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[synthetic-origin] listening on http://127.0.0.1:${PORT} (v1.ex5, v2.ex5)`);
});
