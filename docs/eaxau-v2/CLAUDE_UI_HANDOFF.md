# Claude Code 后续任务：EAXAU V2 UI 精修

更新时间：2026-08-22。

这是一份可直接交给 Claude Code 的限定任务书。EAXAU V2 的产品纵向链路、数据契约、
Demo/HTTP Provider、校验引擎、页面和后台已经由 Codex 实现。Claude 的任务是独立完成
第二轮视觉与可访问性精修，不重做架构，也不新增或删减功能。

## 先阅读

```text
docs/eaxau-v2/README.md
docs/eaxau-v2/PRODUCT_ARCHITECTURE.md
docs/eaxau-v2/API_CONTRACT.md
docs/eaxau-v2/IMPLEMENTATION_STATUS.md
```

## 已完成，不要重写

- `/v2-preview` 六策略首页。
- 策略详情、组合曲线、持仓、成交和可编辑图文块。
- 自主分仓配置器及全部业务校验。
- 签约管理、自主分仓两类账户页。
- 独立 EA 资料库页面。
- `/admin/v2-content` 六策略图文后台。
- 确定性 Demo Provider 和 Quant Data Core HTTP Provider。
- V2 Zod 契约、tRPC 路由和单元测试。

## Claude 负责的任务

### A. 三视口 UI 精修

只在现有信息架构内改善留白、字号层级、对齐、状态辨识和长文本表现：

- 1440x900 桌面；
- 1024x768 平板；
- 390x844 手机。

覆盖首页、策略详情、分仓、账户列表、两类账户详情、EA 资料库和内容后台。保持卡片圆角
不超过 8px，不做卡片套卡片，不添加渐变球、AI 风格文字框或重复图片标题。

### B. 可访问性与页面状态

- 检查图标按钮的可读标签、键盘焦点和足够的点击区域。
- 检查 `loading/empty/demo/live/stale/offline/partial/error` 的文案和布局稳定性。
- 检查颜色之外是否还有文字/图标表达状态。
- 修复长名称、最大数字、空字段及 200% 浏览器缩放下的遮挡与横向溢出。

### C. 内容后台易用性

精修 `/admin/v2-content`，但不改变保存格式或 API：

- 策略切换、内容块选择、显隐、排序、编辑和预览更容易扫描；
- 保存中、保存成功、校验失败、删除确认状态清楚；
- 小屏仍能完成完整编辑；
- 不引入新的富文本数据格式。

### D. 桌面拖放快捷方式

在不改变分仓 DTO、校验引擎和按钮操作路径的前提下，为桌面 Web 增加策略拖入已启用平台桶的
快捷方式：

- 拖放只调用现有“添加兼容策略”动作，不另建一套状态；
- 不兼容、离线或已存在的策略不可放入，并给出清楚反馈；
- 键盘和按钮路径必须继续完整可用；
- 移动端仍使用选择按钮与步进器，不强制长按拖动；
- 为成功、拒绝和重复拖入补充组件测试或浏览器验收记录。

### E. 前端性能复查

- 检查首屏以下图片懒加载和稳定媒体尺寸；
- 避免重复查询和无意义重渲染；
- 只有确认能降低初始包体时才做路由级延迟加载；
- 提供修改前后的浏览器 Network/Performance 证据，不凭感觉声称提升。

## 允许修改

```text
app/v2-preview/**
app/admin/v2-content.tsx
components/v2/**
lib/v2/content-editor.ts
lib/v2/allocation.ts
public/strategy-art-v2/**
docs/eaxau-v2/CLAUDE_UI_HANDOFF.md
```

如测试需要，可修改与上述文件直接对应的 `*.test.ts`。发现后端问题先记录，不要越界修复。

## 禁止修改

```text
server/routers.ts
server/routers/v2.ts
server/v2/**
shared/v2/contracts.ts
drizzle/**
package.json
pnpm-lock.yaml
app/(tabs)/**  （除非只是修复 V2 复用参数且能证明 V1 行为不变）
```

还必须遵守：

- 不改任何 V1 procedure、输入、输出、支付、下载、登录或 OAuth 行为。
- 不接触牛帮数据库、交易执行或内部函数。
- 不把 `DEMO` 改成 `LIVE`，不伪造实时账户。
- 不加入下单、平仓、入金或远程修改交易参数的操作。
- 不用“永不爆仓”“保证收益”等不可证实承诺。
- 不 force push，不覆盖别人的改动，不提交 `.env`、`web-build`、`dist` 或本地截图。

## 开发与验收命令

Node.js 必须使用 24。安装依赖后执行：

```bash
npx tsc --noEmit
npx expo lint
ADMIN_EMAIL=admin@example.test \
ADMIN_PASSWORD=test-only \
JWT_SECRET=test-secret-at-least-32-characters \
OAUTH_SERVER_URL=https://api.manus.im \
npx vitest run
npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npx expo export --platform web --clear
node scripts/inject-web-bootstrap.mjs
node scripts/verify-web-build.mjs
git diff --check
```

启动本地联调：

```bash
PORT=3000 NODE_ENV=development EAXAU_V2_ENABLED=true npx tsx server/_core/index.ts
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npx expo start --web --port 8081
```

## 交付要求

1. 从最新 `main` 创建 `claude/v2-ui-polish`，分小提交，不重写历史。
2. 给出修改文件清单和每项修改的可验证原因。
3. 提交三个视口的首页、详情、分仓、账户、EA 资料库和后台截图。
4. 报告每条验收命令的真实结果；失败不能写成通过。
5. 列出残余问题，明确区分本仓库问题与外部真实数据依赖。
6. 提供 `git diff --stat` 和证明 V1 API 未改动的 diff。

## 可直接粘贴给 Claude Code

```text
你正在 quant-trading-hub 仓库中执行 EAXAU V2 第二轮 UI 精修。先完整阅读
docs/eaxau-v2/CLAUDE_UI_HANDOFF.md、PRODUCT_ARCHITECTURE.md、API_CONTRACT.md 和
IMPLEMENTATION_STATUS.md。现有 V2 功能、契约、Provider、校验引擎和路由已经完成；
不要重写架构，不新增或删除功能，不修改 V1 API，不触碰牛帮执行路径。

严格限制在任务书“允许修改”的文件内，完成：三视口视觉精修、可访问性/状态复查、
/admin/v2-content 易用性精修、桌面拖放快捷方式和前端性能证据复查。保留六个核心策略、两种业务模式、
独立 EA 资料库和所有 DEMO 标识。遇到需要后端改动的问题只记录，不自行改契约。

完成后运行任务书内全部类型、lint、测试、构建和静态验证命令；用 1440x900、
1024x768、390x844 截图验收，无横向溢出或遮挡。创建 claude/v2-ui-polish 分支，
分小提交，不 force push。最终发回变更清单、测试原始结论、截图、git diff --stat、
V1 未改动证明和残余问题。
```
