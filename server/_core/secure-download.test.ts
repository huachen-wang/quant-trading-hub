import crypto from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getStrategyById: vi.fn(),
  hasUserPurchased: vi.fn(),
  recordDownload: vi.fn(),
}));

import { getStrategyById, hasUserPurchased, recordDownload } from "../db";
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

function strategyToken(): string {
  return signDownloadToken({
    userId: 17,
    productKind: "strategy",
    productId: 6,
  });
}

describe("secure downloads", () => {
  beforeEach(() => {
    process.env.DOWNLOAD_SIGNING_SECRET = TEST_SECRET;
    vi.mocked(getStrategyById).mockReset();
    vi.mocked(hasUserPurchased).mockReset();
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
    });

    const decoded = Buffer.from(validToken, "base64url").toString("utf8");
    const parts = decoded.split(".");
    parts[4] = `${parts[4][0] === "a" ? "b" : "a"}${parts[4].slice(1)}`;
    const tamperedToken = Buffer.from(parts.join("."), "utf8").toString(
      "base64url",
    );
    expect(verifyDownloadToken(tamperedToken).ok).toBe(false);

    const future = Date.now() + 5 * 60 * 1000;
    expect(
      verifyDownloadToken(makeRawSignedToken(`0.strategy.6.${future}`)).ok,
    ).toBe(false);
    expect(
      verifyDownloadToken(makeRawSignedToken(`17.other.6.${future}`)).ok,
    ).toBe(false);
    expect(
      verifyDownloadToken(makeRawSignedToken(`17.strategy.06.${future}`)).ok,
    ).toBe(false);
    expect(
      verifyDownloadToken(
        makeRawSignedToken(`17.strategy.6.${Date.now() + 40 * 60 * 1000}`),
      ).ok,
    ).toBe(false);

    expect(() =>
      signDownloadToken({
        userId: 0,
        productKind: "strategy",
        productId: 6,
      }),
    ).toThrow(/Invalid download token claims/);
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

    vi.mocked(hasUserPurchased).mockResolvedValue(true);
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

  it("checks purchase permission again before resolving the storage URL", async () => {
    vi.mocked(hasUserPurchased).mockResolvedValue(false);
    const app = await createDownloadApp();
    try {
      const response = await fetch(
        `${app.baseUrl}/api/download/secure?token=${encodeURIComponent(strategyToken())}`,
      );

      expect(response.status).toBe(403);
      expect(getStrategyById).not.toHaveBeenCalled();
      expect(recordDownload).not.toHaveBeenCalled();
    } finally {
      await close(app.server);
    }
  });

  it("rejects non-HTTP storage URLs", async () => {
    vi.mocked(hasUserPurchased).mockResolvedValue(true);
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
    vi.mocked(hasUserPurchased).mockResolvedValue(true);
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
    vi.mocked(hasUserPurchased).mockResolvedValue(true);
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

    vi.mocked(hasUserPurchased).mockResolvedValue(true);
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

  it("rejects an oversized upstream response before streaming it", async () => {
    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": 100 * 1024 * 1024 + 1,
      });
      res.flushHeaders();
    });
    const upstreamUrl = await listen(upstream);

    vi.mocked(hasUserPurchased).mockResolvedValue(true);
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
