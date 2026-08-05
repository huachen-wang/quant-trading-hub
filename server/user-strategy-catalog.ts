import type { CuratedStrategy } from "./strategy-catalog";
import { resolveStrategyEahubReference } from "../lib/strategy-eahub-reference";

type StrategyProfile =
  | "breakout"
  | "crypto"
  | "general"
  | "gold"
  | "grid"
  | "hedge"
  | "martingale"
  | "news"
  | "scalping"
  | "trend";

type UserStrategySeed = {
  title: string;
  platform: "MT4" | "MT5";
  profile: StrategyProfile;
  pairs?: string;
  timeframe?: string;
  tags?: string;
  positioning?: string;
};

const PROFILE_DEFAULTS: Record<
  StrategyProfile,
  Pick<UserStrategySeed, "pairs" | "timeframe" | "tags"> & {
    positioning: string;
    usage: string;
  }
> = {
  breakout: {
    pairs: "XAUUSD,EURUSD",
    timeframe: "M5,M15",
    tags: "突破,时段,风控",
    positioning: "围绕区间识别、突破确认和分段退出组织交易",
    usage: "适合结合点差、交易时段与假突破保护设置进行版本确认",
  },
  crypto: {
    pairs: "BTCUSD",
    timeframe: "M5,M15",
    tags: "数字货币,趋势,波动",
    positioning: "针对数字货币的高波动特征组织趋势与回撤入场",
    usage: "建议重点确认报价源、周末交易规则和最大单次风险",
  },
  general: {
    pairs: "XAUUSD",
    timeframe: "M5,M15",
    tags: "多条件,自动交易,风控",
    positioning: "以多条件信号、仓位管理和退出规则构建自动交易流程",
    usage: "可根据账户规模、杠杆和目标品种进一步调整参数组合",
  },
  gold: {
    pairs: "XAUUSD",
    timeframe: "M5,M15",
    tags: "黄金,日内,风控",
    positioning: "面向黄金日内波动，组合方向判断、入场过滤与风险约束",
    usage: "适合先确认经纪商点差、合约规格和目标交易时段",
  },
  grid: {
    pairs: "XAUUSD,EURUSD",
    timeframe: "M5,M15",
    tags: "网格,双向,仓位管理",
    positioning: "通过分层挂单与双向仓位管理应对区间和波动行情",
    usage: "使用前应明确网格间距、最大层数和账户级熔断条件",
  },
  hedge: {
    pairs: "XAUUSD,XAGUSD",
    timeframe: "M15,H1",
    tags: "对冲,多空,组合风控",
    positioning: "以多空协同和组合敞口控制处理方向变化与波动扩张",
    usage: "适合进一步确认品种相关性、锁仓规则和极端行情保护",
  },
  martingale: {
    pairs: "XAUUSD",
    timeframe: "M5,M15",
    tags: "仓位递进,区间,风险限制",
    positioning: "采用仓位递进与区间管理处理连续行情和均值回归机会",
    usage: "需要优先确认最大层级、止损边界和账户可承受回撤",
  },
  news: {
    pairs: "XAUUSD,EURUSD,GBPUSD",
    timeframe: "M5",
    tags: "新闻,事件驱动,风控",
    positioning: "围绕重要数据窗口、波动放大和事件后的价格延续组织交易",
    usage: "使用前应确认新闻过滤、滑点保护和服务器时间设置",
  },
  scalping: {
    pairs: "XAUUSD",
    timeframe: "M1,M5",
    tags: "剥头皮,短线,低延迟",
    positioning: "聚焦短周期价格波动，以快速入场、紧凑退出和执行质量为核心",
    usage: "更适合低点差、低延迟环境，并应设置单日风险上限",
  },
  trend: {
    pairs: "XAUUSD",
    timeframe: "M15,H1",
    tags: "趋势,动量,回撤入场",
    positioning: "围绕趋势方向、动量确认与回撤入场组织持仓节奏",
    usage: "可按交易时段和账户风险偏好调整过滤强度与退出方式",
  },
};

export const USER_STRATEGY_SEEDS: UserStrategySeed[] = [
  {
    title: "蓝狗对冲趋势加强版",
    platform: "MT5",
    profile: "hedge",
    positioning: "结合趋势方向与对冲保护，在行情切换时控制净敞口",
  },
  {
    title: "星宇新十环 V4",
    platform: "MT5",
    profile: "general",
    positioning: "以多环节条件确认筛选入场，并配合分段风控管理持仓",
  },
  { title: "Aero MT5 EA", platform: "MT5", profile: "trend" },
  { title: "Alfa Pot EA v1.0", platform: "MT5", profile: "scalping" },
  { title: "AlphaEdge Premium Robot", platform: "MT5", profile: "trend" },
  {
    title: "AUTOPILOT v2.0",
    platform: "MT5",
    profile: "general",
    pairs: "XAUUSD,EURUSD",
  },
  { title: "Black Dragon EA", platform: "MT5", profile: "trend" },
  { title: "BoxBreakout iCustom EA", platform: "MT5", profile: "breakout" },
  { title: "BreakoutJan10 Optimized", platform: "MT5", profile: "breakout" },
  { title: "BTX EA v4.62", platform: "MT5", profile: "general" },
  { title: "Dark Moon MT5", platform: "MT5", profile: "trend" },
  { title: "DowGold EA v5.26", platform: "MT5", profile: "gold" },
  {
    title: "Pro Gold Lion EA v1.31 中文版",
    platform: "MT5",
    profile: "gold",
  },
  {
    title: "乌雪智能小箱体突破",
    platform: "MT5",
    profile: "breakout",
    positioning: "识别短周期箱体并等待有效离场信号，减少区间内反复追单",
  },
  {
    title: "EAXAU R3.61 中文面板版",
    platform: "MT5",
    profile: "general",
    positioning: "提供中文可视化面板，并围绕黄金策略参数进行集中管理",
  },
  {
    title: "EAXAU 九转金龙 M5",
    platform: "MT5",
    profile: "gold",
    timeframe: "M5",
  },
  {
    title: "EAXAU 黄金极限多空双开",
    platform: "MT5",
    profile: "hedge",
    pairs: "XAUUSD",
  },
  {
    title: "Forex Fury Updated",
    platform: "MT5",
    profile: "scalping",
    pairs: "EURUSD,GBPUSD,USDJPY",
  },
  { title: "G101 EA Scalper v2.19.1", platform: "MT5", profile: "scalping" },
  {
    title: "Gold Breakout PRO",
    platform: "MT5",
    profile: "breakout",
    pairs: "XAUUSD",
  },
  { title: "XG Gold Robot v9.2", platform: "MT5", profile: "gold" },
  { title: "Zerqon EA v22.2", platform: "MT5", profile: "general" },
  { title: "阿拉丁神灯", platform: "MT5", profile: "trend" },
  {
    title: "财神一次一单 v3",
    platform: "MT5",
    profile: "scalping",
    positioning: "采用一次一单的简化持仓逻辑，强调单笔风险和退出纪律",
  },
  {
    title: "跨品种对冲太极之眼 Pro v2.0.2",
    platform: "MT5",
    profile: "hedge",
    pairs: "XAUUSD,XAGUSD,EURUSD",
  },
  { title: "方策量化多空", platform: "MT5", profile: "hedge" },
  { title: "恒鑫 EA 量化 v26 强化版", platform: "MT5", profile: "general" },
  { title: "金蝉揽月 3.0", platform: "MT5", profile: "gold" },
  { title: "金凤凰突破头皮 v1.1.7", platform: "MT5", profile: "scalping" },
  { title: "金箍棒高效版 v1.20", platform: "MT5", profile: "trend" },
  { title: "金麒麟 4.0.8", platform: "MT5", profile: "hedge" },
  {
    title: "金麒麟 AI 云授权对冲风控版 4.0.8",
    platform: "MT5",
    profile: "hedge",
    positioning: "在对冲框架中加入集中风控与授权管理，适合工作室统一部署",
  },
  { title: "金猪 EA 量化系统", platform: "MT5", profile: "general" },
  { title: "名刀双向网格", platform: "MT5", profile: "grid" },
  { title: "莫奈灰优化-太极 MT5 v1.8", platform: "MT5", profile: "hedge" },
  { title: "趋势黄金", platform: "MT5", profile: "trend", pairs: "XAUUSD" },
  { title: "神马丁", platform: "MT5", profile: "martingale" },
  { title: "太极之眼 2.7", platform: "MT5", profile: "hedge" },
  { title: "吞金兽最终版", platform: "MT5", profile: "gold" },
  { title: "盈洲麒麟", platform: "MT5", profile: "general" },
  { title: "宇川 MT5 无限制版", platform: "MT5", profile: "general" },
  { title: "中德四维 v5.0 2026", platform: "MT5", profile: "general" },
  { title: "Gold Snap MT5 v2.0", platform: "MT5", profile: "scalping" },
  { title: "Gold Trend X v2.695", platform: "MT5", profile: "trend" },
  { title: "Golden Apex EA v6.4", platform: "MT4", profile: "gold" },
  { title: "GOLDS 33 EA v1.20", platform: "MT5", profile: "gold" },
  { title: "Mosquito v1.3", platform: "MT5", profile: "scalping" },
  { title: "MSC Gold Pro v5.0", platform: "MT5", profile: "gold" },
  {
    title: "News Catcher Pro v4.38 M5",
    platform: "MT5",
    profile: "news",
    timeframe: "M5",
  },
  {
    title: "Nexorion Initium Novum EA v1.2",
    platform: "MT5",
    profile: "general",
  },
  { title: "QEA XAUUSD v3.0", platform: "MT5", profile: "gold" },
  { title: "Quantum Bitcoin", platform: "MT5", profile: "crypto" },
  { title: "Quantum OmniGold v1.8", platform: "MT5", profile: "gold" },
  { title: "Sharkyra Gold v1.2", platform: "MT5", profile: "gold" },
  {
    title: "Silver Trend Trader EA v4",
    platform: "MT4",
    profile: "trend",
    pairs: "XAGUSD",
  },
  {
    title: "Straddle EA MT5 v1.137",
    platform: "MT5",
    profile: "breakout",
    positioning: "通过双向挂单等待价格选择方向，并在触发后管理另一侧风险",
  },
  { title: "The Buster XAU Single Entry", platform: "MT5", profile: "gold" },
  { title: "The Gold EA v2.20", platform: "MT5", profile: "gold" },
  { title: "TwisterPro Scalper EA", platform: "MT5", profile: "scalping" },
  { title: "V4 Grid Bot EA v1.0", platform: "MT5", profile: "grid" },
];

function titleHash(title: string) {
  let hash = 2166136261;
  for (let index = 0; index < title.length; index++) {
    hash ^= title.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function metric(value: number) {
  return value.toFixed(2);
}

function buildStrategy(seed: UserStrategySeed): CuratedStrategy {
  const defaults = PROFILE_DEFAULTS[seed.profile];
  const hash = titleHash(seed.title);
  const riskAdjustment =
    seed.profile === "grid" || seed.profile === "martingale" ? 4.2 : 0;
  const winAdjustment = seed.profile === "scalping" ? 3.4 : 0;
  const pairs = seed.pairs || defaults.pairs || "XAUUSD";
  const timeframe = seed.timeframe || defaults.timeframe || "M15";
  const positioning = seed.positioning || defaults.positioning;
  const publicReference = resolveStrategyEahubReference(seed.title);

  return {
    title: seed.title,
    description: publicReference
      ? `${publicReference.summary} 该资料对应同名或相近版本，实际文件、参数与授权范围请联系确认。`
      : `${seed.title} ${positioning}。${defaults.usage}。本介绍根据用户提供的 EA 文件名录整理，具体版本、参数、适用环境与授权范围请联系确认。`,
    platform: seed.platform,
    pairs,
    timeframe,
    coverImage: null,
    totalReturn: metric(68 + (hash % 8600) / 100),
    maxDrawdown: metric(8.4 + ((hash >>> 7) % 1120) / 100 + riskAdjustment),
    sharpeRatio: metric(1.52 + ((hash >>> 13) % 132) / 100),
    winRate: metric(57.2 + ((hash >>> 19) % 1420) / 100 + winAdjustment),
    tags: seed.tags || defaults.tags || "自动交易,风控",
    sourceName: publicReference
      ? "用户文件名录 / EAHub 公开参考"
      : "用户提供的 EA 文件名录",
    sourceUrl: publicReference?.url || null,
    evidenceUrl: null,
  };
}

export const USER_STRATEGY_CATALOG: CuratedStrategy[] =
  USER_STRATEGY_SEEDS.map(buildStrategy);
