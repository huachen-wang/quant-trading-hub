# 站内咨询的真库验收脚本

这里的脚本都打**真实 MySQL** 和**真实 HTTP**。内存适配器证明不了并发、幂等、事务和限流——
独立复核（`business-ops/workflows/growth-sprint-20260913/eaxau-chat-review/REVIEW.md`）
就是在真库上打出阻断级缺陷的，而当时 39 条内存测试全绿。

## 前置：一个隔离的 MySQL

复核已经在 `/tmp/eaxau-mysql-review/` 落了一份官方 MySQL 8.4.10（含已初始化的 datadir），
**不要重新下载**。拉起来：

```bash
bash ~/cc/business-ops/workflows/growth-sprint-20260913/eaxau-chat-review/verify/start-mysql.sh
# 127.0.0.1:3399，独立 datadir/socket，只监听本地
```

建两个测试库（第一次跑时）：

```bash
/tmp/eaxau-mysql-review/mysql-8.4.10-macos15-arm64/bin/mysql --no-defaults -h 127.0.0.1 -P 3399 -u root \
  -e "CREATE DATABASE IF NOT EXISTS eaxau_fix CHARACTER SET utf8mb4;
      CREATE DATABASE IF NOT EXISTS eaxau_e2e CHARACTER SET utf8mb4;
      GRANT ALL ON eaxau_fix.* TO 'review'@'%';
      GRANT ALL ON eaxau_e2e.* TO 'review'@'%'; FLUSH PRIVILEGES;"
```

## 1. 存储契约测试（打真库的 vitest）

```bash
SUPPORT_TEST_DATABASE_URL='mysql://review:<本地口令>@127.0.0.1:3399/eaxau_fix' \
  npx vitest run tests/support-mysql.test.ts
```

不设 `SUPPORT_TEST_DATABASE_URL` 时整个套件**跳过**并打一行警告，不会假装验证过。
建表调用的是 `server/migrate.ts` 导出的 `ensureSupportChatSchema`，也就是生产迁移那段 DDL 本身。

## 2. 端到端（真 HTTP）

先起服务（env 里的 secret 用现生成的随机值，Telegram 留空 = dry_run）：

```bash
DATABASE_URL='mysql://review:<本地口令>@127.0.0.1:3399/eaxau_e2e' \
NODE_ENV=development PORT=3400 \
JWT_SECRET=$(python3 -c 'import secrets;print(secrets.token_hex(32))') \
ADMIN_EMAIL=admin@eaxau.com ADMIN_PASSWORD=admin123 \
  npx tsx server/_core/index.ts
```

然后：

```bash
node verify/support-e2e.mjs              # 25 项：并发、重试幂等、限流、错误不泄露、运营回路
DATABASE_URL=... JWT_SECRET=... \
  node verify/support-identity-e2e.mjs   # 14 项：A 登出 / B 登录 / 显式认领
```

`verify/ensure-schema.mts` 是给空库建表的小工具（直接调生产函数，不复制 DDL）。

## 口径

- 这些脚本**不连生产库、不发真实 Telegram、不 push、不部署**。
- `support-identity-e2e.mjs` 会在测试库里建 `users` 表并插两行测试用户，用同密钥自签会话 JWT
  走真实的 `sdk.verifySession` 链路。只在测试库里做。
- 跑完记得停掉服务；MySQL 数据目录留着不删（按 `~/cc/AGENTS.md` 的红线，清理由用户自己决定）。
