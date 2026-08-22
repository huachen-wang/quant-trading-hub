import type {
  AllocationDraft,
  CoreStrategy,
  EquityPoint,
  PlatformProfile,
  ServiceAccount,
  SourceMeta,
  V2Overview,
} from "../../shared/v2/contracts";

const DAY_MS = 86_400_000;
const STRATEGY_GALLERY_ASSETS = [
  "/strategy-art-v2/gold-momentum.jpg",
  "/strategy-art-v2/breakout-execution.jpg",
  "/strategy-art-v2/adaptive-signal.jpg",
  "/strategy-art-v2/volatility-prism.jpg",
  "/strategy-art-v2/orderflow-depth.jpg",
  "/strategy-art-v2/multiasset-network.jpg",
  "/strategy-art-v2/gold-defense.jpg",
  "/strategy-art-v2/grid-control.jpg",
  "/strategy-art-v2/mean-reversion.jpg",
  "/strategy-art-v2/silver-momentum.jpg",
];

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function isoAtOffset(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
}

function source(
  freshness: SourceMeta["freshness"] = "FRESH",
  hoursAgo = 0.03,
): SourceMeta {
  const observedAt = isoAtOffset(hoursAgo);
  return {
    provider: "eaxau-demo-provider",
    label: "EAXAU 模拟数据",
    observedAt,
    receivedAt: isoAtOffset(Math.max(0, hoursAgo - 0.01)),
    freshness,
    dataMode: "DEMO",
    delaySeconds: Math.round(hoursAgo * 3_600),
  };
}

export function createEquitySeries(
  seed: number,
  startBalance: number,
  points = 60,
): EquityPoint[] {
  const end = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  let balance = startBalance;

  return Array.from({ length: points }, (_, index) => {
    const trend = 0.00072 + seed * 0.000035;
    const cycle = Math.sin((index + seed * 1.9) * 0.58) * 0.0038;
    const pulse = Math.cos((index + seed) * 0.21) * 0.0017;
    balance *= 1 + trend + cycle + pulse;
    const equity = balance * (1 + Math.sin((index + seed) * 0.83) * 0.0024);
    return {
      timestamp: new Date(end - (points - index - 1) * DAY_MS).toISOString(),
      balance: round(balance),
      equity: round(equity),
    };
  });
}

type StrategySeed = Omit<
  CoreStrategy,
  "equity" | "positions" | "recentTrades" | "contentBlocks" | "source"
> & {
  seed: number;
  freshness?: SourceMeta["freshness"];
};

function buildStrategy(input: StrategySeed): CoreStrategy {
  const equity = createEquitySeries(input.seed, input.metrics.balance ?? 10_000);
  const symbol = input.instruments[0] || "XAUUSD";
  const direction = input.seed % 2 === 0 ? "BUY" : "SELL";
  const basePrice = symbol === "BTCUSD" ? 116_240 : symbol === "EURUSD" ? 1.1624 : 3_342.6;
  const currentPrice = basePrice * (direction === "BUY" ? 1.0021 : 0.9984);
  const freshness = input.freshness ?? "FRESH";
  const galleryImages = [...new Set([
    input.artwork,
    STRATEGY_GALLERY_ASSETS[(input.seed * 2 + 3) % STRATEGY_GALLERY_ASSETS.length],
    STRATEGY_GALLERY_ASSETS[(input.seed * 3 + 5) % STRATEGY_GALLERY_ASSETS.length],
    STRATEGY_GALLERY_ASSETS[(input.seed * 5 + 1) % STRATEGY_GALLERY_ASSETS.length],
  ])].slice(0, 3);

  return {
    ...input,
    equity,
    positions:
      freshness === "OFFLINE"
        ? []
        : [
            {
              id: `${input.id}-position-1`,
              symbol,
              side: direction,
              volume: input.riskLevel === "HIGH" ? 0.18 : 0.08,
              openPrice: round(basePrice, symbol === "EURUSD" ? 5 : 2),
              currentPrice: round(currentPrice, symbol === "EURUSD" ? 5 : 2),
              floatingPnl: round((input.metrics.floatingPnl ?? 0) * 0.72),
              openedAt: isoAtOffset(3 + input.seed),
            },
          ],
    recentTrades: [
      {
        id: `${input.id}-trade-1`,
        symbol,
        side: direction,
        volume: input.riskLevel === "HIGH" ? 0.16 : 0.06,
        openPrice: round(basePrice * 0.997, symbol === "EURUSD" ? 5 : 2),
        closePrice: round(basePrice * 1.001, symbol === "EURUSD" ? 5 : 2),
        pnl: round(38 + input.seed * 11.4),
        openedAt: isoAtOffset(30 + input.seed),
        closedAt: isoAtOffset(24 + input.seed),
      },
      {
        id: `${input.id}-trade-2`,
        symbol,
        side: direction === "BUY" ? "SELL" : "BUY",
        volume: 0.05,
        openPrice: round(basePrice * 1.003, symbol === "EURUSD" ? 5 : 2),
        closePrice: round(basePrice * 1.0015, symbol === "EURUSD" ? 5 : 2),
        pnl: round(-12 - input.seed * 2.7),
        openedAt: isoAtOffset(58 + input.seed),
        closedAt: isoAtOffset(52 + input.seed),
      },
    ],
    contentBlocks: [
      {
        id: `${input.id}-overview`,
        type: "rich_text",
        heading: "策略逻辑",
        paragraphs: [
          `${input.name}围绕${input.style}建立信号、执行与退出规则，当前页面用于展示策略结构和模拟数据接入方式。`,
          `首批观察品种为${input.instruments.join("、")}。正式启用前仍需按平台点差、交易时段与账户资金重新校准参数。`,
        ],
        bullets: [
          `建议资金门槛：${input.minimumCapital.toLocaleString("zh-CN")} USD`,
          `风险级别：${input.riskLevel === "LOW" ? "低" : input.riskLevel === "MEDIUM" ? "中" : "高"}`,
          `兼容终端：${input.terminals.join(" / ")}`,
        ],
      },
      {
        id: `${input.id}-evidence`,
        type: "evidence",
        heading: "说明与证据",
        items: [
          {
            title: "净值数据链路",
            detail: "当前为确定性模拟曲线；接入 Quant Data Core 后替换为带来源签名的账户快照。",
            status: "DEMO",
            observedAt: source(freshness).observedAt,
          },
          {
            title: "版本与参数核验",
            detail: `${input.version} 参数清单等待运营上传，发布前需完成兼容平台复核。`,
            status: "PENDING",
          },
        ],
      },
      {
        id: `${input.id}-gallery`,
        type: "media_gallery",
        heading: "策略资料",
        items: galleryImages.map((url, index) => ({
          id: `${input.id}-gallery-media-${index + 1}`,
          title: ["策略视觉", "执行结构", "风险观察"][index] ?? `资料 ${index + 1}`,
          caption: [
            `${input.shortName}的视觉识别与核心交易场景。`,
            `用于说明${input.style}的信号与执行关系。`,
            "当前为展示占位，后续可替换为实盘截图、参数说明或核验材料。",
          ][index] ?? "策略展示资料。",
          thumbnailUrl: url,
          fullUrl: url,
          alt: `${input.shortName} ${["策略视觉", "执行结构", "风险观察"][index] ?? "资料"}`,
        })),
      },
      {
        id: `${input.id}-timeline`,
        type: "timeline",
        heading: "观察进度",
        items: [
          {
            date: "阶段 01",
            title: "历史样本整理",
            detail: "统一交易品种、时区、成本口径与异常订单标记。",
          },
          {
            date: "阶段 02",
            title: "模拟接入",
            detail: "验证页面状态、曲线刷新、账户映射和风险提示。",
          },
          {
            date: "阶段 03",
            title: "实盘审核",
            detail: "绑定可核验数据源后才允许将状态切换为 LIVE。",
          },
        ],
      },
      {
        id: `${input.id}-risk`,
        type: "risk_notice",
        heading: "风险边界",
        content:
          "任何历史收益、胜率和回撤都不能代表未来结果。杠杆、流动性、滑点、平台规则和参数偏离均可能造成超出模型的损失。",
      },
      {
        id: `${input.id}-faq`,
        type: "faq",
        heading: "常见问题",
        items: [
          {
            question: "可以直接连接真实账户吗？",
            answer: "当前预览只生成方案与接入步骤，不下单、不自动调仓。正式连接需完成账户授权与风险确认。",
          },
          {
            question: "页面里的收益是真实收益吗？",
            answer: "不是。带 DEMO 标识的数据用于产品评审；只有绑定并核验数据源后才会显示 LIVE。",
          },
        ],
      },
    ],
    source: source(freshness, freshness === "STALE" ? 18 : freshness === "OFFLINE" ? 72 : 0.03 + input.seed * 0.01),
  };
}

export const DEMO_STRATEGIES: CoreStrategy[] = [
  buildStrategy({
    id: "jingge-v51",
    homeSlot: 1,
    name: "金戈铁马 V5.1",
    shortName: "金戈铁马",
    version: "V5.1 风险约束版",
    tagline: "黄金趋势 · 动态风险预算",
    description: "趋势确认后分段建立仓位，并用账户级风险预算限制单次暴露。",
    style: "黄金趋势与回撤控制",
    instruments: ["XAUUSD"],
    terminals: ["MT5"],
    riskLevel: "MEDIUM",
    riskScore: 3,
    accent: "#E8C46A",
    artwork: "/strategy-art-v2/gold-momentum.jpg",
    minimumCapital: 5_000,
    metrics: {
      return30dPct: 4.86,
      return90dPct: 13.72,
      totalReturnPct: 46.28,
      todayPnlPct: 0.42,
      maxDrawdownPct: 8.4,
      winRatePct: 67.8,
      tradeCount: 184,
      avgHoldingMinutes: 214,
      balance: 24_820,
      equity: 24_934,
      floatingPnl: 114,
    },
    compatiblePlatformIds: ["atlas-prime", "meridian", "vertex"],
    seed: 1,
  }),
  buildStrategy({
    id: "night-hunter",
    homeSlot: 2,
    name: "Night Hunter Pro",
    shortName: "夜间猎手",
    version: "R3.8",
    tagline: "夜盘波动 · 短周期执行",
    description: "聚焦欧美交叉时段的短周期波动，强调成交质量和快速退出。",
    style: "夜盘短线执行",
    instruments: ["EURUSD", "GBPUSD"],
    terminals: ["MT4", "MT5"],
    riskLevel: "MEDIUM",
    riskScore: 3,
    accent: "#55D6C2",
    artwork: "/strategy-art-v2/breakout-execution.jpg",
    minimumCapital: 3_000,
    metrics: {
      return30dPct: 3.42,
      return90dPct: 10.18,
      totalReturnPct: 31.6,
      todayPnlPct: -0.18,
      maxDrawdownPct: 6.9,
      winRatePct: 71.4,
      tradeCount: 246,
      avgHoldingMinutes: 46,
      balance: 18_740,
      equity: 18_706,
      floatingPnl: -34,
    },
    compatiblePlatformIds: ["atlas-prime", "meridian"],
    seed: 2,
  }),
  buildStrategy({
    id: "quantum-queen",
    homeSlot: 3,
    name: "Quantum Queen X",
    shortName: "量子女王",
    version: "V4.3",
    tagline: "多条件信号 · 组合过滤",
    description: "以多周期条件过滤建立组合信号，减少单一指标造成的追涨杀跌。",
    style: "多条件自适应",
    instruments: ["XAUUSD", "GBPUSD"],
    terminals: ["MT5"],
    riskLevel: "LOW",
    riskScore: 2,
    accent: "#A995FF",
    artwork: "/strategy-art-v2/adaptive-signal.jpg",
    minimumCapital: 8_000,
    metrics: {
      return30dPct: 2.78,
      return90dPct: 8.64,
      totalReturnPct: 24.92,
      todayPnlPct: 0.12,
      maxDrawdownPct: 4.7,
      winRatePct: 63.2,
      tradeCount: 122,
      avgHoldingMinutes: 382,
      balance: 32_480,
      equity: 32_519,
      floatingPnl: 39,
    },
    compatiblePlatformIds: ["meridian", "vertex"],
    seed: 3,
  }),
  buildStrategy({
    id: "gold-reaper",
    homeSlot: 4,
    name: "The Gold Reaper",
    shortName: "黄金收割者",
    version: "V4.5",
    tagline: "关键价位 · 突破跟随",
    description: "等待关键结构确认后参与突破行情，并使用时间退出减少隔夜暴露。",
    style: "黄金突破跟随",
    instruments: ["XAUUSD"],
    terminals: ["MT4", "MT5"],
    riskLevel: "HIGH",
    riskScore: 4,
    accent: "#F08A65",
    artwork: "/strategy-art-v2/volatility-prism.jpg",
    minimumCapital: 4_000,
    metrics: {
      return30dPct: 6.24,
      return90dPct: 17.32,
      totalReturnPct: 52.14,
      todayPnlPct: 0.86,
      maxDrawdownPct: 12.8,
      winRatePct: 59.7,
      tradeCount: 198,
      avgHoldingMinutes: 138,
      balance: 21_360,
      equity: 21_544,
      floatingPnl: 184,
    },
    compatiblePlatformIds: ["atlas-prime", "vertex"],
    seed: 4,
  }),
  buildStrategy({
    id: "black-aura",
    homeSlot: 5,
    name: "Aura Black Edition",
    shortName: "黑曜王者",
    version: "V2.6",
    tagline: "订单流结构 · 波动过滤",
    description: "根据流动性结构与波动阈值筛选机会，侧重趋势延续阶段。",
    style: "订单流与结构突破",
    instruments: ["XAUUSD", "EURUSD"],
    terminals: ["MT5"],
    riskLevel: "MEDIUM",
    riskScore: 3,
    accent: "#64CFF3",
    artwork: "/strategy-art-v2/orderflow-depth.jpg",
    minimumCapital: 6_000,
    metrics: {
      return30dPct: 3.98,
      return90dPct: 11.46,
      totalReturnPct: 35.84,
      todayPnlPct: 0,
      maxDrawdownPct: 7.6,
      winRatePct: 65.1,
      tradeCount: 156,
      avgHoldingMinutes: 196,
      balance: 27_120,
      equity: 27_120,
      floatingPnl: 0,
    },
    compatiblePlatformIds: ["atlas-prime", "meridian", "vertex"],
    freshness: "STALE",
    seed: 5,
  }),
  buildStrategy({
    id: "bitcoin-core",
    homeSlot: 6,
    name: "Bitcoin Core Quant",
    shortName: "比特币核心",
    version: "V1.9",
    tagline: "数字资产 · 波动分层",
    description: "对数字资产高波动区间进行分层响应，保留独立的风险预算。",
    style: "数字资产波动管理",
    instruments: ["BTCUSD"],
    terminals: ["MT5"],
    riskLevel: "HIGH",
    riskScore: 5,
    accent: "#43D3A2",
    artwork: "/strategy-art-v2/multiasset-network.jpg",
    minimumCapital: 10_000,
    metrics: {
      return30dPct: null,
      return90dPct: null,
      totalReturnPct: 18.24,
      todayPnlPct: null,
      maxDrawdownPct: 15.2,
      winRatePct: 57.8,
      tradeCount: 88,
      avgHoldingMinutes: 426,
      balance: 16_820,
      equity: null,
      floatingPnl: null,
    },
    compatiblePlatformIds: ["vertex"],
    freshness: "OFFLINE",
    seed: 6,
  }),
];

export const DEMO_PLATFORMS: PlatformProfile[] = [
  {
    id: "atlas-prime",
    name: "Atlas Prime",
    code: "ATP",
    entity: "演示平台 A",
    regionLabel: "可用地区待核验",
    terminals: ["MT4", "MT5"],
    minimumCapital: 3_000,
    accountType: "Raw Spread",
    summary: "偏重低延迟执行与黄金短线适配。",
    supportedStrategyIds: ["jingge-v51", "night-hunter", "gold-reaper", "black-aura"],
    commercialTerms: {
      version: "DEMO-ATP-2026.08",
      effectiveFrom: "2026-08-01",
      spreadLabel: "XAUUSD 模拟中位 16 点",
      commissionLabel: "模拟 7 USD / 手",
      rebateLabel: "规则待商务确认",
      rebateEligibility: "开户链接、地区与交易量均需核验",
      withdrawalP50Hours: 9,
      withdrawalP95Hours: 28,
      withdrawalSampleSize: 36,
      executionLatencyMs: 84,
      slippagePoints: 1.8,
    },
    source: source(),
  },
  {
    id: "meridian",
    name: "Meridian Markets",
    code: "MDN",
    entity: "演示平台 B",
    regionLabel: "可用地区待核验",
    terminals: ["MT4", "MT5"],
    minimumCapital: 5_000,
    accountType: "ECN Pro",
    summary: "偏重多品种覆盖与稳定成本结构。",
    supportedStrategyIds: ["jingge-v51", "night-hunter", "quantum-queen", "black-aura"],
    commercialTerms: {
      version: "DEMO-MDN-2026.08",
      effectiveFrom: "2026-08-01",
      spreadLabel: "主要品种模拟中位 11 点",
      commissionLabel: "模拟 6 USD / 手",
      rebateLabel: "分级规则待确认",
      rebateEligibility: "按账户类型与月度交易量核验",
      withdrawalP50Hours: 13,
      withdrawalP95Hours: 42,
      withdrawalSampleSize: 51,
      executionLatencyMs: 106,
      slippagePoints: 1.2,
    },
    source: source(),
  },
  {
    id: "vertex",
    name: "Vertex Capital",
    code: "VTX",
    entity: "演示平台 C",
    regionLabel: "可用地区待核验",
    terminals: ["MT5"],
    minimumCapital: 8_000,
    accountType: "Multi Asset",
    summary: "偏重 MT5、多资产和独立风险桶。",
    supportedStrategyIds: ["jingge-v51", "quantum-queen", "gold-reaper", "black-aura", "bitcoin-core"],
    commercialTerms: {
      version: "DEMO-VTX-2026.08",
      effectiveFrom: "2026-08-01",
      spreadLabel: "多资产成本按品种核验",
      commissionLabel: "模拟 5.5 USD / 手",
      rebateLabel: "组合账户方案待确认",
      rebateEligibility: "仅适用于指定账户实体",
      withdrawalP50Hours: 18,
      withdrawalP95Hours: 56,
      withdrawalSampleSize: 29,
      executionLatencyMs: 92,
      slippagePoints: 1.5,
    },
    source: source("STALE", 18),
  },
];

export const DEFAULT_ALLOCATION: AllocationDraft = {
  id: "demo-allocation-balanced",
  version: 1,
  mode: "SELF_ALLOCATED",
  source: "RECOMMENDED",
  capital: { amount: "50000", currency: "USD" },
  riskBudget: { profile: "MEDIUM", maxDrawdownPct: 12 },
  platformBuckets: [
    {
      platformId: "atlas-prime",
      capitalWeightPct: 45,
      strategies: [
        { strategyId: "jingge-v51", weightPct: 60, riskMultiplier: 1 },
        { strategyId: "night-hunter", weightPct: 40, riskMultiplier: 0.8 },
      ],
    },
    {
      platformId: "meridian",
      capitalWeightPct: 35,
      strategies: [
        { strategyId: "quantum-queen", weightPct: 55, riskMultiplier: 0.8 },
        { strategyId: "black-aura", weightPct: 45, riskMultiplier: 0.9 },
      ],
    },
    {
      platformId: "vertex",
      capitalWeightPct: 20,
      strategies: [
        { strategyId: "gold-reaper", weightPct: 100, riskMultiplier: 0.55 },
      ],
    },
  ],
  dataMode: "DEMO",
};

export const DEMO_ACCOUNTS: ServiceAccount[] = [
  {
    id: "managed-demo-01",
    name: "签约管理观察账户",
    serviceMode: "MANAGED_CONTRACT",
    contractStatus: "ACTIVE",
    platformIds: ["meridian"],
    strategyIds: ["jingge-v51", "quantum-queen"],
    currency: "USD",
    balance: 52_840,
    equity: 53_192,
    floatingPnl: 352,
    todayPnl: 184,
    totalPnl: 3_192,
    totalPnlPct: 6.38,
    maxDrawdownPct: 5.4,
    connectionStatus: "CONNECTED",
    equitySeries: createEquitySeries(8, 48_000, 90),
    positions: DEMO_STRATEGIES[0].positions,
    recentTrades: DEMO_STRATEGIES[2].recentTrades,
    allocation: null,
    source: source(),
  },
  {
    id: "self-demo-01",
    name: "自主分仓演示账户",
    serviceMode: "SELF_ALLOCATED",
    contractStatus: "NONE",
    platformIds: ["atlas-prime", "meridian", "vertex"],
    strategyIds: ["jingge-v51", "night-hunter", "quantum-queen", "black-aura", "gold-reaper"],
    currency: "USD",
    balance: 50_000,
    equity: 51_194,
    floatingPnl: 126,
    todayPnl: -42,
    totalPnl: 1_194,
    totalPnlPct: 2.39,
    maxDrawdownPct: 3.8,
    connectionStatus: "DEGRADED",
    equitySeries: createEquitySeries(11, 47_500, 90),
    positions: [...DEMO_STRATEGIES[1].positions, ...DEMO_STRATEGIES[3].positions],
    recentTrades: [...DEMO_STRATEGIES[0].recentTrades, ...DEMO_STRATEGIES[4].recentTrades],
    allocation: DEFAULT_ALLOCATION,
    source: source("STALE", 1.2),
  },
];

function aggregateEquity(strategies: CoreStrategy[]): EquityPoint[] {
  const pointCount = Math.min(...strategies.map((strategy) => strategy.equity.length));
  return Array.from({ length: pointCount }, (_, index) => {
    const rows = strategies.map((strategy) => strategy.equity[index]);
    return {
      timestamp: rows[0].timestamp,
      balance: round(rows.reduce((sum, row) => sum + row.balance, 0)),
      equity: round(rows.reduce((sum, row) => sum + row.equity, 0)),
    };
  });
}

export function createDemoOverview(): V2Overview {
  const active = DEMO_STRATEGIES.filter((strategy) => strategy.source.freshness !== "OFFLINE");
  const balance = active.reduce((sum, strategy) => sum + (strategy.metrics.balance ?? 0), 0);
  const equity = active.reduce((sum, strategy) => sum + (strategy.metrics.equity ?? strategy.metrics.balance ?? 0), 0);

  return {
    headline: "六策略量化组合",
    subheadline: "先看运行状态，再按平台、资金和风险完成可解释分仓。",
    portfolio: {
      balance: round(balance),
      equity: round(equity),
      todayPnlPct: 0.28,
      return90dPct: 12.26,
      maxDrawdownPct: 8.92,
      activeStrategies: active.length,
      equitySeries: aggregateEquity(active),
    },
    strategies: DEMO_STRATEGIES,
    platforms: DEMO_PLATFORMS,
    source: source(),
  };
}
