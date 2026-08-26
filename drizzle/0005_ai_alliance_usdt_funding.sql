-- AI量化联盟：EA 商城 USDT、券商直入与企业代收三账隔离。
-- 本增量文件只追加新结构；生产启动时 server/migrate.ts 还会用
-- INFORMATION_SCHEMA 做幂等补列并在迁移锁内校验唯一索引。

ALTER TABLE `payments` ADD COLUMN `settlementNetwork` varchar(32) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `settlementToken` varchar(16) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `recipientAddress` varchar(255) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `quotedAmount` decimal(20,6) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `quoteExpiresAt` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `submittedAt` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `payerWalletAddress` varchar(255) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `payerOwnershipAttestedAt` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `receivedAmount` decimal(20,6) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `confirmations` int DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `observedNetwork` varchar(32) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `usdtReviewStatus` enum('NOT_APPLICABLE','AWAITING_TX','PENDING_REVIEW','MATCHED','UNDERPAID','OVERPAID','WRONG_NETWORK','QUOTE_EXPIRED_RECEIPT','DUPLICATE_TX','REFUND_PENDING','REFUNDED','REJECTED') NOT NULL DEFAULT 'NOT_APPLICABLE';
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `verificationMode` enum('MANUAL','RPC') DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `reviewedBy` int DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `reviewedAt` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `reviewNote` text DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundAmount` decimal(20,6) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundNetwork` varchar(32) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundTxHash` varchar(160) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundRecipientAddress` varchar(255) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundVerificationRef` varchar(120) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundRecipientVerifiedBy` int DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundRecipientVerifiedAt` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundedBy` int DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `refundedAt` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_refund_tx_unique_idx` ON `payments` (`refundTxHash`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `commerce_usdt_events` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `paymentId` int NOT NULL,
  `orderId` int NOT NULL,
  `actorUserId` int DEFAULT NULL,
  `eventType` varchar(64) NOT NULL,
  `payload` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `commerce_usdt_event_payment_idx` (`paymentId`),
  INDEX `commerce_usdt_event_order_idx` (`orderId`),
  INDEX `commerce_usdt_event_created_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `chain_tx_registry` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `network` varchar(32) NOT NULL,
  `normalizedHash` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `usageType` enum('COMMERCE_INBOUND','BROKER_DIRECT_INBOUND','COLLECTION_INBOUND','COLLECTION_PAYOUT','COLLECTION_REFUND','COMMERCE_REFUND') NOT NULL,
  `referenceNo` varchar(64) NOT NULL,
  `actorUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `chain_tx_network_hash_unique_idx` (`network`,`normalizedHash`),
  INDEX `chain_tx_reference_idx` (`usageType`,`referenceNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `admin_totp_uses` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `adminId` int NOT NULL,
  `timeStep` int NOT NULL,
  `action` varchar(80) NOT NULL,
  `usedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `admin_totp_admin_step_unique_idx` (`adminId`,`timeStep`),
  INDEX `admin_totp_used_at_idx` (`usedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `managed_broker_funding_intents` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `intentNo` varchar(64) NOT NULL UNIQUE,
  `sessionId` int NOT NULL,
  `slotId` int NOT NULL,
  `userId` int NOT NULL,
  `brokerId` varchar(80) NOT NULL,
  `status` enum('DRAFT','WAITING_ACCOUNT','WAITING_INSTRUCTIONS','READY_TO_FUND','TX_SUBMITTED','RECEIVED','RECONCILED','AWAITING_PAYOUT','PAYOUT_SUBMITTED','BROKER_CREDIT_PENDING','CREDITED','EXCEPTION','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `asset` enum('USDT') NOT NULL DEFAULT 'USDT',
  `fundsRoute` enum('BROKER_DIRECT','PLATFORM_COLLECTION') NOT NULL DEFAULT 'BROKER_DIRECT',
  `instructionSource` enum('BROKER_PORTAL','PLATFORM_ADDRESS_POOL') DEFAULT NULL,
  `custodyProvider` enum('MANUAL','BVNK','COBO') NOT NULL DEFAULT 'MANUAL',
  `externalProviderRef` varchar(120) DEFAULT NULL,
  `collectionAddressId` int DEFAULT NULL,
  `network` varchar(32) DEFAULT NULL,
  `depositAddress` varchar(255) DEFAULT NULL,
  `depositTag` varchar(120) DEFAULT NULL,
  `expectedAmount` decimal(20,6) NOT NULL,
  `declaredAmount` decimal(20,6) DEFAULT NULL,
  `payerWalletAddress` varchar(255) DEFAULT NULL,
  `payerOwnershipAttestedAt` timestamp NULL DEFAULT NULL,
  `customerEligibilityReferenceHash` varchar(80) DEFAULT NULL,
  `customerEligibilityAttestedBy` int DEFAULT NULL,
  `customerEligibilityAttestedAt` timestamp NULL DEFAULT NULL,
  `txHash` varchar(160) DEFAULT NULL,
  `receivedAmount` decimal(20,6) DEFAULT NULL,
  `observedNetwork` varchar(32) DEFAULT NULL,
  `creditedAmount` decimal(20,6) DEFAULT NULL,
  `confirmations` int DEFAULT NULL,
  `reconciliationResult` enum('MATCHED','UNDERPAID','OVERPAID','WRONG_NETWORK','LATE_RECEIPT','DUPLICATE_TX','REFUND_PENDING','REFUNDED','MANUAL_REVIEW') DEFAULT NULL,
  `screeningStatus` enum('PENDING','CLEARED','HELD','REJECTED') DEFAULT NULL,
  `screeningProviderRef` varchar(120) DEFAULT NULL,
  `complianceNote` text DEFAULT NULL,
  `clearedBy` int DEFAULT NULL,
  `clearedAt` timestamp NULL DEFAULT NULL,
  `payoutAmount` decimal(20,6) DEFAULT NULL,
  `payoutNetwork` varchar(32) DEFAULT NULL,
  `payoutDestination` varchar(255) DEFAULT NULL,
  `payoutDestinationReferenceHash` varchar(80) DEFAULT NULL,
  `payoutTxHash` varchar(160) DEFAULT NULL,
  `payoutRequestedBy` int DEFAULT NULL,
  `payoutRequestedAt` timestamp NULL DEFAULT NULL,
  `payoutApprovedBy` int DEFAULT NULL,
  `payoutApprovedAt` timestamp NULL DEFAULT NULL,
  `payoutSubmittedAt` timestamp NULL DEFAULT NULL,
  `verifiedRefundAddress` varchar(255) DEFAULT NULL,
  `refundAddressVerifiedBy` int DEFAULT NULL,
  `refundAddressVerifiedAt` timestamp NULL DEFAULT NULL,
  `refundAmount` decimal(20,6) DEFAULT NULL,
  `refundTxHash` varchar(160) DEFAULT NULL,
  `brokerCreditReference` varchar(120) DEFAULT NULL,
  `exceptionReason` text DEFAULT NULL,
  `resolutionNote` text DEFAULT NULL,
  `resumeStatus` varchar(32) DEFAULT NULL,
  `instructionsIssuedAt` timestamp NULL DEFAULT NULL,
  `instructionsExpireAt` timestamp NULL DEFAULT NULL,
  `submittedAt` timestamp NULL DEFAULT NULL,
  `receivedAt` timestamp NULL DEFAULT NULL,
  `reconciledAt` timestamp NULL DEFAULT NULL,
  `creditedAt` timestamp NULL DEFAULT NULL,
  `cancelledAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `managed_funding_session_idx` (`sessionId`),
  INDEX `managed_funding_slot_idx` (`slotId`),
  INDEX `managed_funding_user_idx` (`userId`),
  INDEX `managed_funding_status_idx` (`status`),
  UNIQUE INDEX `managed_funding_tx_unique_idx` (`txHash`),
  UNIQUE INDEX `managed_funding_payout_tx_unique_idx` (`payoutTxHash`),
  UNIQUE INDEX `managed_funding_refund_tx_unique_idx` (`refundTxHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `managed_broker_funding_events` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `fundingIntentId` int NOT NULL,
  `sessionId` int NOT NULL,
  `actorUserId` int DEFAULT NULL,
  `eventType` varchar(64) NOT NULL,
  `fromStatus` varchar(32) DEFAULT NULL,
  `toStatus` varchar(32) DEFAULT NULL,
  `payload` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `managed_funding_event_intent_idx` (`fundingIntentId`),
  INDEX `managed_funding_event_session_idx` (`sessionId`),
  INDEX `managed_funding_event_created_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `managed_collection_addresses` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `label` varchar(80) NOT NULL,
  `network` varchar(32) NOT NULL,
  `asset` enum('USDT') NOT NULL DEFAULT 'USDT',
  `address` varchar(255) NOT NULL,
  `depositTag` varchar(120) DEFAULT NULL,
  `status` enum('AVAILABLE','RESERVED','USED','DISABLED') NOT NULL DEFAULT 'AVAILABLE',
  `currentFundingIntentId` int DEFAULT NULL,
  `createdBy` int NOT NULL,
  `reservedAt` timestamp NULL DEFAULT NULL,
  `usedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX `managed_collection_network_address_unique_idx` (`network`,`address`),
  INDEX `managed_collection_address_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `managed_broker_collection_approvals` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `brokerId` varchar(80) NOT NULL UNIQUE,
  `status` enum('NOT_APPROVED','PENDING','APPROVED','SUSPENDED') NOT NULL DEFAULT 'NOT_APPROVED',
  `approvalReferenceHash` varchar(80) DEFAULT NULL,
  `approvedEntity` varchar(160) DEFAULT NULL,
  `approvedRegion` varchar(80) DEFAULT NULL,
  `approvedChannelId` varchar(120) DEFAULT NULL,
  `validUntil` timestamp NULL DEFAULT NULL,
  `allowedNetworks` text DEFAULT NULL,
  `minimumAmount` decimal(20,6) DEFAULT NULL,
  `maximumAmount` decimal(20,6) DEFAULT NULL,
  `reviewedBy` int DEFAULT NULL,
  `approvedAt` timestamp NULL DEFAULT NULL,
  `note` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `managed_collection_approval_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

INSERT IGNORE INTO `managed_broker_collection_approvals` (`brokerId`,`status`) VALUES
  ('exness','NOT_APPROVED'),
  ('ic-markets','NOT_APPROVED'),
  ('blueberry-markets','NOT_APPROVED');
