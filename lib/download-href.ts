/**
 * 把服务端返回的相对下载路径（/api/download/secure?token=…）变成各端真正能打开的地址。
 *
 * - Web：浏览器能解析同源相对路径；配置了 API base 时拼上去
 *   （Expo dev 的 8081 页面要打 3000 的 API）。
 * - 原生（iOS / Android）：没有"当前 origin"。只有明确配置的可信 base URL 才拼接；
 *   没配或不可信时明确失败，由 UI 告诉用户，而不是把相对路径静默丢给 Linking.openURL。
 *
 * 纯函数，无 react-native 依赖，可直接单测。原生真机行为本轮未实测，见 report。
 */
export type DownloadHrefFailure =
  | "empty"
  | "unsupported_href"
  | "base_url_missing"
  | "base_url_untrusted";

export type DownloadHrefResult =
  | { ok: true; url: string }
  | { ok: false; reason: DownloadHrefFailure };

const ABSOLUTE_HTTP_RE = /^https?:\/\//i;
const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * 可信 base：绝对 http(s) URL，无用户名密码、无 query/hash；
 * 明文 http 只允许本机开发地址。
 */
export function parseTrustedApiBaseUrl(raw: string | null | undefined): URL | null {
  const value = raw?.trim() ?? "";
  if (!value || !ABSOLUTE_HTTP_RE.test(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  if (parsed.protocol === "http:" && !LOCAL_DEV_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }
  return parsed;
}

function joinBase(base: URL, href: string): string {
  const basePath = base.pathname.replace(/\/+$/, "");
  return `${base.origin}${basePath}${href}`;
}

export function resolveDownloadHref(
  href: string | null | undefined,
  options: { platform: string; baseUrl?: string | null },
): DownloadHrefResult {
  const value = href?.trim() ?? "";
  if (!value) return { ok: false, reason: "empty" };
  if (ABSOLUTE_HTTP_RE.test(value)) return { ok: true, url: value };
  if (HAS_SCHEME_RE.test(value) || value.startsWith("//") || !value.startsWith("/")) {
    return { ok: false, reason: "unsupported_href" };
  }

  const configured = options.baseUrl?.trim() ?? "";
  if (options.platform === "web") {
    // 同源相对路径由浏览器解析；配置了 base 才拼接。
    if (!configured) return { ok: true, url: value };
    const base = parseTrustedApiBaseUrl(configured);
    return base
      ? { ok: true, url: joinBase(base, value) }
      : { ok: false, reason: "base_url_untrusted" };
  }

  if (!configured) return { ok: false, reason: "base_url_missing" };
  const base = parseTrustedApiBaseUrl(configured);
  if (!base) return { ok: false, reason: "base_url_untrusted" };
  return { ok: true, url: joinBase(base, value) };
}

export const DOWNLOAD_HREF_FAILURE_MESSAGES: Record<DownloadHrefFailure, string> = {
  empty: "下载链接尚未生成，请稍后在「我的订单」重试或联系客服。",
  unsupported_href: "下载链接格式无效，已阻止打开。请联系客服核对。",
  base_url_missing:
    "当前 App 暂时无法打开下载链接。请改用网页版，在「我的订单」下载文件，或联系客服协助。",
  base_url_untrusted:
    "当前下载地址无法安全打开。请改用网页版，在「我的订单」下载文件，或联系客服协助。",
};

export function describeDownloadHrefFailure(reason: DownloadHrefFailure): string {
  return DOWNLOAD_HREF_FAILURE_MESSAGES[reason];
}
