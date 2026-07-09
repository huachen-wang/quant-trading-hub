# Manus 部署修复指令：eaxau.com 白屏

请只做这次白屏修复，不要重构接口、不要改数据库、不要改 API 路径。

## 背景

线上服务端已经正常启动，数据库迁移成功，`/api/health` 正常，静态目录 `web-build` 也存在。但 `https://eaxau.com` / `https://www.eaxau.com` 首屏为空白深色背景。

诊断结果：生产 Web 曾经启用了 Expo Router 的异步路由拆包，并且 Metro 缓存可能继续把旧配置打进生产 JS。线上会出现外壳加载、静态资源 200，但首页内容没有挂载的问题。

## 必须合并的改动

1. 确认 `app.config.ts` 里的 Expo Router 配置为：

```ts
{ asyncRoutes: { web: false, default: "development" } }
```

2. 确认 `package.json` 里的 `build:web` 使用清缓存导出，并在导出后校验入口资源：

```json
"build:web": "pnpm build && npx expo export --platform web --output-dir web-build --clear && node scripts/verify-web-build.js"
```

这些改动不会改变任何后端接口、数据库字段、API URL 或登录逻辑，只影响生产 Web 打包方式和构建缓存。

## 合并后必须执行的检查

在仓库根目录执行：

```bash
pnpm install
EXPO_PUBLIC_API_BASE_URL=https://eaxau.com ADMIN_EMAIL=admin@eaxau.com ADMIN_PASSWORD=local-test-password JWT_SECRET=local-test-jwt-secret COOKIE_SECRET=local-test-cookie-secret DOWNLOAD_SIGNING_SECRET=local-test-download-secret OAUTH_SERVER_URL=https://api.manus.im pnpm test
pnpm lint
pnpm build:web
```

预期结果：

- `pnpm test`：35 个测试通过，1 个测试跳过。
- `pnpm lint`：通过。
- `pnpm build:web`：通过。
- 构建日志必须出现 `[verify-web-build] OK`。
- 构建后的 `web-build/index.html` 应该只引用一个入口 JS，例如 `/_expo/static/js/web/entry-*.js`，不应该再出现很多首页/详情页异步路由 chunk。
- 构建后的入口 JS 里必须能搜到 `asyncRoutes.*web.*false`，不能搜到 `asyncRoutes.*web.*true`。

## 部署后验证

部署完成后检查：

```bash
curl -I https://www.eaxau.com/
curl -s https://www.eaxau.com/api/health
curl -s https://www.eaxau.com/ | grep 'entry-'
curl -s https://www.eaxau.com/ | grep '<title>'
```

然后浏览器无痕打开 `https://www.eaxau.com/`。如果仍看到旧白屏，请清理 Cloudflare/边缘缓存并强制刷新，因为旧 JS 文件可能被浏览器或 CDN 短暂缓存。如果标题仍是 `量化军火库` 而不是 `EAXAU`，说明线上还是旧构建，必须重新全量部署。
