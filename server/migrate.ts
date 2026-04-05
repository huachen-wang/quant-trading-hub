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

    // ==================== 新增表：合作展示卡片 ====================
    const createCooperationCards = `
      CREATE TABLE IF NOT EXISTS \`cooperation_cards\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`title\` varchar(255) NOT NULL,
        \`subtitle\` varchar(255) DEFAULT NULL,
        \`description\` text DEFAULT NULL,
        \`coverImage\` text DEFAULT NULL,
        \`galleryImages\` text DEFAULT NULL,
        \`badge\` varchar(50) DEFAULT NULL,
        \`badgeColor\` varchar(20) DEFAULT 'gold',
        \`strategyType\` varchar(50) DEFAULT NULL,
        \`platform\` varchar(20) DEFAULT NULL,
        \`observeNote\` text DEFAULT NULL,
        \`contactInfo\` text DEFAULT NULL,
        \`sortOrder\` int NOT NULL DEFAULT 0,
        \`isVisible\` boolean NOT NULL DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`sortOrder_idx\` (\`sortOrder\`),
        INDEX \`isVisible_idx\` (\`isVisible\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring cooperation_cards table exists...");
    await connection.query(createCooperationCards);
    migrationsRun++;

    // ==================== 新增表：合作模式配置 ====================
    const createCooperationPlans = `
      CREATE TABLE IF NOT EXISTS \`cooperation_plans\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`title\` varchar(100) NOT NULL,
        \`badge\` varchar(50) DEFAULT NULL,
        \`price\` varchar(100) DEFAULT NULL,
        \`priceNote\` varchar(100) DEFAULT NULL,
        \`features\` text DEFAULT NULL,
        \`sortOrder\` int NOT NULL DEFAULT 0,
        \`isVisible\` boolean NOT NULL DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring cooperation_plans table exists...");
    await connection.query(createCooperationPlans);
    migrationsRun++;

    // ==================== 新增表：促销商品 ====================
    const createPromoProducts = `
      CREATE TABLE IF NOT EXISTS \`promo_products\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`title\` varchar(255) NOT NULL,
        \`description\` text DEFAULT NULL,
        \`coverImage\` text DEFAULT NULL,
        \`galleryImages\` text DEFAULT NULL,
        \`platform\` varchar(20) DEFAULT NULL,
        \`category\` varchar(50) NOT NULL DEFAULT 'ea',
        \`originalPrice\` decimal(10,2) NOT NULL,
        \`promoPrice\` decimal(10,2) NOT NULL,
        \`promoLabel\` varchar(50) DEFAULT NULL,
        \`promoEndTime\` timestamp NULL DEFAULT NULL,
        \`detailContent\` text DEFAULT NULL,
        \`paymentInfo\` text DEFAULT NULL,
        \`contactInfo\` text DEFAULT NULL,
        \`stock\` int NOT NULL DEFAULT -1,
        \`soldCount\` int NOT NULL DEFAULT 0,
        \`sortOrder\` int NOT NULL DEFAULT 0,
        \`isVisible\` boolean NOT NULL DEFAULT true,
        \`status\` enum('active','expired','soldout') NOT NULL DEFAULT 'active',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`status_idx\` (\`status\`),
        INDEX \`category_idx\` (\`category\`),
        INDEX \`sortOrder_idx\` (\`sortOrder\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring promo_products table exists...");
    await connection.query(createPromoProducts);
    migrationsRun++;

    // ==================== 插入默认合作模式数据（如果表为空）====================
    const [planRows] = await connection.query("SELECT COUNT(*) as cnt FROM `cooperation_plans`") as any[];
    if (planRows[0].cnt === 0) {
      console.log("[migrate] Inserting default cooperation plans...");
      await connection.query(`
        INSERT INTO \`cooperation_plans\` (\`title\`, \`badge\`, \`price\`, \`priceNote\`, \`features\`, \`sortOrder\`) VALUES
        ('试用合作', '零门槛', '免费', '体验', '["可选一款策略实盘测试","无资金量要求","不拿佣金","指定合作平台账户授权"]', 1),
        ('策略授权', '推荐', '¥1,000/月', '¥2,500/年', '["有效期内无限开窗口/授权","永久免费更新迭代","不需要分成"]', 2),
        ('源码买断', NULL, '¥9,800起', NULL, '["完整源码交付·支持二次开发","终身技术支持","不限平台·无限开窗口/授权"]', 3)
      `);
      migrationsRun++;
    }

    // ==================== 插入默认合作卡片数据（如果表为空）====================
    const [cardRows] = await connection.query("SELECT COUNT(*) as cnt FROM `cooperation_cards`") as any[];
    if (cardRows[0].cnt === 0) {
      console.log("[migrate] Inserting default cooperation cards...");
      await connection.query(`
        INSERT INTO \`cooperation_cards\` (\`title\`, \`subtitle\`, \`description\`, \`badge\`, \`badgeColor\`, \`strategyType\`, \`platform\`, \`observeNote\`, \`sortOrder\`) VALUES
        ('极限黄金对冲 Pro', '日均几百~几千单·回撤稳定', '专业级对冲策略，适合追求稳定收益的工作室。多账户分散风险，回撤可控。', '热门', 'red', '对冲策略', 'MT4', '私聊备注「极限对冲」获取观摩账户', 1),
        ('多空双开策略（小艺）', '日均几千单·500U美分即可启动', '低门槛网格策略，美分账户即可运行。适合小资金起步的工作室。', NULL, 'gold', '网格策略', 'MT5', '私聊备注「多空双开」获取观摩账户', 2),
        ('一单一结（武汉小艺）', '日均20-80单·零爆仓', '极致安全的一次一单策略，历史零爆仓记录。适合风险厌恶型客户。', '零爆仓', 'green', '一次一单', 'MT5', '私聊备注「一单一结」获取观摩账户', 3),
        ('超级黄金调优 2026', '两个月战绩600%', '主力网格策略，经过深度调优。高收益高风险，适合激进型工作室。', '主力', 'gold', '网格策略', 'MT4', '私聊备注「超级调优」获取观摩账户', 4),
        ('趋势刷单·军火库独家版', '单边1000点暴跌不爆仓', '趋势马丁策略，抗单能力极强。独家调优版本，市面无同款。', NULL, 'gold', '趋势马丁', 'MT4', '私聊备注「趋势刷单」获取观摩账户', 5),
        ('智能趋势追踪', '趋势追踪·节奏清晰', '一次一单趋势追踪策略，信号清晰，适合手动+自动结合使用。', NULL, 'gold', '一次一单', 'MT4/MT5', '私聊备注「趋势追踪」获取观摩账户', 6),
        ('暴利引擎 Pro', '全网月收益第一', '暴力策略，追求极致收益。适合有风险承受能力的专业交易者。', '月收益第一', 'red', '暴力策略', 'MT4', '私聊备注「暴利引擎」获取观摩账户', 7),
        ('点金订单流', '四维共振·专业机构选择', '机构级订单流分析系统，四维共振信号。适合专业交易团队和工作室。', '机构级', 'gold', '一次一单', 'MT4/MT5', '私聊备注「点金订单流」获取观摩账户', 8)
      `);
      migrationsRun++;
    }

    if (migrationsRun > 0) {
      console.log(`[migrate] ✓ ${migrationsRun} migration(s) applied successfully`);
    } else {
      console.log("[migrate] ✓ Database schema is up to date");
    }
  } catch (error) {
    console.error("[migrate] Migration error:", error);
    // 不抛出错误，允许服务器继续启动
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export { runMigrations };
