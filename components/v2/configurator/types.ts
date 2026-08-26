import type { AppLanguage } from "@/lib/language";

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

const ENGLISH_RISK_OPTIONS: RiskOption[] = [
  {
    id: "LOW",
    title: "Conservative",
    drawdown: 8,
    detail: "Prioritize volatility and concentration control",
  },
  {
    id: "MEDIUM",
    title: "Balanced",
    drawdown: 12,
    detail: "Balance growth with the drawdown budget",
  },
  {
    id: "HIGH",
    title: "Growth",
    drawdown: 18,
    detail: "Accept more volatility for greater upside",
  },
];

const ARABIC_RISK_OPTIONS: RiskOption[] = [
  {
    id: "LOW",
    title: "محافظ",
    drawdown: 8,
    detail: "الأولوية للتحكم في التقلب والتركيز",
  },
  {
    id: "MEDIUM",
    title: "متوازن",
    drawdown: 12,
    detail: "موازنة النمو مع ميزانية التراجع",
  },
  {
    id: "HIGH",
    title: "نمو",
    drawdown: 18,
    detail: "قبول تقلب أعلى مقابل فرص نمو أكبر",
  },
];

export function getRiskOptions(language: AppLanguage) {
  if (language === "en") return ENGLISH_RISK_OPTIONS;
  if (language === "ar") return ARABIC_RISK_OPTIONS;
  return RISK_OPTIONS;
}
