/**
 * 合成发包源（隔离验收专用）。
 *
 * 只在 127.0.0.1 上提供几个**带标识的合成文件**，冒充商品的受控存储地址。
 * 不是真实 EA，不含任何生产资产，也不对外网暴露。
 *
 * 用法：node verify/purchase/synthetic-origin.mjs [port]
 *   GET /v1.ex5       -> 合成包 v1
 *   GET /v2.ex5       -> 合成包 v2（用来验证「付款商品与发包版本不一致」）
 *   GET /mutable.ex5  -> 可被就地替换字节的合成包（用来验证「同 URL 不同字节」）
 *   POST /__control/mutable?variant=a|same-size|bigger
 *       -> 就地替换 /mutable.ex5 的内容，URL 不变。只接受来自 127.0.0.1 的请求。
 */
import { createServer } from "node:http";

const PORT = Number(process.argv[2] || 3498);

const PREFIX = "EAXAU-SYNTHETIC-TEST-ARTIFACT";

export const SYNTHETIC_FILES = {
  "/v1.ex5": `${PREFIX}|version=v1|not-a-real-ea|` + "A".repeat(64) + "\n",
  "/v2.ex5": `${PREFIX}|version=v2|not-a-real-ea|` + "B".repeat(64) + "\n",
};

// 同一个 URL，不同字节。`same-size` 与 `a` 长度完全相同——只有内容摘要能区分，
// content-length 区分不了；`bigger` 连长度都变了。
export const MUTABLE_VARIANTS = {
  a: `${PREFIX}|mutable=a|not-a-real-ea|` + "A".repeat(64) + "\n",
  "same-size": `${PREFIX}|mutable=c|not-a-real-ea|` + "C".repeat(64) + "\n",
  bigger: `${PREFIX}|mutable=d|not-a-real-ea|` + "D".repeat(200) + "\n",
};

let mutableVariant = "a";

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");

  if (url.pathname === "/__control/mutable") {
    // 控制口只服务回环地址，且不返回任何文件字节。
    if (req.socket.remoteAddress !== "127.0.0.1" && req.socket.remoteAddress !== "::ffff:127.0.0.1") {
      res.writeHead(403).end("forbidden");
      return;
    }
    const variant = url.searchParams.get("variant") || "";
    if (!(variant in MUTABLE_VARIANTS)) {
      res.writeHead(400, { "content-type": "text/plain" }).end("unknown variant");
      return;
    }
    mutableVariant = variant;
    res.writeHead(200, { "content-type": "text/plain" }).end(`mutable=${variant}`);
    return;
  }

  const body =
    url.pathname === "/mutable.ex5"
      ? MUTABLE_VARIANTS[mutableVariant]
      : SYNTHETIC_FILES[url.pathname];
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
  console.log(
    `[synthetic-origin] listening on http://127.0.0.1:${PORT} (v1.ex5, v2.ex5, mutable.ex5)`,
  );
});
