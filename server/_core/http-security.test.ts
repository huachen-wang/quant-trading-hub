import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./http-security";

describe("HTTP content security policy", () => {
  it("blocks script attributes, objects and framing in production", () => {
    const policy = buildContentSecurityPolicy(true);
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("lets Cloudflare Web Analytics load its beacon and report back", () => {
    const policy = buildContentSecurityPolicy(true);
    const script = policy.split("; ").find((d) => d.startsWith("script-src "))!;
    const connect = policy.split("; ").find((d) => d.startsWith("connect-src "))!;
    expect(script.split(" ")).toContain("https://static.cloudflareinsights.com");
    expect(connect.split(" ")).toContain("https://cloudflareinsights.com");
  });
});
