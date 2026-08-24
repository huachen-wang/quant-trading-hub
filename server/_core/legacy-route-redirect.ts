import type { RequestHandler } from "express";

const LEGACY_TABS_ROUTE =
  /^\/\(tabs\)(?:\/(index|market|group-buy|subscribe|profile|favorites|moments))?\/?$/i;

const LEGACY_TABS_DESTINATIONS: Readonly<Record<string, string>> = {
  index: "/market",
  market: "/market",
  "group-buy": "/group-buy",
  subscribe: "/subscribe",
  profile: "/profile",
  favorites: "/favorites",
  moments: "/moments",
};

function splitOriginalUrl(originalUrl: string): {
  rawPath: string;
  rawQuery: string | null;
} {
  const queryStart = originalUrl.indexOf("?");
  if (queryStart === -1) {
    return { rawPath: originalUrl, rawQuery: null };
  }

  return {
    rawPath: originalUrl.slice(0, queryStart),
    rawQuery: originalUrl.slice(queryStart + 1),
  };
}

/**
 * Expo Router group names are implementation details and must not appear in a
 * public URL. Older links exposed /(tabs), so canonicalize only the known
 * legacy page matrix before the SPA router sees it.
 */
export function getLegacyRouteRedirect(originalUrl: string): string | null {
  const { rawPath, rawQuery } = splitOriginalUrl(originalUrl);
  let candidate = rawPath;

  // One decode handles normal URL encoding. A second handles links that were
  // encoded before being copied into another URL, without matching other paths.
  for (let decodeCount = 0; decodeCount <= 2; decodeCount += 1) {
    const legacyMatch = candidate.match(LEGACY_TABS_ROUTE);
    if (legacyMatch) {
      const legacyPage = legacyMatch[1]?.toLowerCase();
      const destination = legacyPage
        ? LEGACY_TABS_DESTINATIONS[legacyPage]
        : "/market";

      return rawQuery === null ? destination : `${destination}?${rawQuery}`;
    }

    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    } catch {
      return null;
    }
  }

  return null;
}

export const legacyRouteRedirect: RequestHandler = (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  const redirectTarget = getLegacyRouteRedirect(req.originalUrl);
  if (!redirectTarget) {
    next();
    return;
  }

  // Keep this temporary so a browser cannot retain an obsolete routing rule
  // indefinitely if the public route structure changes again.
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, redirectTarget);
};
