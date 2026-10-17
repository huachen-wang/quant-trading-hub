/**
 * 前端（Expo Router，app/ 目录）真实存在的页面地址。
 *
 * 用途：服务端只对这些地址返回 200 的应用壳；其它地址给真 404（noindex），不再「任意路径都 200」。
 * tests/spa-routes.test.ts 会扫描 app/ 目录，新增或删除页面文件而没同步这里会直接测试失败。
 *
 * - 路由组 `(tabs)` 不出现在网址里；`index` 对应上一级目录；
 * - `[param]` 是单段动态参数，匹配任意一个非空路径段；
 * - `/strategy/:id` 不在这里：index.ts 里有专门的处理（查库，不存在的商品给 404）。
 */
export const STATIC_SPA_ROUTES: readonly string[] = [
  "/",
  // (tabs)
  "/favorites",
  "/group-buy",
  "/market",
  "/moments",
  "/profile",
  "/subscribe",
  // 后台
  "/admin",
  "/admin/alliance-sessions",
  "/admin/backtest-data",
  "/admin/broker-funding",
  "/admin/broker-funding-detail",
  "/admin/comments",
  "/admin/contact-settings",
  "/admin/cooperation-contents",
  "/admin/cooperation-manage",
  "/admin/group-buys",
  "/admin/listings",
  "/admin/login",
  "/admin/notifications",
  "/admin/order-detail",
  "/admin/orders",
  "/admin/page-contents",
  "/admin/promo-manage",
  "/admin/site-entries",
  "/admin/strategies",
  "/admin/strategy-form",
  "/admin/subscribers",
  "/admin/support",
  "/admin/v2-content",
  "/admin/v2-data",
  // 登录
  "/auth/forgot-password",
  "/auth/login",
  "/auth/register",
  // 结账
  "/checkout/new",
  "/checkout/success",
  // 其它页面
  "/cooperation",
  "/dev/theme-lab",
  // 中英双语内容页（2026-10-18，正文见 shared/content-pages）
  "/en/cooperation",
  "/en/guides/ea-requirements-and-acceptance",
  "/guides/ea-requirements-and-acceptance",
  "/group-buy/create",
  "/oauth/callback",
  "/profile/edit",
  "/promo",
  "/search",
  // V2
  "/v2-preview",
  "/v2-preview/accounts",
  "/v2-preview/allocate",
  "/v2-preview/ea-library",
];

/** 动态页面，写成 app/ 里的文件路径形式（不含扩展名），便于和测试里扫出来的结果直接比对。 */
export const DYNAMIC_SPA_ROUTES: readonly string[] = [
  "/checkout/[orderNo]",
  "/v2-preview/accounts/[id]",
  "/v2-preview/strategies/[id]",
];

const STATIC_SET = new Set(STATIC_SPA_ROUTES.map((route) => route.toLowerCase()));

const DYNAMIC_PATTERNS = DYNAMIC_SPA_ROUTES.map(
  (route) =>
    new RegExp(
      "^" +
        route
          .split("/")
          .map((segment) =>
            /^\[[^\]]+\]$/.test(segment)
              ? "[^/]+"
              : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          )
          .join("/") +
        "$",
      "i",
    ),
);

/** 去掉末尾斜杠（根路径除外）。 */
function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return trimmed || "/";
}

/** 这个地址是否对应 app/ 里真实存在的页面（不含 /strategy/:id，那个单独查库）。 */
export function isKnownSpaRoute(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (STATIC_SET.has(path.toLowerCase())) return true;
  return DYNAMIC_PATTERNS.some((pattern) => pattern.test(path));
}
