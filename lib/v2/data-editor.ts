import type { StrategyDataOverride } from "@/shared/v2/contracts";

export type StrategyDataEditorForm = {
  mode: StrategyDataOverride["mode"];
  historyHandoverAt: string;
  note: string;
  metrics: Record<keyof StrategyDataOverride["metrics"], string>;
  equityText: string;
};

const METRIC_KEYS = [
  "return30dPct",
  "return90dPct",
  "totalReturnPct",
  "todayPnlPct",
  "maxDrawdownPct",
  "winRatePct",
  "tradeCount",
  "avgHoldingMinutes",
  "balance",
  "equity",
  "floatingPnl",
] as const;

function metricText(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

export function overrideToDataEditorForm(
  override: StrategyDataOverride,
): StrategyDataEditorForm {
  return {
    mode: override.mode,
    historyHandoverAt: override.historyHandoverAt ?? "",
    note: override.note,
    metrics: Object.fromEntries(
      METRIC_KEYS.map((key) => [key, metricText(override.metrics[key])]),
    ) as StrategyDataEditorForm["metrics"],
    equityText: override.equity
      .map((point) => `${point.timestamp} | ${point.balance} | ${point.equity}`)
      .join("\n"),
  };
}

function parseMetric(key: typeof METRIC_KEYS[number], raw: string) {
  const value = raw.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${key} 必须是有效数字。`);
  if (key === "tradeCount") {
    if (!Number.isInteger(parsed) || parsed < 0) throw new Error("交易次数必须是非负整数。");
  }
  return parsed;
}

export function dataEditorFormToOverride(
  strategyId: string,
  form: StrategyDataEditorForm,
): StrategyDataOverride {
  const metrics = Object.fromEntries(
    METRIC_KEYS.flatMap((key) => {
      const value = parseMetric(key, form.metrics[key]);
      return value === undefined ? [] : [[key, value]];
    }),
  );
  const equity = form.equityText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawTime, rawBalance, rawEquity] = line.split("|").map((part) => part.trim());
      const timestamp = new Date(rawTime).toISOString();
      const balance = Number(rawBalance);
      const equityValue = Number(rawEquity);
      if (!Number.isFinite(balance) || !Number.isFinite(equityValue)) {
        throw new Error(`第 ${index + 1} 行的余额或净值不是有效数字。`);
      }
      return { timestamp, balance, equity: equityValue, source: "CUSTOM" as const };
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  let historyHandoverAt: string | null = null;
  if (form.mode === "HYBRID") {
    if (!form.historyHandoverAt.trim()) throw new Error("混合模式必须填写实盘接管时间。");
    historyHandoverAt = new Date(form.historyHandoverAt).toISOString();
    const cutoff = Date.parse(historyHandoverAt);
    if (equity.some((point) => Date.parse(point.timestamp) >= cutoff)) {
      throw new Error("自定义历史数据点必须早于实盘接管时间。同步后的数据由实盘接口负责。");
    }
  }

  return {
    strategyId,
    mode: form.mode,
    historyHandoverAt,
    note: form.note.trim(),
    metrics,
    equity,
  };
}
