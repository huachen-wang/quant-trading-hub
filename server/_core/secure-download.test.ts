import crypto from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getLatestPaidStrategyOrder: vi.fn(),
  getPaidOrderForDelivery: vi.fn(),
  getStrategyById: vi.fn(),
  pinOrderDeliveryDigest: vi.fn(),
  pinStrategyPackageDigest: vi.fn(),
  recordDownload: vi.fn(),
}));

import {
  getLatestPaidStrategyOrder,
  getPaidOrderForDelivery,
  getStrategyById,
  pinOrderDeliveryDigest,
  pinStrategyPackageDigest,
  recordDownload,
} from "../db";
import {
  createSecureDownloadHandlerForTests,
  secureDownloadHandler,
  signDownloadToken,
  type SecureDownloadTestNetworkPolicy,
  verifyDownloadToken,
} from "./secure-download";

const TEST_SECRET = "test-download-secret-with-more-than-32-bytes";
const originalSigningSecret = process.env.DOWNLOAD_SIGNING_SECRET;

function makeRawSignedToken(payload: string): string {
  const signature = crypto
    .createHmac("sha256", TEST_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${signature}`, "utf8").toString("base64url");
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function createDownloadApp(): Promise<{
  server: Server;
  baseUrl: string;
}>;
async function createDownloadApp(
  testNetworkPolicy: SecureDownloadTestNetworkPolicy,
): Promise<{
  server: Server;
  baseUrl: string;
}>;
async function createDownloadApp(
  testNetworkPolicy?: SecureDownloadTestNetworkPolicy,
): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const app = express();
  if (testNetworkPolicy) {
    app.get(
      "/api/download/secure",
      createSecureDownloadHandlerForTests(testNetworkPolicy),
    );
  } else {
    app.get("/api/download/secure", secureDownloadHandler);
  }
  const server = createServer(app);
  return { server, baseUrl: await listen(server) };
}

const ORDER_ID = 4242;

function strategyToken(orderId = ORDER_ID): string {
  return signDownloadToken({
    userId: 17,
    productKind: "strategy",
    productId: 6,
    orderId,
  });
}

/** 免费领取（downloads.claimFree）签发的令牌：不对应订单。 */
function freeToken(): string {
  return signDownloadToken({
    userId: 17,
    productKind: "strategy",
    productId: 6,
    orderId: "free",
  });
}

/** 本次修复之前签发的旧格式令牌：没有订单号。 */
function legacyStrategyToken(): string {
  return makeRawSignedToken(`17.strategy.6.${Date.now() + 10 * 60 * 1000}`);
}

function sha256(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

describe("secure downloads", () => {
  beforeEach(() => {
    process.env.DOWNLOAD_SIGNING_SECRET = TEST_SECRET;
    vi.mocked(getStrategyById).mockReset();
    vi.mocked(getPaidOrderForDelivery).mockReset();
    vi.mocked(getLatestPaidStrategyOrder).mockReset();
    vi.mocked(recordDownload).mockReset();
    vi.mocked(recordDownload).mockResolvedValue(undefined as never);
    vi.mocked(pinOrderDeliveryDigest).mockReset();
    vi.mocked(pinOrderDeliveryDigest).mockResolvedValue(undefined as never);
    vi.mocked(pinStrategyPackageDigest).mockReset();
    vi.mocked(pinStrategyPackageDigest).mockResolvedValue(undefined as never);
  });

  afterAll(() => {
    if (originalSigningSecret === undefined) {
      delete process.env.DOWNLOAD_SIGNING_SECRET;
    } else {
      process.env.DOWNLOAD_SIGNING_SECRET = originalSigningSecret;
    }
  });

  it("fails closed when the dedicated signing secret is absent", () => {
    const token = strategyToken();
    delete process.env.DOWNLOAD_SIGNING_SECRET;

    expect(() => strategyToken()).toThrow(/DOWNLOAD_SIGNING_SECRET/);
    expect(verifyDownloadToken(token)).toEqual({
      ok: false,
      error: "Token verification unavailable",
    });
  });

  it("strictly verifies token signatures, kinds, ids and lifetimes", () => {
    const validToken = strategyToken();
    expect(verifyDownloadToken(validToken)).toMatchObject({
      ok: true,
      userId: 17,
      productKind: "strategy",
      productId: 6,
      orderId: ORDER_ID,
    });

    const decoded = Buffer.from(validToken, "base64url").toString("utf8");
    const parts = decoded.split(".");
    const sigIndex = parts.length - 1;
    parts[sigIndex] = `${parts[sigIndex][0] === "a" ? "b" : "a"}${parts[sigIndex].slice(1)}`;
    const tamperedToken = Buffer.from(parts.join("."), "utf8").toString(
      "base64url",
    );
    expect(verifyDownloadToken(tamperedToken).ok).toBe(false);

    // 改订单号 = 换一笔订单，必须重新签名才有效。
    const swappedOrder = Buffer.from(validToken, "base64url")
      .toString("utf8")
      .split(".");
    swappedOrder[4] = String(ORDER_ID + 1);
    expect(
      verifyDownloadToken(
        Buffer.from(swappedOrder.join("."), "utf8").toString("base64url"),
      ).ok,
    ).toBe(false);

    const future = Date.now() + 5 * 60 * 1000;
    expect(
      verifyDownloadToken(makeRawSignedToken(`v2.0.strategy.6.9.${future}`)).ok,
    ).toBe(false);
    expect(
      verifyDownloadToken(makeRawSignedToken(`v2.17.other.6.9.${future}`)).ok,
    ).toBe(false);
    expect(
      verifyDownloadToken(makeRawSignedToken(`v2.17.strategy.06.9.${future}`)).ok,
    ).toBe(false);
    expect(
      verifyDownloadToken(makeRawSignedToken(`v2.17.strategy.6.0.${future}`)).ok,
    ).toBe(false);
    expect(
      verifyDownloadToken(makeRawSignedToken(`v1.17.strategy.6.9.${future}`)).ok,
    ).toBe(false);
    expect(
      verifyDownloadToken(
        makeRawSignedToken(`v2.17.strategy.6.9.${Date.now() + 40 * 60 * 1000}`),
      ).ok,
    ).toBe(false);

    expect(() =>
      signDownloadToken({
        userId: 0,
        productKind: "strategy",
        productId: 6,
        orderId: ORDER_ID,
      }),
    ).toThrow(/Invalid download token claims/);
    expect(() =>
      signDownloadToken({
        userId: 17,
        productKind: "strategy",
        productId: 6,
        orderId: 0,
      }),
    ).toThrow(/Invalid download token claims/);
  });

  it("still accepts pre-upgrade tokens, which carry no order id", () => {
    // 修复上线前签发的旧格式令牌 TTL 只有 30 分钟；保留它是为了不打断在途客户。
    expect(verifyDownloadToken(legacyStrategyToken())).toMatchObject({
      ok: true,
      userId: 17,
      productKind: "strategy",
      productId: 6,
      orderId: null,
    });
  });

  it("streams a purchased EA through the backend and hides redirect targets", async () => {
    const file = Buffer.from("EA-BINARY-CONTENT");
    const upstream = createServer((req, res) => {
      if (req.url === "/entry") {
        res.writeHead(302, { Location: "/private/gold-ea.zip" });
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": file.length,
      });
      res.end(file);
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "Gold EA",
      downloadUrl: `${upstreamUrl}/entry`,
    } as never);

    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
        { redirect: "manual" },
      );
      const received = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(received).toEqual(file);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("content-disposition")).toBe(
        'attachment; filename="eaxau-strategy-6.zip"',
      );
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect([...response.headers.values()].join(" ")).not.toContain(
        upstreamUrl,
      );
      await vi.waitFor(() => {
        expect(recordDownload).toHaveBeenCalledWith(17, 6);
      });
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it("serves the build the order was paid for, not the product's current one", async () => {
    const paidBuild = Buffer.from("EA-BUILD-THE-CUSTOMER-PAID-FOR");
    const upstream = createServer((req, res) => {
      if (req.url !== "/builds/v1.ex5") {
        res.writeHead(404).end("wrong build");
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": paidBuild.length,
      });
      res.end(paidBuild);
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: `${upstreamUrl}/builds/v1.ex5`,
    } as never);
    // 商品已经换到 v2；已成交的订单不能跟着漂。
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "Gold EA",
      downloadUrl: `${upstreamUrl}/builds/v2.ex5`,
    } as never);

    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(paidBuild);
      expect(getStrategyById).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it("checks purchase permission again before resolving the storage URL", async () => {
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue(null as never);
    // A paid product: without a paid order the token holder gets nothing and the
    // storage URL is never fetched. The product row is read once so the route
    // can tell a paid product from a free one (see the free-product cases below);
    // that read is a local DB lookup, not a request to the storage host.
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "Paid EA",
      status: "published",
      saleMode: "direct",
      isFree: false,
      downloadUrl: "https://files.eaxau.example/paid-ea.zip",
    } as never);
    const app = await createDownloadApp({
      resolveHostname: async () => {
        throw new Error("storage host must not be resolved for an unauthorized caller");
      },
    });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(403);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("rejects non-HTTP storage URLs", async () => {
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "Unsafe EA",
      downloadUrl: "file:///etc/passwd",
    } as never);
    const app = await createDownloadApp();
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(502);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it.each([
    "http://127.0.0.1/private-ea.zip",
    "http://localhost/private-ea.zip",
    "http://169.254.169.254/latest/meta-data",
  ])("blocks private or metadata SSRF target %s", async (downloadUrl) => {
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "Blocked EA",
      downloadUrl,
    } as never);
    const app = await createDownloadApp();
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(502);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("blocks a public-looking hostname when DNS resolves it privately", async () => {
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "DNS Rebinding EA",
      downloadUrl: "https://files.eaxau.example/private-ea.zip",
    } as never);
    const app = await createDownloadApp({
      resolveHostname: async () => [{ address: "10.0.0.8", family: 4 }],
    });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(502);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("revalidates a redirect target before making the next request", async () => {
    let upstreamRequests = 0;
    const upstream = createServer((_req, res) => {
      upstreamRequests += 1;
      res.writeHead(302, {
        Location: "http://169.254.169.254/latest/meta-data",
      });
      res.end();
    });
    const upstreamUrl = new URL(await listen(upstream));

    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "Redirecting EA",
      downloadUrl: `http://downloads.eaxau.example:${upstreamUrl.port}/entry`,
    } as never);
    const app = await createDownloadApp({
      resolveHostname: async () => [{ address: "127.0.0.1", family: 4 }],
      isAddressAllowed: ({ address }) => address === "127.0.0.1",
    });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(502);
      expect(upstreamRequests).toBe(1);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it("resolves the order the token names, not the buyer's latest paid order", async () => {
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue(null as never);
    const app = await createDownloadApp();
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken(99))}`,
      );

      expect(response.status).toBe(403);
      expect(getPaidOrderForDelivery).toHaveBeenCalledWith({
        orderId: 99,
        userId: 17,
        strategyId: 6,
      });
      // 退款的那一笔不能借另一笔 paid 订单越权：交付侧压根不去找「最近一笔」。
      expect(getLatestPaidStrategyOrder).not.toHaveBeenCalled();
      expect(getStrategyById).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("falls back to the latest paid order only for pre-upgrade tokens", async () => {
    vi.mocked(getLatestPaidStrategyOrder).mockResolvedValue(null as never);
    const app = await createDownloadApp();
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(legacyStrategyToken())}`,
      );

      expect(response.status).toBe(403);
      expect(getLatestPaidStrategyOrder).toHaveBeenCalledWith(17, 6);
      expect(getPaidOrderForDelivery).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("pins the delivered bytes on the order and the product after a clean delivery", async () => {
    const file = Buffer.from("EA-BUILD-BYTES");
    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": file.length,
      });
      res.end(file);
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: `${upstreamUrl}/build.ex5`,
      deliverySha256: null,
      deliveryBytes: null,
    } as never);

    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(file);
      // 还没有内容身份的这一次，如实标 unpinned——不能对外说版本已经锁定。
      expect(response.headers.get("x-delivery-integrity")).toBe("unpinned");
      await vi.waitFor(() => {
        expect(pinOrderDeliveryDigest).toHaveBeenCalledWith(ORDER_ID, {
          sha256: sha256(file),
          bytes: file.length,
        });
        expect(pinStrategyPackageDigest).toHaveBeenCalledWith(6, {
          downloadUrl: `${upstreamUrl}/build.ex5`,
          sha256: sha256(file),
          bytes: file.length,
        });
      });
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it("leaves pre-upgrade orders unpinned so a legitimate rebuild still reaches them", async () => {
    const file = Buffer.from("EA-BUILD-BYTES");
    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": file.length,
      });
      res.end(file);
    });
    const upstreamUrl = await listen(upstream);

    // 修复之前建的老订单：没有发包地址快照，本来就没有版本约定。
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
      deliverySha256: null,
      deliveryBytes: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "Legacy EA",
      downloadUrl: `${upstreamUrl}/build.ex5`,
    } as never);

    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("x-delivery-integrity")).toBe("unpinned");
      await vi.waitFor(() => {
        expect(pinStrategyPackageDigest).toHaveBeenCalled();
      });
      // 给老订单钉上「第一次下到的那份字节」，只会在商品正常换包时把老客户挡在 409 外面。
      expect(pinOrderDeliveryDigest).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it("serves a pinned package when the bytes still match", async () => {
    const file = Buffer.from("EA-BUILD-BYTES");
    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": file.length,
      });
      res.end(file);
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: `${upstreamUrl}/build.ex5`,
      deliverySha256: sha256(file),
      deliveryBytes: file.length,
    } as never);

    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("x-delivery-integrity")).toBe("pinned");
      // 锁定过的包明着声明长度：客户端短收一截就是 HTTP 层面的错误，不用靠连接重置去猜。
      expect(response.headers.get("content-length")).toBe(String(file.length));
      expect(Buffer.from(await response.arrayBuffer())).toEqual(file);
      // 身份没变就不要反复改写订单上锁定的那一份。
      expect(pinOrderDeliveryDigest).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it("holds the package when the same URL now serves a different length", async () => {
    const replaced = Buffer.from("EA-BUILD-BYTES-THAT-GOT-LONGER");
    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": replaced.length,
      });
      res.end(replaced);
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: `${upstreamUrl}/build.ex5`,
      deliverySha256: sha256(Buffer.from("EA-BUILD-BYTES")),
      deliveryBytes: "EA-BUILD-BYTES".length,
    } as never);

    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );
      const body = await response.text();

      // 一个字节都没发出去，给的是能读懂的停发回执。
      expect(response.status).toBe(409);
      expect(body).toContain("DELIVERY_PACKAGE_MISMATCH");
      expect(body).not.toContain("EA-BUILD-BYTES-THAT-GOT-LONGER");
      expect(response.headers.get("content-disposition")).toBeNull();
      expect(recordDownload).not.toHaveBeenCalled();
      expect(pinOrderDeliveryDigest).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it("never lets a same-length replacement through as a complete file", async () => {
    // 长度一模一样、字节不一样：content-length 分辨不了，只有内容摘要能分辨。
    // 而且分多块发，摘要要到最后一块才算得出来——校验不过时客户端必须拿不到完整文件。
    const original = Buffer.concat([
      Buffer.from("A".repeat(64 * 1024)),
      Buffer.from("B".repeat(64 * 1024)),
    ]);
    const replaced = Buffer.concat([
      Buffer.from("A".repeat(64 * 1024)),
      Buffer.from("C".repeat(64 * 1024)),
    ]);
    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": replaced.length,
      });
      res.write(replaced.subarray(0, 64 * 1024));
      res.end(replaced.subarray(64 * 1024));
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: `${upstreamUrl}/build.ex5`,
      deliverySha256: sha256(original),
      deliveryBytes: original.length,
    } as never);

    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      let received: Buffer | null = null;
      let aborted = false;
      try {
        received = Buffer.from(await response.arrayBuffer());
      } catch {
        aborted = true;
      }

      // 要么停发，要么传输被掐断——绝不能是一份完整的、客户没买过的包。
      expect(aborted || response.status === 409).toBe(true);
      if (received) expect(received.equals(replaced)).toBe(false);
      // 走到流式这一步时，响应已经声明了订单锁定的长度：压住尾块之后客户端拿到的是
      // 「声明 N 字节、实收不足 N」的短收，而不是一次看起来正常收完的 chunked 传输。
      if (response.status === 200) {
        expect(response.headers.get("content-length")).toBe(String(original.length));
        expect(response.headers.get("transfer-encoding")).toBeNull();
      }
      expect(recordDownload).not.toHaveBeenCalled();
      expect(pinOrderDeliveryDigest).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it("rejects an oversized upstream response before streaming it", async () => {
    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": 100 * 1024 * 1024 + 1,
      });
      res.flushHeaders();
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      title: "Huge EA",
      downloadUrl: `${upstreamUrl}/huge.zip`,
    } as never);
    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(413);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });
});

describe("free product downloads (delivery gate at the last hop)", () => {
  const freeStrategy = {
    title: "Free EA",
    status: "published",
    saleMode: "direct",
    isFree: true,
    downloadUrl: "https://files.eaxau.example/free-ea.ex4",
  };

  function refuseUpstream(): SecureDownloadTestNetworkPolicy {
    return {
      resolveHostname: async () => {
        throw new Error("storage host must not be resolved");
      },
    };
  }

  beforeEach(() => {
    process.env.DOWNLOAD_SIGNING_SECRET = TEST_SECRET;
    vi.mocked(getStrategyById).mockReset();
    vi.mocked(getPaidOrderForDelivery).mockReset();
    vi.mocked(getLatestPaidStrategyOrder).mockReset();
    vi.mocked(recordDownload).mockReset();
    vi.mocked(recordDownload).mockResolvedValue(undefined as never);
  });

  afterAll(() => {
    if (originalSigningSecret === undefined) {
      delete process.env.DOWNLOAD_SIGNING_SECRET;
    } else {
      process.env.DOWNLOAD_SIGNING_SECRET = originalSigningSecret;
    }
  });

  it("streams a published free EA to a logged-in user who never purchased it", async () => {
    const file = Buffer.from("FREE-EA-CONTENT");
    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": file.length,
      });
      res.end(file);
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(getStrategyById).mockResolvedValue({
      ...freeStrategy,
      downloadUrl: `${upstreamUrl}/free-ea.ex4`,
    } as never);

    const app = await createDownloadApp({ isAddressAllowed: () => true });
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(freeToken())}`,
      );

      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(file);
      expect(response.headers.get("content-disposition")).toBe(
        'attachment; filename="eaxau-strategy-6.ex4"',
      );
      // 可审计：免费下载完成后同样落 downloads 表（用户 17 / 商品 6）。
      await vi.waitFor(() => {
        expect(recordDownload).toHaveBeenCalledWith(17, 6);
      });
    } finally {
      await close(app.server);
      await close(upstream);
    }
  });

  it.each([
    ["draft", { status: "draft" }],
    ["archived", { status: "archived" }],
    ["inquiry-only", { saleMode: "inquiry" }],
    ["not actually free", { isFree: false }],
  ])("refuses a %s product to a token holder without a purchase", async (_label, patch) => {
    vi.mocked(getStrategyById).mockResolvedValue({ ...freeStrategy, ...patch } as never);
    const app = await createDownloadApp(refuseUpstream());
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(freeToken())}`,
      );

      expect(response.status).toBe(403);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("never proxies a broker registration link as a free EA", async () => {
    vi.mocked(getStrategyById).mockResolvedValue({
      ...freeStrategy,
      downloadUrl: "https://kaibb.co/register/trader?link_id=a&referrer_id=b",
    } as never);
    const app = await createDownloadApp(refuseUpstream());
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(freeToken())}`,
      );

      expect(response.status).toBe(403);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("never proxies a broker registration link even to a paying buyer", async () => {
    // 修复前的老订单：没有发包快照，交付回落到商品当前地址。
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
      deliverySha256: null,
      deliveryBytes: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      ...freeStrategy,
      isFree: false,
      downloadUrl: "https://www.bluesyd-au.com/register/trader?link_id=a&referrer_id=b",
    } as never);
    const app = await createDownloadApp(refuseUpstream());
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(404);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("never proxies a broker registration link pinned on an order", async () => {
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: "https://kaibb.co/register/trader?link_id=a&referrer_id=b",
      deliverySha256: null,
      deliveryBytes: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({ ...freeStrategy, isFree: false } as never);
    const app = await createDownloadApp(refuseUpstream());
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(404);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("returns 404 for a purchased product whose file was cleared", async () => {
    // 修复前的老订单：没有发包快照，交付回落到商品当前地址。
    vi.mocked(getPaidOrderForDelivery).mockResolvedValue({
      id: ORDER_ID,
      deliveryUrl: null,
      deliverySha256: null,
      deliveryBytes: null,
    } as never);
    vi.mocked(getStrategyById).mockResolvedValue({
      ...freeStrategy,
      isFree: false,
      downloadUrl: null,
    } as never);
    const app = await createDownloadApp(refuseUpstream());
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(404);
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });
});
