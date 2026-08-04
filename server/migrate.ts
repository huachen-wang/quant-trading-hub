/**
 * 自动数据库迁移脚本
 * 在服务器启动前执行，确保数据库 schema 与代码同步
 * 使用原生 SQL 执行迁移，带有 IF NOT EXISTS 保护，可重复执行
 */
import mysql from "mysql2/promise";
import { syncCuratedStrategyCatalog } from "./strategy-catalog";

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
      ["isCurated", "ALTER TABLE `strategies` ADD COLUMN `isCurated` boolean NOT NULL DEFAULT false"],
      ["featuredLink", "ALTER TABLE `strategies` ADD COLUMN `featuredLink` text DEFAULT NULL"],
      ["dataStatus", "ALTER TABLE `strategies` ADD COLUMN `dataStatus` enum('estimated','referenced','verified') NOT NULL DEFAULT 'estimated'"],
      ["sourceName", "ALTER TABLE `strategies` ADD COLUMN `sourceName` varchar(120) DEFAULT NULL"],
      ["sourceUrl", "ALTER TABLE `strategies` ADD COLUMN `sourceUrl` text DEFAULT NULL"],
      ["evidenceUrl", "ALTER TABLE `strategies` ADD COLUMN `evidenceUrl` text DEFAULT NULL"],
    ];

    for (const [colName, sql] of strategyMigrations) {
      if (!strategyColumnNames.has(colName)) {
        console.log(`[migrate] Adding column strategies.${colName}...`);
        await connection.query(sql);
        migrationsRun++;
      }
    }

    try {
      await connection.query("CREATE INDEX `curated_idx` ON `strategies` (`isCurated`)");
      migrationsRun++;
    } catch {
      // 索引已存在，忽略。
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
        ('趋势刷单·EAXAU独家版', '单边1000点暴跌不爆仓', '趋势马丁策略，抗单能力极强。独家调优版本，市面无同款。', NULL, 'gold', '趋势马丁', 'MT4', '私聊备注「趋势刷单」获取观摩账户', 5),
        ('智能趋势追踪', '趋势追踪·节奏清晰', '一次一单趋势追踪策略，信号清晰，适合手动+自动结合使用。', NULL, 'gold', '一次一单', 'MT4/MT5', '私聊备注「趋势追踪」获取观摩账户', 6),
        ('暴利引擎 Pro', '全网月收益第一', '暴力策略，追求极致收益。适合有风险承受能力的专业交易者。', '月收益第一', 'red', '暴力策略', 'MT4', '私聊备注「暴利引擎」获取观摩账户', 7),
        ('点金订单流', '四维共振·专业机构选择', '机构级订单流分析系统，四维共振信号。适合专业交易团队和工作室。', '机构级', 'gold', '一次一单', 'MT4/MT5', '私聊备注「点金订单流」获取观摩账户', 8)
      `);
      migrationsRun++;
    }

    // ==================== 插入默认促销商品数据（如果表为空）====================
    const [promoRows] = await connection.query("SELECT COUNT(*) as cnt FROM `promo_products`") as any[];
    if (promoRows[0].cnt === 0) {
      console.log("[migrate] Inserting default promo products...");
      await connection.query(`
        INSERT INTO \`promo_products\` (\`title\`, \`description\`, \`coverImage\`, \`platform\`, \`category\`, \`originalPrice\`, \`promoPrice\`, \`promoLabel\`, \`promoEndTime\`, \`detailContent\`, \`stock\`, \`soldCount\`, \`sortOrder\`, \`status\`) VALUES
        ('Gold Scalper Pro MT5', '专业黄金剥头皮EA，超低延迟执行，日均50-200单。适合ECN账户，点差要求低于15点。经过3年实盘验证，年化收益180%+。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/QVUXRHilJWhcYKTW.png', 'MT5', 'ea', 2999.00, 899.00, '限时3折', '2026-06-30 23:59:59', '【策略原理】基于黄金市场微观结构的高频剥头皮策略，利用价格回归特性在波动中获利。\n【核心优势】超低延迟执行引擎、智能滑点控制、多层风控体系。\n【适用环境】ECN/STP账户，点差<15点，建议VPS延迟<5ms。\n【历史表现】年化180%+，最大回撤12%，夏普比率2.8。', 50, 23, 1, 'active'),
        ('Quantum Grid Master', '量子网格交易系统，智能动态网格间距，自适应市场波动。支持多货币对同时运行，内置资金管理模块。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/gBeMVyXMhnKurKQb.png', 'MT4', 'ea', 4999.00, 1599.00, '爆款直降', '2026-07-15 23:59:59', '【策略原理】基于量子计算理论的动态网格系统，根据ATR和波动率自动调整网格间距。\n【核心优势】自适应网格间距、多货币对支持、智能仓位管理。\n【适用环境】标准账户即可，建议资金5000美元以上。\n【历史表现】年化150%+，最大回撤18%。', 30, 15, 2, 'active'),
        ('Sniper Entry System', '狙击手入场系统，精准捕捉趋势起点。一次一单模式，胜率高达78%。配合独家出场算法，盈亏比达到1:3以上。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/WXZZOEwdmycsCooS.png', 'MT5', 'ea', 3999.00, 1299.00, '源头特供', '2026-08-01 23:59:59', '【策略原理】多时间框架趋势共振+关键位突破确认，精准捕捉趋势启动点。\n【核心优势】78%胜率、1:3盈亏比、严格止损控制。\n【适用环境】H1/H4时间框架，适合黄金/主流货币对。\n【历史表现】年化120%+，最大回撤8%，连续亏损不超过3单。', 100, 42, 3, 'active'),
        ('Turbo Scalping Engine', '涡轮剥头皮引擎，毫秒级下单速度。专为黄金高频交易设计，日均交易200-500单，稳定盈利。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/qckOdYQDkJZKplag.png', 'MT4', 'ea', 5999.00, 1999.00, '限量特价', '2026-06-15 23:59:59', '【策略原理】基于Tick级别数据的超高频交易策略，利用市场微结构获利。\n【核心优势】毫秒级执行、智能流动性检测、自动避开新闻时段。\n【适用环境】必须使用ECN账户+低延迟VPS，点差<10点。\n【历史表现】月均15-25%收益，最大回撤10%。', 20, 11, 4, 'active'),
        ('AI Matrix Trader', 'AI矩阵交易系统，基于深度学习的多策略组合。自动识别市场状态，动态切换最优策略。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/IqDbJxzTcYPbrfRv.png', 'MT5', 'ea', 8999.00, 2999.00, '旗舰首发', '2026-09-01 23:59:59', '【策略原理】基于LSTM神经网络的市场状态识别+多策略动态切换系统。\n【核心优势】AI自适应市场、多策略组合、全自动风控。\n【适用环境】MT5平台，建议资金10000美元以上。\n【历史表现】年化200%+，最大回撤15%，夏普比率3.2。', 15, 8, 5, 'active'),
        ('Neural Trend Follower', '神经网络趋势跟踪器，利用机器学习识别趋势方向和强度。低频高质量交易，周均3-5单。', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/WXZZOEwdmycsCooS.png', 'MT4', 'indicator', 1999.00, 699.00, '新品上架', '2026-07-31 23:59:59', '【产品类型】智能指标+半自动EA\n【核心功能】AI趋势识别、信号强度评分、自动画线标注。\n【适用场景】适合有一定交易基础的手动交易者辅助决策。\n【使用方式】安装后自动在图表上标注买卖信号和趋势方向。', 200, 67, 6, 'active')
      `);
      migrationsRun++;
    }

    // ==================== 更新合作卡片封面图（如果为空）====================
    const coverImages: Record<number, string> = {
      1: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/QVUXRHilJWhcYKTW.png',
      2: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/gBeMVyXMhnKurKQb.png',
      3: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/WXZZOEwdmycsCooS.png',
      4: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/qckOdYQDkJZKplag.png',
      5: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/IqDbJxzTcYPbrfRv.png',
      6: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/QVUXRHilJWhcYKTW.png',
      7: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/qckOdYQDkJZKplag.png',
      8: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/gBeMVyXMhnKurKQb.png',
    };
    for (const [id, url] of Object.entries(coverImages)) {
      await connection.query(
        "UPDATE `cooperation_cards` SET `coverImage` = ? WHERE `id` = ? AND (`coverImage` IS NULL OR `coverImage` = '')",
        [url, id]
      );
    }
    console.log("[migrate] Updated cooperation card cover images");
    migrationsRun++;

    // ==================== 确保 email_subscriptions 表包含新字段 ====================
    try {
      const [emailSubCols] = await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_subscriptions'"
      ) as any[];
      const emailSubColumnNames = new Set(emailSubCols.map((c: any) => c.COLUMN_NAME));

      const emailSubNewColumns: Record<string, string> = {
        contact_info: "ALTER TABLE `email_subscriptions` ADD COLUMN `contact_info` varchar(255) DEFAULT NULL AFTER `email`",
        contact_type: "ALTER TABLE `email_subscriptions` ADD COLUMN `contact_type` varchar(50) DEFAULT 'unknown' AFTER `contact_info`",
      };

      for (const [colName, alterSql] of Object.entries(emailSubNewColumns)) {
        if (!emailSubColumnNames.has(colName)) {
          await connection.query(alterSql);
          migrationsRun++;
        }
      }

      // 确保 email 列允许 NULL（旧表可能是 NOT NULL）
      try {
        await connection.query("ALTER TABLE `email_subscriptions` MODIFY COLUMN `email` varchar(320) DEFAULT NULL");
        console.log("[migrate] Updated email column to allow NULL");
        migrationsRun++;
      } catch {
        // 已经是 nullable 或表不存在，忽略
      }

      // 添加索引（如果不存在）
      try {
        await connection.query("CREATE INDEX `contact_info_idx` ON `email_subscriptions` (`contact_info`)");
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
      const [userCols] = await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
      ) as any[];
      const userColumnNames = new Set(userCols.map((c: any) => c.COLUMN_NAME));

      const userMigrations: [string, string][] = [
        ["phone", "ALTER TABLE `users` ADD COLUMN `phone` varchar(20) DEFAULT NULL"],
        ["phoneVerified", "ALTER TABLE `users` ADD COLUMN `phoneVerified` boolean NOT NULL DEFAULT false"],
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
      ["saleMode", "ALTER TABLE `strategies` ADD COLUMN `saleMode` enum('direct','inquiry') NOT NULL DEFAULT 'inquiry'"],
      ["richDescription", "ALTER TABLE `strategies` ADD COLUMN `richDescription` text DEFAULT NULL"],
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
          "UPDATE `strategies` SET `saleMode` = 'direct' WHERE `isFree` = true"
        );
        console.log("[migrate] Backfilled saleMode='direct' for free strategies");
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
    const [categoryRows] = await connection.query("SELECT COUNT(*) as cnt FROM `categories`") as any[];
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
        \`paidAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`orderId_idx\` (\`orderId\`),
        INDEX \`orderNo_idx\` (\`orderNo\`),
        INDEX \`gatewayOrderNo_idx\` (\`gatewayOrderNo\`),
        INDEX \`status_idx\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    console.log("[migrate] Ensuring payments table exists...");
    await connection.query(createPayments);

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

    try {
      const catalogChanges = await syncCuratedStrategyCatalog(connection);
      if (catalogChanges > 0) {
        console.log(`[migrate] Curated strategy catalog synced (${catalogChanges} record(s))`);
        migrationsRun++;
      }
    } catch (error) {
      // 内容升级失败不阻断服务启动；下一次部署会安全重试。
      console.error("[migrate] Curated strategy catalog sync failed:", error);
    }

    if (migrationsRun > 0) {
      console.log(`[migrate] \u2713 ${migrationsRun} migration(s) applied successfully`);
    } else {
      console.log("[migrate] \u2713 Database schema is up to date");
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
