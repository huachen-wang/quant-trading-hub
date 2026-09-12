#!/usr/bin/env node
/**
 * 咨询上下文链接产物验证。
 *
 * ContactModal 现在会把「商品页：https://www.eaxau.com/strategy/<id>」写进客户要发出去的
 * 咨询内容里。这条链接一旦 404，客户和顾问两边都会卡住，所以它必须对线上每个在售商品都成立。
 *
 * 用法：node scripts/verify-inquiry-links.mjs [--base https://www.eaxau.com] [--out report.json]
 * 退出码非 0 表示有链接不可达。
 */
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const readFlag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const base = readFlag("base", "https://www.eaxau.com").replace(/\/+$/, "");
const outPath = readFlag("out", "");
const listUrl = `${base}/api/trpc/strategies.list?batch=1&input=${encodeURIComponent(
  JSON.stringify({ 0: { json: {} } }),
)}`;

async function main() {
  const listRes = await fetch(listUrl);
  if (!listRes.ok) throw new Error(`strategies.list HTTP ${listRes.status}`);
  const rows = (await listRes.json())[0]?.result?.data?.json;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("strategies.list returned no rows");

  const checks = [];
  for (const row of rows) {
    const url = `${base}/strategy/${row.id}`;
    let status = 0;
    let error = null;
    try {
      status = (await fetch(url, { redirect: "follow" })).status;
    } catch (e) {
      error = String(e?.message || e);
    }
    checks.push({
      id: row.id,
      title: row.title,
      saleMode: row.saleMode,
      downloadAvailable: row.downloadAvailable,
      inquiryPageUrl: url,
      status,
      ok: status === 200,
      error,
    });
  }

  const failed = checks.filter((c) => !c.ok);
  const report = {
    checkedAt: new Date().toISOString(),
    base,
    productCount: checks.length,
    reachable: checks.length - failed.length,
    failed: failed.length,
    saleModes: checks.reduce((acc, c) => ({ ...acc, [c.saleMode]: (acc[c.saleMode] || 0) + 1 }), {}),
    checks,
  };

  if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(
    `[verify-inquiry-links] ${report.reachable}/${report.productCount} 商品页可达 · saleMode ${JSON.stringify(report.saleModes)}`,
  );
  for (const f of failed) console.error(`  FAIL ${f.inquiryPageUrl} -> ${f.error || `HTTP ${f.status}`}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`[verify-inquiry-links] ${e.message}`);
  process.exitCode = 1;
});
