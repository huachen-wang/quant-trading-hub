CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`strategyId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`strategyId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`strategyId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`strategyId` int NOT NULL,
	`score` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`platform` enum('MT4','MT5') NOT NULL,
	`pairs` text NOT NULL,
	`timeframe` varchar(50),
	`coverImage` text,
	`totalReturn` decimal(10,2) DEFAULT '0.00',
	`maxDrawdown` decimal(10,2) DEFAULT '0.00',
	`sharpeRatio` decimal(10,2) DEFAULT '0.00',
	`winRate` decimal(5,2) DEFAULT '0.00',
	`followCount` int NOT NULL DEFAULT 0,
	`favoriteCount` int NOT NULL DEFAULT 0,
	`viewCount` int NOT NULL DEFAULT 0,
	`avgRating` decimal(3,2) DEFAULT '0.00',
	`ratingCount` int NOT NULL DEFAULT 0,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategyId` int NOT NULL,
	`pair` varchar(20) NOT NULL,
	`direction` enum('buy','sell') NOT NULL,
	`openTime` timestamp NOT NULL,
	`closeTime` timestamp,
	`openPrice` decimal(20,8) NOT NULL,
	`closePrice` decimal(20,8),
	`volume` decimal(10,2) NOT NULL,
	`profit` decimal(15,2),
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `comments` (`strategyId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `comments` (`userId`);--> statement-breakpoint
CREATE INDEX `user_strategy_idx` ON `favorites` (`userId`,`strategyId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `favorites` (`userId`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `favorites` (`strategyId`);--> statement-breakpoint
CREATE INDEX `user_strategy_idx` ON `follows` (`userId`,`strategyId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `follows` (`userId`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `follows` (`strategyId`);--> statement-breakpoint
CREATE INDEX `user_strategy_idx` ON `ratings` (`userId`,`strategyId`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `ratings` (`strategyId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `strategies` (`userId`);--> statement-breakpoint
CREATE INDEX `platform_idx` ON `strategies` (`platform`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `strategies` (`status`);--> statement-breakpoint
CREATE INDEX `avgRating_idx` ON `strategies` (`avgRating`);--> statement-breakpoint
CREATE INDEX `totalReturn_idx` ON `strategies` (`totalReturn`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `trades` (`strategyId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `trades` (`status`);--> statement-breakpoint
CREATE INDEX `openTime_idx` ON `trades` (`openTime`);