# 部署交付前审计记录

审计日期：2026-07-03

## 结论

当前交付包在本地已通过类型检查、自动测试、lint、后端构建、Web 导出、生产预览启动、关键路由浏览器巡检和基础静态检查。

从代码构建和本地生产预览角度看，当前版本不是一推 GitHub 就直接构建失败或首页黑屏的状态。生产环境是否正常展示真实数据，取决于 Railway 环境变量和数据库连接是否配置正确。

## 已执行检查

### 1. TypeScript 类型检查

命令：

```bash
tsc --noEmit
```

结果：通过。

### 2. 自动测试

命令：

```bash
ADMIN_EMAIL=admin@eaxau.com \
ADMIN_PASSWORD=local-test-password \
JWT_SECRET=local-test-jwt-secret \
COOKIE_SECRET=local-test-cookie-secret \
DOWNLOAD_SIGNING_SECRET=local-test-download-secret \
OAUTH_SERVER_URL=https://api.manus.im \
vitest run
```

结果：

```text
Test Files  10 passed | 1 skipped (11)
Tests       37 passed | 1 skipped (38)
```

说明：`auth.logout` 有 1 个已知 skipped，这不是构建阻断项。

### 3. Expo lint

命令：

```bash
expo lint
```

结果：通过。

### 4. 后端构建

命令：

```bash
esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --out-extension:.js=.mjs --outdir=dist
```

结果：通过，生成 `dist/index.mjs`。

### 5. Web 导出

命令：

```bash
expo export --platform web --output-dir web-build
```

结果：通过，生成 `web-build`。

### 6. 后端 + Web 联合构建

Railway 实际使用：

```bash
pnpm build:web
```

对应逻辑：

```bash
pnpm build && npx expo export --platform web --output-dir web-build
```

已单独验证后端 build 和 web export 均通过。

### 7. 本地生产预览

启动方式：

```bash
PORT=61380 \
ADMIN_EMAIL=admin@eaxau.com \
ADMIN_PASSWORD=local-test-password \
JWT_SECRET=local-test-jwt-secret \
COOKIE_SECRET=local-test-cookie-secret \
DOWNLOAD_SIGNING_SECRET=local-test-download-secret \
OAUTH_SERVER_URL=https://api.manus.im \
node dist/index.mjs
```

结果：

- `/` 返回 HTTP 200。
- `/api/health` 返回 JSON。
- 服务端日志显示 `web-build directory exists`。
- 首页、策略详情页、后台登录页均生成生产截图，未出现纯黑空白页。

### 8. 关键路由浏览器巡检

已用本地生产预览服务访问以下路由：

- `/`
- `/strategy/1`
- `/cooperation`
- `/promo`
- `/subscribe`
- `/group-buy`
- `/admin/login`
- `/auth/login`
- `/auth/register`
- `/admin`（使用本地测试管理员账号登录后进入）

结果：

- 所有路由都有可见内容。
- 页面标题为 `EAXAU`。
- 未发现旧 `EX` 图标字样。
- 浏览器控制台 error 数量为 0。

### 9. tRPC 顶层路由兼容性

拆分前后的 `appRouter` 顶层 key 对比：

旧路由没有缺失。

新增路由：

```text
features
favorites
```

缺失路由：

```text
无
```

### 10. Git 空白检查

命令：

```bash
git diff --check
```

结果：通过。

### 11. 裸 JSX 文本扫描

结果：未发现可疑裸文本节点。

## 重要部署注意事项

必须提交 untracked 新文件，否则线上会因为模块缺失而报错。重点包括：

- `components/home/`
- `components/promo/`
- `components/strategy-detail/`
- `server/routers/`
- `server/mock-data.ts`
- `.env.example`
- `docker-compose.yml`
- `GITHUB_DEPLOY_GUIDE.md`
- `AI_DEPLOY_OPERATOR_PROMPT.md`
- `DEPLOYMENT_AUDIT.md`
- `MANUS_PRODUCTION_FIX_AND_UI_POLISH_PROMPT.md`

不要提交：

- `.env`
- `.env.local`
- `node_modules/`
- `.git/`
- `.manus/`
- `.expo/`
- `dist/`
- `web-build/`
- `database-export.sql`
- `database-export.sql.backup`

## 生产环境必需变量

```bash
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
JWT_SECRET=<长随机字符串>
COOKIE_SECRET=<长随机字符串>
DOWNLOAD_SIGNING_SECRET=<长随机字符串>
ADMIN_EMAIL=<管理员邮箱>
ADMIN_PASSWORD=<管理员强密码>
```

如果没有 `DATABASE_URL`，项目会回退到 mock 数据。mock 适合本地预览，不适合正式生产。

`EXPO_PUBLIC_API_BASE_URL` 在前后端同服务部署时建议留空。访问 `eaxau.com` 或 `www.eaxau.com` 时，前端会自动使用同域 API，避免 apex/www 跨域导致页面卡住或空白。

## 剩余风险

1. 本地无法替你验证真实生产数据库连通性。
2. 本地无法替你验证 Railway 账号、GitHub 权限、DNS 是否配置正确。
3. OAuth、支付、邮件、短信属于第三方服务，需要线上变量和服务商配置完整后再验收。
4. 如果部署平台不是 Railway，需要重新确认构建命令和启动命令。

## 推荐上线后验收

上线后访问：

```text
/api/health
/
/promo
/admin/login
/strategy/<真实策略ID>
```

并检查 Railway Logs 是否有：

- 数据库连接失败
- 迁移失败
- 环境变量缺失
- API 500 错误
