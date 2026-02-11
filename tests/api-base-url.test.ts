import { describe, it, expect } from "vitest";

describe("EXPO_PUBLIC_API_BASE_URL", () => {
  it("should be set to production URL", () => {
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(apiBaseUrl).toBeDefined();
    expect(apiBaseUrl).toBe("https://eaxau.com");
  });

  it("should be a valid HTTPS URL", () => {
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL!;
    expect(apiBaseUrl.startsWith("https://")).toBe(true);
    expect(apiBaseUrl.endsWith("/")).toBe(false); // no trailing slash
  });
});
