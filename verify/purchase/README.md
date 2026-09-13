# 购买 → 交付闭环的隔离验收

对象：商品 → 注册/登录 → 订单 → 支付确认 → 授权 → 文件交付 → 售后。
打的是真 HTTP、真 tRPC 过程、真 MySQL（隔离库）、真 ZPay 回调路由。
不连生产库、不建真实收款、不碰真实交易账户、不发邮件/消息、不伪造生产已付款订单。

交付文件是**带标识的合成附件**（`EAXAU-SYNTHETIC-TEST-ARTIFACT`），不是任何真实 EA。

## 1. 隔离 MySQL

复用复核留下的一次性实例（`/tmp/eaxau-mysql-review`，只监听 127.0.0.1:3399）：

```bash
bash ~/cc/business-ops/workflows/growth-sprint-20260913/eaxau-chat-review/verify/start-mysql.sh

/tmp/eaxau-mysql-review/mysql-8.4.10-macos15-arm64/bin/mysql --no-defaults \
  -h 127.0.0.1 -P 3399 -u root -e "
    CREATE DATABASE IF NOT EXISTS eaxau_purchase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'review'@'%' IDENTIFIED BY '<本地一次性口令>';
    GRANT ALL ON eaxau_purchase.* TO 'review'@'%'; FLUSH PRIVILEGES;"
```

## 2. 一次性配置

`verify/purchase/.env.local`（被 `.gitignore` 的 `.env*.local` 规则忽略，不进提交）：

```
NODE_ENV=development
PORT=3410
DATABASE_URL=mysql://review:<本地一次性口令>@127.0.0.1:3399/eaxau_purchase
JWT_SECRET=<随机 32 bytes hex>
COOKIE_SECRET=<随机 32 bytes hex>
DOWNLOAD_SIGNING_SECRET=<随机 32 bytes hex>
ADMIN_EMAIL=admin@eaxau.local
ADMIN_PASSWORD=<随机>
ENABLE_ZPAY=true
ENABLE_USDT_PAYMENT=false
ZPAY_PID=1000-sandbox
ZPAY_KEY=<随机 16 bytes hex>            # 本地 sandbox 商户密钥，不是真实商户
ZPAY_GATEWAY=http://127.0.0.1:3499/mock-zpay   # 故意指向不存在的本地端口
ZPAY_NOTIFY_URL=http://127.0.0.1:3410/api/payment/zpay/notify
ZPAY_RETURN_URL=http://127.0.0.1:3410/api/payment/zpay/return
```

`RESEND_API_KEY` **有意留空**：注册验证码照常落库，但一封邮件都发不出去。

## 3. 建表 + 起服务

```bash
set -a && . ./verify/purchase/.env.local && set +a

npx drizzle-kit push --force          # 空库首次建表
npx tsx server/_core/index.ts         # 3410：真实应用（含 /api/payment/zpay/notify、/api/download/secure）
node verify/purchase/synthetic-origin.mjs 3498   # 合成发包源，只在 127.0.0.1
NODE_ENV=test npx tsx verify/purchase/delivery-entry.ts 3411   # 见下方「口径」
```

## 4. 跑验收

```bash
set -a && . ./verify/purchase/.env.local && set +a
node verify/purchase/purchase-delivery-e2e.mjs
```

## 口径：哪一段算通过了什么

- **隔离支付流程通过** ≠ **真实支付渠道通过**。ZPay 回调的签名由本地一次性 sandbox
  密钥自签，网关主机 `zpayz.cn` 从头到尾没有被访问过，也没有任何真实收款发生。
  服务端的验签、金额校验、商户号校验、幂等、落库全部是生产代码；**真实 ZPay
  商户联调没有做，不能按这份结果验收真实收款**。
- **鉴权链路**打的是生产真实路由 `http://127.0.0.1:3410/api/download/secure`。
- **文件字节交付**走 `verify/purchase/delivery-entry.ts`：挂的是
  `server/_core/secure-download.ts` 里**同一个** `handleSecureDownload`，只通过已有的
  `NODE_ENV=test` 依赖注入口把 SSRF 地址策略放开到 `127.0.0.1`——隔离环境没有公网出口，
  合成发包源只能跑在回环地址上，而生产策略（正确地）拒绝私有地址。
  token 校验、已付订单复核、发包版本快照解析、取包、大小限制、响应头、下载计数
  都是生产代码；被替换的只有「这个 IP 允不允许连」这一个判断。
