export type StrategyStatus = "draft" | "published" | "archived";

export type AdminStrategy = {
  id: number;
  title: string;
  description?: string | null;
  platform?: string | null;
  productType?: string | null;
  pairs?: string | null;
  timeframe?: string | null;
  tags?: string | null;
  status: StrategyStatus;
  totalReturn?: string | null;
  winRate?: string | null;
  downloadCount?: number | null;
  virtualDownloads?: number | null;
  virtualSubscribers?: number | null;
};

export type StrategyCounts = Record<StrategyStatus, number> & {
  total: number;
};

export const STRATEGY_STATUS_OPTIONS: Array<{
  label: string;
  value?: StrategyStatus;
}> = [
  { label: "全部" },
  { label: "草稿", value: "draft" },
  { label: "已发布", value: "published" },
  { label: "已归档", value: "archived" },
];

export function getStrategyStatusLabel(status: StrategyStatus): string {
  if (status === "published") return "已发布";
  if (status === "draft") return "草稿";
  return "已归档";
}
