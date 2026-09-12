#!/usr/bin/env node
/**
 * v5「摘除未核验绝对化说法」迁移的只读预演。
 *
 * 只发 SELECT，不发 UPDATE / INSERT / DDL，不写库。
 * 只打印元数据：MySQL 版本、两个迁移键的状态、每条说法会命中多少行、
 * 因 dataStatus='verified' 被保护的行数。不打印任何标题、ID、用户或订单资料。
 *
 * 用法：DATABASE_URL='mysql://…' node scripts/dryrun-title-claims.mjs
 */
import mysql from "mysql2/promise";

const CATALOG_V4_KEY = "2026-08-06-strategy-content-placeholders-v4";
const TITLE_CLAIMS_V5_KEY = "2026-09-13-unevidenced-title-claims-v5";
const CLAIMS = ["永不爆仓版本", "永不爆仓", "全网收益第一", "零回撤", "稳赚不赔"];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[dryrun] 需要 DATABASE_URL（只读连接即可）");
  process.exit(2);
}

const connection = await mysql.createConnection(url);
try {
  const [[version]] = await connection.query("SELECT VERSION() AS v");
  console.log(`MySQL 版本                : ${version.v}`);
  console.log(
    `REGEXP_REPLACE 可用       : ${/^(\d+)\./.exec(version.v)?.[1] >= "8" ? "是（8.0+）" : "否 — 迁移未使用该函数，不受影响"}`,
  );

  const [migrationTable] = await connection.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'content_migrations'",
  );
  const hasTable = migrationTable[0].n > 0;
  console.log(`content_migrations 表存在 : ${hasTable ? "是" : "否（v5 会自行建表）"}`);

  if (hasTable) {
    const [keys] = await connection.query(
      "SELECT `migrationKey` FROM `content_migrations` WHERE `migrationKey` IN (?, ?)",
      [CATALOG_V4_KEY, TITLE_CLAIMS_V5_KEY],
    );
    const applied = new Set(keys.map((r) => r.migrationKey));
    console.log(`v4 catalog 键已应用       : ${applied.has(CATALOG_V4_KEY) ? "是（catalog sync 会整块跳过，符合预期）" : "否"}`);
    console.log(`v5 标题清理键已应用       : ${applied.has(TITLE_CLAIMS_V5_KEY) ? "是（本次为 no-op）" : "否（本次会执行一遍）"}`);
  }

  const [[total]] = await connection.query(
    "SELECT COUNT(*) AS n FROM `strategies` WHERE `status` = 'published'",
  );
  console.log(`已发布商品总数            : ${total.n}`);

  let wouldChange = 0;
  let protectedRows = 0;
  console.log("\n每条说法的命中行数（不含标题内容）：");
  for (const claim of CLAIMS) {
    const [[hit]] = await connection.query(
      "SELECT COUNT(*) AS n FROM `strategies` WHERE `title` LIKE ? AND COALESCE(`dataStatus`, '') <> 'verified'",
      [`%${claim}%`],
    );
    const [[kept]] = await connection.query(
      "SELECT COUNT(*) AS n FROM `strategies` WHERE `title` LIKE ? AND `dataStatus` = 'verified'",
      [`%${claim}%`],
    );
    wouldChange += hit.n;
    protectedRows += kept.n;
    console.log(`  ${claim.padEnd(8)} 将修改 ${hit.n} 行 · 因已核验跳过 ${kept.n} 行`);
  }

  console.log(`\n合计将修改                : ${wouldChange} 行（仅 strategies.title）`);
  console.log(`合计因已核验被保护        : ${protectedRows} 行`);
  console.log("本次预演未执行任何写操作。");
} finally {
  await connection.end();
}
