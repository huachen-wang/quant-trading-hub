export function buildContentSecurityPolicy(production: boolean) {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  const connectSources = ["'self'", "https:", "wss:"];
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
