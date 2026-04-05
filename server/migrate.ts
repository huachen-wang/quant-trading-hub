/**
 * 自动数据库迁移脚本
 * 在服务器启动前执行，确保数据库 schema 与代码同步
 * 使用原生 SQL 执行迁移，带有 IF NOT EXISTS 保护，可重复执行
 */
import mysql from "mysql2/promise";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[migrate] DATABASE_URL not set, skipping migrations");
    return;
  }

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection(databaseUrl);
    console.log("[migrate] Connected to database, checking schema...");

    // 获取 strategies 表的现有列
    const [strategyCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies'"
    ) as any[];
    const strategyColumnNames = new Set(strategyCols.map((c: any) => c.COLUMN_NAME));

    // 获取 group_buys 表的现有列
    const [groupBuyCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_buys'"
    ) as any[];
    const groupBuyColumnNames = new Set(groupBuyCols.map((c: any) => c.COLUMN_NAME));

    let migrationsRun = 0;

    // strategies 表新增字段
    const strategyMigrations: [string, string][] = [
      ["originalPrice", "ALTER TABLE `strategies` ADD COLUMN `originalPrice` decimal(10,2) DEFAULT NULL"],
      ["productType", "ALTER TABLE `strategies` ADD COLUMN `productType` varchar(20) DEFAULT 'ea'"],
      ["tags", "ALTER TABLE `strategies` ADD COLUMN `tags` text DEFAULT NULL"],
      ["galleryImages", "ALTER TABLE `strategies` ADD COLUMN `galleryImages` text DEFAULT NULL"],
      ["isFeatured", "ALTER TABLE `strategies` ADD COLUMN `isFeatured` boolean DEFAULT false"],
      ["featuredLink", "ALTER TABLE `strategies` ADD COLUMN `featuredLink` text DEFAULT NULL"],
    ];

    for (const [colName, sql] of strategyMigrations) {
      if (!strategyColumnNames.has(colName)) {
        console.log(`[migrate] Adding column strategies.${colName}...`);
        await connection.query(sql);
        migrationsRun++;
      }
    }

    // group_buys 表新增字段
    const groupBuyMigrations: [string, string][] = [
      ["coverImage", "ALTER TABLE `group_buys` ADD COLUMN `coverImage` text DEFAULT NULL"],
    ];

    for (const [colName, sql] of groupBuyMigrations) {
      if (!groupBuyColumnNames.has(colName)) {
        console.log(`[migrate] Adding column group_buys.${colName}...`);
        await connection.query(sql);
        migrationsRun++;
      }
    }

    if (migrationsRun > 0) {
      console.log(`[migrate] ✓ ${migrationsRun} migration(s) applied successfully`);
    } else {
      console.log("[migrate] ✓ Database schema is up to date");
    }
  } catch (error) {
    console.error("[migrate] Migration error:", error);
    // 不抛出错误，允许服务器继续启动
    // 这样即使迁移失败，服务器仍然可以运行（只是新功能可能不可用）
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export { runMigrations };
