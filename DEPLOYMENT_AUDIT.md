# 部署交付前审计记录

审计日期：2026-08-23

审计运行时：Node.js `v24.19.0`

## 结论

当前仓库已通过类型检查、lint、全量自动测试、后端生产构建、Expo Web 导出、静态资源
完整性校验、本地生产 API 启动和关键路由浏览器巡检。根首页首屏直接展示六款核心策略，
页面内完成“资金 × 风控 × 策略 × 平台 × 模式”选配；原 EA 商城完整保留在 `/market`。
V2 使用独立 `v2` tRPC 命名空间，没有替换 V1 API。

这能证明当前提交不存在已知的编译错误、缺失模块或本地白屏问题；不能替代 Railway
数据库、DNS、第三方支付/OAuth 和外部 Quant Data Core 的线上验收。

## 自动化结果

### TypeScript

```bash
npx tsc --noEmit
```

结果：通过，无类型错误。

### Expo lint

```bash
npx expo lint
```

结果：通过，无 lint 错误。

### 全量测试

```bash
ADMIN_EMAIL=admin@example.test \
ADMIN_PASSWORD=test-only-password \
JWT_SECRET=test-only-jwt-secret-at-least-32-characters \
COOKIE_SECRET=test-cookie-secret-at-least-32-characters \
DOWNLOAD_SIGNING_SECRET=test-download-secret-at-least-32-characters \
OAUTH_SERVER_URL=https://api.manus.im \
npx vitest run
```

结果：

```text
Test Files  30 passed (30)
Tests       107 passed (107)
```

无跳过项。契约、分仓引擎、数据覆盖、数据编辑器、Niubang 只读映射、Provider 选择和
`auth.logout` 均有自动测试并通过。

### 后端生产构建

```bash
npx esbuild server/_core/index.ts \
  --platform=node --packages=external --bundle --format=esm \
  --out-extension:.js=.mjs --outdir=dist
```

结果：通过，生成 `dist/index.mjs`，约 `361.1 KB`。

### Web 导出与完整性

```bash
npx expo export --platform web --output-dir web-build --clear
node scripts/inject-web-bootstrap.js
node scripts/verify-web-build.js
```

结果：通过。导出包含 1 个 JavaScript bundle、2 个 CSS bundle 和全部必需静态资源；
验证脚本返回 `OK`。Browserslist 数据陈旧提示不阻断构建，后续可单独升级依赖数据。

## 本地生产联调

使用同域生产后端与 Web 产物启动：

```bash
PORT=8082 NODE_ENV=production EAXAU_V2_ENABLED=true \
node dist/index.mjs
```

已核验：

- `/api/health` 返回 `{"ok":true}`；
- `/api/trpc/v2.status` 返回 `enabled=true`、`provider=DEMO`；
- `/api/trpc/v2.overview` 返回六策略聚合 DTO；
- 服务端确认 `web-build directory exists`、静态入口引用资源完整并监听 `8082`；
- 未设置 `DATABASE_URL` 时迁移按设计跳过，适用于本地演示，不适用于正式生产。

## 浏览器巡检

使用本地生产 Web 包和生产后端，实际访问并操作：

```text
/
/v2-preview
/v2-preview/strategies/jingge-v51
/v2-preview/allocate
/v2-preview/accounts
/v2-preview/accounts/managed-demo-01
/v2-preview/accounts/self-demo-01
/market
/admin/v2-content
/admin/v2-data
```

核验结果：

- 1440x900 桌面与 390x844 手机核心页面均有完整内容，无页面级横向溢出；
- 桌面首页第一视口完整出现六张策略卡和已选方案条，不再先展示大面积英雄区或空白；
- 六策略图片全部加载，卡片同时展示简介、90 日收益、回撤、风险、资金门槛和数据来源；
- 首页明确显示 `模拟数据`，没有把 Demo 伪装为实盘；
- 页面内选配器可切换资金、风险、六策略、三个平台及资管/券商模式；生产包生成方案后返回“基础规则通过”；
- 推荐引擎保留用户明确选择的策略和平台，测试覆盖 2 平台、2 策略并通过分仓校验；
- 资管模式明确标注“技术方按合同代操管理”，券商模式明确标注“资金不经过技术方”；
- 策略详情在桌面和手机均为高密度首屏，净值、快照、资料、持仓和交易通过页签组织；
- 首页、详情、高级选配、两类账户与 `/market` 均无空白页、错误状态、横向溢出或路由 404；
- `/admin/v2-content` 与 `/admin/v2-data` 在未登录生产会话中均正确跳转 `/admin/login`。

## V1 兼容边界

- `server/routers.ts` 只新增 `v2: v2Router`，原有顶层 procedure 未重命名或删除。
- V2 所有后端实现位于 `server/v2/**` 和 `server/routers/v2.ts`。
- V2 内容复用现有 `page_contents`，本轮没有新增迁移或修改表结构。
- V2 内容排序新增独立 procedure，并通过现有 `page_contents` 的数据库事务整组更新；
  没有改变任何既有 procedure 的输入或输出。
- 支付、下载、登录、OAuth、邮件、短信、定时任务和牛帮执行路径未改动。
- EA 资料库原页面迁移到 `/market`，V2 通过显式 `variant` 复用；目录与旧详情能力保留。

## 生产变量

必须设置：

```bash
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
JWT_SECRET=<长随机字符串>
COOKIE_SECRET=<长随机字符串>
DOWNLOAD_SIGNING_SECRET=<长随机字符串>
ADMIN_EMAIL=<管理员邮箱>
ADMIN_PASSWORD=<管理员强密码>
EAXAU_V2_ENABLED=true
```

同服务部署时 `EXPO_PUBLIC_API_BASE_URL` 建议留空，让前端使用当前域名的同源 API。
`package.json` 已固定 Node.js `24.x`。

V2 数据源：

```bash
V2_DATA_PROVIDER=
QUANT_DATA_CORE_URL=
QUANT_DATA_CORE_API_KEY=
QUANT_DATA_CORE_TIMEOUT_MS=8000
NIUBANG_DATA_URL=
NIUBANG_DATA_API_KEY=
NIUBANG_STRATEGY_MAP={}
```

`V2_DATA_PROVIDER` 可显式设为 `DEMO`、`HTTP` 或 `NIUBANG`；留空时按 Niubang、HTTP、
Demo 顺序自动选择。公开策略映射与 HTTP Provider 都不会把失败静默伪装成实盘。

## 剩余外部风险

1. 本地不能证明 Railway 到真实 MySQL/TiDB 的网络和权限正确。
2. 本地不能替代 GitHub/Railway 权限、域名 DNS、证书和 `www/apex` 指向验收。
3. OAuth、支付、邮件、短信需用各服务商生产凭据做回调验收。
4. Quant Data Core 与 Niubang 私有账户 Export Adapter 尚是外部项目；当前仅实现公开策略只读映射。
5. 六策略真实账户、平台条款、风险文案和合同责任主体仍需业务/合规审核。

## 上线后检查

1. 打开 `/api/health`、`/`、`/v2-preview`、`/admin/login`。
2. 查看 Railway Logs，确认迁移成功且无数据库、环境变量、静态资源或 API 500 错误。
3. 检查 `/api/trpc/v2.status` 的 provider；未接真实数据时必须仍为 `DEMO`。
4. 用桌面和手机各完成一次六策略、详情、分仓、账户、EA 资料库浏览。
5. 同时抽查 `/market`，确认原 EA 商城、搜索、筛选和详情入口仍可使用。
