-- 订单锁定发包版本：交付读订单上的快照，而不是读商品当前的 downloadUrl。
-- 没有这一列时，商品换包会把老订单发到客户没买过的版本上。
-- 本增量只追加一列；生产启动时 server/migrate.ts 会用 INFORMATION_SCHEMA 幂等补列。

ALTER TABLE `orders` ADD COLUMN `deliveryUrl` text DEFAULT NULL;
