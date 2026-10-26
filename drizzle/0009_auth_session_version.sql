-- 2026-10-26 安全修复：会话版本 + 邮箱验证时间。
--
-- 第 1 部分（加列）应用启动时由 server/migrate.ts 的 ensureUserAuthColumns 自动执行，这里只留作手工补跑；
-- 列已存在时什么都不做，可重复执行。MySQL DDL 非事务性，逐条确认结果。
SET @add_session_version = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'sessionVersion') = 0,
  'ALTER TABLE users ADD COLUMN sessionVersion int NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE auth_migration FROM @add_session_version;
EXECUTE auth_migration;
DEALLOCATE PREPARE auth_migration;

SET @add_email_verified = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'emailVerifiedAt') = 0,
  'ALTER TABLE users ADD COLUMN emailVerifiedAt timestamp NULL DEFAULT NULL', 'SELECT 1');
PREPARE auth_migration FROM @add_email_verified;
EXECUTE auth_migration;
DEALLOCATE PREPARE auth_migration;

-- 第 2 部分（可选的手工回填，不随部署自动执行）：
-- 凭仍保留的、已使用的邮箱验证码补 emailVerifiedAt（会员「已验证」状态随之恢复）。
-- 无证据的账号保持 NULL：照常用自己的密码登录，等本人下次用验证码登录 / 重置密码时再确认。
-- 抢注防护：账号若不是用 register 验证码建的（即旧的免验证注册入口建的），旧密码可能是抢注者设的，
-- 回填时一并清掉密码并撤销旧会话；本人用验证码登录或「忘记密码」重设即可。用 register 验证码建的账号，
-- 密码是邮箱本人注册时设的，保留。只处理 NULL 行，重跑不影响已确认的账号。
-- 执行前先只读统计将受影响的行数（尤其是会被清密码的行数），再决定是否执行。
UPDATE users AS u
JOIN (
  SELECT target, MAX(createdAt) AS verifiedAt,
         MAX(purpose = 'register') AS registeredWithCode
  FROM verification_codes
  WHERE targetType = 'email' AND used = true
    AND purpose IN ('register', 'login', 'reset_password', 'verify_email')
  GROUP BY target
) AS proof ON proof.target = u.email
SET u.passwordHash = IF(proof.registeredWithCode = 1, u.passwordHash, NULL),
    u.sessionVersion = IF(proof.registeredWithCode = 1, u.sessionVersion, u.sessionVersion + 1),
    u.emailVerifiedAt = proof.verifiedAt
WHERE u.emailVerifiedAt IS NULL;
