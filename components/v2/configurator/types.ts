export type RiskProfile = "LOW" | "MEDIUM" | "HIGH";
export type ServicePath = "BROKER" | "MANAGED";

export type RiskOption = {
  id: RiskProfile;
  title: string;
  drawdown: number;
  detail: string;
};

export const CAPITAL_PRESETS = [10_000, 50_000, 100_000, 300_000];

export const RISK_OPTIONS: RiskOption[] = [
  { id: "LOW", title: "稳健", drawdown: 8, detail: "优先控制波动与集中度" },
  { id: "MEDIUM", title: "均衡", drawdown: 12, detail: "兼顾增长与回撤预算" },
  { id: "HIGH", title: "进取", drawdown: 18, detail: "接受更高波动换取弹性" },
];
