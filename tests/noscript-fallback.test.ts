import { describe, expect, it, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import * as community from "../shared/community-contacts";

const repoRoot = resolve(__dirname, "..");
const injector = join(repoRoot, "scripts", "inject-web-bootstrap.js");

/** Expo web export 的出厂产物形状：带默认 noscript 文案。 */
const FACTORY_INDEX = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>EA商城｜MT4/MT5量化交易软件与策略工具 - EAXAU</title>
  </head>
  <body>
    <noscript>
      You need to enable JavaScript to run this app.
    </noscript>
    <div id="root"></div>
    <script src="/_expo/static/js/web/entry-abc.js" defer></script>
  </body>
</html>`;

function runInjector(indexHtml: string) {
  const dir = mkdtempSync(join(tmpdir(), "eaxau-inject-"));
  mkdirSync(join(dir, "web-build"));
  writeFileSync(join(dir, "web-build", "index.html"), indexHtml);
  const stdout = execFileSync("node", [injector], { cwd: dir, encoding: "utf-8" });
  return { html: readFileSync(join(dir, "web-build", "index.html"), "utf-8"), stdout };
}

describe("no-JavaScript contact fallback", () => {
  let html = "";
  let stdout = "";
  beforeAll(() => {
    const r = runInjector(FACTORY_INDEX);
    html = r.html;
    stdout = r.stdout;
  });

  it("removes the factory noscript copy", () => {
    expect(FACTORY_INDEX).toContain("You need to enable JavaScript to run this app.");
    expect(html).not.toContain("You need to enable JavaScript to run this app.");
    expect(stdout).toContain("replaced factory noscript");
  });

  it("gives a no-JS visitor the product name and a real way to ask", () => {
    const noscript = html.match(/<noscript[\s\S]*?<\/noscript>/)![0];
    expect(noscript).toContain("EAXAU");
    expect(noscript).toContain("MT4 / MT5 EA、指标与交易工具");
    // 交流群
    expect(noscript).toContain("https://t.me/nbmarketchat");
    expect(noscript).toContain("951703741");
    // 客服
    expect(noscript).toContain("https://t.me/hypermatch123");
    expect(noscript).toContain("@hypermatch123");
    expect(noscript).toContain("3832001817");
    expect(noscript).toContain("oooiniooo0624 / xau6000");
    // 死链和停用号码不回来
    expect(noscript).not.toContain("t.me/xau6000");
    expect(noscript).not.toContain("@xau6000");
    expect(noscript).not.toContain("1226426670");
  });

  it("keeps the boot fallback hidden until the app actually fails to mount", () => {
    expect(html).toMatch(/<div class="eaxau-fallback" id="eaxau-boot-fallback" hidden>/);
    expect(html).toContain('if (fallback) fallback.hidden = false;');
    expect(html).toContain("14000");
  });

  it("invents no sales figure, price, payment method or response-time promise", () => {
    const noscript = html.match(/<noscript[\s\S]*?<\/noscript>/)![0];
    const boot = html.match(/<div id="eaxau-boot"[\s\S]*?<\/div>\s*<\/div>/)![0];
    for (const block of [noscript, boot]) {
      expect(block).not.toMatch(/¥|\$\d|USD|USDT|支付宝|微信支付|已售|销量|下载量/);
      expect(block).not.toMatch(/小时内|分钟内回复|保证|承诺|稳赚|收益/);
    }
  });

  it("stays idempotent across repeated builds", () => {
    const dir = mkdtempSync(join(tmpdir(), "eaxau-inject-"));
    mkdirSync(join(dir, "web-build"));
    writeFileSync(join(dir, "web-build", "index.html"), html);
    const out = execFileSync("node", [injector], { cwd: dir, encoding: "utf-8" });
    expect(out).toContain("bootstrap already present");
    expect(readFileSync(join(dir, "web-build", "index.html"), "utf-8")).toBe(html);
  });

  it("still installs the fallback when Expo stops emitting a noscript", () => {
    const r = runInjector(FACTORY_INDEX.replace(/<noscript>[\s\S]*?<\/noscript>/, ""));
    expect(r.html).toContain("eaxau-noscript");
    expect(r.stdout).toContain("injected");
  });

  it("does not drift from the contact values the app itself uses", () => {
    // 页面、服务端预渲染、/llms.txt 都从 shared/community-contacts.ts 取；这个脚本是 CommonJS 不能 import，只能对值。
    for (const value of [
      community.TELEGRAM_GROUP_URL,
      community.QQ_GROUP_NUMBER,
      community.SUPPORT_QQ,
      community.SUPPORT_WECHAT,
      community.SUPPORT_TELEGRAM_HANDLE,
      community.SUPPORT_TELEGRAM_URL,
    ]) {
      expect(html, `${value} must match shared/community-contacts.ts`).toContain(value);
    }
  });
});
