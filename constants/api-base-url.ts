export type WebLocationLike = {
  protocol: string;
  hostname: string;
  port?: string;
  origin?: string;
};

export function resolveWebApiBaseUrl(location: WebLocationLike, configuredBaseUrl = ""): string {
  const { protocol, hostname, port, origin } = location;

  // Production safeguard: for eaxau domains, always use same-origin relative API path.
  // This avoids cross-origin preflight/redirect issues between apex and www.
  if (hostname === "eaxau.com" || hostname === "www.eaxau.com") {
    return "";
  }

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Expo dev web runs on 8081 while the API server runs on 3000.
    if (port === "8081") {
      return `${protocol}//${hostname}:3000`;
    }

    // Production previews and bundled local servers should call the same origin.
    return origin || `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  if (hostname.startsWith("8081-")) {
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    return `${protocol}//${apiHostname}`;
  }

  return origin || `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}
