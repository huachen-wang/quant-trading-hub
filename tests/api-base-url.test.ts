import { describe, it, expect } from "vitest";
import { resolveWebApiBaseUrl } from "../constants/api-base-url";

describe("API base URL resolution", () => {
  it("uses a configured production API URL without trailing slash", () => {
    expect(resolveWebApiBaseUrl({
      protocol: "https:",
      hostname: "preview.example.com",
      origin: "https://preview.example.com",
    }, "https://eaxau.com/")).toBe("https://eaxau.com");
  });

  it("uses same-origin APIs on eaxau production domains", () => {
    expect(resolveWebApiBaseUrl({
      protocol: "https:",
      hostname: "eaxau.com",
      origin: "https://eaxau.com",
    }, "https://eaxau.com")).toBe("");

    expect(resolveWebApiBaseUrl({
      protocol: "https:",
      hostname: "www.eaxau.com",
      origin: "https://www.eaxau.com",
    }, "https://eaxau.com")).toBe("");
  });

  it("keeps Expo web development pointed at the API server", () => {
    expect(resolveWebApiBaseUrl({
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "8081",
      origin: "http://127.0.0.1:8081",
    }, "")).toBe("http://127.0.0.1:3000");
  });

  it("uses same-origin APIs for bundled local production previews", () => {
    expect(resolveWebApiBaseUrl({
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "59245",
      origin: "http://127.0.0.1:59245",
    }, "")).toBe("http://127.0.0.1:59245");
  });
});
