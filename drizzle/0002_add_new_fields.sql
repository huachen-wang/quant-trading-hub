-- 为 strategies 表添加新字段
ALTER TABLE `strategies` ADD `originalPrice` decimal(10,2) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `strategies` ADD `productType` varchar(20) DEFAULT 'ea';
--> statement-breakpoint
ALTER TABLE `strategies` ADD `tags` text DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `strategies` ADD `galleryImages` text DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `strategies` ADD `isFeatured` boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE `strategies` ADD `featuredLink` text DEFAULT NULL;
--> statement-breakpoint
-- 为 group_buys 表添加封面图字段
ALTER TABLE `group_buys` ADD `coverImage` text DEFAULT NULL;
