-- ════════════════════════════════════════════════════════════════════
-- Phase 1 Migration: 用户系统 + 订单 + 支付 + 收藏 + 分类
--
-- 本文件仅用于留档参考。实际迁移由 server/migrate.ts 在服务器启动时
-- 自动幂等执行（含 IF NOT EXISTS 和 INFORMATION_SCHEMA 字段检测）。
-- 重新启动服务器即可应用，无需手动执行此 SQL。
-- ════════════════════════════════════════════════════════════════════

-- ─── users 表新增字段 ───
ALTER TABLE `users` ADD COLUMN `phone` varchar(20) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `phoneVerified` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE INDEX `phone_idx` ON `users` (`phone`);
--> statement-breakpoint

-- ─── strategies 表新增字段 ───
ALTER TABLE `strategies` ADD COLUMN `saleMode` enum('direct','inquiry') NOT NULL DEFAULT 'inquiry';
--> statement-breakpoint
ALTER TABLE `strategies` ADD COLUMN `richDescription` text DEFAULT NULL;
--> statement-breakpoint

-- 回填：免费商品默认改为 direct（直购）
UPDATE `strategies` SET `saleMode` = 'direct' WHERE `isFree` = true;
--> statement-breakpoint

-- ─── 新表：verification_codes（短信/邮箱验证码） ───
CREATE TABLE IF NOT EXISTS `verification_codes` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `target` varchar(255) NOT NULL,
  `targetType` enum('phone','email') NOT NULL,
  `code` varchar(10) NOT NULL,
  `purpose` varchar(50) NOT NULL,
  `used` boolean NOT NULL DEFAULT false,
  `expiresAt` timestamp NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `target_purpose_idx` (`target`, `purpose`),
  INDEX `expiresAt_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- ─── 新表：categories（一级 + 二级商品分类） ───
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL UNIQUE,
  `parentId` int DEFAULT NULL,
  `icon` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `isVisible` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `parentId_idx` (`parentId`),
  INDEX `slug_idx` (`slug`),
  INDEX `sortOrder_idx` (`sortOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 默认一级分类
INSERT INTO `categories` (`name`, `slug`, `parentId`, `icon`, `sortOrder`) VALUES
('MT4 智能交易', 'mt4', NULL, '📈', 1),
('MT5 智能交易', 'mt5', NULL, '📊', 2),
('指标工具', 'indicator', NULL, '📐', 3),
('辅助工具', 'tool', NULL, '🔧', 4),
('实战教程', 'course', NULL, '📚', 5);
--> statement-breakpoint

-- 默认二级分类（策略类型，与 platform 正交）
INSERT INTO `categories` (`name`, `slug`, `parentId`, `icon`, `sortOrder`) VALUES
('马丁策略', 'martin', NULL, '♻️', 11),
('趋势策略', 'trend', NULL, '📈', 12),
('网格策略', 'grid', NULL, '🔲', 13),
('对冲策略', 'hedge', NULL, '⚖️', 14),
('剥头皮', 'scalping', NULL, '⚡', 15),
('订单流', 'orderflow', NULL, '🌊', 16),
('套利策略', 'arbitrage', NULL, '🔄', 17),
('AI 量化', 'ai', NULL, '🤖', 18);
--> statement-breakpoint

-- ─── 新表：orders（订单） ───
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `orderNo` varchar(64) NOT NULL UNIQUE,
  `userId` int NOT NULL,
  `productKind` varchar(20) NOT NULL,
  `productId` int NOT NULL,
  `productTitle` varchar(255) NOT NULL,
  `productCover` text DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `originalAmount` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'CNY',
  `status` enum('pending','paid','cancelled','refunded','expired') NOT NULL DEFAULT 'pending',
  `paymentMethod` varchar(50) DEFAULT NULL,
  `paymentGateway` varchar(50) DEFAULT NULL,
  `paidAt` timestamp NULL DEFAULT NULL,
  `expiresAt` timestamp NULL DEFAULT NULL,
  `metadata` text DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `orderNo_idx` (`orderNo`),
  INDEX `userId_idx` (`userId`),
  INDEX `status_idx` (`status`),
  INDEX `product_idx` (`productKind`, `productId`),
  INDEX `createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- ─── 新表：payments（支付流水） ───
CREATE TABLE IF NOT EXISTS `payments` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `orderId` int NOT NULL,
  `orderNo` varchar(64) NOT NULL,
  `gateway` varchar(50) NOT NULL,
  `gatewayOrderNo` varchar(255) DEFAULT NULL,
  `method` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'CNY',
  `status` enum('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  `callbackRaw` text DEFAULT NULL,
  `callbackVerified` boolean NOT NULL DEFAULT false,
  `errorMessage` text DEFAULT NULL,
  `paidAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `orderId_idx` (`orderId`),
  INDEX `orderNo_idx` (`orderNo`),
  INDEX `gatewayOrderNo_idx` (`gatewayOrderNo`),
  INDEX `status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- ─── 新表：user_favorites（用户云端收藏） ───
CREATE TABLE IF NOT EXISTS `user_favorites` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `productKind` varchar(20) NOT NULL,
  `productId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `userId_idx` (`userId`),
  INDEX `product_idx` (`productKind`, `productId`),
  UNIQUE INDEX `uniq_user_product` (`userId`, `productKind`, `productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
