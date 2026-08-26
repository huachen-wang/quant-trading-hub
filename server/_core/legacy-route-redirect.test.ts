import { describe, expect, it, vi } from "vitest";
import {
  getLegacyRouteRedirect,
  legacyRouteRedirect,
} from "./legacy-route-redirect";

describe("legacy Expo group route compatibility", () => {
  it.each([
    ["/(tabs)", "/market"],
    ["/(tabs)/", "/market"],
    ["/(tabs)/index", "/market"],
    ["/(tabs)/index/", "/market"],
    ["/(tabs)/market", "/market"],
    ["/(tabs)/group-buy", "/group-buy"],
    ["/(tabs)/subscribe/", "/subscribe"],
    ["/(tabs)/profile", "/profile"],
    ["/(tabs)/favorites", "/favorites"],
    ["/(tabs)/moments", "/moments"],
    ["/%28tabs%29", "/market"],
    ["/%28tabs%29/market", "/market"],
    ["/%28tabs%29%2Fgroup-buy", "/group-buy"],
    ["/%2528tabs%2529", "/market"],
    ["/%2528tabs%2529%252Findex", "/market"],
    ["/%2528tabs%2529%252Fprofile", "/profile"],
    ["/(tabs)?utm_source=legacy", "/market?utm_source=legacy"],
    [
      "/%28tabs%29/favorites?next=%2Fallocate&campaign=a%3Fb",
      "/favorites?next=%2Fallocate&campaign=a%3Fb",
    ],
  ])("redirects %s to %s", (originalUrl, expected) => {
    expect(getLegacyRouteRedirect(originalUrl)).toBe(expected);
  });

  it.each([
    "/",
    "/tabs",
    "/(tabs)/allocate",
    "/prefix/(tabs)",
    "/%28tabs%29/allocate",
    "/%E0%A4%A",
  ])("does not redirect unrelated or malformed path %s", (originalUrl) => {
    expect(getLegacyRouteRedirect(originalUrl)).toBeNull();
  });

  it("returns a no-store 302 before the SPA handles a legacy GET", () => {
    const setHeader = vi.fn();
    const redirect = vi.fn();
    const next = vi.fn();

    legacyRouteRedirect(
      { method: "GET", originalUrl: "/%28tabs%29/index?ref=old" } as never,
      { setHeader, redirect } as never,
      next,
    );

    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(redirect).toHaveBeenCalledWith(302, "/market?ref=old");
    expect(next).not.toHaveBeenCalled();
  });

  it("does not redirect mutation requests", () => {
    const redirect = vi.fn();
    const next = vi.fn();

    legacyRouteRedirect(
      { method: "POST", originalUrl: "/(tabs)" } as never,
      { setHeader: vi.fn(), redirect } as never,
      next,
    );

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
