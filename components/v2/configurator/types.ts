export type RiskProfile = "LOW" | "MEDIUM" | "HIGH";
export type ManagedSessionDuration = 30 | 90 | 180;
export type FundingRoute = "DIRECT_BROKER" | "MANAGED_VAULT";
export type ExitMode = "CLOSE_NOW" | "NO_NEW_ENTRIES" | "HAND_BACK_POSITIONS";

export type RiskOption = {
  id: RiskProfile;
  title: string;
  drawdown: number;
  detail: string;
};

export type ManagedSessionOption<T extends string | number> = {
  id: T;
  title: string;
  detail: string;
};

export const CAPITAL_PRESETS = [10_000, 50_000, 100_000, 300_000];

export const RISK_OPTIONS: RiskOption[] = [
  { id: "LOW", title: "稳健", drawdown: 8, detail: "优先控制波动与集中度" },
  { id: "MEDIUM", title: "均衡", drawdown: 12, detail: "兼顾增长与回撤预算" },
  { id: "HIGH", title: "进取", drawdown: 18, detail: "接受更高波动换取弹性" },
];

export const SESSION_DURATION_OPTIONS: ManagedSessionOption<ManagedSessionDuration>[] =
  [
    { id: 30, title: "30 天", detail: "短周期验证与复盘" },
    { id: 90, title: "90 天", detail: "覆盖更多市场状态" },
    { id: 180, title: "180 天", detail: "长周期资管与结算" },
  ];

export const EXIT_MODE_OPTIONS: ManagedSessionOption<ExitMode>[] = [
  {
    id: "CLOSE_NOW",
    title: "立即平仓",
    detail: "停止新单并按约定处理已有仓位",
  },
  {
    id: "NO_NEW_ENTRIES",
    title: "自然退出",
    detail: "停止新单，原持仓按策略规则退出",
  },
  {
    id: "HAND_BACK_POSITIONS",
    title: "交还持仓",
    detail: "终止管理后由客户接管现有持仓",
  },
];

export const FUNDING_ROUTE_OPTIONS: (ManagedSessionOption<FundingRoute> & {
  status: "ACTIVE" | "PREPARING";
  badge: string;
})[] = [
  {
    id: "DIRECT_BROKER",
    title: "U 直达券商",
    detail: "客户将 USDT 直接存入支持稳定币的合作券商账户。",
    status: "ACTIVE",
    badge: "当前路由",
  },
  {
    id: "MANAGED_VAULT",
    title: "Managed Vault",
    detail: "统一接收 U，再向 1–2 个券商执行槽调度资金。",
    status: "PREPARING",
    badge: "接入准备中",
  },
];

export function fundingRouteLabel(routes: FundingRoute[]) {
  const hasDirect = routes.includes("DIRECT_BROKER");
  const hasVault = routes.includes("MANAGED_VAULT");
  if (hasDirect && hasVault) return "混合路由";
  if (hasVault) return "Managed Vault";
  return "U 直达券商";
}

export function exitModeLabel(exitMode: ExitMode) {
  return (
    EXIT_MODE_OPTIONS.find((option) => option.id === exitMode)?.title ??
    "未设定"
  );
}
