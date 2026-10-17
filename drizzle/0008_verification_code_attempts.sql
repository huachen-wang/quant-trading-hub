-- 验证码校验次数上限（2026-10-18 安全修复）。
-- 原来验证码登录、找回密码、注册在 5 分钟有效期内可以无限次提交错误码，6 位数字可被穷举。
--
-- verification_codes.attempts：这条码已经被校验过几次。每次校验先用一条带条件的 UPDATE
-- 原子占一次名额（attempts < 5 才占得到），占到了才比对；满 5 次后这条码作废，正确的码也不再认。
--
-- 本增量只追加列；生产启动时 server/migrate.ts 会用 INFORMATION_SCHEMA 幂等补列。

ALTER TABLE `verification_codes` ADD COLUMN `attempts` int NOT NULL DEFAULT 0;
