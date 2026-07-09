# Manus / AI 部署操作指令

请严格按以下步骤操作，不要只合并 `app/` 目录，也不要当作增量补丁只覆盖 42 个页面文件。本包是完整项目包，包含前台、后台、组件拆分、mock 数据、路由拆分、EAXAU 品牌更新、桌面端 UI 优化和生产空白页修复。

## 必须保留的关键文件

- `components/brand-wordmark.tsx`
- `components/home/*`
- `components/promo/*`
- `components/strategy-detail/*`
- `constants/api-base-url.ts`
- `constants/oauth.ts`
- `server/mock-data.ts`
- `server/routers.ts`
- `server/routers/*`
- `scripts/verify-web-build.js`
- `serve-web.js`
- `app/(tabs)/index.tsx`
- `app/(tabs)/subscribe.tsx`
- `app/cooperation.tsx`
- `app/promo.tsx`
- `app/strategy/[id].tsx`
- `app/admin/index.tsx`
- `app/admin/login.tsx`
- `assets/images/eaxau-icon.svg`
- `assets/images/icon.png`
- `assets/images/favicon.png`
- `tests/api-base-url.test.ts`
- `GITHUB_DEPLOY_GUIDE.md`
- `AI_DEPLOY_OPERATOR_PROMPT.md`
- `DEPLOYMENT_AUDIT.md`

## 合并步骤

1. 解压完整压缩包到一个临时目录。
2. 将临时目录中的项目文件完整同步到 GitHub 仓库工作区。
3. 不要删除仓库现有的 `.env` 或平台环境变量配置。
4. 确认上面列出的关键文件全部存在。
5. 确认没有提交 `node_modules/`、`.git/`、`.manus/`、`.expo/`、`dist/`、`web-build/`、`.env`、`.env.local`。
6. 在仓库根目录运行检查：

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run lint
ADMIN_EMAIL=admin@eaxau.com ADMIN_PASSWORD=local-test-password JWT_SECRET=local-test-jwt-secret COOKIE_SECRET=local-test-cookie-secret DOWNLOAD_SIGNING_SECRET=local-test-download-secret OAUTH_SERVER_URL=https://api.manus.im pnpm test
pnpm build:web
```

## 生产环境变量

部署平台需要配置真实值：

- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `DOWNLOAD_SIGNING_SECRET`
- `OAUTH_SERVER_URL`
- `EXPO_PUBLIC_API_BASE_URL` 可留空

说明：这次修复已经让 `eaxau.com` 和 `www.eaxau.com` 在浏览器里使用同源 API，避免跨域或 apex/www 切换导致空白页。本地生产预览的随机端口也会自动请求同一端口，不再卡加载圈。如果前端和后端部署在同一个 Railway 服务里，`EXPO_PUBLIC_API_BASE_URL` 建议留空。

## 提交前确认

```bash
git status --short
git add .
git commit -m "Fix production web API origin and polish desktop UI"
git push
```

推送后检查部署日志中应出现：

- database migrations complete
- static web-build directory exists
- static verified required web asset(s)
- server listening on deployment port
- payment routes registered
- secure-download route registered

然后打开：

- `https://eaxau.com/`
- `https://eaxau.com/subscribe`
- `https://eaxau.com/promo`
- `https://eaxau.com/cooperation`
- `https://eaxau.com/strategy/1`
- `https://eaxau.com/admin/login`

如果页面仍然空白，优先检查：

1. `curl -L https://www.eaxau.com/ | grep '<title>'` 是否返回 `EAXAU`，如果仍是 `量化军火库`，说明线上还是旧构建。
2. `curl -L https://www.eaxau.com/ | grep 'entry-'` 是否仍返回旧 entry；如果是旧 entry，清 Cloudflare/边缘缓存并强制 Railway Redeploy。
3. 浏览器控制台里 JS bundle 是否 404 或 MIME 类型错误。
4. `/api/health` 是否返回 JSON。
5. `/api/trpc/strategies.list` 是否同域返回。
6. GitHub 仓库里是否真的包含 `components/home/`、`components/promo/`、`components/strategy-detail/`、`server/routers/`、`server/mock-data.ts`。
7. Railway 环境变量里 `DATABASE_URL` 是否正确。
