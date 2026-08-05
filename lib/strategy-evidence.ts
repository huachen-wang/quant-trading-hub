export type StrategyEvidenceInput = {
  dataStatus?: "estimated" | "referenced" | "verified" | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  evidenceUrl?: string | null;
  platform?: string | null;
  pairs?: string | null;
  timeframe?: string | null;
};

export type StrategyEvidenceTone = "success" | "primary" | "warning" | "muted";

export type StrategyEvidenceItem = {
  id: "source" | "performance" | "environment";
  title: string;
  detail: string;
  status: string;
  tone: StrategyEvidenceTone;
  url?: string;
  actionLabel?: string;
};

function clean(value?: string | null) {
  return (value || "").trim();
}

function httpsUrl(value?: string | null) {
  const url = clean(value);
  return /^https:\/\//i.test(url) ? url : undefined;
}

export function resolveStrategyEvidence(input: StrategyEvidenceInput) {
  const sourceUrl = httpsUrl(input.sourceUrl);
  const evidenceUrl = httpsUrl(input.evidenceUrl);
  const sourceName = clean(input.sourceName);
  const platform = clean(input.platform);
  const pairs = clean(input.pairs);
  const timeframe = clean(input.timeframe);
  const hasEnvironment = Boolean(platform && pairs && timeframe);

  const items: StrategyEvidenceItem[] = [
    {
      id: "source",
      title: "版本与来源",
      detail: sourceName || "待补产品原页、文件版本、更新日期或授权范围说明。",
      status: sourceUrl ? "已关联" : sourceName ? "已记录" : "待补充",
      tone: sourceUrl ? "primary" : sourceName ? "muted" : "warning",
      url: sourceUrl,
      actionLabel: sourceUrl ? "查看来源" : undefined,
    },
    {
      id: "performance",
      title: "回测或观摩",
      detail: evidenceUrl
        ? input.dataStatus === "verified"
          ? "已关联核验材料，仍建议核对账户、周期与更新时间。"
          : "已关联外部参考材料，真实性与时效需进一步核对。"
        : "待补回测报告、观摩账户、成交记录或阶段性截图。",
      status: evidenceUrl
        ? input.dataStatus === "verified"
          ? "已核验"
          : "外部参考"
        : "待补充",
      tone: evidenceUrl
        ? input.dataStatus === "verified"
          ? "success"
          : "primary"
        : "warning",
      url: evidenceUrl,
      actionLabel: evidenceUrl ? "打开资料" : undefined,
    },
    {
      id: "environment",
      title: "参数与环境",
      detail: hasEnvironment
        ? `${platform} · ${pairs} · ${timeframe}；经纪商条件、资金门槛与参数文件待继续确认。`
        : "待补平台、交易品种、运行周期、经纪商条件与参数文件。",
      status: hasEnvironment ? "基础档案" : "待补充",
      tone: hasEnvironment ? "muted" : "warning",
    },
  ];

  const summary =
    input.dataStatus === "verified" && evidenceUrl
      ? {
          label: "已核验资料",
          tone: "success" as const,
          note: "页面已关联核验材料，请继续关注资料对应的版本与时间范围。",
        }
      : sourceUrl || evidenceUrl
        ? {
            label: "参考资料",
            tone: "primary" as const,
            note: "当前包含外部参考，尚不能等同于完整实盘验证。",
          }
        : {
            label: "资料待补",
            tone: "warning" as const,
            note: "当前先展示策略档案，证据材料将在后台逐步补齐。",
          };

  return { ...summary, items };
}
