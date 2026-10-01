import { describe, expect, it } from "vitest";
import {
  DOWNLOAD_HREF_FAILURE_MESSAGES,
  describeDownloadHrefFailure,
  parseTrustedApiBaseUrl,
  resolveDownloadHref,
} from "../lib/download-href";

const RELATIVE = "/api/download/secure?token=abc.def";

describe("resolveDownloadHref on web", () => {
  it("keeps a same-origin relative path when no API base is configured", () => {
    expect(resolveDownloadHref(RELATIVE, { platform: "web", baseUrl: "" })).toEqual({
      ok: true,
      url: RELATIVE,
    });
    expect(resolveDownloadHref(RELATIVE, { platform: "web" })).toEqual({ ok: true, url: RELATIVE });
  });

  it("prefixes the configured web API base (Expo dev 8081 page → 3000 API)", () => {
    expect(
      resolveDownloadHref(RELATIVE, { platform: "web", baseUrl: "http://localhost:3000" }),
    ).toEqual({ ok: true, url: `http://localhost:3000${RELATIVE}` });
    expect(
      resolveDownloadHref(RELATIVE, { platform: "web", baseUrl: "https://3000-sandbox.example.dev" }),
    ).toEqual({ ok: true, url: `https://3000-sandbox.example.dev${RELATIVE}` });
  });

  it("refuses an untrusted configured base even on web", () => {
    expect(
      resolveDownloadHref(RELATIVE, { platform: "web", baseUrl: "http://api.example.com" }),
    ).toEqual({ ok: false, reason: "base_url_untrusted" });
  });
});

describe("resolveDownloadHref on native", () => {
  it.each(["ios", "android"])("fails clearly on %s when no base URL is configured", (platform) => {
    expect(resolveDownloadHref(RELATIVE, { platform, baseUrl: "" })).toEqual({
      ok: false,
      reason: "base_url_missing",
    });
    expect(resolveDownloadHref(RELATIVE, { platform, baseUrl: null })).toEqual({
      ok: false,
      reason: "base_url_missing",
    });
    expect(resolveDownloadHref(RELATIVE, { platform })).toEqual({
      ok: false,
      reason: "base_url_missing",
    });
  });

  it("joins a trusted https base, tolerating trailing slashes and path prefixes", () => {
    expect(resolveDownloadHref(RELATIVE, { platform: "ios", baseUrl: "https://eaxau.com" })).toEqual({
      ok: true,
      url: `https://eaxau.com${RELATIVE}`,
    });
    expect(resolveDownloadHref(RELATIVE, { platform: "ios", baseUrl: "https://eaxau.com/" })).toEqual({
      ok: true,
      url: `https://eaxau.com${RELATIVE}`,
    });
    expect(
      resolveDownloadHref(RELATIVE, { platform: "android", baseUrl: "  https://api.eaxau.com/v1/  " }),
    ).toEqual({ ok: true, url: `https://api.eaxau.com/v1${RELATIVE}` });
  });

  it("allows plain http only for local development hosts", () => {
    expect(resolveDownloadHref(RELATIVE, { platform: "ios", baseUrl: "http://localhost:3000" })).toEqual({
      ok: true,
      url: `http://localhost:3000${RELATIVE}`,
    });
    expect(resolveDownloadHref(RELATIVE, { platform: "ios", baseUrl: "http://127.0.0.1:3000" })).toEqual({
      ok: true,
      url: `http://127.0.0.1:3000${RELATIVE}`,
    });
    expect(resolveDownloadHref(RELATIVE, { platform: "ios", baseUrl: "http://eaxau.com" })).toEqual({
      ok: false,
      reason: "base_url_untrusted",
    });
    expect(resolveDownloadHref(RELATIVE, { platform: "ios", baseUrl: "http://192.168.1.20:3000" })).toEqual({
      ok: false,
      reason: "base_url_untrusted",
    });
  });

  it.each([
    "https://user:pass@eaxau.com",
    "https://eaxau.com/?x=1",
    "https://eaxau.com/#frag",
    "ftp://eaxau.com",
    "eaxau.com",
    "//eaxau.com",
    "not a url",
  ])("refuses base URL %s as untrusted", (baseUrl) => {
    expect(resolveDownloadHref(RELATIVE, { platform: "ios", baseUrl })).toEqual({
      ok: false,
      reason: "base_url_untrusted",
    });
    expect(parseTrustedApiBaseUrl(baseUrl)).toBeNull();
  });
});

describe("resolveDownloadHref href validation (all platforms)", () => {
  it("passes absolute http(s) links through unchanged", () => {
    for (const platform of ["web", "ios", "android"]) {
      expect(resolveDownloadHref("https://files.example.com/ea.zip", { platform })).toEqual({
        ok: true,
        url: "https://files.example.com/ea.zip",
      });
    }
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///etc/passwd",
    "//evil.example/steal",
    "api/download/secure?token=abc",
    "intent://scan/#Intent;end",
  ])("refuses unsupported href %s on every platform", (href) => {
    for (const platform of ["web", "ios", "android"]) {
      expect(resolveDownloadHref(href, { platform, baseUrl: "https://eaxau.com" })).toEqual({
        ok: false,
        reason: "unsupported_href",
      });
    }
  });

  it.each([null, undefined, "", "   "])("reports %j as empty", (href) => {
    expect(resolveDownloadHref(href, { platform: "web" })).toEqual({ ok: false, reason: "empty" });
    expect(resolveDownloadHref(href, { platform: "ios", baseUrl: "https://eaxau.com" })).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("has a non-empty user-facing message for every failure reason", () => {
    for (const reason of Object.keys(DOWNLOAD_HREF_FAILURE_MESSAGES) as Array<
      keyof typeof DOWNLOAD_HREF_FAILURE_MESSAGES
    >) {
      expect(describeDownloadHrefFailure(reason).length).toBeGreaterThan(10);
    }
    expect(describeDownloadHrefFailure("base_url_missing")).toContain("网页版");
    expect(describeDownloadHrefFailure("base_url_missing")).not.toContain("EXPO_PUBLIC_API_BASE_URL");
  });
});
