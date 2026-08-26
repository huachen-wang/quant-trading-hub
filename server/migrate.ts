/**
 * 自动数据库迁移脚本
 * 在服务器启动前执行，确保数据库 schema 与代码同步
 * 使用原生 SQL 执行迁移，带有 IF NOT EXISTS 保护，可重复执行
 */
import mysql from "mysql2/promise";
import { pathToFileURL } from "node:url";
import { syncCuratedStrategyCatalog } from "./strategy-catalog";
import { isProductionRuntime } from "./_core/runtime-env";

type DatabaseEnvironment = {
  DATABASE_URL?: string;
  NODE_ENV?: string;
  RAILWAY_ENVIRONMENT_ID?: string;
};

export function resolveDatabaseUrl(env: DatabaseEnvironment = process.env) {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl && isProductionRuntime(env)) {
    throw new Error("[migrate] DATABASE_URL must be configured in production");
  }
  return databaseUrl || null;
}

async function runMigrations(options: { strict?: boolean } = {}) {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.warn("[migrate] DATABASE_URL not set, skipping migrations");
    return;
  }

  let connection: mysql.Connection | null = null;
  let migrationLockAcquired = false;
  try {
    connection = await mysql.createConnection(databaseUrl);
    const [lockRows] = (await connection.query(
      "SELECT GET_LOCK('eaxau_ai_alliance_migrate_v1', 60) AS acquired",
    )) as any[];
    if (Number(lockRows?.[0]?.acquired) !== 1) {
      throw new Error("[migrate] could not acquire database migration lock");
    }
    migrationLockAcquired = true;
    console.log("[migrate] Connected to database, checking schema...");

    // 获取 strategies 表的现有列
    const [strategyCols] = (await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies'",
    )) as any[];
    const strategyColumnNames = new Set(
      strategyCols.map((c: any) => c.COLUMN_NAME),
    );

    // 获取 group_buys 表的现有列
    const [groupBuyCols] = (await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_buys'",
    )) as any[];
    const groupBuyColumnNames = new Set(
      groupBuyCols.map((c: any) => c.COLUMN_NAME),
    );

    let migrationsRun = 0;
    const ensureIndex = async (
      tableName: string,
      indexName: string,
      statement: string,
    ) => {
      const [rows] = (await connection!.query(
        "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
        [tableName, indexName],
      )) as any[];
      if (!rows.length) {
        await connection!.query(statement);
        migrationsRun++;
      }
    };

    // strategies 表新增字段
    const strategyMigrations: [string, string][] = [
      [
        "originalPrice",
        "ALTER TABLE `strategies` ADD COLUMN `originalPrice` decimal(10,2) DEFAULT NULL",
      ],
      [
        "productType",
        "ALTER TABLE `strategies` ADD COLUMN `productType` varchar(20) DEFAULT 'ea'",
      ],
      ["tags", "ALTER TABLE `strategies` ADD COLUMN `tags` text DEFAULT NULL"],
      [
        "galleryImages",
        "ALTER TABLE `strategies` ADD COLUMN `galleryImages` text DEFAULT NULL",
      ],
      [
        "isFeatured",
        "ALTER TABLE `strategies` ADD COLUMN `isFeatured` boolean DEFAULT false",
      ],
      [
        "isCurated",
        "ALTER TABLE `strategies` ADD COLUMN `isCurated` boolean NOT NULL DEFAULT false",
      ],
      [
        "featuredLink",
        "ALTER TABLE `strategies` ADD COLUMN `featuredLink` text DEFAULT NULL",
      ],
      [
        "dataStatus",
        "ALTER TABLE `strategies` ADD COLUMN `dataStatus` enum('estimated','referenced','verified') NOT NULL DEFAULT 'estimated'",
      ],
      [
        "sourceName",
        "ALTER TABLE `strategies` ADD COLUMN `sourceName` varchar(120) DEFAULT NULL",
      ],
      [
        "sourceUrl",
        "ALTER TABLE `strategies` ADD COLUMN `sourceUrl` text DEFAULT NULL",
      ],
      [
        "evidenceUrl",
        "ALTER TABLE `strategies` ADD COLUMN `evidenceUrl` text DEFAULT NULL",
      ],
    ];

    for (const [colName, sql] of strategyMigrations) {
      if (!strategyColumnNames.has(colName)) {
        console.log(`[migrate] Adding column strategies.${colName}...`);
        await connection.query(sql);
        migrationsRun++;
      }
    }

    try {
      await connection.query(
        "CREATE INDEX `curated_idx` ON `strategies` (`isCurated`)",
      );
      migrationsRun++;
    } catch {
      // 索引已存在，忽略。
    }

    // group_buys 表新增字段
    const groupBuyMigrations: [string, string][] = [
      [
        "coverImage",
        "ALTER TABLE `group_buys` ADD COLUMN `coverImage` text DEFAULT NULL",
      ],
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
    const [planRows] = (await connection.query(
      "SELECT COUNT(*) as cnt FROM `cooperation_plans`",
    )) as any[];
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
    const [cardRows] = (await connection.query(
      "SELECT COUNT(*) as cnt FROM `cooperation_cards`",
    )) as any[];
    if (cardRows[0].cnt === 0) {
      console.log("[migrate] Inserting default cooperation cards...");
      await connection.query(`
        INSERT INTO \`cooperation_cards\` (\`title\`, \`subtitle\`, \`description\`, \`badge\`, \`badgeColor\`, \`strategyType\`, \`platform\`, \`observeNote\`, \`sortOrder\`) VALUES
        ('极限黄金对冲 Pro', '高频对冲·需核验实盘记录', '对冲执行方案展示；成本、滑点、相关性失效与极端行情均可造成损失。', '高风险', 'red', '对冲策略', 'MT4', '私聊备注「极限对冲」申请查看可核验资料', 1),
        ('多空双开策略（小艺）', '网格参数方案·需先评估资金', '网格策略可能在单边行情中快速累积仓位；展示内容不构成收益保证。', '高风险', 'gold', '网格策略', 'MT5', '私聊备注「多空双开」申请查看可核验资料', 2),
        ('一单一结（武汉小艺）', '一次一单·历史资料待核验', '一次一单的执行方案展示；仍可发生连续亏损、滑点和爆仓风险。', '风险边界', 'green', '一次一单', 'MT5', '私聊备注「一单一结」申请查看可核验资料', 3),
        ('超级黄金调优 2026', '网格参数方案·高风险', '网格参数与风控边界展示；模拟或历史数据不代表未来结果。', '高风险', 'gold', '网格策略', 'MT4', '私聊备注「超级调优」申请查看可核验资料', 4),
        ('趋势刷单·风险测试版', '趋势马丁·极端行情风险高', '趋势马丁参数方案展示；抗单不等于不会爆仓，不宣称独家或同类唯一。', '高风险', 'gold', '趋势马丁', 'MT4', '私聊备注「趋势刷单」申请查看可核验资料', 5),
        ('智能趋势追踪', '趋势追踪·节奏清晰', '一次一单趋势追踪策略，信号清晰，适合手动+自动结合使用。', NULL, 'gold', '一次一单', 'MT4/MT5', '私聊备注「趋势追踪」获取观摩账户', 6),
        ('高波动引擎 Pro', '高风险策略·不承诺收益', '高波动执行方案展示；仅适合能承受全部本金损失的测试环境。', '高风险', 'red', '高风险策略', 'MT4', '私聊备注「高波动引擎」申请查看可核验资料', 7),
        ('点金订单流', '订单流工具·资料展示', '订单流分析与信号工具展示；不使用“机构级”或其他无法核验的背书。', '工具演示', 'gold', '一次一单', 'MT4/MT5', '私聊备注「点金订单流」申请查看可核验资料', 8)
      `);
      migrationsRun++;
    }

    // 已部署旧库可能保留过去的绝对收益/不爆仓宣称；每次迁移幂等修复这些已知 seed。
    const complianceCardRepairs: Array<
      [string, string, string, string, string]
    > = [
      [
        "一单一结（武汉小艺）",
        "一单一结（武汉小艺）",
        "一次一单·历史资料待核验",
        "一次一单的执行方案展示；仍可发生连续亏损、滑点和爆仓风险。",
        "风险边界",
      ],
      [
        "超级黄金调优 2026",
        "超级黄金调优 2026",
        "网格参数方案·高风险",
        "网格参数与风控边界展示；模拟或历史数据不代表未来结果。",
        "高风险",
      ],
      [
        "趋势刷单·EAXAU独家版",
        "趋势刷单·风险测试版",
        "趋势马丁·极端行情风险高",
        "趋势马丁参数方案展示；抗单不等于不会爆仓，不宣称独家或同类唯一。",
        "高风险",
      ],
      [
        "暴利引擎 Pro",
        "高波动引擎 Pro",
        "高风险策略·不承诺收益",
        "高波动执行方案展示；仅适合能承受全部本金损失的测试环境。",
        "高风险",
      ],
    ];
    for (const [
      oldTitle,
      title,
      subtitle,
      description,
      badge,
    ] of complianceCardRepairs) {
      const [repairResult] = (await connection.query(
        "UPDATE `cooperation_cards` SET `title` = ?, `subtitle` = ?, `description` = ?, `badge` = ? WHERE `title` = ?",
        [title, subtitle, description, badge, oldTitle],
      )) as any[];
      if (Number(repairResult?.affectedRows ?? 0) > 0) migrationsRun++;
    }

    // ==================== 插入默认促销商品数据（如果表为空）====================
    const [promoRows] = (await connection.query(
      "SELECT COUNT(*) as cnt FROM `promo_products`",
    )) as any[];
    if (promoRows[0].cnt === 0) {
      console.log("[migrate] Inserting default promo products...");
      await connection.query(`
        INSERT INTO \`promo_products\` (\`title\`, \`description\`, \`coverImage\`, \`platform\`, \`category\`, \`originalPrice\`, \`promoPrice\`, \`promoLabel\`, \`promoEndTime\`, \`detailContent\`, \`stock\`, \`soldCount\`, \`sortOrder\`, \`status\`) VALUES
        ('Gold Scalper Pro MT5', '黄金剥头皮 EA 策略资料；交易频率、滑点与历史表现均需以可核验证据为准。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/QVUXRHilJWhcYKTW.png', 'MT5', 'ea', 2999.00, 899.00, '限时3折', '2026-06-30 23:59:59', '【策略类型】黄金剥头皮。\n【环境】对点差、滑点、延迟和流动性敏感。\n【证据状态】平台尚未完成独立实盘核验，历史数据不代表未来结果。', 50, 23, 1, 'active'),
        ('Quantum Grid Master', '动态网格参数方案；支持多品种测试，不宣称量子计算或收益保证。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/gBeMVyXMhnKurKQb.png', 'MT4', 'ea', 4999.00, 1599.00, '网格方案', '2026-07-15 23:59:59', '【策略类型】基于 ATR/波动率参数的动态网格。\n【风险】单边行情可快速累积仓位和回撤。\n【证据状态】表现数据待独立核验。', 30, 15, 2, 'active'),
        ('Sniper Entry System', '一次一单的趋势入场方案；胜率、盈亏比和回撤需以可核验报告为准。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/WXZZOEwdmycsCooS.png', 'MT5', 'ea', 3999.00, 1299.00, '策略资料', '2026-08-01 23:59:59', '【策略类型】多时间框架趋势与关键位确认。\n【风险】信号可失效，止损不消除连续亏损。\n【证据状态】胜率和收益数据待独立核验。', 100, 42, 3, 'active'),
        ('Turbo Scalping Engine', '黄金高频执行方案；对券商规则、成本、滑点和延迟高度敏感。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/qckOdYQDkJZKplag.png', 'MT4', 'ea', 5999.00, 1999.00, '高风险', '2026-06-15 23:59:59', '【策略类型】Tick 级高频执行。\n【风险】实际成本和流动性可使回测与实盘显著偏离。\n【证据状态】收益与回撤尚未独立核验。', 20, 11, 4, 'active'),
        ('AI Matrix Trader', '多策略组合与市场状态切换方案；“AI”不代表收益保证。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/IqDbJxzTcYPbrfRv.png', 'MT5', 'ea', 8999.00, 2999.00, '多策略', '2026-09-01 23:59:59', '【策略类型】多策略组合与状态切换。\n【风险】模型分类可能错误，多策略仍可同时亏损。\n【证据状态】算法实现与表现数据待独立核验。', 15, 8, 5, 'active'),
        ('Neural Trend Follower', '趋势跟踪指标与半自动方案；算法实现、信号质量与交易频率待独立核验。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/WXZZOEwdmycsCooS.png', 'MT4', 'indicator', 1999.00, 699.00, '资料待核验', '2026-07-31 23:59:59', '【产品类型】趋势跟踪指标+半自动 EA。\n【风险】信号会滞后或失效，不构成投资建议。\n【证据状态】算法实现与表现尚未独立核验。', 200, 67, 6, 'active')
      `);
      migrationsRun++;
    }

    const compliancePromoRepairs: Array<[string, string, string, string]> = [
      [
        "Gold Scalper Pro MT5",
        "黄金剥头皮 EA 策略资料；交易频率、滑点与历史表现均需以可核验证据为准。",
        "【策略类型】黄金剥头皮。\n【风险】对点差、滑点、延迟和流动性敏感。\n【证据状态】平台尚未完成独立实盘核验，历史数据不代表未来结果。",
        "资料待核验",
      ],
      [
        "Quantum Grid Master",
        "动态网格参数方案；支持多品种测试，不宣称量子计算或收益保证。",
        "【策略类型】基于 ATR/波动率参数的动态网格。\n【风险】单边行情可快速累积仓位和回撤。\n【证据状态】表现数据待独立核验。",
        "高风险",
      ],
      [
        "Sniper Entry System",
        "一次一单的趋势入场方案；胜率、盈亏比和回撤需以可核验报告为准。",
        "【策略类型】多时间框架趋势与关键位确认。\n【风险】信号可失效，止损不消除连续亏损。\n【证据状态】胜率和收益数据待独立核验。",
        "资料待核验",
      ],
      [
        "Turbo Scalping Engine",
        "黄金高频执行方案；对券商规则、成本、滑点和延迟高度敏感。",
        "【策略类型】Tick 级高频执行。\n【风险】实际成本和流动性可使回测与实盘显著偏离。\n【证据状态】收益与回撤尚未独立核验。",
        "高风险",
      ],
      [
        "AI Matrix Trader",
        "多策略组合与市场状态切换方案；“AI”不代表收益保证。",
        "【策略类型】多策略组合与状态切换。\n【风险】模型分类可能错误，多策略仍可同时亏损。\n【证据状态】算法实现与表现数据待独立核验。",
        "资料待核验",
      ],
      [
        "Neural Trend Follower",
        "趋势跟踪指标与半自动方案；算法实现、信号质量与交易频率待独立核验。",
        "【产品类型】趋势跟踪指标+半自动 EA。\n【风险】信号会滞后或失效，不构成投资建议。\n【证据状态】算法与表现尚未独立核验。",
        "资料待核验",
      ],
    ];
    for (const [
      title,
      description,
      detailContent,
      promoLabel,
    ] of compliancePromoRepairs) {
      const [repairResult] = (await connection.query(
        "UPDATE `promo_products` SET `description` = ?, `detailContent` = ?, `promoLabel` = ? WHERE `title` = ?",
        [description, detailContent, promoLabel, title],
      )) as any[];
      if (Number(repairResult?.affectedRows ?? 0) > 0) migrationsRun++;
    }

    // ==================== 更新合作卡片封面图（如果为空）====================
    const coverImages: Record<number, string> = {
      1: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/QVUXRHilJWhcYKTW.png",
      2: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/gBeMVyXMhnKurKQb.png",
      3: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/WXZZOEwdmycsCooS.png",
      4: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/qckOdYQDkJZKplag.png",
      5: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/IqDbJxzTcYPbrfRv.png",
      6: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/QVUXRHilJWhcYKTW.png",
      7: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/qckOdYQDkJZKplag.png",
      8: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/gBeMVyXMhnKurKQb.png",
    };
    for (const [id, url] of Object.entries(coverImages)) {
      await connection.query(
        "UPDATE `cooperation_cards` SET `coverImage` = ? WHERE `id` = ? AND (`coverImage` IS NULL OR `coverImage` = '')",
        [url, id],
      );
    }
    console.log("[migrate] Updated cooperation card cover images");
    migrationsRun++;

    // ==================== 确保 email_subscriptions 表包含新字段 ====================
    try {
      const [emailSubCols] = (await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_subscriptions'",
      )) as any[];
      const emailSubColumnNames = new Set(
        emailSubCols.map((c: any) => c.COLUMN_NAME),
      );

      const emailSubNewColumns: Record<string, string> = {
        contact_info:
          "ALTER TABLE `email_subscriptions` ADD COLUMN `contact_info` varchar(255) DEFAULT NULL AFTER `email`",
        contact_type:
          "ALTER TABLE `email_subscriptions` ADD COLUMN `contact_type` varchar(50) DEFAULT 'unknown' AFTER `contact_info`",
      };

      for (const [colName, alterSql] of Object.entries(emailSubNewColumns)) {
        if (!emailSubColumnNames.has(colName)) {
          await connection.query(alterSql);
          migrationsRun++;
        }
      }

      // 确保 email 列允许 NULL（旧表可能是 NOT NULL）
      try {
        await connection.query(
          "ALTER TABLE `email_subscriptions` MODIFY COLUMN `email` varchar(320) DEFAULT NULL",
        );
        console.log("[migrate] Updated email column to allow NULL");
        migrationsRun++;
      } catch {
        // 已经是 nullable 或表不存在，忽略
      }

      // 添加索引（如果不存在）
      try {
        await connection.query(
          "CREATE INDEX `contact_info_idx` ON `email_subscriptions` (`contact_info`)",
        );
        migrationsRun++;
      } catch {
        // 索引已存在，忽略
      }
    } catch {
      // email_subscriptions 表可能不存在，由 drizzle 自动创建
    }

    // ════════════════════════════════════════════════════════════════
    // Phase 1：用户系统、订单、支付、收藏、分类
    // ════════════════════════════════════════════════════════════════

    // ─── users 表新增字段：phone + phoneVerified ───
    try {
      const [userCols] = (await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'",
      )) as any[];
      const userColumnNames = new Set(userCols.map((c: any) => c.COLUMN_NAME));

      const userMigrations: [string, string][] = [
        [
          "phone",
          "ALTER TABLE `users` ADD COLUMN `phone` varchar(20) DEFAULT NULL",
        ],
        [
          "phoneVerified",
          "ALTER TABLE `users` ADD COLUMN `phoneVerified` boolean NOT NULL DEFAULT false",
        ],
      ];
      for (const [colName, sql] of userMigrations) {
        if (!userColumnNames.has(colName)) {
          console.log(`[migrate] Adding column users.${colName}...`);
          await connection.query(sql);
          migrationsRun++;
        }
      }
      // 手机号索引
      try {
        await connection.query("CREATE INDEX `phone_idx` ON `users` (`phone`)");
        migrationsRun++;
      } catch {
        // 索引已存在，忽略
      }
    } catch (e) {
      console.error("[migrate] users phone migration failed:", e);
    }

    // ─── strategies 表新增字段：saleMode + richDescription ───
    const strategyPhase1Migrations: [string, string][] = [
      [
        "saleMode",
        "ALTER TABLE `strategies` ADD COLUMN `saleMode` enum('direct','inquiry') NOT NULL DEFAULT 'inquiry'",
      ],
      [
        "richDescription",
        "ALTER TABLE `strategies` ADD COLUMN `richDescription` text DEFAULT NULL",
      ],
    ];
    for (const [colName, sql] of strategyPhase1Migrations) {
      if (!strategyColumnNames.has(colName)) {
        console.log(`[migrate] Adding column strategies.${colName}...`);
        await connection.query(sql);
        migrationsRun++;
      }
    }

    // 自动回填：免费商品（isFree=true）默认改为 direct（直购）
    // 付费商品保持 inquiry（私聊授权），符合现状
    if (!strategyColumnNames.has("saleMode")) {
      try {
        await connection.query(
          "UPDATE `strategies` SET `saleMode` = 'direct' WHERE `isFree` = true",
        );
        console.log(
          "[migrate] Backfilled saleMode='direct' for free strategies",
        );
        migrationsRun++;
      } catch {
        // 忽略
      }
    }

    // ─── 新表：verification_codes ───
    const createVerificationCodes = `
      CREATE TABLE IF NOT EXISTS \`verification_codes\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`target\` varchar(255) NOT NULL,
        \`targetType\` enum('phone','email') NOT NULL,
        \`code\` varchar(10) NOT NULL,
        \`purpose\` varchar(50) NOT NULL,
        \`used\` boolean NOT NULL DEFAULT false,
        \`expiresAt\` timestamp NOT NULL,
        \`ip\` varchar(45) DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`target_purpose_idx\` (\`target\`, \`purpose\`),
        INDEX \`expiresAt_idx\` (\`expiresAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring verification_codes table exists...");
    await connection.query(createVerificationCodes);

    // ─── 新表：categories ───
    const createCategories = `
      CREATE TABLE IF NOT EXISTS \`categories\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`name\` varchar(100) NOT NULL,
        \`slug\` varchar(100) NOT NULL UNIQUE,
        \`parentId\` int DEFAULT NULL,
        \`icon\` varchar(50) DEFAULT NULL,
        \`description\` text DEFAULT NULL,
        \`sortOrder\` int NOT NULL DEFAULT 0,
        \`isVisible\` boolean NOT NULL DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`parentId_idx\` (\`parentId\`),
        INDEX \`slug_idx\` (\`slug\`),
        INDEX \`sortOrder_idx\` (\`sortOrder\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring categories table exists...");
    await connection.query(createCategories);

    // 默认分类数据（如果表为空）
    const [categoryRows] = (await connection.query(
      "SELECT COUNT(*) as cnt FROM `categories`",
    )) as any[];
    if (categoryRows[0].cnt === 0) {
      console.log("[migrate] Seeding default categories...");
      // 一级分类
      await connection.query(`
        INSERT INTO \`categories\` (\`name\`, \`slug\`, \`parentId\`, \`icon\`, \`sortOrder\`) VALUES
        ('MT4 智能交易', 'mt4', NULL, '📈', 1),
        ('MT5 智能交易', 'mt5', NULL, '📊', 2),
        ('指标工具', 'indicator', NULL, '📐', 3),
        ('辅助工具', 'tool', NULL, '🔧', 4),
        ('实战教程', 'course', NULL, '📚', 5)
      `);
      // 二级分类（策略类型，独立于一级，前端按 platform + type 组合筛选）
      await connection.query(`
        INSERT INTO \`categories\` (\`name\`, \`slug\`, \`parentId\`, \`icon\`, \`sortOrder\`) VALUES
        ('马丁策略', 'martin', NULL, '♻️', 11),
        ('趋势策略', 'trend', NULL, '📈', 12),
        ('网格策略', 'grid', NULL, '🔲', 13),
        ('对冲策略', 'hedge', NULL, '⚖️', 14),
        ('剥头皮', 'scalping', NULL, '⚡', 15),
        ('订单流', 'orderflow', NULL, '🌊', 16),
        ('套利策略', 'arbitrage', NULL, '🔄', 17),
        ('AI 量化', 'ai', NULL, '🤖', 18)
      `);
      migrationsRun++;
    }

    // ─── 新表：orders ───
    const createOrders = `
      CREATE TABLE IF NOT EXISTS \`orders\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`orderNo\` varchar(64) NOT NULL UNIQUE,
        \`userId\` int NOT NULL,
        \`productKind\` varchar(20) NOT NULL,
        \`productId\` int NOT NULL,
        \`productTitle\` varchar(255) NOT NULL,
        \`productCover\` text DEFAULT NULL,
        \`amount\` decimal(10,2) NOT NULL,
        \`originalAmount\` decimal(10,2) DEFAULT NULL,
        \`currency\` varchar(10) NOT NULL DEFAULT 'CNY',
        \`status\` enum('pending','paid','cancelled','refunded','expired') NOT NULL DEFAULT 'pending',
        \`paymentMethod\` varchar(50) DEFAULT NULL,
        \`paymentGateway\` varchar(50) DEFAULT NULL,
        \`paidAt\` timestamp NULL DEFAULT NULL,
        \`expiresAt\` timestamp NULL DEFAULT NULL,
        \`metadata\` text DEFAULT NULL,
        \`remark\` text DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`orderNo_idx\` (\`orderNo\`),
        INDEX \`userId_idx\` (\`userId\`),
        INDEX \`status_idx\` (\`status\`),
        INDEX \`product_idx\` (\`productKind\`, \`productId\`),
        INDEX \`createdAt_idx\` (\`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring orders table exists...");
    await connection.query(createOrders);

    // ─── 新表：payments ───
    const createPayments = `
      CREATE TABLE IF NOT EXISTS \`payments\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`orderId\` int NOT NULL,
        \`orderNo\` varchar(64) NOT NULL,
        \`gateway\` varchar(50) NOT NULL,
        \`gatewayOrderNo\` varchar(255) DEFAULT NULL,
        \`method\` varchar(50) NOT NULL,
        \`amount\` decimal(10,2) NOT NULL,
        \`currency\` varchar(10) NOT NULL DEFAULT 'CNY',
        \`status\` enum('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
        \`callbackRaw\` text DEFAULT NULL,
        \`callbackVerified\` boolean NOT NULL DEFAULT false,
        \`errorMessage\` text DEFAULT NULL,
        \`settlementNetwork\` varchar(32) DEFAULT NULL,
        \`settlementToken\` varchar(16) DEFAULT NULL,
        \`recipientAddress\` varchar(255) DEFAULT NULL,
        \`quotedAmount\` decimal(20,6) DEFAULT NULL,
        \`quoteExpiresAt\` timestamp NULL DEFAULT NULL,
        \`submittedAt\` timestamp NULL DEFAULT NULL,
        \`payerWalletAddress\` varchar(255) DEFAULT NULL,
        \`payerOwnershipAttestedAt\` timestamp NULL DEFAULT NULL,
        \`receivedAmount\` decimal(20,6) DEFAULT NULL,
        \`confirmations\` int DEFAULT NULL,
        \`observedNetwork\` varchar(32) DEFAULT NULL,
        \`usdtReviewStatus\` enum('NOT_APPLICABLE','AWAITING_TX','PENDING_REVIEW','MATCHED','UNDERPAID','OVERPAID','WRONG_NETWORK','QUOTE_EXPIRED_RECEIPT','DUPLICATE_TX','REFUND_PENDING','REFUNDED','REJECTED') NOT NULL DEFAULT 'NOT_APPLICABLE',
        \`verificationMode\` enum('MANUAL','RPC') DEFAULT NULL,
        \`reviewedBy\` int DEFAULT NULL,
        \`reviewedAt\` timestamp NULL DEFAULT NULL,
        \`reviewNote\` text DEFAULT NULL,
        \`refundAmount\` decimal(20,6) DEFAULT NULL,
        \`refundNetwork\` varchar(32) DEFAULT NULL,
        \`refundTxHash\` varchar(160) DEFAULT NULL,
        \`refundRecipientAddress\` varchar(255) DEFAULT NULL,
        \`refundVerificationRef\` varchar(120) DEFAULT NULL,
        \`refundRecipientVerifiedBy\` int DEFAULT NULL,
        \`refundRecipientVerifiedAt\` timestamp NULL DEFAULT NULL,
        \`refundedBy\` int DEFAULT NULL,
        \`refundedAt\` timestamp NULL DEFAULT NULL,
        \`paidAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`orderId_idx\` (\`orderId\`),
        INDEX \`orderNo_idx\` (\`orderNo\`),
        INDEX \`gatewayOrderNo_idx\` (\`gatewayOrderNo\`),
        UNIQUE INDEX \`payments_refund_tx_unique_idx\` (\`refundTxHash\`),
        INDEX \`status_idx\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring payments table exists...");
    await connection.query(createPayments);
    const [paymentCols] = (await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'",
    )) as any[];
    const paymentColumnNames = new Set(
      paymentCols.map((column: any) => column.COLUMN_NAME),
    );
    const paymentAuditMigrations: [string, string][] = [
      [
        "settlementNetwork",
        "ALTER TABLE `payments` ADD COLUMN `settlementNetwork` varchar(32) DEFAULT NULL",
      ],
      [
        "settlementToken",
        "ALTER TABLE `payments` ADD COLUMN `settlementToken` varchar(16) DEFAULT NULL",
      ],
      [
        "recipientAddress",
        "ALTER TABLE `payments` ADD COLUMN `recipientAddress` varchar(255) DEFAULT NULL",
      ],
      [
        "quotedAmount",
        "ALTER TABLE `payments` ADD COLUMN `quotedAmount` decimal(20,6) DEFAULT NULL",
      ],
      [
        "quoteExpiresAt",
        "ALTER TABLE `payments` ADD COLUMN `quoteExpiresAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "submittedAt",
        "ALTER TABLE `payments` ADD COLUMN `submittedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "payerWalletAddress",
        "ALTER TABLE `payments` ADD COLUMN `payerWalletAddress` varchar(255) DEFAULT NULL",
      ],
      [
        "payerOwnershipAttestedAt",
        "ALTER TABLE `payments` ADD COLUMN `payerOwnershipAttestedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "receivedAmount",
        "ALTER TABLE `payments` ADD COLUMN `receivedAmount` decimal(20,6) DEFAULT NULL",
      ],
      [
        "confirmations",
        "ALTER TABLE `payments` ADD COLUMN `confirmations` int DEFAULT NULL",
      ],
      [
        "observedNetwork",
        "ALTER TABLE `payments` ADD COLUMN `observedNetwork` varchar(32) DEFAULT NULL",
      ],
      [
        "usdtReviewStatus",
        "ALTER TABLE `payments` ADD COLUMN `usdtReviewStatus` enum('NOT_APPLICABLE','AWAITING_TX','PENDING_REVIEW','MATCHED','UNDERPAID','OVERPAID','WRONG_NETWORK','QUOTE_EXPIRED_RECEIPT','DUPLICATE_TX','REFUND_PENDING','REFUNDED','REJECTED') NOT NULL DEFAULT 'NOT_APPLICABLE'",
      ],
      [
        "verificationMode",
        "ALTER TABLE `payments` ADD COLUMN `verificationMode` enum('MANUAL','RPC') DEFAULT NULL",
      ],
      [
        "reviewedBy",
        "ALTER TABLE `payments` ADD COLUMN `reviewedBy` int DEFAULT NULL",
      ],
      [
        "reviewedAt",
        "ALTER TABLE `payments` ADD COLUMN `reviewedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "reviewNote",
        "ALTER TABLE `payments` ADD COLUMN `reviewNote` text DEFAULT NULL",
      ],
      [
        "refundAmount",
        "ALTER TABLE `payments` ADD COLUMN `refundAmount` decimal(20,6) DEFAULT NULL",
      ],
      [
        "refundNetwork",
        "ALTER TABLE `payments` ADD COLUMN `refundNetwork` varchar(32) DEFAULT NULL",
      ],
      [
        "refundTxHash",
        "ALTER TABLE `payments` ADD COLUMN `refundTxHash` varchar(160) DEFAULT NULL",
      ],
      [
        "refundRecipientAddress",
        "ALTER TABLE `payments` ADD COLUMN `refundRecipientAddress` varchar(255) DEFAULT NULL",
      ],
      [
        "refundVerificationRef",
        "ALTER TABLE `payments` ADD COLUMN `refundVerificationRef` varchar(120) DEFAULT NULL",
      ],
      [
        "refundRecipientVerifiedBy",
        "ALTER TABLE `payments` ADD COLUMN `refundRecipientVerifiedBy` int DEFAULT NULL",
      ],
      [
        "refundRecipientVerifiedAt",
        "ALTER TABLE `payments` ADD COLUMN `refundRecipientVerifiedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "refundedBy",
        "ALTER TABLE `payments` ADD COLUMN `refundedBy` int DEFAULT NULL",
      ],
      [
        "refundedAt",
        "ALTER TABLE `payments` ADD COLUMN `refundedAt` timestamp NULL DEFAULT NULL",
      ],
    ];
    for (const [column, statement] of paymentAuditMigrations) {
      if (!paymentColumnNames.has(column)) {
        await connection.query(statement);
        migrationsRun++;
      }
    }
    await ensureIndex(
      "payments",
      "payments_refund_tx_unique_idx",
      "CREATE UNIQUE INDEX `payments_refund_tx_unique_idx` ON `payments` (`refundTxHash`)",
    );
    await connection.query(`CREATE TABLE IF NOT EXISTS \`commerce_usdt_events\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`paymentId\` int NOT NULL,
      \`orderId\` int NOT NULL,
      \`actorUserId\` int DEFAULT NULL,
      \`eventType\` varchar(64) NOT NULL,
      \`payload\` text DEFAULT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`commerce_usdt_event_payment_idx\` (\`paymentId\`),
      INDEX \`commerce_usdt_event_order_idx\` (\`orderId\`),
      INDEX \`commerce_usdt_event_created_idx\` (\`createdAt\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await connection.query(`CREATE TABLE IF NOT EXISTS \`chain_tx_registry\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`network\` varchar(32) NOT NULL,
      \`normalizedHash\` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      \`usageType\` enum('COMMERCE_INBOUND','BROKER_DIRECT_INBOUND','COLLECTION_INBOUND','COLLECTION_PAYOUT','COLLECTION_REFUND','COMMERCE_REFUND') NOT NULL,
      \`referenceNo\` varchar(64) NOT NULL,
      \`actorUserId\` int DEFAULT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX \`chain_tx_network_hash_unique_idx\` (\`network\`, \`normalizedHash\`),
      INDEX \`chain_tx_reference_idx\` (\`usageType\`, \`referenceNo\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await connection.query(
      "ALTER TABLE `chain_tx_registry` MODIFY COLUMN `normalizedHash` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, MODIFY COLUMN `usageType` enum('COMMERCE_INBOUND','BROKER_DIRECT_INBOUND','COLLECTION_INBOUND','COLLECTION_PAYOUT','COLLECTION_REFUND','COMMERCE_REFUND') NOT NULL",
    );
    await connection.query(`CREATE TABLE IF NOT EXISTS \`admin_totp_uses\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`adminId\` int NOT NULL,
      \`timeStep\` int NOT NULL,
      \`action\` varchar(80) NOT NULL,
      \`usedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX \`admin_totp_admin_step_unique_idx\` (\`adminId\`, \`timeStep\`),
      INDEX \`admin_totp_used_at_idx\` (\`usedAt\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // ─── 新表：user_favorites ───
    const createUserFavorites = `
      CREATE TABLE IF NOT EXISTS \`user_favorites\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`userId\` int NOT NULL,
        \`productKind\` varchar(20) NOT NULL,
        \`productId\` int NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`userId_idx\` (\`userId\`),
        INDEX \`product_idx\` (\`productKind\`, \`productId\`),
        UNIQUE INDEX \`uniq_user_product\` (\`userId\`, \`productKind\`, \`productId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring user_favorites table exists...");
    await connection.query(createUserFavorites);

    // ─── AI 量化联盟：委托、券商直入/企业代收和审计边界 ───
    const managedSessionTables = [
      `CREATE TABLE IF NOT EXISTS \`managed_sessions\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`sessionNo\` varchar(64) NOT NULL UNIQUE,
        \`userId\` int NOT NULL,
        \`status\` enum('DRAFT','PENDING_REVIEW','PENDING_AUTHORIZATION','READY','ACTIVE','EXIT_REQUESTED','WINDING_DOWN','ENDED','CANCELLED','REJECTED') NOT NULL DEFAULT 'DRAFT',
        \`termDays\` int NOT NULL DEFAULT 0,
        \`capitalMode\` enum('DIRECT_BROKER') NOT NULL DEFAULT 'DIRECT_BROKER',
        \`onboardingMode\` enum('SELF_OPENED','PLATFORM_ASSISTED') NOT NULL DEFAULT 'SELF_OPENED',
        \`fundsRoute\` enum('BROKER_DIRECT','PLATFORM_COLLECTION') NOT NULL DEFAULT 'BROKER_DIRECT',
        \`targetCapital\` decimal(20,6) NOT NULL,
        \`settlementAsset\` enum('USDT') NOT NULL DEFAULT 'USDT',
        \`riskProfile\` enum('CONSERVATIVE','BALANCED','AGGRESSIVE') NOT NULL,
        \`maxDrawdownPct\` decimal(5,2) NOT NULL,
        \`exitMode\` enum('IMMEDIATE_CLOSE','NATURAL_EXIT','HANDOVER_OPEN_POSITIONS') NOT NULL,
        \`tradeAuthorizationStatus\` enum('NOT_REQUESTED','PENDING','GRANTED','REVOKED') NOT NULL DEFAULT 'NOT_REQUESTED',
        \`withdrawalPermission\` enum('NONE') NOT NULL DEFAULT 'NONE',
        \`executionEnabled\` boolean NOT NULL DEFAULT false,
        \`version\` int NOT NULL DEFAULT 1,
        \`submittedAt\` timestamp NULL DEFAULT NULL,
        \`activatedAt\` timestamp NULL DEFAULT NULL,
        \`expiresAt\` timestamp NULL DEFAULT NULL,
        \`exitRequestedAt\` timestamp NULL DEFAULT NULL,
        \`endedAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`managed_sessions_user_idx\` (\`userId\`),
        INDEX \`managed_sessions_status_idx\` (\`status\`),
        INDEX \`managed_sessions_created_idx\` (\`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`managed_session_strategies\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`sessionId\` int NOT NULL,
        \`strategyId\` varchar(80) NOT NULL,
        \`weightPct\` decimal(5,2) NOT NULL,
        \`riskMultiplier\` decimal(4,2) NOT NULL,
        \`sortOrder\` int NOT NULL DEFAULT 0,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`managed_strategy_session_idx\` (\`sessionId\`),
        UNIQUE INDEX \`managed_strategy_unique_idx\` (\`sessionId\`, \`strategyId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`managed_execution_slots\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`sessionId\` int NOT NULL,
        \`slotKey\` varchar(64) NOT NULL,
        \`brokerId\` varchar(80) NOT NULL,
        \`label\` varchar(80) DEFAULT NULL,
        \`capitalWeightPct\` decimal(5,2) NOT NULL,
        \`fundingSource\` enum('DIRECT_BROKER') NOT NULL DEFAULT 'DIRECT_BROKER',
        \`connectionStatus\` enum('UNLINKED','PENDING','VERIFIED','REVOKED') NOT NULL DEFAULT 'UNLINKED',
        \`tradePermission\` enum('NOT_REQUESTED','PENDING','GRANTED','REVOKED') NOT NULL DEFAULT 'NOT_REQUESTED',
        \`withdrawalPermission\` enum('NONE') NOT NULL DEFAULT 'NONE',
        \`accountAlias\` varchar(80) DEFAULT NULL,
        \`authorizationReference\` varchar(120) DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`managed_slot_session_idx\` (\`sessionId\`),
        UNIQUE INDEX \`managed_slot_broker_unique_idx\` (\`sessionId\`, \`brokerId\`),
        UNIQUE INDEX \`managed_slot_key_unique_idx\` (\`sessionId\`, \`slotKey\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`managed_session_events\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`sessionId\` int NOT NULL,
        \`actorUserId\` int DEFAULT NULL,
        \`eventType\` varchar(64) NOT NULL,
        \`fromStatus\` varchar(32) DEFAULT NULL,
        \`toStatus\` varchar(32) DEFAULT NULL,
        \`payload\` text DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`managed_event_session_idx\` (\`sessionId\`),
        INDEX \`managed_event_created_idx\` (\`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];
    console.log("[migrate] Ensuring managed session tables exist...");
    for (const sql of managedSessionTables) await connection.query(sql);
    const [managedSessionColumns] = (await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'managed_sessions'",
    )) as any[];
    if (
      !managedSessionColumns.some(
        (column: any) => column.COLUMN_NAME === "expiresAt",
      )
    ) {
      await connection.query(
        "ALTER TABLE `managed_sessions` ADD COLUMN `expiresAt` timestamp NULL DEFAULT NULL AFTER `activatedAt`",
      );
      migrationsRun++;
    }
    const managedSessionColumnNames = new Set(
      managedSessionColumns.map((column: any) => column.COLUMN_NAME),
    );
    if (!managedSessionColumnNames.has("onboardingMode")) {
      await connection.query(
        "ALTER TABLE `managed_sessions` ADD COLUMN `onboardingMode` enum('SELF_OPENED','PLATFORM_ASSISTED') NOT NULL DEFAULT 'SELF_OPENED' AFTER `capitalMode`",
      );
      migrationsRun++;
    }
    if (!managedSessionColumnNames.has("fundsRoute")) {
      await connection.query(
        "ALTER TABLE `managed_sessions` ADD COLUMN `fundsRoute` enum('BROKER_DIRECT','PLATFORM_COLLECTION') NOT NULL DEFAULT 'BROKER_DIRECT' AFTER `onboardingMode`",
      );
      migrationsRun++;
    }
    // 历史的期限/Vault 草案统一收敛为无期限、默认券商直入。
    await connection.query(
      "UPDATE `managed_sessions` SET `termDays` = 0, `expiresAt` = NULL, `capitalMode` = 'DIRECT_BROKER'",
    );
    await connection.query(
      "UPDATE `managed_execution_slots` SET `fundingSource` = 'DIRECT_BROKER'",
    );
    await connection.query(
      "ALTER TABLE `managed_sessions` MODIFY COLUMN `termDays` int NOT NULL DEFAULT 0, MODIFY COLUMN `capitalMode` enum('DIRECT_BROKER') NOT NULL DEFAULT 'DIRECT_BROKER'",
    );
    await connection.query(
      "ALTER TABLE `managed_execution_slots` MODIFY COLUMN `fundingSource` enum('DIRECT_BROKER') NOT NULL DEFAULT 'DIRECT_BROKER'",
    );

    const managedFundingTables = [
      `CREATE TABLE IF NOT EXISTS \`managed_broker_funding_intents\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`intentNo\` varchar(64) NOT NULL UNIQUE,
        \`sessionId\` int NOT NULL,
        \`slotId\` int NOT NULL,
        \`userId\` int NOT NULL,
        \`brokerId\` varchar(80) NOT NULL,
        \`status\` enum('DRAFT','WAITING_ACCOUNT','WAITING_INSTRUCTIONS','READY_TO_FUND','TX_SUBMITTED','RECEIVED','RECONCILED','AWAITING_PAYOUT','PAYOUT_SUBMITTED','BROKER_CREDIT_PENDING','CREDITED','EXCEPTION','CANCELLED') NOT NULL DEFAULT 'DRAFT',
        \`asset\` enum('USDT') NOT NULL DEFAULT 'USDT',
        \`fundsRoute\` enum('BROKER_DIRECT','PLATFORM_COLLECTION') NOT NULL DEFAULT 'BROKER_DIRECT',
        \`instructionSource\` enum('BROKER_PORTAL','PLATFORM_ADDRESS_POOL') DEFAULT NULL,
        \`custodyProvider\` enum('MANUAL','BVNK','COBO') NOT NULL DEFAULT 'MANUAL',
        \`externalProviderRef\` varchar(120) DEFAULT NULL,
        \`collectionAddressId\` int DEFAULT NULL,
        \`network\` varchar(32) DEFAULT NULL,
        \`depositAddress\` varchar(255) DEFAULT NULL,
        \`depositTag\` varchar(120) DEFAULT NULL,
        \`expectedAmount\` decimal(20,6) NOT NULL,
        \`declaredAmount\` decimal(20,6) DEFAULT NULL,
        \`payerWalletAddress\` varchar(255) DEFAULT NULL,
        \`payerOwnershipAttestedAt\` timestamp NULL DEFAULT NULL,
        \`customerEligibilityReferenceHash\` varchar(80) DEFAULT NULL,
        \`customerEligibilityAttestedBy\` int DEFAULT NULL,
        \`customerEligibilityAttestedAt\` timestamp NULL DEFAULT NULL,
        \`txHash\` varchar(160) DEFAULT NULL,
        \`receivedAmount\` decimal(20,6) DEFAULT NULL,
        \`observedNetwork\` varchar(32) DEFAULT NULL,
        \`creditedAmount\` decimal(20,6) DEFAULT NULL,
        \`confirmations\` int DEFAULT NULL,
        \`reconciliationResult\` enum('MATCHED','UNDERPAID','OVERPAID','WRONG_NETWORK','LATE_RECEIPT','DUPLICATE_TX','REFUND_PENDING','REFUNDED','MANUAL_REVIEW') DEFAULT NULL,
        \`screeningStatus\` enum('PENDING','CLEARED','HELD','REJECTED') DEFAULT NULL,
        \`screeningProviderRef\` varchar(120) DEFAULT NULL,
        \`complianceNote\` text DEFAULT NULL,
        \`clearedBy\` int DEFAULT NULL,
        \`clearedAt\` timestamp NULL DEFAULT NULL,
        \`payoutAmount\` decimal(20,6) DEFAULT NULL,
        \`payoutNetwork\` varchar(32) DEFAULT NULL,
        \`payoutDestination\` varchar(255) DEFAULT NULL,
        \`payoutDestinationReferenceHash\` varchar(80) DEFAULT NULL,
        \`payoutTxHash\` varchar(160) DEFAULT NULL,
        \`payoutRequestedBy\` int DEFAULT NULL,
        \`payoutRequestedAt\` timestamp NULL DEFAULT NULL,
        \`payoutApprovedBy\` int DEFAULT NULL,
        \`payoutApprovedAt\` timestamp NULL DEFAULT NULL,
        \`payoutSubmittedAt\` timestamp NULL DEFAULT NULL,
        \`verifiedRefundAddress\` varchar(255) DEFAULT NULL,
        \`refundAddressVerifiedBy\` int DEFAULT NULL,
        \`refundAddressVerifiedAt\` timestamp NULL DEFAULT NULL,
        \`refundAmount\` decimal(20,6) DEFAULT NULL,
        \`refundTxHash\` varchar(160) DEFAULT NULL,
        \`brokerCreditReference\` varchar(120) DEFAULT NULL,
        \`exceptionReason\` text DEFAULT NULL,
        \`resolutionNote\` text DEFAULT NULL,
        \`resumeStatus\` varchar(32) DEFAULT NULL,
        \`instructionsIssuedAt\` timestamp NULL DEFAULT NULL,
        \`instructionsExpireAt\` timestamp NULL DEFAULT NULL,
        \`submittedAt\` timestamp NULL DEFAULT NULL,
        \`receivedAt\` timestamp NULL DEFAULT NULL,
        \`reconciledAt\` timestamp NULL DEFAULT NULL,
        \`creditedAt\` timestamp NULL DEFAULT NULL,
        \`cancelledAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`managed_funding_session_idx\` (\`sessionId\`),
        INDEX \`managed_funding_slot_idx\` (\`slotId\`),
        INDEX \`managed_funding_user_idx\` (\`userId\`),
        INDEX \`managed_funding_status_idx\` (\`status\`),
        UNIQUE INDEX \`managed_funding_tx_unique_idx\` (\`txHash\`),
        UNIQUE INDEX \`managed_funding_payout_tx_unique_idx\` (\`payoutTxHash\`),
        UNIQUE INDEX \`managed_funding_refund_tx_unique_idx\` (\`refundTxHash\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`managed_broker_funding_events\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`fundingIntentId\` int NOT NULL,
        \`sessionId\` int NOT NULL,
        \`actorUserId\` int DEFAULT NULL,
        \`eventType\` varchar(64) NOT NULL,
        \`fromStatus\` varchar(32) DEFAULT NULL,
        \`toStatus\` varchar(32) DEFAULT NULL,
        \`payload\` text DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`managed_funding_event_intent_idx\` (\`fundingIntentId\`),
        INDEX \`managed_funding_event_session_idx\` (\`sessionId\`),
        INDEX \`managed_funding_event_created_idx\` (\`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`managed_collection_addresses\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`label\` varchar(80) NOT NULL,
        \`network\` varchar(32) NOT NULL,
        \`asset\` enum('USDT') NOT NULL DEFAULT 'USDT',
        \`address\` varchar(255) NOT NULL,
        \`depositTag\` varchar(120) DEFAULT NULL,
        \`status\` enum('AVAILABLE','RESERVED','USED','DISABLED') NOT NULL DEFAULT 'AVAILABLE',
        \`currentFundingIntentId\` int DEFAULT NULL,
        \`createdBy\` int NOT NULL,
        \`reservedAt\` timestamp NULL DEFAULT NULL,
        \`usedAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX \`managed_collection_network_address_unique_idx\` (\`network\`, \`address\`),
        INDEX \`managed_collection_address_status_idx\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS \`managed_broker_collection_approvals\` (
        \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`brokerId\` varchar(80) NOT NULL UNIQUE,
        \`status\` enum('NOT_APPROVED','PENDING','APPROVED','SUSPENDED') NOT NULL DEFAULT 'NOT_APPROVED',
        \`approvalReferenceHash\` varchar(80) DEFAULT NULL,
        \`approvedEntity\` varchar(160) DEFAULT NULL,
        \`approvedRegion\` varchar(80) DEFAULT NULL,
        \`approvedChannelId\` varchar(120) DEFAULT NULL,
        \`validUntil\` timestamp NULL DEFAULT NULL,
        \`allowedNetworks\` text DEFAULT NULL,
        \`minimumAmount\` decimal(20,6) DEFAULT NULL,
        \`maximumAmount\` decimal(20,6) DEFAULT NULL,
        \`reviewedBy\` int DEFAULT NULL,
        \`approvedAt\` timestamp NULL DEFAULT NULL,
        \`note\` text DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`managed_collection_approval_status_idx\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];
    for (const sql of managedFundingTables) await connection.query(sql);
    const [managedFundingColumns] = (await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'managed_broker_funding_intents'",
    )) as any[];
    const managedFundingColumnNames = new Set(
      managedFundingColumns.map((column: any) => column.COLUMN_NAME),
    );
    const managedFundingColumnMigrations: [string, string][] = [
      [
        "custodyProvider",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `custodyProvider` enum('MANUAL','BVNK','COBO') NOT NULL DEFAULT 'MANUAL' AFTER `instructionSource`",
      ],
      [
        "externalProviderRef",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `externalProviderRef` varchar(120) DEFAULT NULL",
      ],
      [
        "collectionAddressId",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `collectionAddressId` int DEFAULT NULL",
      ],
      [
        "payerWalletAddress",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payerWalletAddress` varchar(255) DEFAULT NULL",
      ],
      [
        "payerOwnershipAttestedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payerOwnershipAttestedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "customerEligibilityReferenceHash",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `customerEligibilityReferenceHash` varchar(80) DEFAULT NULL",
      ],
      [
        "customerEligibilityAttestedBy",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `customerEligibilityAttestedBy` int DEFAULT NULL",
      ],
      [
        "customerEligibilityAttestedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `customerEligibilityAttestedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "receivedAmount",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `receivedAmount` decimal(20,6) DEFAULT NULL",
      ],
      [
        "observedNetwork",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `observedNetwork` varchar(32) DEFAULT NULL",
      ],
      [
        "creditedAmount",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `creditedAmount` decimal(20,6) DEFAULT NULL",
      ],
      [
        "confirmations",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `confirmations` int DEFAULT NULL",
      ],
      [
        "reconciliationResult",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `reconciliationResult` enum('MATCHED','UNDERPAID','OVERPAID','WRONG_NETWORK','LATE_RECEIPT','DUPLICATE_TX','REFUND_PENDING','REFUNDED','MANUAL_REVIEW') DEFAULT NULL",
      ],
      [
        "screeningStatus",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `screeningStatus` enum('PENDING','CLEARED','HELD','REJECTED') DEFAULT NULL",
      ],
      [
        "screeningProviderRef",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `screeningProviderRef` varchar(120) DEFAULT NULL",
      ],
      [
        "complianceNote",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `complianceNote` text DEFAULT NULL",
      ],
      [
        "clearedBy",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `clearedBy` int DEFAULT NULL",
      ],
      [
        "clearedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `clearedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "payoutAmount",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutAmount` decimal(20,6) DEFAULT NULL",
      ],
      [
        "payoutNetwork",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutNetwork` varchar(32) DEFAULT NULL",
      ],
      [
        "payoutDestination",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutDestination` varchar(255) DEFAULT NULL",
      ],
      [
        "payoutDestinationReferenceHash",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutDestinationReferenceHash` varchar(80) DEFAULT NULL",
      ],
      [
        "payoutTxHash",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutTxHash` varchar(160) DEFAULT NULL",
      ],
      [
        "payoutRequestedBy",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutRequestedBy` int DEFAULT NULL",
      ],
      [
        "payoutRequestedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutRequestedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "payoutApprovedBy",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutApprovedBy` int DEFAULT NULL",
      ],
      [
        "payoutApprovedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutApprovedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "payoutSubmittedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `payoutSubmittedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "verifiedRefundAddress",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `verifiedRefundAddress` varchar(255) DEFAULT NULL",
      ],
      [
        "refundAddressVerifiedBy",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `refundAddressVerifiedBy` int DEFAULT NULL",
      ],
      [
        "refundAddressVerifiedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `refundAddressVerifiedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "refundAmount",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `refundAmount` decimal(20,6) DEFAULT NULL",
      ],
      [
        "refundTxHash",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `refundTxHash` varchar(160) DEFAULT NULL",
      ],
      [
        "brokerCreditReference",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `brokerCreditReference` varchar(120) DEFAULT NULL",
      ],
      [
        "exceptionReason",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `exceptionReason` text DEFAULT NULL",
      ],
      [
        "resolutionNote",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `resolutionNote` text DEFAULT NULL",
      ],
      [
        "resumeStatus",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `resumeStatus` varchar(32) DEFAULT NULL",
      ],
      [
        "instructionsIssuedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `instructionsIssuedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "instructionsExpireAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `instructionsExpireAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "submittedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `submittedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "receivedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `receivedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "reconciledAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `reconciledAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "creditedAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `creditedAt` timestamp NULL DEFAULT NULL",
      ],
      [
        "cancelledAt",
        "ALTER TABLE `managed_broker_funding_intents` ADD COLUMN `cancelledAt` timestamp NULL DEFAULT NULL",
      ],
    ];
    for (const [column, statement] of managedFundingColumnMigrations) {
      if (!managedFundingColumnNames.has(column)) {
        await connection.query(statement);
        migrationsRun++;
      }
    }
    await connection.query(
      "ALTER TABLE `managed_broker_funding_intents` MODIFY COLUMN `status` enum('DRAFT','WAITING_ACCOUNT','WAITING_INSTRUCTIONS','READY_TO_FUND','TX_SUBMITTED','RECEIVED','RECONCILED','AWAITING_PAYOUT','PAYOUT_SUBMITTED','BROKER_CREDIT_PENDING','CREDITED','EXCEPTION','CANCELLED') NOT NULL DEFAULT 'DRAFT', MODIFY COLUMN `custodyProvider` enum('MANUAL','BVNK','COBO') NOT NULL DEFAULT 'MANUAL'",
    );
    await ensureIndex(
      "managed_broker_funding_intents",
      "managed_funding_tx_unique_idx",
      "CREATE UNIQUE INDEX `managed_funding_tx_unique_idx` ON `managed_broker_funding_intents` (`txHash`)",
    );
    await ensureIndex(
      "managed_broker_funding_intents",
      "managed_funding_payout_tx_unique_idx",
      "CREATE UNIQUE INDEX `managed_funding_payout_tx_unique_idx` ON `managed_broker_funding_intents` (`payoutTxHash`)",
    );
    await ensureIndex(
      "managed_broker_funding_intents",
      "managed_funding_refund_tx_unique_idx",
      "CREATE UNIQUE INDEX `managed_funding_refund_tx_unique_idx` ON `managed_broker_funding_intents` (`refundTxHash`)",
    );
    const [approvalColumns] = (await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'managed_broker_collection_approvals'",
    )) as any[];
    const approvalColumnNames = new Set(
      approvalColumns.map((column: any) => column.COLUMN_NAME),
    );
    const approvalMigrations: [string, string][] = [
      [
        "approvedEntity",
        "ALTER TABLE `managed_broker_collection_approvals` ADD COLUMN `approvedEntity` varchar(160) DEFAULT NULL",
      ],
      [
        "approvedRegion",
        "ALTER TABLE `managed_broker_collection_approvals` ADD COLUMN `approvedRegion` varchar(80) DEFAULT NULL",
      ],
      [
        "approvedChannelId",
        "ALTER TABLE `managed_broker_collection_approvals` ADD COLUMN `approvedChannelId` varchar(120) DEFAULT NULL",
      ],
      [
        "validUntil",
        "ALTER TABLE `managed_broker_collection_approvals` ADD COLUMN `validUntil` timestamp NULL DEFAULT NULL",
      ],
      [
        "allowedNetworks",
        "ALTER TABLE `managed_broker_collection_approvals` ADD COLUMN `allowedNetworks` text DEFAULT NULL",
      ],
      [
        "minimumAmount",
        "ALTER TABLE `managed_broker_collection_approvals` ADD COLUMN `minimumAmount` decimal(20,6) DEFAULT NULL",
      ],
      [
        "maximumAmount",
        "ALTER TABLE `managed_broker_collection_approvals` ADD COLUMN `maximumAmount` decimal(20,6) DEFAULT NULL",
      ],
    ];
    for (const [column, statement] of approvalMigrations) {
      if (!approvalColumnNames.has(column)) {
        await connection.query(statement);
        migrationsRun++;
      }
    }
    // 明确写入三家默认未批准；不存在默认开启第三方入金。
    await connection.query(`
      INSERT IGNORE INTO \`managed_broker_collection_approvals\` (\`brokerId\`, \`status\`)
      VALUES ('exness', 'NOT_APPROVED'), ('ic-markets', 'NOT_APPROVED'), ('blueberry-markets', 'NOT_APPROVED')
    `);

    try {
      const catalogChanges = await syncCuratedStrategyCatalog(connection);
      if (catalogChanges > 0) {
        console.log(
          `[migrate] Curated strategy catalog synced (${catalogChanges} record(s))`,
        );
        migrationsRun++;
      }
    } catch (error) {
      // 内容升级失败不阻断服务启动；下一次部署会安全重试。
      console.error("[migrate] Curated strategy catalog sync failed:", error);
    }

    if (migrationsRun > 0) {
      console.log(
        `[migrate] \u2713 ${migrationsRun} migration(s) applied successfully`,
      );
    } else {
      console.log("[migrate] \u2713 Database schema is up to date");
    }
  } catch (error) {
    console.error("[migrate] Migration error:", error);
    // 生产环境必须 fail closed：资管与结算状态不能在半迁移的 schema 上运行。
    if (options.strict || isProductionRuntime()) throw error;
  } finally {
    if (connection) {
      if (migrationLockAcquired) {
        try {
          await connection.query(
            "SELECT RELEASE_LOCK('eaxau_ai_alliance_migrate_v1')",
          );
        } catch (error) {
          console.error("[migrate] Failed to release migration lock:", error);
        }
      }
      await connection.end();
    }
  }
}

export { runMigrations };

// Drizzle SQL files are retained as schema-review artifacts. The authoritative
// migration path is this idempotent, advisory-locked migrator so an existing
// database that was previously upgraded at server startup never replays an
// unjournaled ALTER statement.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runMigrations({ strict: true }).catch((error) => {
    console.error("[migrate] CLI migration failed:", error);
    process.exitCode = 1;
  });
}
