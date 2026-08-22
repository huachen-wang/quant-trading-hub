# GitHub 自动部署操作指南

这份文档用于把当前项目上传到 GitHub，并通过 Railway 自动部署为一个完整网站服务。

推荐 Railway 的原因：本项目不是纯静态站，它同时包含：

- Web 前端导出产物
- Express 后端服务
- tRPC API
- MySQL 数据库连接
- 登录、支付回调、下载、SEO sitemap 等服务端路由

Railway 可以在同一个服务里运行前端静态文件和后端 API，最不容易出现跨域、Cookie、接口地址不一致的问题。

## 一、部署前必须确认

请先确认你上传到 GitHub 的内容包含这些新增目录和文件：

- `components/home/`
- `components/promo/`
- `components/strategy-detail/`
- `components/v2/`
- `app/v2-preview/`
- `app/admin/v2-content.tsx`
- `server/routers/`
- `server/v2/`
- `shared/v2/`
- `server/mock-data.ts`
- `.env.example`
- `docker-compose.yml`
- `GITHUB_DEPLOY_GUIDE.md`
- `AI_DEPLOY_OPERATOR_PROMPT.md`
- `DEPLOYMENT_AUDIT.md`

不要上传这些目录或文件：

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

## 二、创建 GitHub 仓库

1. 打开 GitHub。
2. 新建仓库，例如：`quant-trading-hub`。
3. 仓库可以选择 Private 或 Public。
4. 不要勾选自动创建 README、`.gitignore`、License，因为项目里已经有这些文件。

## 三、上传代码到 GitHub

如果你是从压缩包解压出来的新目录开始：

```bash
cd quant-trading-hub
git init
git add -A
git commit -m "Deploy ready version"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

如果你是在已有仓库里继续提交：

```bash
cd quant-trading-hub
git status
git add -A
git commit -m "Prepare deploy ready version"
git push
```

推送前建议检查：

```bash
git status --short
```

确保没有重要的新增文件漏掉，尤其是 `components/v2/`、`app/v2-preview/`、
`server/v2/`、`shared/v2/` 和 `server/routers/v2.ts`。

## 四、Railway 自动部署

1. 打开 Railway。
2. 选择 `New Project`。
3. 选择 `Deploy from GitHub repo`。
4. 选择刚上传的 GitHub 仓库。
5. Railway 会读取项目根目录的 `railway.json`。

当前 `railway.json` 已配置：

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build:web"
  },
  "deploy": {
    "startCommand": "node dist/index.mjs"
  }
}
```

所以 Railway 会自动执行：

```bash
pnpm install
pnpm build:web
node dist/index.mjs
```

`package.json` 已声明 `Node.js 24.x`。Railway/Vercel 项目设置也应选择 Node.js 24，
不要继续固定在 Node.js 20。

其中 `pnpm build:web` 会先构建后端，再导出 Web 前端到 `web-build/`。

## 五、必须配置的环境变量

在 Railway 项目里进入 `Variables`，添加以下变量。

生产环境必填：

```bash
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
JWT_SECRET=换成超长随机字符串
COOKIE_SECRET=换成超长随机字符串
DOWNLOAD_SIGNING_SECRET=换成超长随机字符串
ADMIN_EMAIL=你的管理员邮箱
ADMIN_PASSWORD=你的强密码
```

建议配置：

```bash
EXPO_PUBLIC_API_BASE_URL=
ENABLE_USDT_PAYMENT=true
ENABLE_ZPAY=true
EAXAU_V2_ENABLED=true
```

说明：

- 如果前端和后端部署在同一个 Railway 服务里，`EXPO_PUBLIC_API_BASE_URL` 可以留空。
- 如果你绑定了 `eaxau.com` 或 `www.eaxau.com`，代码会优先走同域 API。
- 如果前端和后端分开部署，才需要把 `EXPO_PUBLIC_API_BASE_URL` 设置为后端完整地址。

EAXAU V2 数据源：

```bash
# 不设置 URL：使用页面明确标注的确定性模拟数据
QUANT_DATA_CORE_URL=
QUANT_DATA_CORE_API_KEY=
QUANT_DATA_CORE_TIMEOUT_MS=8000
```

只有独立 Quant Data Core 已部署并通过鉴权、脱敏和契约验收后，才填写 URL 和 Key。
设置 URL 后请求失败会明确报错，不会静默回退并伪装成真实数据。

OAuth 可选变量：

```bash
OAUTH_SERVER_URL=
VITE_APP_ID=
VITE_OAUTH_PORTAL_URL=
OWNER_OPEN_ID=
OWNER_NAME=
EXPO_PUBLIC_APP_ID=
EXPO_PUBLIC_OAUTH_PORTAL_URL=
EXPO_PUBLIC_OAUTH_SERVER_URL=
EXPO_PUBLIC_OWNER_OPEN_ID=
EXPO_PUBLIC_OWNER_NAME=
```

邮件可选变量：

```bash
RESEND_API_KEY=
EMAIL_FROM=EAXAU <noreply@你的域名>
EMAIL_REPLY_TO=
```

支付可选变量：

```bash
USDT_TRC20_ADDRESS=
USDT_ERC20_ADDRESS=
ZPAY_PID=
ZPAY_KEY=
ZPAY_GATEWAY=https://zpayz.cn
ZPAY_NOTIFY_URL=
ZPAY_RETURN_URL=
```

## 六、数据库

生产环境必须使用真实 MySQL/TiDB 数据库。

本项目本地没有 `DATABASE_URL` 时会使用 mock 数据，方便预览；但线上正式部署一定要配置 `DATABASE_URL`。

Railway 首次启动时后端会自动执行迁移：

```ts
await runMigrations();
```

如果数据库连接信息错误，部署可以构建成功，但运行时会在日志里报数据库连接问题。

## 七、上线后验证

部署成功后，打开 Railway 给你的域名，逐项检查：

1. 首页可以打开。
2. 策略列表可以显示真实数据库数据。
3. `/api/health` 返回 JSON。
4. 登录/注册入口不报错。
5. 管理员登录页面可以打开。
6. 促销页 `/promo` 可以打开。
7. 策略详情页 `/strategy/1` 或真实策略 ID 可以打开。

健康检查地址示例：

```text
https://你的域名/api/health
```

正常返回类似：

```json
{ "ok": true, "timestamp": 1234567890 }
```

## 八、绑定域名

在 Railway 项目里：

1. 打开 `Settings`。
2. 找到 `Domains`。
3. 添加你的域名，例如 `eaxau.com` 或 `www.eaxau.com`。
4. 按 Railway 给出的 DNS 记录到域名服务商处配置。
5. DNS 生效后，重新访问域名。

如果使用 `eaxau.com` 和 `www.eaxau.com`，建议两个都绑定，并在域名侧设置统一跳转。

## 九、出错时先看这里

如果 GitHub 推送后 Railway 构建失败，优先看：

1. `pnpm install` 是否成功。
2. `pnpm build:web` 是否成功。
3. 是否漏传了 untracked 新文件。
4. `DATABASE_URL` 是否正确。
5. `JWT_SECRET`、`COOKIE_SECRET`、`DOWNLOAD_SIGNING_SECRET` 是否配置。

如果页面打开但没有真实数据：

1. 检查 Railway Variables 是否有 `DATABASE_URL`。
2. 检查数据库是否允许 Railway 外网连接。
3. 检查数据表是否迁移成功。
4. 检查 Railway Logs。

## 十、这次交付前已通过的检查

当前交付包制作前已通过：

- TypeScript 类型检查
- Vitest 全量自动测试（89 通过，1 个原有用例跳过）
- Expo lint
- 后端 build
- Web export
- 本地生产预览启动
- V2 首页、详情、分仓、账户、EA 资料库、后台登录、后台首页和 V2 内容编辑路由巡检
- 1440x900 与 390x844 响应式、图片加载和横向溢出检查
- Git 空白检查
- 顶层 tRPC 路由兼容性检查

完整命令、输出结论和剩余外部风险见 `DEPLOYMENT_AUDIT.md`。

详细记录见 `DEPLOYMENT_AUDIT.md`。
