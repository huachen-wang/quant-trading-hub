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
});
