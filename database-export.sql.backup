-- ============================================
-- 量化交易策略评分平台 - 数据库SQL导出
-- 生成时间: 2026-02-09
-- 包含: 表结构 + 测试数据
-- ============================================

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. 用户表 (users)
-- ============================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320) DEFAULT NULL,
  `avatar` text,
  `bio` text,
  `loginMethod` varchar(64) DEFAULT NULL,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `openId` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试用户数据
INSERT INTO `users` (`id`, `openId`, `name`, `email`, `avatar`, `role`, `createdAt`) VALUES
(1, 'test_admin_001', '管理员', 'admin@test.com', NULL, 'admin', NOW()),
(2, 'test_user_001', '测试用户1', 'user1@test.com', NULL, 'user', NOW()),
(3, 'test_user_002', '测试用户2', 'user2@test.com', NULL, 'user', NOW()),
(4, 'test_user_003', '张三', 'zhangsan@test.com', NULL, 'user', NOW()),
(5, 'test_user_004', '李四', 'lisi@test.com', NULL, 'user', NOW());

-- ============================================
-- 2. EA策略表 (strategies)
-- ============================================
DROP TABLE IF EXISTS `strategies`;
CREATE TABLE `strategies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `platform` enum('MT4','MT5') NOT NULL,
  `pairs` text NOT NULL,
  `timeframe` varchar(50) DEFAULT NULL,
  `coverImage` text,
  `totalReturn` decimal(10,2) DEFAULT '0.00',
  `maxDrawdown` decimal(10,2) DEFAULT '0.00',
  `sharpeRatio` decimal(10,2) DEFAULT '0.00',
  `winRate` decimal(5,2) DEFAULT '0.00',
  `downloadUrl` text,
  `price` decimal(10,2) DEFAULT '0.00',
  `isFree` tinyint(1) NOT NULL DEFAULT '1',
  `downloadCount` int NOT NULL DEFAULT '0',
  `telegramGroup` varchar(255) DEFAULT NULL,
  `qqGroup` varchar(255) DEFAULT NULL,
  `viewCount` int NOT NULL DEFAULT '0',
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `platform_idx` (`platform`),
  KEY `status_idx` (`status`),
  KEY `totalReturn_idx` (`totalReturn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试策略数据(10个策略)
INSERT INTO `strategies` (`id`, `title`, `description`, `platform`, `pairs`, `timeframe`, `coverImage`, `totalReturn`, `maxDrawdown`, `sharpeRatio`, `winRate`, `price`, `isFree`, `downloadCount`, `telegramGroup`, `qqGroup`, `viewCount`, `status`) VALUES
(1, '黄金智能交易系统', '专注于黄金市场的AI驱动交易系统,采用深度学习算法分析市场趋势,自动识别最佳入场和出场时机。系统内置风险管理模块,严格控制回撤,适合稳健型投资者。', 'MT4', 'XAUUSD', 'H1', 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3', '156.80', '12.30', '2.45', '68.50', '0.00', 1, 1250, '@GoldTradingEA', '123456789', 3200, 'published'),
(2, '欧美剥头皮专家', '专为EURUSD设计的高频剥头皮策略,利用市场微小波动快速获利。采用先进的订单流分析技术,精准捕捉短期价格波动,平均每单持仓时间5-15分钟。', 'MT5', 'EURUSD', 'M5', 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44', '89.40', '8.60', '1.95', '72.30', '399.00', 0, 856, '@EURUSDScalper', '987654321', 2100, 'published'),
(3, '多货币网格交易机器人', '支持10+主流货币对的智能网格交易系统,自动在价格区间内高抛低吸。系统会根据市场波动率动态调整网格间距,最大化收益同时控制风险。', 'MT4', 'EURUSD,GBPUSD,USDJPY,AUDUSD,USDCAD', 'H4', 'https://images.unsplash.com/photo-1642790106117-e829e14a795f', '234.60', '15.80', '3.12', '65.80', '599.00', 0, 642, '@GridTradingBot', '456789123', 1850, 'published'),
(4, '英镑趋势追踪者', '专注于GBPUSD的中长期趋势跟踪策略,使用多重时间框架分析确认趋势方向。系统会在趋势确立后入场,并使用移动止损保护利润,适合趋势行情。', 'MT5', 'GBPUSD', 'H4', 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7', '178.90', '18.40', '2.28', '61.20', '499.00', 0, 523, '@GBPTrendFollower', '789123456', 1420, 'published'),
(5, 'AI深度学习交易系统', '基于神经网络的智能交易系统,通过分析海量历史数据学习市场规律。系统可以自适应不同市场环境,在趋势和震荡行情中均能稳定盈利。', 'MT4', 'EURUSD,GBPUSD,USDJPY', 'H1', 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0', '312.50', '14.20', '3.85', '70.40', '899.00', 0, 1089, '@AITradingPro', '321654987', 2890, 'published'),
(6, '突破猎手Pro', '专门捕捉关键支撑阻力位突破的交易系统,结合成交量分析确认突破有效性。系统会在假突破时及时止损,真突破时加仓跟进,盈亏比优秀。', 'MT5', 'EURUSD,GBPUSD,XAUUSD', 'M15', 'https://images.unsplash.com/photo-1642790551116-18e150f248e6', '145.30', '11.70', '2.15', '66.90', '549.00', 0, 734, '@BreakoutHunter', '654987321', 1680, 'published'),
(7, '对冲大师EA', '采用多货币对冲策略,通过相关性分析构建对冲组合。系统可以在市场剧烈波动时保护账户,同时在单边行情中获取超额收益,风险控制能力强。', 'MT4', 'EURUSD,USDCHF,GBPUSD,EURGBP', 'H1', 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3', '198.70', '9.50', '2.95', '69.80', '699.00', 0, 468, '@HedgeMasterEA', '147258369', 1290, 'published'),
(8, '新闻交易闪电EA', '专门针对重大经济数据发布时的市场波动设计,系统会在新闻发布前布局,利用市场剧烈波动快速获利。内置新闻日历和风险过滤器。', 'MT5', 'EURUSD,GBPUSD,USDJPY,XAUUSD', 'M1', 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44', '267.40', '22.10', '2.68', '58.30', '799.00', 0, 391, '@NewsTraderPro', '258369147', 1050, 'published'),
(9, '马丁格尔增强版', '改良版马丁格尔策略,加入趋势过滤和智能加仓算法。系统会在有利趋势中使用马丁,避免在不利行情中过度加仓,大幅降低爆仓风险。', 'MT4', 'EURUSD,GBPUSD', 'M30', 'https://images.unsplash.com/photo-1642790106117-e829e14a795f', '189.60', '28.50', '1.75', '63.40', '449.00', 0, 612, '@SafeMartingale', '369147258', 1540, 'published'),
(10, '稳健波段交易EA', '适合保守型投资者的波段交易系统,每周交易2-5次,持仓时间1-3天。系统使用多重确认信号,只在高概率机会出现时交易,追求稳定收益。', 'MT5', 'EURUSD,XAUUSD', 'D1', 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7', '98.30', '7.80', '2.42', '74.60', '0.00', 1, 892, '@SwingTradingEA', '741852963', 1920, 'published');

-- ============================================
-- 3. 回测数据表 (backtest_data)
-- ============================================
DROP TABLE IF EXISTS `backtest_data`;
CREATE TABLE `backtest_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `strategyId` int NOT NULL,
  `date` date NOT NULL,
  `equity` decimal(15,2) NOT NULL,
  `balance` decimal(15,2) NOT NULL,
  `profit` decimal(15,2) NOT NULL,
  `drawdown` decimal(10,2) NOT NULL,
  `tradesCount` int NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `strategyId_idx` (`strategyId`),
  KEY `date_idx` (`date`),
  KEY `strategy_date_idx` (`strategyId`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入策略1的回测数据(最近30天)
INSERT INTO `backtest_data` (`strategyId`, `date`, `equity`, `balance`, `profit`, `drawdown`, `tradesCount`) VALUES
(1, '2026-01-10', 10000.00, 10000.00, 0.00, 0.00, 0),
(1, '2026-01-11', 10150.00, 10150.00, 150.00, 0.00, 2),
(1, '2026-01-12', 10280.00, 10280.00, 130.00, 0.00, 3),
(1, '2026-01-13', 10220.00, 10220.00, -60.00, 0.60, 1),
(1, '2026-01-14', 10390.00, 10390.00, 170.00, 0.00, 2),
(1, '2026-01-15', 10520.00, 10520.00, 130.00, 0.00, 2),
(1, '2026-01-16', 10680.00, 10680.00, 160.00, 0.00, 3),
(1, '2026-01-17', 10850.00, 10850.00, 170.00, 0.00, 2),
(1, '2026-01-18', 10920.00, 10920.00, 70.00, 0.00, 1),
(1, '2026-01-19', 11080.00, 11080.00, 160.00, 0.00, 2),
(1, '2026-01-20', 11250.00, 11250.00, 170.00, 0.00, 3),
(1, '2026-01-21', 11180.00, 11180.00, -70.00, 0.62, 1),
(1, '2026-01-22', 11340.00, 11340.00, 160.00, 0.00, 2),
(1, '2026-01-23', 11490.00, 11490.00, 150.00, 0.00, 2),
(1, '2026-01-24', 11620.00, 11620.00, 130.00, 0.00, 2),
(1, '2026-01-25', 11780.00, 11780.00, 160.00, 0.00, 3),
(1, '2026-01-26', 11950.00, 11950.00, 170.00, 0.00, 2),
(1, '2026-01-27', 12110.00, 12110.00, 160.00, 0.00, 2),
(1, '2026-01-28', 12040.00, 12040.00, -70.00, 0.58, 1),
(1, '2026-01-29', 12200.00, 12200.00, 160.00, 0.00, 2),
(1, '2026-01-30', 12360.00, 12360.00, 160.00, 0.00, 3),
(1, '2026-01-31', 12520.00, 12520.00, 160.00, 0.00, 2),
(1, '2026-02-01', 12680.00, 12680.00, 160.00, 0.00, 2),
(1, '2026-02-02', 12850.00, 12850.00, 170.00, 0.00, 3),
(1, '2026-02-03', 13020.00, 13020.00, 170.00, 0.00, 2),
(1, '2026-02-04', 13180.00, 13180.00, 160.00, 0.00, 2),
(1, '2026-02-05', 13340.00, 13340.00, 160.00, 0.00, 3),
(1, '2026-02-06', 13500.00, 13500.00, 160.00, 0.00, 2),
(1, '2026-02-07', 13660.00, 13660.00, 160.00, 0.00, 2),
(1, '2026-02-08', 13820.00, 13820.00, 160.00, 0.00, 3);

-- ============================================
-- 4. 匿名留言表 (anonymous_comments)
-- ============================================
DROP TABLE IF EXISTS `anonymous_comments`;
CREATE TABLE `anonymous_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `strategyId` int NOT NULL,
  `nickname` varchar(100) DEFAULT NULL,
  `content` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `strategyId_idx` (`strategyId`),
  KEY `createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试留言数据
INSERT INTO `anonymous_comments` (`strategyId`, `nickname`, `content`, `createdAt`) VALUES
(1, '交易老手', '这个EA真的很稳定,用了一个月收益率15%,回撤控制得很好!', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(1, NULL, '免费的EA能做到这个水平已经很不错了,推荐新手试试', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(1, '黄金猎人', '在黄金震荡行情中表现优秀,趋势行情也能跟上,五星好评!', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, '剥头皮专家', 'EURUSD剥头皮的最佳选择,胜率很高,就是需要低点差账户', DATE_SUB(NOW(), INTERVAL 7 DAY)),
(2, '小白用户', '第一次用EA,设置有点复杂,不过客服很耐心,现在已经稳定盈利了', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(3, NULL, '网格策略在震荡市很赚钱,但是单边行情要小心,建议配合手动管理', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(3, '多货币玩家', '同时跑5个货币对,分散风险效果明显,整体收益很稳', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(5, 'AI信仰者', '深度学习算法确实厉害,能适应不同行情,就是价格有点贵', DATE_SUB(NOW(), INTERVAL 8 DAY)),
(5, NULL, '用了两周,AI的自适应能力确实强,值得这个价格', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(10, '稳健投资者', '波段交易很适合上班族,不用盯盘,每周就交易几次,收益稳定', DATE_SUB(NOW(), INTERVAL 3 DAY));

-- ============================================
-- 5. 合购表 (group_buys)
-- ============================================
DROP TABLE IF EXISTS `group_buys`;
CREATE TABLE `group_buys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `eaName` varchar(255) NOT NULL,
  `description` text,
  `targetPrice` decimal(10,2) NOT NULL,
  `currentParticipants` int NOT NULL DEFAULT '0',
  `targetParticipants` int NOT NULL,
  `pricePerPerson` decimal(10,2) NOT NULL,
  `contactInfo` varchar(255) NOT NULL,
  `status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
  `expiresAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `status_idx` (`status`),
  KEY `createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试合购数据
INSERT INTO `group_buys` (`title`, `eaName`, `description`, `targetPrice`, `currentParticipants`, `targetParticipants`, `pricePerPerson`, `contactInfo`, `status`, `expiresAt`) VALUES
('AI深度学习系统合购', 'AI深度学习交易系统', '原价899元的AI交易系统,10人合购每人仅需90元!系统采用神经网络算法,自适应市场环境,适合各类投资者。', 899.00, 7, 10, 90.00, 'Telegram: @AIGroupBuy2026', 'active', DATE_ADD(NOW(), INTERVAL 7 DAY)),
('新闻交易EA拼团', '新闻交易闪电EA', '专业新闻交易系统,原价799元,现5人成团每人160元。内置新闻日历,自动识别重大数据发布,捕捉市场波动。', 799.00, 3, 5, 160.00, 'QQ群: 888888888', 'active', DATE_ADD(NOW(), INTERVAL 5 DAY)),
('对冲大师EA团购', '对冲大师EA', '多货币对冲策略,风险控制能力强。原价699元,8人团购每人仅需88元,已有6人参与,还差2人成团!', 699.00, 6, 8, 88.00, '微信: hedgemaster2026', 'active', DATE_ADD(NOW(), INTERVAL 3 DAY)),
('欧美剥头皮专家合购(已满)', '欧美剥头皮专家', '高胜率剥头皮系统,10人团购已满,每人仅花40元!感谢大家支持,下期合购敬请期待。', 399.00, 10, 10, 40.00, 'Telegram: @ScalperGroup', 'completed', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- ============================================
-- 6. 上架EA申请表 (listing_requests)
-- ============================================
DROP TABLE IF EXISTS `listing_requests`;
CREATE TABLE `listing_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `contact` varchar(255) NOT NULL,
  `eaName` varchar(255) NOT NULL,
  `eaDescription` text,
  `status` enum('pending','contacted','rejected') NOT NULL DEFAULT 'pending',
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `status_idx` (`status`),
  KEY `createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试上架申请数据
INSERT INTO `listing_requests` (`name`, `contact`, `eaName`, `eaDescription`, `status`, `notes`, `createdAt`) VALUES
('王开发', 'Telegram: @wangdev', '智能趋势跟踪EA', '基于多重时间框架分析的趋势跟踪系统,回测年化收益120%,最大回撤15%,希望能在平台上架销售。', 'pending', NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),
('李交易', 'QQ: 123456789', '黄金波段交易系统', '专注黄金市场的波段交易EA,胜率70%+,适合中长线投资者,有完整的实盘记录可提供。', 'contacted', '已联系,等待提供实盘数据', DATE_SUB(NOW(), INTERVAL 5 DAY)),
('张策略', '微信: zhangcelue', '多货币套利EA', '利用货币对相关性进行套利交易,低风险稳定收益,月均收益5-8%。', 'pending', NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
('赵程序员', 'Telegram: @zhaodev', '高频剥头皮机器人', '超高频交易系统,每天交易50-100次,需要ECN账户和VPS,年化收益200%+。', 'rejected', '风险过高,不符合平台定位', DATE_SUB(NOW(), INTERVAL 10 DAY));

-- ============================================
-- 7. 评论表 (comments) - 用户登录后的评论
-- ============================================
DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `strategyId` int NOT NULL,
  `content` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `strategyId_idx` (`strategyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试评论数据
INSERT INTO `comments` (`userId`, `strategyId`, `content`, `createdAt`) VALUES
(2, 1, '作为新手第一次使用EA,这个黄金系统真的很友好,设置简单,收益稳定!', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(3, 2, '剥头皮策略需要低点差账户,我用的是ECN账户,效果很好,一个月盈利12%', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(4, 3, '网格交易在震荡市表现优秀,但是遇到单边行情要及时调整参数', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(5, 5, 'AI系统的自适应能力确实强,不同行情都能稳定盈利,值得投资', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 10, '波段交易很适合我这种上班族,不用盯盘,每周就交易几次', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- ============================================
-- 8. 购买记录表 (purchases)
-- ============================================
DROP TABLE IF EXISTS `purchases`;
CREATE TABLE `purchases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `strategyId` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `purchasedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `strategyId_idx` (`strategyId`),
  KEY `user_strategy_idx` (`userId`,`strategyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试购买记录
INSERT INTO `purchases` (`userId`, `strategyId`, `price`, `purchasedAt`) VALUES
(2, 2, 399.00, DATE_SUB(NOW(), INTERVAL 15 DAY)),
(3, 3, 599.00, DATE_SUB(NOW(), INTERVAL 20 DAY)),
(4, 5, 899.00, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(5, 4, 499.00, DATE_SUB(NOW(), INTERVAL 8 DAY)),
(2, 7, 699.00, DATE_SUB(NOW(), INTERVAL 5 DAY));

-- ============================================
-- 9. 下载记录表 (downloads)
-- ============================================
DROP TABLE IF EXISTS `downloads`;
CREATE TABLE `downloads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `strategyId` int NOT NULL,
  `downloadedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `strategyId_idx` (`strategyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入测试下载记录
INSERT INTO `downloads` (`userId`, `strategyId`, `downloadedAt`) VALUES
(2, 1, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(2, 10, DATE_SUB(NOW(), INTERVAL 8 DAY)),
(3, 1, DATE_SUB(NOW(), INTERVAL 12 DAY)),
(4, 1, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(5, 10, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2, 2, DATE_SUB(NOW(), INTERVAL 15 DAY)),
(3, 3, DATE_SUB(NOW(), INTERVAL 20 DAY));

-- ============================================
-- 10. 交易记录表 (trades) - 可选
-- ============================================
DROP TABLE IF EXISTS `trades`;
CREATE TABLE `trades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `strategyId` int NOT NULL,
  `pair` varchar(20) NOT NULL,
  `direction` enum('buy','sell') NOT NULL,
  `openTime` timestamp NOT NULL,
  `closeTime` timestamp NULL DEFAULT NULL,
  `openPrice` decimal(20,8) NOT NULL,
  `closePrice` decimal(20,8) DEFAULT NULL,
  `volume` decimal(10,2) NOT NULL,
  `profit` decimal(15,2) DEFAULT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `strategyId_idx` (`strategyId`),
  KEY `status_idx` (`status`),
  KEY `openTime_idx` (`openTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 恢复外键检查
-- ============================================
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 导出完成
-- ============================================
-- 说明:
-- 1. 测试用户账号:
--    - 管理员: openId='test_admin_001', email='admin@test.com'
--    - 普通用户: openId='test_user_001' ~ 'test_user_004'
-- 
-- 2. 包含10个EA策略,涵盖免费和付费策略
-- 
-- 3. 包含完整的测试数据:
--    - 匿名留言(10条)
--    - 合购申请(4条,包含进行中和已完成)
--    - 上架申请(4条,包含待处理、已联系、已拒绝)
--    - 用户评论(5条)
--    - 购买记录(5条)
--    - 下载记录(7条)
--    - 回测数据(策略1的30天数据)
-- 
-- 4. 所有功能点均可测试:
--    - 策略浏览和筛选
--    - 策略详情和回测图表
--    - 匿名留言功能
--    - 合购功能
--    - 上架EA申请
--    - 用户登录和权限
--    - 管理员后台
-- ============================================
