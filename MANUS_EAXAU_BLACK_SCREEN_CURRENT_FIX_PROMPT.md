# Manus 当前线上黑屏修复指令

请按这份指令处理 `eaxau.com` 当前黑屏问题。不要改接口、不要改数据库、不要改 API 路径。

## 已确认现象

线上服务已启动，数据库迁移完成，日志显示 `web-build` 目录存在。但浏览器打开 `eaxau.com` 仍是纯黑空白，这通常说明线上没有跑到最新完整前端构建，或者前端 JS/CSS 资源没有按正确内容类型返回。

- 线上当前 HTML 标题：`<title>量化军火库</title>`
- 线上当前入口 JS：`/_expo/static/js/web/entry-d811b45fa72134ac91f5e4bd59369c41.js`
- 当前最新本地构建标题：`<title>EAXAU</title>`
- 当前最新本地入口 JS：`/_expo/static/js/web/entry-bf0ca547bf86cb7c2aacabfa40d83b8f.js`

如果线上仍是 `量化军火库` 标题、旧 entry hash、或者 JS 请求返回 HTML/404，就说明线上没有跑到最新完整源码构建，或者 Cloudflare/Railway 边缘仍在返回旧构建。

## 必须完整同步的文件

不要只覆盖 `app/`。必须完整同步整个项目源码，尤其是：

- `components/brand-wordmark.tsx`
- `components/home/*`
- `components/promo/*`
- `components/strategy-detail/*`
- `constants/api-base-url.ts`
- `scripts/verify-web-build.js`
- `serve-web.js`
- `server/_core/index.ts`
- `server/mock-data.ts`
- `server/routers.ts`
- `server/routers/*`
- `package.json`
- `app.config.ts`
- `assets/images/*`
- `AI_DEPLOY_OPERATOR_PROMPT.md`
- `GITHUB_DEPLOY_GUIDE.md`
- `DEPLOYMENT_AUDIT.md`

## 部署前必须跑

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run lint
ADMIN_EMAIL=admin@eaxau.com ADMIN_PASSWORD=local-test-password JWT_SECRET=local-test-jwt-secret COOKIE_SECRET=local-test-cookie-secret DOWNLOAD_SIGNING_SECRET=local-test-download-secret OAUTH_SERVER_URL=https://api.manus.im pnpm test
pnpm build:web
```

`pnpm build:web` 现在必须包含：

```json
"build:web": "pnpm build && npx expo export --platform web --output-dir web-build --clear && node scripts/verify-web-build.js"
```

构建日志必须出现：

```text
[verify-web-build] OK
```

部署运行日志必须出现：

```text
[static] web-build directory exists
[static] verified ... required web asset(s)
✓ [api] server listening on port ...
```

如果缺少 `[static] verified ... required web asset(s)`，不要验收。

## Railway 设置

- Build Command: `pnpm install && pnpm build:web`
- Start Command: `pnpm start`
- `EXPO_PUBLIC_API_BASE_URL`：同一个 Railway 服务托管前后端时建议留空。

不要提交：

- `node_modules/`
- `.git/`
- `.manus/`
- `.expo/`
- `dist/`
- `web-build/`
- `.env`
- `.env.local`

## 部署后必须验收

```bash
curl -L https://www.eaxau.com/ | grep '<title>'
curl -L https://www.eaxau.com/ | grep 'entry-'
curl -I https://www.eaxau.com/_expo/static/js/web/entry-bf0ca547bf86cb7c2aacabfa40d83b8f.js
curl -s 'https://www.eaxau.com/api/trpc/strategies.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A12%2C%22offset%22%3A0%2C%22orderBy%22%3A%22latest%22%7D%7D%7D' | head
```

预期：

- 标题必须是 `EAXAU`。
- 首页入口 JS 必须是最新构建生成的 `entry-bf0ca547bf86cb7c2aacabfa40d83b8f.js`，或者是重新构建后新的 entry hash，但不能再是旧构建里的 entry 文件。
- 入口 JS 的 `Content-Type` 必须是 `application/javascript`。
- 策略列表接口必须返回真实数据。
- 浏览器无痕打开 `https://www.eaxau.com/`，首屏不能是纯黑空白，左上角必须显示 `EAXAU`。

如果部署后仍返回旧标题或旧 entry：

1. 在 Cloudflare 清理 `eaxau.com` / `www.eaxau.com` 缓存。
2. 在 Railway 触发一次全量 Redeploy，不要使用旧构建缓存。
3. 再重复上面的 `curl` 验收。
