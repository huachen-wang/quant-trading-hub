-- 交付的**内容身份**：只锁发包地址锁不住字节。
-- 存储代理（server/storage.ts）是按 path 覆盖写的，同一个 URL 的内容可以被就地替换，
-- 所以「已付订单按下单时锁定的地址交付」并不等于「按下单时那一份字节交付」。
--
-- orders.deliverySha256 / deliveryBytes：这笔订单约定交付的那一份字节。
-- strategies.packageSha256 / packageBytes / packageDigestUrl：商品当前发包地址上量到的字节。
-- 三列都可为空 = 还没有内容身份（老订单 / 尚未量过），此时交付不得对外宣称版本已锁定。
--
-- 本增量只追加列；生产启动时 server/migrate.ts 会用 INFORMATION_SCHEMA 幂等补列。

ALTER TABLE `orders` ADD COLUMN `deliverySha256` varchar(64) DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN `deliveryBytes` bigint DEFAULT NULL;

ALTER TABLE `strategies` ADD COLUMN `packageDigestUrl` text DEFAULT NULL;
ALTER TABLE `strategies` ADD COLUMN `packageSha256` varchar(64) DEFAULT NULL;
ALTER TABLE `strategies` ADD COLUMN `packageBytes` bigint DEFAULT NULL;
