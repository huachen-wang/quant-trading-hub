/**
 * Secure EA downloads.
 *
 * The signed URL only identifies an already-purchased product. The route checks
 * the purchase again and proxies the file so the storage URL never reaches the
 * browser.
 */

import crypto from "node:crypto";
import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { URL } from "node:url";
import type { Request, Response } from "express";
import { getStrategyById, hasUserPurchased, recordDownload } from "../db";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const TOKEN_CLOCK_SKEW_MS = 60 * 1000;
const MAX_TOKEN_LENGTH = 512;
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60 * 1000;
const MAX_UPSTREAM_REDIRECTS = 5;
const MAX_DNS_RESULTS = 32;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;

const BLOCKED_ADDRESSES = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED_ADDRESSES.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:2::", 48],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED_ADDRESSES.addSubnet(network, prefix, "ipv6");
}

type AddressResolver = (hostname: string) => Promise<readonly LookupAddress[]>;
type AddressPolicy = (address: LookupAddress) => boolean;

interface DownloadNetworkPolicy {
  resolveHostname: AddressResolver;
  isAddressAllowed: AddressPolicy;
}

export interface SecureDownloadTestNetworkPolicy {
  resolveHostname?: AddressResolver;
  isAddressAllowed?: AddressPolicy;
}

export type DownloadProductKind = "strategy" | "promo";

interface VerifiedDownloadToken {
  ok: true;
  userId: number;
  productKind: DownloadProductKind;
  productId: number;
}

interface InvalidDownloadToken {
  ok: false;
  error: string;
}

export type DownloadTokenVerification =
  | VerifiedDownloadToken
  | InvalidDownloadToken;

class DownloadTooLargeError extends Error {
  constructor() {
    super("Download exceeds the maximum allowed size");
    this.name = "DownloadTooLargeError";
  }
}

function getSigningSecret(): string {
  const secret = process.env.DOWNLOAD_SIGNING_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "DOWNLOAD_SIGNING_SECRET must be configured with at least 32 bytes",
    );
  }
  return secret;
}

function isProductKind(value: string): value is DownloadProductKind {
  return value === "strategy" || value === "promo";
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function parseCanonicalPositiveInteger(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return isPositiveSafeInteger(parsed) ? parsed : null;
}

function hmac(payload: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
}

function signaturesMatch(actual: string, expected: string): boolean {
  if (!SHA256_HEX_RE.test(actual) || !SHA256_HEX_RE.test(expected)) {
    return false;
  }

  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return (
    actualBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(actualBytes, expectedBytes)
  );
}

/** Generate a short-lived, HMAC-signed download token. */
export function signDownloadToken(opts: {
  userId: number;
  productKind: DownloadProductKind;
  productId: number;
}): string {
  if (
    !isPositiveSafeInteger(opts.userId) ||
    !isPositiveSafeInteger(opts.productId) ||
    !isProductKind(opts.productKind)
  ) {
    throw new TypeError("Invalid download token claims");
  }

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${opts.userId}.${opts.productKind}.${opts.productId}.${expiresAt}`;
  return Buffer.from(`${payload}.${hmac(payload)}`, "utf8").toString(
    "base64url",
  );
}

/** Verify format, claims, lifetime and signature without trusting decoded data. */
export function verifyDownloadToken(token: string): DownloadTokenVerification {
  try {
    if (
      token.length === 0 ||
      token.length > MAX_TOKEN_LENGTH ||
      !BASE64URL_RE.test(token)
    ) {
      return { ok: false, error: "Invalid token" };
    }

    const tokenBytes = Buffer.from(token, "base64url");
    if (tokenBytes.toString("base64url") !== token) {
      return { ok: false, error: "Invalid token" };
    }

    const parts = tokenBytes.toString("utf8").split(".");
    if (parts.length !== 5) {
      return { ok: false, error: "Invalid token" };
    }

    const [userIdClaim, productKindClaim, productIdClaim, expiresAtClaim, sig] =
      parts;
    const userId = parseCanonicalPositiveInteger(userIdClaim);
    const productId = parseCanonicalPositiveInteger(productIdClaim);
    const expiresAt = parseCanonicalPositiveInteger(expiresAtClaim);
    if (
      userId === null ||
      productId === null ||
      expiresAt === null ||
      !isProductKind(productKindClaim)
    ) {
      return { ok: false, error: "Invalid token" };
    }

    const now = Date.now();
    if (
      expiresAt <= now ||
      expiresAt > now + TOKEN_TTL_MS + TOKEN_CLOCK_SKEW_MS
    ) {
      return { ok: false, error: "Invalid token" };
    }

    const payload = `${userIdClaim}.${productKindClaim}.${productIdClaim}.${expiresAtClaim}`;
    if (!signaturesMatch(sig, hmac(payload))) {
      return { ok: false, error: "Invalid token" };
    }

    return {
      ok: true,
      userId,
      productKind: productKindClaim,
      productId,
    };
  } catch {
    // A missing production secret must fail closed, never fall back to a known key.
    return { ok: false, error: "Token verification unavailable" };
  }
}

function validateUpstreamUrl(rawUrl: string, baseUrl?: URL): URL {
  const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new Error("Unsupported upstream URL");
  }
  return url;
}

function normalizedHostname(url: URL): string {
  return url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "")
    .toLowerCase();
}

function isBlockedHostname(hostname: string): boolean {
  if (isIP(hostname) !== 0) return false;
  if (!hostname.includes(".")) return true;
  return [
    ".localhost",
    ".localdomain",
    ".local",
    ".lan",
    ".internal",
    ".home.arpa",
  ].some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
}

function isPublicAddress({ address, family }: LookupAddress): boolean {
  const detectedFamily = isIP(address);
  if ((family !== 4 && family !== 6) || detectedFamily !== family) {
    return false;
  }
  return !BLOCKED_ADDRESSES.check(address, family === 4 ? "ipv4" : "ipv6");
}

const resolveHostname: AddressResolver = async (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

const PRODUCTION_NETWORK_POLICY: DownloadNetworkPolicy = {
  resolveHostname,
  isAddressAllowed: isPublicAddress,
};

async function waitForNetworkOperation<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

async function resolveAndValidateTarget(
  url: URL,
  policy: DownloadNetworkPolicy,
  signal: AbortSignal,
): Promise<LookupAddress> {
  signal.throwIfAborted();
  const hostname = normalizedHostname(url);
  if (!hostname || isBlockedHostname(hostname)) {
    throw new Error("Blocked upstream hostname");
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? ([{ address: hostname, family: literalFamily }] as const)
    : await waitForNetworkOperation(policy.resolveHostname(hostname), signal);
  if (addresses.length === 0 || addresses.length > MAX_DNS_RESULTS) {
    throw new Error("Upstream hostname did not resolve safely");
  }

  for (const address of addresses) {
    const detectedFamily = isIP(address.address);
    if (
      (address.family !== 4 && address.family !== 6) ||
      detectedFamily !== address.family ||
      !policy.isAddressAllowed(address)
    ) {
      throw new Error("Blocked upstream address");
    }
  }

  return addresses[0];
}

function pinnedLookup(address: LookupAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address]);
      return;
    }
    callback(null, address.address, address.family);
  };
}

async function requestDownload(
  url: URL,
  signal: AbortSignal,
  policy: DownloadNetworkPolicy,
): Promise<IncomingMessage> {
  const pinnedAddress = await resolveAndValidateTarget(url, policy, signal);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<IncomingMessage>((resolve, reject) => {
    const upstreamRequest = request(
      url,
      {
        method: "GET",
        signal,
        agent: false,
        lookup: pinnedLookup(pinnedAddress),
        maxHeaderSize: 16 * 1024,
        headers: {
          Accept: "application/octet-stream,*/*;q=0.8",
          "User-Agent": "EAXAU-Secure-Download/1.0",
        },
      },
      resolve,
    );
    upstreamRequest.once("error", reject);
    upstreamRequest.end();
  });
}

async function fetchDownload(
  initialUrl: string,
  signal: AbortSignal,
  policy: DownloadNetworkPolicy,
): Promise<{ response: IncomingMessage; finalUrl: URL }> {
  let currentUrl = validateUpstreamUrl(initialUrl);

  for (let redirectCount = 0; ; redirectCount += 1) {
    const response = await requestDownload(currentUrl, signal, policy);
    const status = response.statusCode ?? 0;

    if (status >= 300 && status < 400) {
      const location = response.headers.location;
      response.destroy();
      if (!location || redirectCount >= MAX_UPSTREAM_REDIRECTS) {
        throw new Error("Invalid upstream redirect");
      }
      currentUrl = validateUpstreamUrl(location, currentUrl);
      continue;
    }

    if (status < 200 || status >= 300) {
      response.destroy();
      throw new Error("Upstream download unavailable");
    }

    return { response, finalUrl: currentUrl };
  }
}

function readContentLength(response: IncomingMessage): number | null {
  const rawLength = response.headers["content-length"];
  if (rawLength === undefined) return null;
  if (Array.isArray(rawLength)) {
    throw new Error("Invalid upstream content length");
  }
  if (!/^\d+$/.test(rawLength)) {
    throw new Error("Invalid upstream content length");
  }
  const length = Number(rawLength);
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new Error("Invalid upstream content length");
  }
  return length;
}

function createSizeLimiter(maxBytes: number): Transform {
  let receivedBytes = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        callback(new DownloadTooLargeError());
        return;
      }
      callback(null, chunk);
    },
  });
}

function safeContentType(response: IncomingMessage): string {
  const contentType = response.headers["content-type"];
  if (contentType && contentType.length <= 200 && !/[\r\n]/.test(contentType)) {
    return contentType;
  }
  return "application/octet-stream";
}

function safeDownloadFilename(productId: number, finalUrl: URL): string {
  const extension = path.extname(finalUrl.pathname).toLowerCase();
  const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension)
    ? extension
    : ".bin";
  return `eaxau-strategy-${productId}${safeExtension}`;
}

function sendProxyError(res: Response, error: unknown): void {
  if (res.headersSent) {
    res.destroy(error instanceof Error ? error : undefined);
    return;
  }

  if (error instanceof DownloadTooLargeError) {
    res.status(413).send("Download is too large");
    return;
  }
  if (error instanceof Error && error.name === "AbortError") {
    res.status(504).send("Download timed out");
    return;
  }
  res.status(502).send("Download unavailable");
}

type SecureDownloadHandler = (req: Request, res: Response) => Promise<void>;

/** Verify ownership again, then stream the file without exposing its source URL. */
async function handleSecureDownload(
  req: Request,
  res: Response,
  networkPolicy: DownloadNetworkPolicy,
) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).send("Missing token");
    return;
  }

  const verified = verifyDownloadToken(token);
  if (!verified.ok || verified.productKind !== "strategy") {
    res.status(403).send("Forbidden");
    return;
  }

  try {
    // Token possession is not enough: purchase permission is checked every time.
    const purchased = await hasUserPurchased(
      verified.userId,
      verified.productId,
    );
    if (!purchased) {
      res.status(403).send("Forbidden");
      return;
    }

    const strategy = await getStrategyById(verified.productId);
    if (!strategy?.downloadUrl) {
      res.status(404).send("Download not found");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    timeout.unref?.();
    const abortForDisconnectedClient = () => controller.abort();
    req.once("aborted", abortForDisconnectedClient);
    res.once("close", abortForDisconnectedClient);

    try {
      const { response, finalUrl } = await fetchDownload(
        strategy.downloadUrl,
        controller.signal,
        networkPolicy,
      );
      const contentLength = readContentLength(response);
      if (contentLength !== null && contentLength > MAX_DOWNLOAD_BYTES) {
        response.destroy();
        throw new DownloadTooLargeError();
      }

      res.status(200);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Content-Type", safeContentType(response));
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeDownloadFilename(verified.productId, finalUrl)}"`,
      );
      res.setHeader("X-Content-Type-Options", "nosniff");

      await pipeline(response, createSizeLimiter(MAX_DOWNLOAD_BYTES), res);

      // Count only downloads that finished streaming successfully.
      try {
        await recordDownload(verified.userId, verified.productId);
      } catch {
        // Download statistics must not make a paid file unavailable.
      }
    } catch (error) {
      sendProxyError(res, error);
    } finally {
      clearTimeout(timeout);
      req.off("aborted", abortForDisconnectedClient);
      res.off("close", abortForDisconnectedClient);
      controller.abort();
    }
  } catch {
    if (!res.headersSent) {
      res.status(500).send("Download unavailable");
    }
  }
}

export const secureDownloadHandler: SecureDownloadHandler = (req, res) =>
  handleSecureDownload(req, res, PRODUCTION_NETWORK_POLICY);

/**
 * Explicit dependency injection for local integration tests only. There is no
 * environment-variable escape hatch in the production route.
 */
export function createSecureDownloadHandlerForTests(
  overrides: SecureDownloadTestNetworkPolicy = {},
): SecureDownloadHandler {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Test network policy is only available under NODE_ENV=test",
    );
  }
  const policy: DownloadNetworkPolicy = {
    resolveHostname:
      overrides.resolveHostname ?? PRODUCTION_NETWORK_POLICY.resolveHostname,
    isAddressAllowed:
      overrides.isAddressAllowed ?? PRODUCTION_NETWORK_POLICY.isAddressAllowed,
  };
  return (req, res) => handleSecureDownload(req, res, policy);
}

/** Register the secure download endpoint on the Express app. */
export function registerSecureDownloadRoute(app: {
  get(path: string, handler: typeof secureDownloadHandler): unknown;
}) {
  app.get("/api/download/secure", secureDownloadHandler);
  console.log("[secure-download] route registered: /api/download/secure");
}
