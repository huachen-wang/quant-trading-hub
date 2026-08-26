import { describe, expect, it } from "vitest";
import { safeJsonLd } from "./seo-json";

describe("safeJsonLd", () => {
  it("cannot be terminated by database-controlled script markup", () => {
    const value = safeJsonLd({
      title: '</script><script>alert("xss")</script>',
      separators: "a\u2028b\u2029c",
      ampersand: "A&B",
    });
    expect(value).not.toContain("</script>");
    expect(value).not.toContain("<script>");
    expect(value).not.toContain("\u2028");
    expect(value).not.toContain("\u2029");
    expect(value).toContain("\\u003c/script\\u003e");
    expect(value).toContain("\\u0026");
    expect(JSON.parse(value)).toMatchObject({ ampersand: "A&B" });
  });
});
