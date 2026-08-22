# Claude Code 独立复查任务：EAXAU V2

更新时间：2026-08-22。

这不是继续开发架构的任务。EAXAU V2 的六策略首页、策略详情、两种账户模式、自主分仓、
EA 资料库、图文后台、Demo/HTTP Provider、数据契约和校验引擎已经实现。Claude Code 的
职责是作为第二位审查者，先验证，再只修复有证据的问题；没有问题就不要制造代码改动。

## 开始前

1. 从最新 `main` 开始，先执行 `git status --short --branch` 和 `git log -12 --oneline`。
2. 完整阅读 `README.md`、`PRODUCT_ARCHITECTURE.md`、`API_CONTRACT.md`、
   `IMPLEMENTATION_STATUS.md` 和仓库根目录 `DEPLOYMENT_AUDIT.md`。
3. 确认 Node.js 为 24.x。不要改锁文件，不要自动升级依赖。
4. 如果工作区不干净，保留并理解已有修改，不得覆盖、回退或重写他人的提交。

## 已完成，不要重做

- `/v2-preview` 只展示六个核心策略席位，且只挂载六张可见图片。
- `/v2-preview/strategies/[id]` 已包含净值、指标、持仓、交易及可编辑说明/证据块。
- `/v2-preview/allocate` 已支持 1 至 3 个平台、推荐方案、手动步进器和桌面拖放快捷方式。
- `/v2-preview/accounts` 已覆盖签约管理与自主分仓两种只读账户。
- `/v2-preview/ea-library` 保留原 EA 目录、搜索、筛选、咨询和旧链接能力。
- `/admin/v2-content` 已支持新建、编辑、显隐、原子排序、删除、预览和未保存保护。
- 浏览器原生 `alert/confirm` 已替换为站内确认层。
- 首页卡片回调已稳定化，首三张图普通优先级、后三张低优先级，非当前旧首页不再后台挂载。
- V1 procedure、支付、下载、登录、OAuth、邮件、短信和牛帮执行路径没有被改写。

## 你的任务

### 1. 独立 UI 验收

逐页检查以下路由，尺寸固定为 1440x900、1024x768、390x844，并额外检查浏览器 200% 缩放：

```text
/v2-preview
/v2-preview/strategies/jingge-v51
/v2-preview/allocate
/v2-preview/accounts
/v2-preview/accounts/managed-demo-01
/v2-preview/accounts/self-demo-01
/v2-preview/ea-library
/admin/v2-content
```

只记录真实问题：横向页面溢出、文本遮挡、按钮不可点击、焦点不可见、状态只靠颜色、图片失败、
布局跳动或小屏无法完成编辑。横向导航滚动和卡片内部标题省略属于设计行为，不要误报。

### 2. 三项重点复核

- 在真实桌面 Chrome 中把兼容策略拖入平台桶，确认成功提示；再验证重复、离线和不兼容策略被拒绝。
- 在 390px 后台完成“打开区块 -> 修改 -> 切换类型 -> 取消 -> 关闭 -> 放弃修改”全过程，
  确认弹层没有被编辑窗口遮挡。
- 在 `/v2-preview`、策略详情和 `/search` 检查 DOM 图片数量；非当前 V1 首页不得额外挂载
  12 张隐藏商城图片。

### 3. 代码审查

重点检查回归、竞态和可维护性，不做审美性重写：

- 内容块排序是否始终规范化且事务提交；
- mutation 失败后是否保留编辑内容并给出可恢复反馈；
- 路由切换是否产生重复请求或隐藏页面图片请求；
- memo 组件是否仍因不稳定回调失效；
- `DEMO/LIVE/STALE/OFFLINE` 是否同时用文字或图标表达；
- V1 根首页、搜索和 EA 详情是否仍能正常进入。

## 允许修复的范围

只有复现问题后才修改：

```text
app/v2-preview/**
app/admin/v2-content.tsx
components/v2/**
components/home/strategy-filters.tsx
lib/v2/**
docs/eaxau-v2/**
```

需要后端、契约、数据库或 V1 路由变更时，只写成 finding，不自行修改。

## 严格禁止

- 不修改任何既有 V1 procedure、输入或输出。
- 不修改 `server/routers.ts`、`server/routers/v2.ts`、`server/v2/**`、`shared/v2/contracts.ts`、
  `drizzle/**`、`package.json` 或 `pnpm-lock.yaml`。
- 不接触支付、下载、登录、OAuth、邮件、短信、定时任务或牛帮交易执行。
- 不把 `DEMO` 改成 `LIVE`，不写“永不爆仓”“保证收益”等不可验证承诺。
- 不添加新功能，不删除现有功能，不换设计体系，不提交构建产物、本地截图或 `.env`。
- 不 force push，不 rebase 公共分支，不覆盖他人提交。

## 必须执行的验收

```bash
npx tsc --noEmit
npx expo lint
ADMIN_EMAIL=admin@example.test \
ADMIN_PASSWORD=test-only-password \
JWT_SECRET=test-only-jwt-secret-at-least-32-characters \
OAUTH_SERVER_URL=https://api.manus.im \
EAXAU_V2_ENABLED=true \
npx vitest run
npx esbuild server/_core/index.ts --platform=node --packages=external \
  --bundle --format=esm --out-extension:.js=.mjs --outdir=dist
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 \
npx expo export --platform web --output-dir web-build --clear
node scripts/inject-web-bootstrap.js
node scripts/verify-web-build.js
git diff --check
```

## 交付格式

1. Findings 按严重度排序，必须有文件/行号或可复现步骤。
2. 三个视口的页面截图和真实 HTML5 拖放结果。
3. 每条命令的真实通过/失败数量。
4. 若有修复，给出小提交、`git diff --stat` 和 V1 未改动证明。
5. 若没有问题，明确写“未发现需要修改的问题”，不要为了产生提交而改代码。

## 可直接粘贴给 Claude Code

```text
请在 quant-trading-hub 最新 main 上执行独立验收。先完整阅读
docs/eaxau-v2/CLAUDE_UI_HANDOFF.md 及其中列出的架构、契约、状态和部署审计文档。
现有功能已经开发完成，你不是来重写架构或新增功能的。按任务书检查 1440x900、
1024x768、390x844 和 200% 缩放，重点实测桌面 HTML5 拖放、390px 内容后台完整编辑流程，
以及非当前首页是否仍挂载隐藏图片。先报告 findings；只有复现问题后才在允许目录内做最小修复。
禁止修改 V1 API、V2 后端/契约、数据库、支付、下载、登录、OAuth、牛帮执行、package.json
和锁文件。保留所有 DEMO 标识，不 force push。完成后运行任务书中的全部验收命令，发回
截图、测试原始结论、diff stat、V1 未改动证明和残余外部依赖。
```
