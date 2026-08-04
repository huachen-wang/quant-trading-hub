const COVER_ROOT = "/ea-covers-v2";

const DYNAMIC_PLACEHOLDER_TITLES = new Set([
  "quantumqueenxmt5",
  "quantumkingea",
  "waveridereamt5",
  "scalpingrobotpromt5",
  "smartgoldhunter",
  "lizardmt5",
  "rangebreakoutea",
  "adaptivegoldscalpermt5",
  "axiogoldea",
  "precisepairtradingpro",
  "smartowlfx",
  "quantumathenamt5",
  "artquantgoldv32",
]);

type CoverRule = {
  keywords: string[];
  file: string;
};

const COVER_RULES: CoverRule[] = [
  { keywords: ["金戈铁马"], file: "49_Quantum_Dark_Gold.jpg" },
  { keywords: ["wakawaka"], file: "02_Waka_Waka_EA.jpg" },
  { keywords: ["ai外汇机器人"], file: "36_AI_Forex_Robot.jpg" },
  { keywords: ["goldhouse", "黄金屋"], file: "34_Gold_Atlas.jpg" },
  { keywords: ["apache", "炼金术士"], file: "12_Karat_Killer.jpg" },
  { keywords: ["虚空之门"], file: "14_The_Gold_Phantom.jpg" },
  { keywords: ["turboai"], file: "45_AI_Scalper_Pro.jpg" },
  { keywords: ["黄金m1动态跟随"], file: "30_GOLD_Scalper_PRO.jpg" },
  { keywords: ["黄金猎手", "smartgoldhunter"], file: "13_AI_Gold_Sniper.jpg" },
  { keywords: ["上帝之手"], file: "24_AI_Gold_Prime.jpg" },
  { keywords: ["ai黄金狙击"], file: "13_AI_Gold_Sniper.jpg" },
  { keywords: ["黄金毁灭"], file: "25_EA_Gold_Stuff.jpg" },
  { keywords: ["手工军械"], file: "33_The_ORB_Master.jpg" },
  { keywords: ["金财神"], file: "15_Golden_Hen_EA.jpg" },
  { keywords: ["至尊手工单"], file: "47_Advanced_Sniper_Pro.jpg" },
  { keywords: ["atas", "订单流"], file: "27_Big_Forex_Players.jpg" },
  { keywords: ["mt4多核"], file: "50_HTTP_Multi_Asset_EA.jpg" },
  { keywords: ["mt5一次一单"], file: "46_AW_Swing_Trading_EA.jpg" },
  { keywords: ["超级黄金"], file: "43_SuperTrend_EA_32.jpg" },
  { keywords: ["madturtle"], file: "19_Mad_Turtle_ML.jpg" },
  { keywords: ["aurablack"], file: "06_Aura_Black_Edition.jpg" },
  { keywords: ["quantumemperor"], file: "01_Quantum_Emperor.jpg" },
  { keywords: ["bitcoincore"], file: "20_The_Bitcoin_Core.jpg" },
  { keywords: ["刷单王"], file: "42_刷单王EA_Holy_Grail.jpg" },
  { keywords: ["nighthunter"], file: "05_Night_Hunter_Pro.jpg" },
  { keywords: ["quantumqueen"], file: "11_Quantum_Queen.jpg" },
  { keywords: ["goldreaper"], file: "03_The_Gold_Reaper.jpg" },
  { keywords: ["实盘秒单"], file: "44_Hero_Gold_Scalp_V3.jpg" },
  { keywords: ["quantumking"], file: "18_Quantum_King_EA.jpg" },
  { keywords: ["waverider"], file: "21_Zenox_AI_Swing.jpg" },
  { keywords: ["scalpingrobot"], file: "30_GOLD_Scalper_PRO.jpg" },
  { keywords: ["lizard"], file: "24_AI_Gold_Prime.jpg" },
  { keywords: ["rangebreakout"], file: "22_Ultimate_Breakout_System.jpg" },
  { keywords: ["adaptivegoldscalper"], file: "41_Javier_Gold_Scalper.jpg" },
  { keywords: ["axiogold"], file: "37_EA_Gold_Algo.jpg" },
  { keywords: ["precisepair"], file: "26_ORIX_GBPUSD.jpg" },
  { keywords: ["smartowl"], file: "35_Stability_Killer_AI.jpg" },
  { keywords: ["quantumathena"], file: "49_Quantum_Dark_Gold.jpg" },
  { keywords: ["artquant"], file: "40_Goldex_AI_Neural.jpg" },
];

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
}

export function getLocalStrategyCover(title: string): string | null {
  const normalizedTitle = normalizeTitle(title);
  const match = COVER_RULES.find((rule) =>
    rule.keywords.some((keyword) =>
      normalizedTitle.includes(normalizeTitle(keyword)),
    ),
  );

  return match ? `${COVER_ROOT}/${match.file}` : null;
}

export function resolveStrategyCover(
  title: string,
  fallback?: string | null,
): string | null {
  if (!fallback && DYNAMIC_PLACEHOLDER_TITLES.has(normalizeTitle(title)))
    return null;
  if (fallback && !/files\.manuscdn\.com|images\.unsplash\.com/i.test(fallback))
    return fallback;
  return getLocalStrategyCover(title) || fallback || null;
}
