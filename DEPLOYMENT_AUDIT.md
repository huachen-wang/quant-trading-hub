# 部署交付前审计记录

审计日期：2026-08-22

审计运行时：Node.js `v24.19.0`

## 结论

当前仓库已通过类型检查、lint、全量自动测试、后端生产构建、Expo Web 导出、静态资源
完整性校验、本地生产 API 启动和关键路由浏览器巡检。V2 以新增 `/v2-preview` 路由和
`v2` tRPC 命名空间存在，没有替换 V1 API。

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
ADMIN_PASSWORD=test-only \
JWT_SECRET=test-secret-at-least-32-characters \
COOKIE_SECRET=test-cookie-secret-at-least-32-characters \
DOWNLOAD_SIGNING_SECRET=test-download-secret-at-least-32-characters \
OAUTH_SERVER_URL=https://api.manus.im \
npx vitest run
```

结果：

```text
Test Files  25 passed | 1 skipped (26)
Tests       95 passed | 1 skipped (96)
```

唯一跳过项为仓库原有 `auth.logout` 测试；V2 新增契约、分仓引擎、分仓工具和内容编辑器
测试全部通过。

### 后端生产构建

```bash
npx esbuild server/_core/index.ts \
  --platform=node --packages=external --bundle --format=esm \
  --out-extension:.js=.mjs --outdir=dist
```

结果：通过，生成 `dist/index.mjs`，约 `332.8 KB`。

### Web 导出与完整性

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 \
npx expo export --platform web --output-dir web-build --clear
node scripts/inject-web-bootstrap.js
node scripts/verify-web-build.js
```

结果：通过。导出包含 1 个 JavaScript bundle、2 个 CSS bundle 和全部必需静态资源；
验证脚本返回 `OK`。Browserslist 数据陈旧提示不阻断构建，后续可单独升级依赖数据。

## 本地生产联调

使用生产后端产物启动：

```bash
PORT=3000 NODE_ENV=production EAXAU_V2_ENABLED=true \
node dist/index.mjs
```

已核验：

- `/api/health` 返回 `{"ok":true}`；
- `/api/trpc/v2.status` 返回 `enabled=true`、`provider=DEMO`；
- `/api/trpc/v2.overview` 返回六策略聚合 DTO；
- 服务端确认 `web-build directory exists` 并监听 `3000`；
- 未设置 `DATABASE_URL` 时迁移按设计跳过，适用于本地演示，不适用于正式生产。

## 浏览器巡检

使用本地 Metro 前端和生产后端，实际访问并操作：

```text
/v2-preview
/v2-preview/strategies/jingge-v51
/v2-preview/allocate
/v2-preview/accounts
/v2-preview/ea-library
/admin/login
/admin
/admin/v2-content
```

核验结果：

- 1440x900 桌面、1024x768 平板和 390x844 手机前台页面均有完整内容，无页面级横向溢出；
- 六策略图片全部加载，策略图自然尺寸统一为 960x540；
- V2 首页 DOM 只挂载六张策略图，首三张为普通优先级、后三张为低优先级；
- `/search` 不再后台挂载旧首页的十二张商城图片；
- 首页明确显示 `模拟数据`，没有把 Demo 伪装为实盘；
- 策略详情长内容在手机端改为单列，无两栏挤压；
- 分仓、账户、EA 资料库手机端 `scrollWidth` 与视口宽度一致；
- 本地管理员账号登录成功，V2 内容后台桌面和手机均可见；
- 新建内容块弹窗在 390px 宽度下完整显示类型、标题、正文、要点、排序、显隐和保存控件；
- 未观察到空白页、图片失败、内容遮挡或路由 404。
- 分仓确认、后台未保存关闭和类型切换均使用站内弹层，没有浏览器原生对话框。

## V1 兼容边界

- `server/routers.ts` 只新增 `v2: v2Router`，原有顶层 procedure 未重命名或删除。
- V2 所有后端实现位于 `server/v2/**` 和 `server/routers/v2.ts`。
- V2 内容复用现有 `page_contents`，本轮没有新增迁移或修改表结构。
- V2 内容排序新增独立 procedure，并通过现有 `page_contents` 的数据库事务整组更新；
  没有改变任何既有 procedure 的输入或输出。
- 支付、下载、登录、OAuth、邮件、短信、定时任务和牛帮执行路径未改动。
- EA 资料库原页面仍为默认 V1 首页实现，V2 通过显式 `variant` 复用。

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
QUANT_DATA_CORE_URL=
QUANT_DATA_CORE_API_KEY=
QUANT_DATA_CORE_TIMEOUT_MS=8000
```

URL 留空即使用清楚标识的确定性 Demo。真实服务部署、鉴权、脱敏和契约验收完成后才能
填写 URL/Key；HTTP Provider 失败不会静默回退到 Demo。

## 剩余外部风险

1. 本地不能证明 Railway 到真实 MySQL/TiDB 的网络和权限正确。
2. 本地不能替代 GitHub/Railway 权限、域名 DNS、证书和 `www/apex` 指向验收。
3. OAuth、支付、邮件、短信需用各服务商生产凭据做回调验收。
4. Quant Data Core 与 Niubang Export Adapter 尚是外部项目，当前页面只能展示 Demo。
5. 六策略真实账户、平台条款、风险文案和合同责任主体仍需业务/合规审核。

## 上线后检查

1. 打开 `/api/health`、`/`、`/v2-preview`、`/admin/login`。
2. 查看 Railway Logs，确认迁移成功且无数据库、环境变量、静态资源或 API 500 错误。
3. 检查 `/api/trpc/v2.status` 的 provider；未接真实数据时必须仍为 `DEMO`。
4. 用桌面和手机各完成一次六策略、详情、分仓、账户、EA 资料库浏览。
5. 验收通过前保留 `/v2-preview`，不要直接把 V2 切为现网根首页。
