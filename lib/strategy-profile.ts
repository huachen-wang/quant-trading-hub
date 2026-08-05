import {
  resolveStrategyArtwork,
  type StrategyArtworkKind,
} from "./strategy-artwork";

type StrategyProfileInput = {
  title: string;
  tags?: string | null;
  pairs?: string | null;
  timeframe?: string | null;
  platform?: string | null;
  productType?: string | null;
};

export type StrategyProfileItem = {
  label: string;
  value: string;
  note: string;
};

export type StrategyProfile = {
  kind: StrategyArtworkKind;
  items: readonly StrategyProfileItem[];
  note: string;
};

const PROFILE_COPY: Record<
  StrategyArtworkKind,
  {
    mechanism: string;
    market: string;
    marketNote: string;
    risk: string;
  }
> = {
  gold: {
    mechanism: "趋势与动量确认",
    market: "方向清晰的延续行情",
    marketNote: "通常更依赖趋势持续性与入场位置",
    risk: "横盘反复与高位追价可能增加回撤",
  },
  meanReversion: {
    mechanism: "价格偏离后的均值修复",
    market: "边界清晰的区间行情",
    marketNote: "重点观察偏离幅度、回归节奏与区间有效性",
    risk: "持续单边突破会削弱回归假设",
  },
  breakout: {
    mechanism: "结构突破与快速执行",
    market: "波动扩张与关键区间突破",
    marketNote: "对执行速度、点差与突破有效性更敏感",
    risk: "假突破、滑点与短时点差放大",
  },
  grid: {
    mechanism: "分层挂单与仓位调度",
    market: "区间往返或方向可控的波动",
    marketNote: "需同时核对网格间距、层数与账户承载力",
    risk: "持续单边与仓位累积是核心边界",
  },
  orderflow: {
    mechanism: "流动性层级与执行位置判断",
    market: "成交活跃且结构可辨识的时段",
    marketNote: "更关注供需变化、深度与进出场质量",
    risk: "低流动性、跳价与成交偏差",
  },
  portfolio: {
    mechanism: "多品种信号组合与风险分配",
    market: "跨品种分散单一行情依赖",
    marketNote: "重点查看各子策略的相关性与暴露上限",
    risk: "相关性骤升时可能出现组合暴露叠加",
  },
  intelligence: {
    mechanism: "多条件信号融合与动态筛选",
    market: "信号结构完整、数据连续的环境",
    marketNote: "需先核对训练假设、参数范围与当前版本",
    risk: "参数过拟合与市场环境切换",
  },
  volatility: {
    mechanism: "事件触发与双向波动响应",
    market: "重要数据或波动快速扩张阶段",
    marketNote: "执行结果对方向、时点与成交条件都更敏感",
    risk: "跳空、点差扩张与成交价偏离",
  },
};

function cleanList(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveCadence(timeframe?: string | null) {
  const frames = cleanList(timeframe).map((frame) => frame.toUpperCase());
  const label =
    frames.length > 0 ? frames.slice(0, 3).join(" / ") : "周期待确认";

  if (frames.some((frame) => /^(M1|M5|M15)$/.test(frame))) {
    return { label, note: "短周期执行，对点差、延迟与 VPS 环境更敏感" };
  }
  if (frames.some((frame) => /^(M30|H1|H2|H4)$/.test(frame))) {
    return { label, note: "日内至波段节奏，建议先用默认周期核对参数" };
  }
  if (frames.some((frame) => /^(D1|W1|MN1)$/.test(frame))) {
    return { label, note: "中长周期持仓，需关注隔夜成本与账户承载力" };
  }
  return { label, note: "使用前请以当前版本参数文件为准" };
}

export function resolveStrategyProfile(
  input: StrategyProfileInput,
): StrategyProfile {
  const artwork = resolveStrategyArtwork(input);
  const copy = PROFILE_COPY[artwork.kind];
  const pairs = cleanList(input.pairs);
  const cadence = resolveCadence(input.timeframe);
  const platform = input.platform?.trim().toUpperCase();
  const coverage =
    pairs.length > 0 ? pairs.slice(0, 3).join(" / ") : "品种待确认";
  const platformNote = platform
    ? `${platform} 环境，上线前需核对点差、杠杆和最小手数`
    : "上线前需核对平台、点差、杠杆和最小手数";

  return {
    kind: artwork.kind,
    items: [
      { label: "策略机制", value: copy.mechanism, note: copy.marketNote },
      {
        label: "适用行情",
        value: copy.market,
        note: "建议先用模拟或小仓环境观察实际表现",
      },
      {
        label: "执行节奏",
        value: `${coverage} · ${cadence.label}`,
        note: `${cadence.note}；${platformNote}`,
      },
      {
        label: "关注边界",
        value: copy.risk,
        note: "仓位、止损与最大暴露应按账户情况单独设置",
      },
    ],
    note: "本档案依据页面标签、品种与周期自动整理；具体参数和适用性以当前版本及沟通确认为准。",
  };
}
