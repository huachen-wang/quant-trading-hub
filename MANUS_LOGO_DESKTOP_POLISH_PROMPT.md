# Manus 合并指令：EAXAU Logo 与桌面端视觉优化

请合并本补丁包，目标是修复左上角仍显示旧 logo 的问题，并提升首页桌面端的金融机构感。

## 合并范围

本补丁只包含前端 UI 文件，不改任何后端接口、数据库字段、API 路径或支付/登录接口。

重点改动：

- 新增统一字标组件：`components/brand-wordmark.tsx`
- 替换旧的分散字母 logo：顶部导航、侧边导航、用户登录卡、后台登录页
- 优化首页桌面端：
  - 首页内容增加桌面版心
  - Hero 改成金融终端式双栏结构
  - 筛选栏改成策略终端面板
  - EA 破解横幅桌面端收紧
  - 无数据状态改为桌面运营面板，减少大面积空白

## 合并后检查

在仓库根目录执行：

```bash
pnpm install
EXPO_PUBLIC_API_BASE_URL=https://eaxau.com ADMIN_EMAIL=admin@eaxau.com ADMIN_PASSWORD=local-test-password JWT_SECRET=local-test-jwt-secret COOKIE_SECRET=local-test-cookie-secret DOWNLOAD_SIGNING_SECRET=local-test-download-secret OAUTH_SERVER_URL=https://api.manus.im pnpm test
pnpm lint
pnpm build:web
```

预期：

- 测试：35 passed，1 skipped
- Lint：通过
- Web 构建：通过

## 部署后验证

打开 `https://www.eaxau.com/`，确认：

- 左上角显示连续的 `EAXAU` 字标，不再是旧的分散 logo。
- 首页桌面端出现 Source Desk 面板、策略终端筛选面板。
- 页面不是空白，也没有控制台致命错误。

如果仍看到旧 logo，先清理浏览器缓存/CDN 缓存后强制刷新。
