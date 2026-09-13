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
import { PassThrough, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { URL } from "node:url";
import type { Request, Response } from "express";
import {
  getLatestPaidStrategyOrder,
  getPaidOrderForDelivery,
  getStrategyById,
  pinOrderDeliveryDigest,
  pinStrategyPackageDigest,
  recordDownload,
} from "../db";

const TOKEN_VERSION = "v2";
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
  /**
   * 这张令牌绑定的订单。
   *
   * `null` = 本次修复之前签发的旧格式令牌（没有订单号）。旧令牌 TTL 只有 30 分钟，
   * 所以这个回落窗口最多存在到「上线 + 30 分钟」，之后不会再有任何旧令牌能通过验签。
   */
  orderId: number | null;
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

/**
 * 取回来的字节跟订单锁定的那一份对不上。
 *
 * 这是「停发 + 待补发」，不是「发一份差不多的」：发包地址没变但内容被换过，
 * 客户拿到的就不是他付款买到的那一版。
 */
class DeliveryIntegrityError extends Error {
  constructor(readonly detail: string) {
    super(`Delivered bytes do not match the pinned package: ${detail}`);
    this.name = "DeliveryIntegrityError";
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

/**
 * Generate a short-lived, HMAC-signed download token bound to one paid order.
 *
 * 令牌必须带订单号。只带 user+product 的话，同一个用户同一件商品的多笔已付订单
 * 共用一张令牌语义，交付侧只能去猜「哪一笔」——猜错就发错版本，而且退款的那一笔
 * 还能借另一笔 paid 订单继续下载。
 */
export function signDownloadToken(opts: {
  userId: number;
  productKind: DownloadProductKind;
  productId: number;
  orderId: number;
}): string {
  if (
    !isPositiveSafeInteger(opts.userId) ||
    !isPositiveSafeInteger(opts.productId) ||
    !isPositiveSafeInteger(opts.orderId) ||
    !isProductKind(opts.productKind)
  ) {
    throw new TypeError("Invalid download token claims");
  }

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${TOKEN_VERSION}.${opts.userId}.${opts.productKind}.${opts.productId}.${opts.orderId}.${expiresAt}`;
  return Buffer.from(`${payload}.${hmac(payload)}`, "utf8").toString(
    "base64url",
  );
}

/**
 * Verify format, claims, lifetime and signature without trusting decoded data.
 *
 * 认两种格式：
 *  - `v2.<user>.<kind>.<product>.<order>.<exp>.<sig>` —— 当前格式，绑定到具体订单。
 *  - `<user>.<kind>.<product>.<exp>.<sig>` —— 本次修复之前签发的旧格式，没有订单号。
 *    旧格式只可能来自修复上线前签发的令牌，TTL 30 分钟，上线半小时后自然绝迹；
 *    保留它只是为了不打断在途客户的下载，交付侧会按旧口径（最近一笔已付订单）回落。
 */
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
    const isCurrentFormat = parts.length === 7 && parts[0] === TOKEN_VERSION;
    const isLegacyFormat = parts.length === 5;
    if (!isCurrentFormat && !isLegacyFormat) {
      return { ok: false, error: "Invalid token" };
    }

    const claims = isCurrentFormat ? parts.slice(1, -1) : parts.slice(0, -1);
    const sig = parts[parts.length - 1];
    const [userIdClaim, productKindClaim, productIdClaim] = claims;
    const orderIdClaim = isCurrentFormat ? claims[3] : null;
    const expiresAtClaim = isCurrentFormat ? claims[4] : claims[3];

    const userId = parseCanonicalPositiveInteger(userIdClaim);
    const productId = parseCanonicalPositiveInteger(productIdClaim);
    const expiresAt = parseCanonicalPositiveInteger(expiresAtClaim);
    const orderId =
      orderIdClaim === null ? null : parseCanonicalPositiveInteger(orderIdClaim);
    if (
      userId === null ||
      productId === null ||
      expiresAt === null ||
      (isCurrentFormat && orderId === null) ||
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

    const payload = parts.slice(0, -1).join(".");
    if (!signaturesMatch(sig, hmac(payload))) {
      return { ok: false, error: "Invalid token" };
    }

    return {
      ok: true,
      userId,
      productKind: productKindClaim,
      productId,
      orderId,
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

interface PinnedPackage {
  sha256: string;
  bytes: number;
}

interface DeliveryGuard {
  stream: Transform;
  /** 流完之后才有值：这次实际取到的字节身份。 */
  measured(): PinnedPackage | null;
}

/**
 * 限流 + 量内容身份，同时保证「校验不过就发不出完整文件」。
 *
 * 摘要要读到最后一个字节才算得出来，所以这里**压着最后一块不转发**：
 * flush 时摘要对得上才把它放出去，对不上就直接报错、连接被掐断，
 * 客户端拿到的是残缺传输，而不是一份看起来完整、其实不是所购版本的文件。
 *
 * 内存占用是「一块」，不是「一整包」——大文件不会被读进内存。
 */
function createDeliveryGuard(
  maxBytes: number,
  pinned: PinnedPackage | null,
): DeliveryGuard {
  const hash = crypto.createHash("sha256");
  let receivedBytes = 0;
  let heldChunk: Buffer | null = null;
  let measured: PinnedPackage | null = null;

  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        callback(new DownloadTooLargeError());
        return;
      }
      hash.update(chunk);
      const previous = heldChunk;
      heldChunk = chunk;
      callback(null, previous ?? undefined);
    },
    flush(callback) {
      measured = { sha256: hash.digest("hex"), bytes: receivedBytes };
      if (
        pinned &&
        (measured.sha256 !== pinned.sha256 || measured.bytes !== pinned.bytes)
      ) {
        callback(
          new DeliveryIntegrityError(
            `sha256 ${measured.sha256.slice(0, 12)}…/${measured.bytes}B vs pinned ${pinned.sha256.slice(0, 12)}…/${pinned.bytes}B`,
          ),
        );
        return;
      }
      callback(null, heldChunk ?? undefined);
    },
  });

  return { stream, measured: () => measured };
}

/** 订单上锁定的内容身份；两列都齐了才算数。 */
function pinnedPackageOf(order: {
  deliverySha256?: string | null;
  deliveryBytes?: number | null;
}): PinnedPackage | null {
  const sha256 = order.deliverySha256;
  const bytes = order.deliveryBytes;
  if (!sha256 || !SHA256_HEX_RE.test(sha256)) return null;
  if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes < 0) {
    return null;
  }
  return { sha256, bytes };
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

/**
 * 停发说明。给的是「等补发」，不是一句 502——客户付过款，得知道这不是他的问题。
 * 前缀是稳定的机器码，方便客服/工单按它检索。
 */
const PACKAGE_MISMATCH_MESSAGE =
  "DELIVERY_PACKAGE_MISMATCH 交付包与本笔订单锁定的版本不一致，已暂停发放以免发错版本。请联系客服并附上订单号，我们会核对后补发。";

function sendProxyError(res: Response, error: unknown): void {
  if (error instanceof DeliveryIntegrityError) {
    if (!res.headersSent) {
      // 还没写出任何字节：给一个能读懂的停发回执，而不是半截文件。
      res.removeHeader("Content-Disposition");
      res.removeHeader("Content-Type");
      res.setHeader("X-Delivery-Integrity", "mismatch");
      res.status(409).type("text/plain; charset=utf-8").send(PACKAGE_MISMATCH_MESSAGE);
      return;
    }
    // 已经在流了：掐断连接。客户端拿到的是残缺传输，不是完整的错版本。
    res.destroy(error);
    return;
  }

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
    // Token possession is not enough: the order is re-checked every time.
    // 令牌带订单号时就按那一笔订单判，不去猜「最近一笔」——猜错就会发错版本，
    // 而且退款的那一笔还能借另一笔 paid 订单继续下载。
    const paidOrder = verified.orderId
      ? await getPaidOrderForDelivery({
          orderId: verified.orderId,
          userId: verified.userId,
          strategyId: verified.productId,
        })
      : // 修复上线前签发的旧格式令牌（无订单号）：按旧口径回落，TTL 30 分钟后绝迹。
        await getLatestPaidStrategyOrder(verified.userId, verified.productId);
    if (!paidOrder) {
      res.status(403).send("Forbidden");
      return;
    }

    // Serve the build the buyer paid for. Orders created before delivery
    // snapshots exist fall back to whatever the product points at today.
    const pinnedUrl = paidOrder.deliveryUrl;
    const downloadUrl =
      pinnedUrl || (await getStrategyById(verified.productId))?.downloadUrl;
    if (!downloadUrl) {
      res.status(404).send("Download not found");
      return;
    }

    // 地址锁不住字节：同一个 URL 的内容可以被就地换掉。有内容身份就按它核对，
    // 没有（老订单 / 这个发包地址还没量过）就如实标 unpinned，并在本次交付中量出来。
    const pinnedPackage = pinnedPackageOf(paidOrder);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    const abortForDisconnectedClient = () => controller.abort();
    req.once("aborted", abortForDisconnectedClient);
    res.once("close", abortForDisconnectedClient);

    try {
      const { response, finalUrl } = await fetchDownload(
        downloadUrl,
        controller.signal,
        networkPolicy,
      );
      const contentLength = readContentLength(response);
      if (contentLength !== null && contentLength > MAX_DOWNLOAD_BYTES) {
        response.destroy();
        throw new DownloadTooLargeError();
      }
      // 长度就对不上的，一个字节都不用发：直接给可解释的停发回执。
      if (pinnedPackage && contentLength !== null && contentLength !== pinnedPackage.bytes) {
        response.destroy();
        throw new DeliveryIntegrityError(
          `content-length ${contentLength}B vs pinned ${pinnedPackage.bytes}B`,
        );
      }

      res.status(200);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Content-Type", safeContentType(response));
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeDownloadFilename(verified.productId, finalUrl)}"`,
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      // 如实标：pinned = 这次交付按订单锁定的内容身份核对过；
      // unpinned = 这笔订单还没有内容身份，本次只是把它量下来，不算校验过。
      res.setHeader("X-Delivery-Integrity", pinnedPackage ? "pinned" : "unpinned");
      // 知道该发多少字节就明着声明。摘要要到最后一块才算得出来，多块文件校验不过时
      // 只能「压住尾块 + 掐断连接」——不声明长度的话那是一次 chunked 传输，客户端只能
      // 从连接被重置去推断出了问题；声明了长度，短收就是 HTTP 层面的硬错误，
      // 任何客户端都会当成下载失败，而不是一份少了一截的「已购版本」。
      if (pinnedPackage) {
        res.setHeader("Content-Length", String(pinnedPackage.bytes));
      }

      const guard = createDeliveryGuard(MAX_DOWNLOAD_BYTES, pinnedPackage);
      // `pipeline` 出错会把目的流一起销毁。中间垫一层 `.pipe()`（经典管道不传播错误、
      // 不销毁目的流），这样「一个字节都还没发出去」时 res 还活着，能回一个能读懂的
      // 停发回执，而不是让客户端看到一次莫名其妙的连接重置。
      const relay = new PassThrough();
      relay.pipe(res);
      await pipeline(response, guard.stream, relay);

      // Count only downloads that finished streaming successfully.
      try {
        await recordDownload(verified.userId, verified.productId);
      } catch {
        // Download statistics must not make a paid file unavailable.
      }
      // 把量到的内容身份补上：订单只补空值（不覆盖已锁定的身份），商品只在
      // 「现在挂的还是这个地址」时记录。都失败也不能让已付款的文件发不出去。
      const measured = guard.measured();
      if (measured) {
        try {
          // 只给「下单时确实锁过发包地址」的订单补内容身份。修复前建的老订单本来就
          // 没有版本约定，交付一直是跟着商品当前地址走的；给它们钉上「第一次下到的
          // 那份字节」，只会在商品正常换包时把老客户挡在 409 外面。
          if (!pinnedPackage && paidOrder.deliveryUrl) {
            await pinOrderDeliveryDigest(paidOrder.id, measured);
          }
          await pinStrategyPackageDigest(verified.productId, {
            downloadUrl,
            ...measured,
          });
        } catch {
          // Pinning is bookkeeping; a paid file must stay deliverable without it.
        }
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
