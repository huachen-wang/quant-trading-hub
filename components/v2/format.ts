export function formatPct(value: number | null, signed = false) {
  if (value === null || !Number.isFinite(value)) return "--";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatMoney(
  value: number | null,
  currency = "USD",
  compact = false,
) {
  if (value === null || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function riskLabel(value: "LOW" | "MEDIUM" | "HIGH") {
  return value === "LOW" ? "低风险" : value === "MEDIUM" ? "中风险" : "高风险";
}
