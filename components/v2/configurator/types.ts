export type RiskProfile = "LOW" | "MEDIUM" | "HIGH";
export type AllianceBrokerId =
  | "exness"
  | "ic-markets"
  | "blueberry-markets";
export type OnboardingMode = "SELF_OPENED" | "PLATFORM_ASSISTED";
export type FundingPath = "BROKER_DIRECT" | "PLATFORM_COLLECTION";

export type RiskOption = {
  id: RiskProfile;
  title: string;
  drawdown: number;
  detail: string;
};

export type AllianceBroker = {
  id: AllianceBrokerId;
  code: string;
  name: string;
  detail: string;
  signupUrl: string;
  managementUrl: string;
  fundingUrl?: string;
  collectionApproval: "NOT_APPROVED" | "PENDING" | "APPROVED" | "SUSPENDED";
};

export type OnboardingOption = {
  id: OnboardingMode;
  title: string;
  badge: string;
  detail: string;
};

export const CAPITAL_PRESETS = [10_000, 50_000, 100_000, 300_000];

export const RISK_OPTIONS: RiskOption[] = [
  { id: "LOW", title: "稳健", drawdown: 8, detail: "优先控制波动与集中度" },
  { id: "MEDIUM", title: "均衡", drawdown: 12, detail: "兼顾增长与回撤预算" },
  { id: "HIGH", title: "进取", drawdown: 18, detail: "接受更高波动换取弹性" },
];

/**
 * Product-level broker catalog. It intentionally contains no deposit network,
 * address or fee claim: customers must obtain those changing values from the
 * selected broker's own client portal for every funding attempt.
 */
export const ALLIANCE_BROKERS: AllianceBroker[] = [
  {
    id: "exness",
    code: "EXN",
    name: "Exness",
    detail: "可选执行券商；开户、地区可用性与当次入金能力以券商客户后台为准。",
    signupUrl: "https://my.exness.com/accounts/sign-up?lng=zh",
    managementUrl:
      "https://portfolio-management.exness.help/hc/en-us/articles/6787235670418-Joining-a-fund",
    collectionApproval: "PENDING",
  },
  {
    id: "ic-markets",
    code: "ICM",
    name: "IC Markets",
    detail: "可选执行券商；开户、地区可用性与当次入金能力以券商客户后台为准。",
    signupUrl: "https://www.ic.com/cn/open-trading-account/live",
    managementUrl: "https://www.icmarketspartners.com/en/apply",
    fundingUrl: "https://www.ic.com/en/trading-accounts/funding",
    collectionApproval: "PENDING",
  },
  {
    id: "blueberry-markets",
    code: "BBM",
    name: "Blueberry Markets",
    detail: "可选执行券商；开户、地区可用性与当次入金能力以券商客户后台为准。",
    signupUrl: "https://portal.blueberrymarkets.com/en/sign-up",
    managementUrl: "https://portal.blueberrypartners.com/en/signup",
    collectionApproval: "PENDING",
  },
];

export const FUNDING_PATH_OPTIONS: {
  id: FundingPath;
  title: string;
  badge: string;
  detail: string;
}[] = [
  {
    id: "BROKER_DIRECT",
    title: "U 直达本人券商",
    badge: "默认",
    detail:
      "客户从券商客户后台获取当次网络、地址与标签，USDT 直接进入客户本人券商账户。",
  },
  {
    id: "PLATFORM_COLLECTION",
    title: "平台专属地址代收",
    badge: "协助通道",
    detail:
      "为单笔代收单生成专属地址；平台核对后再转入客户本人券商账户，全程与其他款项分账。",
  },
];

export const ONBOARDING_OPTIONS: OnboardingOption[] = [
  {
    id: "SELF_OPENED",
    title: "客户自主开户",
    badge: "自主办理",
    detail:
      "客户自行完成券商开户与验证；USDT 直接进入客户本人券商账户。",
  },
  {
    id: "PLATFORM_ASSISTED",
    title: "平台协助接入",
    badge: "流程协助",
    detail:
      "平台协助开户与交易授权；U 可直达本人券商，已获书面批准的通道也可使用平台专属代收单。",
  },
];

export const BROKER_FUNDING_STEPS = [
  "选择可选券商并完成自主开户或申请平台协助接入",
  "从券商客户后台获取当次 USDT 网络、地址及标签（如有）",
  "从客户钱包转账，提交 txHash 与申报金额",
  "等待确认中；网络、金额或标签不符会进入异常处理",
  "券商实际入账并经后台核对后显示已到账",
] as const;

export const ASSISTED_FUNDING_STEPS = [
  "生成或等待单笔专属代收单",
  "客户按代收单指定网络、金额与专属地址转入",
  "提交 txHash，等待确认中；异常会进入独立人工处理",
  "平台核对后从外部企业钱包转入客户本人券商账户",
  "券商实际入账后显示已到账；退款或未到账显示异常",
] as const;

export const BROKER_FUNDING_WARNINGS = [
  "网络必须与券商当次显示完全一致；错链可能无法找回。",
  "不要复用历史入金地址、二维码或标签；每次都从券商客户后台重新获取。",
  "少付、多付、迟到、未到账或标签遗漏会进入人工核对，不代表已入账。",
  "提交 txHash 只是申报；只有券商账户实际入账并经后台核对后才算完成。",
] as const;

export function brokerById(id: AllianceBrokerId) {
  return ALLIANCE_BROKERS.find((broker) => broker.id === id)!;
}

export function onboardingModeLabel(mode: OnboardingMode) {
  return (
    ONBOARDING_OPTIONS.find((option) => option.id === mode)?.title ??
    "未选择"
  );
}

export function fundingPathLabel(path: FundingPath) {
  return (
    FUNDING_PATH_OPTIONS.find((option) => option.id === path)?.title ??
    "未选择"
  );
}
