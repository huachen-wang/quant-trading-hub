CREATE TABLE IF NOT EXISTS `managed_sessions` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sessionNo` varchar(64) NOT NULL UNIQUE,
  `userId` int NOT NULL,
  `status` enum('DRAFT','PENDING_REVIEW','PENDING_AUTHORIZATION','READY','ACTIVE','EXIT_REQUESTED','WINDING_DOWN','ENDED','CANCELLED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `termDays` int NOT NULL,
  `capitalMode` enum('DIRECT_BROKER','MANAGED_VAULT','MIXED') NOT NULL,
  `targetCapital` decimal(20,6) NOT NULL,
  `settlementAsset` enum('USDT') NOT NULL DEFAULT 'USDT',
  `riskProfile` enum('CONSERVATIVE','BALANCED','AGGRESSIVE') NOT NULL,
  `maxDrawdownPct` decimal(5,2) NOT NULL,
  `exitMode` enum('IMMEDIATE_CLOSE','NATURAL_EXIT','HANDOVER_OPEN_POSITIONS') NOT NULL,
  `tradeAuthorizationStatus` enum('NOT_REQUESTED','PENDING','GRANTED','REVOKED') NOT NULL DEFAULT 'NOT_REQUESTED',
  `withdrawalPermission` enum('NONE') NOT NULL DEFAULT 'NONE',
  `executionEnabled` boolean NOT NULL DEFAULT false,
  `version` int NOT NULL DEFAULT 1,
  `submittedAt` timestamp NULL DEFAULT NULL,
  `activatedAt` timestamp NULL DEFAULT NULL,
  `expiresAt` timestamp NULL DEFAULT NULL,
  `exitRequestedAt` timestamp NULL DEFAULT NULL,
  `endedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `managed_sessions_user_idx` (`userId`),
  INDEX `managed_sessions_status_idx` (`status`),
  INDEX `managed_sessions_created_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `managed_session_strategies` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sessionId` int NOT NULL,
  `strategyId` varchar(80) NOT NULL,
  `weightPct` decimal(5,2) NOT NULL,
  `riskMultiplier` decimal(4,2) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `managed_strategy_session_idx` (`sessionId`),
  UNIQUE INDEX `managed_strategy_unique_idx` (`sessionId`, `strategyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `managed_execution_slots` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sessionId` int NOT NULL,
  `slotKey` varchar(64) NOT NULL,
  `brokerId` varchar(80) NOT NULL,
  `label` varchar(80) DEFAULT NULL,
  `capitalWeightPct` decimal(5,2) NOT NULL,
  `fundingSource` enum('DIRECT_BROKER','MANAGED_VAULT') NOT NULL,
  `connectionStatus` enum('UNLINKED','PENDING','VERIFIED','REVOKED') NOT NULL DEFAULT 'UNLINKED',
  `tradePermission` enum('NOT_REQUESTED','PENDING','GRANTED','REVOKED') NOT NULL DEFAULT 'NOT_REQUESTED',
  `withdrawalPermission` enum('NONE') NOT NULL DEFAULT 'NONE',
  `accountAlias` varchar(80) DEFAULT NULL,
  `authorizationReference` varchar(120) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `managed_slot_session_idx` (`sessionId`),
  UNIQUE INDEX `managed_slot_broker_unique_idx` (`sessionId`, `brokerId`),
  UNIQUE INDEX `managed_slot_key_unique_idx` (`sessionId`, `slotKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `managed_session_events` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sessionId` int NOT NULL,
  `actorUserId` int DEFAULT NULL,
  `eventType` varchar(64) NOT NULL,
  `fromStatus` varchar(32) DEFAULT NULL,
  `toStatus` varchar(32) DEFAULT NULL,
  `payload` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `managed_event_session_idx` (`sessionId`),
  INDEX `managed_event_created_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
