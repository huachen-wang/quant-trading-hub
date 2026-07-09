# 给 AI 部署助手的严格操作指令

你是部署助手。你的目标是把这个 `quant-trading-hub` 项目安全上传到 GitHub，并通过 Railway 自动部署。请严格遵守以下规则。

## 绝对禁止

1. 不要改业务代码。
2. 不要改接口路径、tRPC 路由名、数据库 schema。
3. 不要提交 `.env`、`.env.local`、任何真实密钥。
4. 不要提交 `node_modules/`、`.git/`、`.manus/`、`.expo/`、`dist/`、`web-build/`。
5. 不要提交 `database-export.sql` 或 `database-export.sql.backup`。
6. 不要跳过检查。
7. 如果检查失败，停止部署，并把错误完整报告给用户，不要强推。
8. 不要只上传或只合并 `app/` 目录。本包是完整项目包，必须完整同步新增组件、服务端路由、测试和部署文档。

## 项目基本信息

- 项目名：`quant-trading-hub`
- 推荐部署平台：Railway
- 推荐 Node 版本：Node.js 22+
- 包管理器：pnpm
- Railway 构建命令：`pnpm install && pnpm build:web`
- Railway 启动命令：`node dist/index.mjs`
- `pnpm build:web` 已包含 `expo export --clear`，不要删除 `--clear`，否则可能复用旧 Metro 配置导致线上黑屏。

## 第一步：解压并进入项目

```bash
unzip quant-trading-hub-github-deploy-ready.zip
cd quant-trading-hub
```

如果压缩包文件名不同，使用实际文件名。

## 第二步：检查不得提交的敏感内容

运行：

```bash
find . -name ".env" -o -name ".env.local" -o -name "node_modules" -o -name ".git" -o -name ".manus" -o -name "dist" -o -name "web-build" -o -name "database-export.sql" -o -name "database-export.sql.backup"
```

允许看到的情况：

- 如果是刚解压的新项目，不应该有 `.git/`。
- 不应该有 `.env` 或 `.env.local`。
- 不应该有 `node_modules/`。
- 不应该有 `dist/` 或 `web-build/`。
- 不应该有 `.manus/`。
- 不应该有 `database-export.sql` 或 `database-export.sql.backup`。

如果发现 `.env` 或真实密钥，立刻停止。

同时必须确认以下关键文件和目录存在；缺任何一个都不要部署：

```text
components/brand-wordmark.tsx
components/admin/
components/home/
components/promo/
components/strategy-detail/
constants/api-base-url.ts
server/mock-data.ts
server/routers.ts
server/routers/
GITHUB_DEPLOY_GUIDE.md
AI_DEPLOY_OPERATOR_PROMPT.md
DEPLOYMENT_AUDIT.md
MANUS_PRODUCTION_FIX_AND_UI_POLISH_PROMPT.md
MANUS_EAXAU_BLACK_SCREEN_CURRENT_FIX_PROMPT.md
```

## 第三步：安装依赖

```bash
corepack enable
pnpm install --frozen-lockfile
```

如果当前环境没有 corepack，可使用：

```bash
npm install -g pnpm@9.12.0
pnpm install --frozen-lockfile
```

## 第四步：本地检查

必须依次运行：

```bash
pnpm check
ADMIN_EMAIL=admin@eaxau.com \
ADMIN_PASSWORD=local-test-password \
JWT_SECRET=local-test-jwt-secret \
COOKIE_SECRET=local-test-cookie-secret \
DOWNLOAD_SIGNING_SECRET=local-test-download-secret \
OAUTH_SERVER_URL=https://api.manus.im \
pnpm test
pnpm lint
pnpm build:web
```

全部通过后才允许继续。

`pnpm build:web` 的最后必须出现：

```text
[verify-web-build] OK
```

构建完成后必须确认生产 Web 包没有旧 router 配置：

```bash
grep -R 'asyncRoutes.*web.*false' web-build/_expo/static/js/web/
```

如果搜不到，或者搜到 `asyncRoutes.*web.*true`，停止部署并报告。

允许的已知情况：

- 测试里可能有 1 个 OAuth 相关 skipped，因为本地未配置 `OAUTH_SERVER_URL`。
- 只要测试命令最终退出码是 0，可以继续。

如果任意命令失败：

1. 不要部署。
2. 不要猜测修复。
3. 把失败命令和错误日志报告给用户。

## 第五步：初始化 Git 并推送

如果用户提供的是全新 GitHub 仓库：

```bash
git init
git status --short
git add -A
git commit -m "Deploy ready version"
git branch -M main
git remote add origin <用户提供的 GitHub 仓库地址>
git push -u origin main
```

如果用户提供的是已有仓库：

```bash
git status --short
git add -A
git commit -m "Prepare deploy ready version"
git push
```

提交前必须确认这些新增目录已经进入 Git：

```bash
git status --short
```

重点确认：

- `components/home/`
- `components/admin/`
- `components/promo/`
- `components/strategy-detail/`
- `server/routers/`
- `server/mock-data.ts`
- `.env.example`
- `docker-compose.yml`
- `GITHUB_DEPLOY_GUIDE.md`
- `AI_DEPLOY_OPERATOR_PROMPT.md`
- `DEPLOYMENT_AUDIT.md`

## 第六步：Railway 部署

在 Railway 上：

1. New Project
2. Deploy from GitHub repo
3. 选择刚推送的仓库
4. 保持 Root Directory 为项目根目录
5. Railway 会读取 `railway.json`

确认 Railway 使用：

```bash
Build Command: pnpm install && pnpm build:web
Start Command: node dist/index.mjs
```

## 第七步：配置 Railway 环境变量

至少配置：

```bash
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
JWT_SECRET=<长随机字符串>
COOKIE_SECRET=<长随机字符串>
DOWNLOAD_SIGNING_SECRET=<长随机字符串>
ADMIN_EMAIL=<管理员邮箱>
ADMIN_PASSWORD=<管理员强密码>
```

推荐配置：

```bash
EXPO_PUBLIC_API_BASE_URL=
ENABLE_USDT_PAYMENT=true
ENABLE_ZPAY=true
```

说明：

- 同一个 Railway 服务同时跑前端和后端时，`EXPO_PUBLIC_API_BASE_URL` 可以留空。
- 绑定 `eaxau.com` / `www.eaxau.com` 时，代码会自动走同域 API。
- 如果前后端分离，才需要填后端完整 URL。
- 不要把 `EXPO_PUBLIC_API_BASE_URL` 写成错误的临时域名，否则非 eaxau 域名访问时可能请求错 API。

## 第八步：部署后验收

部署成功后依次访问：

```text
https://你的域名/
https://你的域名/api/health
https://你的域名/strategy/1
https://你的域名/promo
https://你的域名/cooperation
https://你的域名/subscribe
https://你的域名/group-buy
https://你的域名/admin/login
```

验收标准：

1. 首页能打开。
2. `/api/health` 返回 `{ "ok": true, ... }`。
3. 页面不是纯黑空白，左上角应显示 `EAXAU` 字标。
4. `/strategy/1` 或真实策略 ID 能打开。
5. `/promo`、`/cooperation`、`/subscribe`、`/group-buy` 能打开。
6. `/admin/login` 能打开。
7. 策略列表显示真实数据库内容。
8. Railway Logs 没有数据库连接错误、启动崩溃错误。

如果 `/api/health` 正常但页面没数据，优先检查 `DATABASE_URL` 和数据库访问白名单。

还必须确认线上不是旧构建：

```bash
curl -L https://你的域名/ | grep '<title>'
curl -L https://你的域名/ | grep 'entry-'
curl -I https://你的域名/_expo/static/js/web/<线上首页显示的 entry 文件名>
```

标题应为 `EAXAU`。入口 JS 的 `Content-Type` 必须是 `application/javascript`，不能是 `text/html` 或 404。如果仍是 `量化军火库`、entry 文件仍是旧 hash，或 JS 请求返回 HTML，先清 Cloudflare/边缘缓存，再触发 Railway 全量 Redeploy。

## 第九步：最终报告给用户

完成后，向用户报告：

1. GitHub 仓库地址。
2. Railway 部署地址。
3. 自定义域名状态。
4. 已配置的环境变量名称，不要泄露值。
5. 检查结果：`check/test/lint/build:web` 是否通过。
6. 如果有 skipped test，说明原因。

不要声称“绝对没有 bug”。只能如实说明检查结果和剩余风险。
