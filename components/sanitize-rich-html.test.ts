import { describe, expect, it } from "vitest";
import { isSafeRichTextUrl, sanitizeRichHtml } from "./sanitize-rich-html";

describe("sanitizeRichHtml", () => {
  it("removes executable/embed elements and their contents", () => {
    const result = sanitizeRichHtml(`
      <p>safe</p>
      <ScRiPt>alert(1)</ScRiPt>
      <style>body{display:none}</style>
      <iframe src="https://evil.example">phish</iframe>
      <object data="https://evil.example"></object>
      <svg><script>alert(2)</script></svg>
    `);
    expect(result).toContain("<p>safe</p>");
    expect(result).not.toMatch(/script|style|iframe|object|svg|alert|phish/i);
  });

  it("drops event/style attributes but preserves safe formatting", () => {
    const result = sanitizeRichHtml(
      '<p style="background:url(javascript:1)" onload="alert(1)"><strong>ok</strong><img src="https://cdn.example/a.png" onerror="alert(2)" alt="a"></p>',
    );
    expect(result).toContain("<strong>ok</strong>");
    expect(result).toContain('src="https://cdn.example/a.png"');
    expect(result).toContain('alt="a"');
    expect(result).not.toMatch(/onload|onerror|style=|javascript|alert/i);
  });

  it("rejects dangerous URL schemes including encoded/control variants", () => {
    const result = sanitizeRichHtml(`
      <a href="JaVaScRiPt:alert(1)">one</a>
      <a href="java&#x73;cript:alert(2)">two</a>
      <a href="java&#10;script:alert(3)">three</a>
      <img src="data:image/svg+xml,<svg onload=alert(4)>">
      <img src="blob:https://evil.example/id">
      <a href="file:///etc/passwd">file</a>
      <a href="//evil.example/x">protocol relative</a>
    `);
    expect(result).not.toMatch(/href=|src=|javascript|data:|blob:|file:|\/\/evil/i);
    expect(result).toContain("one");
    expect(result).toContain("protocol relative");
  });

  it("hardens target blank and escapes attribute delimiters", () => {
    const result = sanitizeRichHtml(
      '<a href="https://example.com/?a=1&b=2" target="_blank" rel="opener">safe</a>',
    );
    expect(result).toBe(
      '<a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">safe</a>',
    );
  });

  it("fails closed on malformed and quoted-angle tag tricks", () => {
    const result = sanitizeRichHtml(
      '<img src="https://safe.example/a>b" onerror="alert(1)"><scr<script>ipt>alert(2)</scr</script>ipt><p>still safe</p>',
    );
    expect(result).not.toMatch(/onerror=|<script|<img[^>]+alert/i);
    expect(result).toContain("<p>still safe</p>");
  });

  it("drops a blocked element even when its attributes contain a quoted angle", () => {
    const result = sanitizeRichHtml(
      '<p>before</p><script title=">">alert(1)</script><iframe title=">">phish</iframe><p>after</p>',
    );
    expect(result).toBe("<p>before</p><p>after</p>");
  });
});

describe("isSafeRichTextUrl", () => {
  it("allows only explicit safe schemes and local paths", () => {
    expect(isSafeRichTextUrl("https://example.com")).toBe(true);
    expect(isSafeRichTextUrl("/strategy/1")).toBe(true);
    expect(isSafeRichTextUrl("#details")).toBe(true);
    expect(isSafeRichTextUrl("mailto:ops@example.com")).toBe(true);
    expect(isSafeRichTextUrl("data:text/html,x")).toBe(false);
    expect(isSafeRichTextUrl("jAvA\nScRiPt:alert(1)")).toBe(false);
    expect(isSafeRichTextUrl("//evil.example")).toBe(false);
    expect(isSafeRichTextUrl("mailto:ops@example.com", "image")).toBe(false);
  });
});
