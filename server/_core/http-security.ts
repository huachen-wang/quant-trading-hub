/**
 * Cloudflare Web Analytics：边缘自动往页面里插 static.cloudflareinsights.com/beacon.min.js，
 * 再把数据发到 cloudflareinsights.com。原来 CSP 没放行脚本，网站统计一直没在跑（2026-10-17）。
 * app/_layout.tsx 里 <Head> 的 CSP meta 同样放行，两份策略同时生效。
 */
export const CLOUDFLARE_INSIGHTS_SCRIPT = "https://static.cloudflareinsights.com";
export const CLOUDFLARE_INSIGHTS_CONNECT = "https://cloudflareinsights.com";

export function buildContentSecurityPolicy(production: boolean) {
  const scriptSources = ["'self'", "'unsafe-inline'", CLOUDFLARE_INSIGHTS_SCRIPT];
  const connectSources = ["'self'", "https:", "wss:", CLOUDFLARE_INSIGHTS_CONNECT];
  if (!production) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("http:", "ws:");
  }
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
