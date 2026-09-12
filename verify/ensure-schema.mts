/**
 * 在指定库上建出站内咨询的四张表——直接调用 `server/migrate.ts` 导出的生产函数，
 * 不复制一份 DDL。给 e2e / 复核脚本准备测试库用。
 *
 * 用法：DATABASE_URL=... npx tsx verify/ensure-schema.mts
 *
 * 用 createRequire 而不是 import：仓库是 CJS，`.mts` 走原生 ESM 时拿不到具名导出。
 */
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const mysql = require_("mysql2/promise");
const { ensureSupportChatSchema } = require_("../server/migrate.ts");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[ensure-schema] 需要 DATABASE_URL");
  process.exit(1);
}
const connection = await mysql.createConnection(url);
const statements = await ensureSupportChatSchema(connection);
const [tables]: any = await connection.query(
  "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'support_%' ORDER BY TABLE_NAME",
);
console.log(`[ensure-schema] index statements run: ${statements}`);
console.log(`[ensure-schema] tables: ${tables.map((t: any) => t.TABLE_NAME).join(", ")}`);
await connection.end();
