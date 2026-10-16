import { NotFoundScreen } from "@/components/not-found-screen";

/**
 * 覆盖 Expo Router 自带的 /_sitemap（它会对外列出 admin、dev、checkout、oauth 等全部路由）。
 * 生产环境不需要这一页：服务端对 /_sitemap 直接返回 404，前端内跳转到这里也只显示 404 页。
 */
export default NotFoundScreen;
