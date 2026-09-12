/**
 * 升级路径端到端：**上一版真实 DDL 建的库** → 跑完整迁移 → 起服务 → 真 HTTP 发消息。
 *
 * 独立复核回合 2 的 P1：`CREATE TABLE IF NOT EXISTS` 对已存在的表是 no-op，
 * 所以上一版跑过迁移的库升级后，新加的列永远补不上，每一次咨询请求都
 * `Unknown column 'notifyGeneration'`——而迁移本身「成功」了，什么都没报。
 * 上一轮所有测试库都是全新建的，全新安装路径把升级路径完全掩盖了。
 *
 * 这里的旧 DDL 是 `git show <BASE_COMMIT>:server/migrate.ts` **原样取的**，不手抄。
 * `tests/support-mysql.test.ts` 里还有一份不依赖 git 的模拟版（建新表再 DROP 新列）。
 *
 * 用法（必须用 tsx 跑：脚本要 require 仓库里的 .ts 模块）：
 *   MYSQL_ROOT_URI='mysql://root@127.0.0.1:3399' npx tsx verify/support-upgrade-e2e.mts
 * 可选：
 *   SUPPORT_UPGRADE_BASE=cdbaefb   上一版 commit（默认 cdbaefb）
 *   SUPPORT_UPGRADE_DB=eaxau_upgrade_e2e
 *
 * 只连本地隔离实例，自建独立库，不碰生产。
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import mysql from "mysql2/promise";

const repoRoot: string = new URL("..", import.meta.url).pathname;
const require_ = createRequire(`${repoRoot}package.json`);
const ROOT_URI = (process.env.MYSQL_ROOT_URI || "mysql://root@127.0.0.1:3399").replace(/\/+$/, "");
const DB = process.env.SUPPORT_UPGRADE_DB || "eaxau_upgrade_e2e";
const BASE_COMMIT = process.env.SUPPORT_UPGRADE_BASE || "cdbaefb";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
}

/** 从旧 commit 的 migrate.ts 里原样抠出 support 段的 CREATE TABLE 语句。 */
function oldCreateStatements() {
  const source = execFileSync("git", ["show", `${BASE_COMMIT}:server/migrate.ts`], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const start = source.indexOf("// ─── 站内咨询（网页客服会话）───");
  if (start < 0) throw new Error(`在 ${BASE_COMMIT} 的 migrate.ts 里找不到 support 段`);
  const end = source.indexOf("const catalogChanges = await syncCuratedStrategyCatalog", start);
  const block = source.slice(start, end < 0 ? undefined : end);

  const BACKTICK = String.fromCharCode(96);
  const BACKSLASH = String.fromCharCode(92);
  const OPEN = `await connection.query(${BACKTICK}`;
  const statements: string[] = [];
  let cursor = 0;
  for (;;) {
    const open = block.indexOf(OPEN, cursor);
    if (open < 0) break;
    let i = open + OPEN.length;
    let buffer = "";
    while (i < block.length) {
      if (block[i] === BACKSLASH) {
        buffer += block[i + 1];
        i += 2;
        continue;
      }
      if (block[i] === BACKTICK) break;
      buffer += block[i];
      i++;
    }
    statements.push(buffer.trim());
    cursor = i + 1;
  }
  return statements;
}

async function main() {
  const root = await mysql.createConnection(`${ROOT_URI}/`);
  await root.query(`DROP DATABASE IF EXISTS \`${DB}\``);
  await root.query(`CREATE DATABASE \`${DB}\` CHARACTER SET utf8mb4`);
  await root.end();

  const connection = await mysql.createConnection(`${ROOT_URI}/${DB}`);

  // ── 1. 用上一版的 DDL 建库（模拟「已经跑过上一版迁移」的环境）
  const statements = oldCreateStatements();
  for (const statement of statements) await connection.query(statement);
  check(`用 ${BASE_COMMIT} 的 DDL 建出 support 表`, statements.length === 4, `${statements.length} 张`);

  const newColumns = async () => {
    const [rows] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('notifyGeneration','generation')`,
    );
    return (rows as any[]).map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`).sort();
  };
  check("升级前确实缺这两列（前提成立）", (await newColumns()).length === 0, JSON.stringify(await newColumns()));

  // ── 2. 跑当前版本的生产建表函数
  const { ensureSupportChatSchema } = require_(`${repoRoot}server/migrate.ts`);
  const ran = await ensureSupportChatSchema(connection);
  const after = await newColumns();
  check(
    "跑完迁移，两列都补上了（复核 P1）",
    after.length === 2,
    `追加语句=${ran} 列=${JSON.stringify(after)}`,
  );

  // ── 3. 再跑一遍：幂等，一句都不该跑
  const again = await ensureSupportChatSchema(connection);
  check("已经最新的库再跑一遍是 no-op（幂等）", again === 0, `追加语句=${again}`);

  // ── 4. 在升级后的库上走真实业务入口
  process.env.DATABASE_URL = `${ROOT_URI}/${DB}`;
  const service = require_(`${repoRoot}server/support/service.ts`);
  const visitorToken = `upgrade-e2e-${Date.now()}-${"x".repeat(12)}`;
  try {
    const sent = await service.sendCustomerMessage({
      visitorToken,
      userId: null,
      ip: "203.0.113.31",
      body: "升级后第一条消息：这个多少钱",
      clientMsgId: `upgrade-${Date.now()}`,
      strategyId: null,
      pageUrl: null,
      locale: "zh",
      scheduleDrain: () => {},
    });
    check("升级后客户能正常发消息", sent.duplicate === false, sent.conversation.publicNo);

    const thread = await service.fetchVisitorThread({
      visitorToken,
      userId: null,
      strategyId: null,
      afterId: 0,
    });
    check(
      "升级后能读回自己的会话（customer + auto）",
      thread.messages.map((m: any) => m.role).join(",") === "customer,auto",
      thread.messages.map((m: any) => m.role).join(","),
    );

    const [notifications]: any = await connection.query(
      "SELECT generation, status FROM support_notifications",
    );
    check(
      "升级后的提醒带上了 generation",
      notifications.length === 1 && Number(notifications[0].generation) === 0,
      JSON.stringify(notifications[0] ?? null),
    );
  } catch (error: any) {
    check("升级后客户能正常发消息", false, String(error?.message ?? error).split("\n")[0]);
  }

  await connection.end();
  console.log("");
  console.log(failures ? `[upgrade-e2e] ${failures} FAILURES` : "[upgrade-e2e] all passed");
  // service.ts 里的连接池是模块级单例，会把事件循环挂住；脚本跑完就明确退出。
  process.exit(failures ? 1 : 0);
}

main().catch((error: any) => {
  console.error("[upgrade-e2e] fatal:", error);
  process.exit(1);
});
