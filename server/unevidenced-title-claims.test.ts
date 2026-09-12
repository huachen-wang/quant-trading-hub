import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// Vite 5.4 的内建模块清单里没有 node:sqlite（Node 22 才加），静态 import 会被
// 当成普通包解析而失败。走 createRequire 在运行时取，跑的仍是 Node 自带的真实 SQLite。
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = InstanceType<typeof DatabaseSync>;
import {
  UNEVIDENCED_TITLE_MIGRATION_KEY,
  syncCuratedStrategyCatalog,
  syncUnevidencedTitleClaims,
} from "./strategy-catalog";

/** 把 node:sqlite 包成 mysql2 的 `[result, fields]` 形状，让被测代码原样跑真实 SQL。 */
function sqliteConnection(db: DatabaseSync) {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const statement = db.prepare(sql);
      if (/^\s*select/i.test(sql)) return [statement.all(...(params as any[])), []];
      const result = statement.run(...(params as any[]));
      return [{ affectedRows: Number(result.changes) }, []];
    }),
  };
}

const STRATEGIES_DDL = `
  CREATE TABLE \`strategies\` (
    \`id\` integer PRIMARY KEY,
    \`title\` varchar(255) NOT NULL,
    \`saleMode\` varchar(20),
    \`coverImage\` varchar(255),
    \`dataStatus\` varchar(20),
    \`status\` varchar(20)
  )`;

const MIGRATIONS_DDL = `
  CREATE TABLE \`content_migrations\` (
    \`migrationKey\` varchar(120) NOT NULL PRIMARY KEY,
    \`appliedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;

const SEED_ROWS: [number, string, string, string | null, string | null, string][] = [
  // 迁移写进来的绝对化说法；后台后来把它改成了 direct 并换了自定义封面
  [30, "金戈铁马 V5.1 永不爆仓版本", "direct", "/admin-custom-cover.jpg", "referenced", "published"],
  // 人工核实并维护过：标题里即便有同样字样也一律不碰
  [31, "稳赚不赔 实盘核验版 V2", "direct", "/verified-cover.jpg", "verified", "published"],
  // 正常商品：一个字都不该动
  [32, "V4 Grid Bot EA v1.0", "inquiry", "/ea-covers-v2/grid.jpg", "referenced", "published"],
  // dataStatus 为空也属于未核验
  [33, "金戈铁马 正版云控 全网收益第一", "inquiry", null, null, "published"],
];

function seed(db: DatabaseSync) {
  db.exec(STRATEGIES_DDL);
  const insert = db.prepare(
    "INSERT INTO `strategies` (`id`,`title`,`saleMode`,`coverImage`,`dataStatus`,`status`) VALUES (?,?,?,?,?,?)",
  );
  for (const row of SEED_ROWS) insert.run(...row);
}

function titles(db: DatabaseSync) {
  return Object.fromEntries(
    (db.prepare("SELECT `id`, `title` FROM `strategies`").all() as any[]).map((r) => [r.id, r.title]),
  );
}

describe("v5 unevidenced-title cleanup — existing v4 database", () => {
  it("runs even though the v4 catalog key is already applied, and touches titles only", async () => {
    const db = new DatabaseSync(":memory:");
    seed(db);
    db.exec(MIGRATIONS_DDL);
    db.prepare("INSERT INTO `content_migrations` (`migrationKey`) VALUES (?)").run(
      "2026-08-06-strategy-content-placeholders-v4",
    );

    const before = db.prepare("SELECT `id`,`saleMode`,`coverImage` FROM `strategies`").all();

    const changed = await syncUnevidencedTitleClaims(sqliteConnection(db) as any);
    expect(changed).toBe(2);

    const after = titles(db);
    expect(after[30]).toBe("金戈铁马 V5.1");
    expect(after[33]).toBe("金戈铁马 正版云控");
    // 已核验条目原样保留，绝不因为字样命中就被改写
    expect(after[31]).toBe("稳赚不赔 实盘核验版 V2");
    expect(after[32]).toBe("V4 Grid Bot EA v1.0");

    // 售卖方式与封面是后台人工维护的，这次迁移一个都不能碰
    expect(db.prepare("SELECT `id`,`saleMode`,`coverImage` FROM `strategies`").all()).toEqual(before);

    // v4 键仍在，没有被顶掉或重写
    expect(
      db
        .prepare("SELECT `migrationKey` FROM `content_migrations` ORDER BY `migrationKey`")
        .all()
        .map((r: any) => r.migrationKey),
    ).toEqual(["2026-08-06-strategy-content-placeholders-v4", UNEVIDENCED_TITLE_MIGRATION_KEY]);
  });

  it("is a no-op on the second run", async () => {
    const db = new DatabaseSync(":memory:");
    seed(db);
    db.exec(MIGRATIONS_DDL);

    expect(await syncUnevidencedTitleClaims(sqliteConnection(db) as any)).toBe(2);
    const settled = titles(db);
    expect(await syncUnevidencedTitleClaims(sqliteConnection(db) as any)).toBe(0);
    expect(titles(db)).toEqual(settled);
  });
});

describe("v5 unevidenced-title cleanup — empty database", () => {
  it("creates its own migrations table and applies cleanly", async () => {
    const db = new DatabaseSync(":memory:");
    seed(db);
    // 没有 content_migrations 表：迁移必须自己建出来
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE name = 'content_migrations'").all(),
    ).toHaveLength(0);

    expect(await syncUnevidencedTitleClaims(sqliteConnection(db) as any)).toBe(2);
    expect(titles(db)[30]).toBe("金戈铁马 V5.1");
    expect(
      db.prepare("SELECT `migrationKey` FROM `content_migrations`").all().map((r: any) => r.migrationKey),
    ).toEqual([UNEVIDENCED_TITLE_MIGRATION_KEY]);
  });

  it("does nothing when no title carries a claim", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(STRATEGIES_DDL);
    db.prepare(
      "INSERT INTO `strategies` (`id`,`title`,`saleMode`,`coverImage`,`dataStatus`,`status`) VALUES (?,?,?,?,?,?)",
    ).run(32, "V4 Grid Bot EA v1.0", "inquiry", "/c.jpg", "referenced", "published");

    expect(await syncUnevidencedTitleClaims(sqliteConnection(db) as any)).toBe(0);
    expect(titles(db)[32]).toBe("V4 Grid Bot EA v1.0");
  });
});

describe("the v4 catalog migration keeps its original semantics", () => {
  it("still gates on the v4 key and is skipped once applied", async () => {
    const seen: string[] = [];
    const connection = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("SELECT `migrationKey`")) {
          seen.push(String(params?.[0]));
          return [[{ migrationKey: "applied" }], []];
        }
        return [[], []];
      }),
    };

    expect(await syncCuratedStrategyCatalog(connection as any)).toBe(0);
    expect(seen).toEqual(["2026-08-06-strategy-content-placeholders-v4"]);
    // 早退之后不得再发出任何 UPDATE：saleMode / coverImage / 改名都不能重跑
    for (const call of connection.query.mock.calls) {
      expect(String(call[0])).not.toMatch(/UPDATE/i);
    }
  });
});

describe("production MySQL compatibility", () => {
  const source = readFileSync(join(__dirname, "strategy-catalog.ts"), "utf-8");
  const v5 = source.slice(
    source.indexOf("export async function syncUnevidencedTitleClaims"),
    source.indexOf("export async function syncCuratedStrategyCatalog"),
  );

  it("uses no MySQL 8.0-only function", () => {
    expect(v5).not.toMatch(/REGEXP_REPLACE/i);
    expect(v5).not.toMatch(/JSON_TABLE|LATERAL|WITH RECURSIVE|ROW_NUMBER\(/i);
  });

  it("keeps its CREATE TABLE portable (no ENGINE/CHARSET tail)", () => {
    const ddl = v5.slice(v5.indexOf("CREATE TABLE"), v5.indexOf("SELECT `migrationKey`"));
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS");
    expect(ddl).not.toMatch(/ENGINE\s*=/i);
    expect(ddl).not.toMatch(/CHARSET|COLLATE/i);
  });

  it("never widens the blast radius beyond strategies.title", () => {
    // 源文件里的反引号是模板字符串里的 \` 转义，正则要允许那个反斜杠
    expect(v5).not.toMatch(/SET\s+\\?`(?!title)/);
    expect(v5).toMatch(/COALESCE\(\\?`dataStatus\\?`, ''\) <> 'verified'/);
    expect(v5).not.toMatch(/DELETE|TRUNCATE|DROP/i);
  });
});
