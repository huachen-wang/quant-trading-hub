export type StrategyArtwork = {
  image: string;
  label: string;
  shortName: string;
  detail: string;
  accent: string;
  fallback: readonly [string, string, string];
};

type StrategyArtworkInput = {
  title: string;
  tags?: string | null;
  pairs?: string | null;
  productType?: string | null;
};

type ArtworkKind = "gold" | "execution" | "control" | "intelligence";
type ArtworkBase = Pick<StrategyArtwork, "accent" | "fallback"> & {
  images: readonly string[];
};

const ARTWORK: Record<ArtworkKind, ArtworkBase> = {
  gold: {
    images: [
      "/strategy-art/gold-trend.jpg",
      "/strategy-art/gold-navigation.jpg",
    ],
    accent: "#F4C76B",
    fallback: ["#07101D", "#172033", "#3B2B15"],
  },
  execution: {
    images: [
      "/strategy-art/scalping-breakout.jpg",
      "/strategy-art/execution-engine.jpg",
    ],
    accent: "#6EE7D2",
    fallback: ["#06131C", "#082934", "#12352F"],
  },
  control: {
    images: ["/strategy-art/grid-hedge.jpg"],
    accent: "#8ED8FF",
    fallback: ["#09101F", "#16213B", "#2B2050"],
  },
  intelligence: {
    images: ["/strategy-art/ai-multiasset.jpg"],
    accent: "#B5A2FF",
    fallback: ["#071021", "#132248", "#2B1F55"],
  },
} as const;

const SHORT_NAME_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/金戈铁马/i, "金戈铁马"],
  [/量子女王/i, "量子女王"],
  [/蓝狗对冲/i, "蓝狗对冲"],
  [/星宇新十环/i, "星宇新十环"],
  [/乌雪.*小箱体/i, "乌雪小箱体"],
  [/九转金龙/i, "九转金龙"],
  [/黄金极限/i, "黄金极限"],
  [/阿拉丁神灯/i, "阿拉丁神灯"],
  [/太极之眼/i, "太极之眼"],
  [/金蝉揽月/i, "金蝉揽月"],
  [/金凤凰/i, "金凤凰"],
  [/金箍棒/i, "金箍棒"],
  [/金麒麟/i, "金麒麟"],
  [/吞金兽/i, "吞金兽"],
  [/盈洲麒麟/i, "盈洲麒麟"],
  [/中德四维/i, "中德四维"],
  [/财神一次一单/i, "财神"],
  [/方策量化/i, "方策量化"],
  [/恒鑫.*量化/i, "恒鑫量化"],
  [/金猪/i, "金猪"],
  [/名刀.*网格/i, "名刀网格"],
  [/莫奈灰/i, "莫奈灰"],
  [/神马丁/i, "神马丁"],
  [/宇川/i, "宇川"],
  [/多货币网格/i, "多货币网格"],
  [/欧美剥头皮/i, "欧美剥头皮"],
  [/ai\s*深度学习/i, "AI 深度学习"],
  [/ai\s*gen/i, "AI Gen"],
  [/supertrend/i, "SuperTrend"],
  [/pro\s+gold\s+lion/i, "Gold Lion"],
  [/quantum\s+queen/i, "Quantum Queen"],
  [/quantum\s+king/i, "Quantum King"],
  [/the\s+buster/i, "The Buster"],
  [/twisterpro/i, "TwisterPro"],
  [/v4\s+grid\s+bot/i, "V4 Grid Bot"],
  [/e?axau\s+r3\.61/i, "EAXAU R3.61"],
];

export function getStrategyShortName(title: string) {
  const normalized = title.normalize("NFKC").trim();
  const matchedRule = SHORT_NAME_RULES.find(([pattern]) =>
    pattern.test(normalized),
  );
  if (matchedRule) return matchedRule[1];

  let cleaned = normalized
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\.(?:ex4|ex5|mq4|mq5|zip)$/i, "")
    .replace(/^eaxau[\s_-]+/i, "")
    .replace(/\b(?:mt4|mt5)\b/gi, " ")
    .replace(/\b(?:v|ver(?:sion)?\s*)\d+(?:[._-]\d+)*\b/gi, " ")
    .replace(/\br\d+(?:[._-]\d+)+\b/gi, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b(?:ea|expert\s+advisor)\b/gi, " ")
    .replace(
      /(?:中文面板版|中文版|加强版|增强版|强化版|优化版|修复版|高效版|最终版|无限制版|独家调优版)$/g,
      "",
    )
    .replace(/[\s_-]+/g, " ")
    .trim();

  if (!cleaned) return "策略精选";

  if (/\p{Script=Han}/u.test(cleaned)) {
    cleaned = cleaned
      .replace(/(?:交易机器人|交易系统|量化系统)$/g, "")
      .replace(/(?:Updated|Optimized|Pro)$/i, "")
      .replace(/\s+/g, "")
      .trim();
    return Array.from(cleaned).slice(0, 7).join("");
  }

  const tokens = cleaned.split(" ").filter(Boolean);
  const genericTail = new Set([
    "advisor",
    "edition",
    "expert",
    "optimized",
    "pro",
    "robot",
    "scalper",
    "system",
    "trader",
    "trading",
    "updated",
  ]);
  while (
    tokens.length > 2 &&
    genericTail.has(tokens[tokens.length - 1].toLowerCase())
  ) {
    tokens.pop();
  }

  const selected: string[] = [];
  for (const token of tokens.slice(0, 3)) {
    const next = [...selected, token].join(" ");
    if (selected.length > 0 && next.length > 18) break;
    selected.push(token);
  }

  return (selected.join(" ") || cleaned).slice(0, 18);
}

function stableTitleHash(title: string) {
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickArtwork(kind: ArtworkKind, title: string) {
  const { images, ...appearance } = ARTWORK[kind];
  return {
    ...appearance,
    image: images[stableTitleHash(title) % images.length],
  };
}

const GRID_KEYWORDS = [
  "网格",
  "对冲",
  "套利",
  "双向",
  "多空",
  "仓位递进",
  "马丁",
  "太极",
  "grid",
  "hedge",
  "martingale",
  "pair trading",
  "recovery",
];

const EXECUTION_KEYWORDS = [
  "剥头皮",
  "头皮",
  "短线",
  "突破",
  "低延迟",
  "秒单",
  "新闻",
  "事件驱动",
  "scalp",
  "breakout",
  "sniper",
  "straddle",
  "news catcher",
  "single entry",
];

const INTELLIGENCE_KEYWORDS = [
  "智能",
  "算法",
  "神经",
  "深度学习",
  "多货币",
  "多策略",
  "多资产",
  "数字货币",
  "组合",
  "autopilot",
  "quantum",
  "bitcoin",
  "crypto",
  "multi asset",
  "multiasset",
  "portfolio",
  "omni",
];

function includesAny(source: string, keywords: readonly string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function compactPairs(pairs?: string | null) {
  if (!pairs || /^(multiple|multi asset)$/i.test(pairs.trim())) return "多品种";

  const symbols = pairs
    .split(",")
    .map((pair) => pair.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) return "多品种";
  if (symbols.length === 1) return symbols[0];
  if (symbols.length === 2) return symbols.join(" / ");
  return `${symbols[0]} +${symbols.length - 1}`;
}

function compactDetail(
  tags: string | null | undefined,
  pairs: string | null | undefined,
  excludedTags: readonly string[],
  productType?: string | null,
  fallbackTags: readonly [string, string] = ["自动执行", "风险控制"],
) {
  const excluded = new Set(excludedTags.map((tag) => tag.toLowerCase()));
  const tagList = (tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => !excluded.has(tag.toLowerCase()))
    .slice(0, 2);

  if (tagList.length === 0) {
    tagList.push(
      productType === "indicator"
        ? "信号辅助"
        : productType === "tool"
          ? "参数工具"
          : fallbackTags[0],
      fallbackTags[1],
    );
  }

  return `${compactPairs(pairs)} · ${tagList.join(" / ")}`;
}

export function resolveStrategyArtwork({
  title,
  tags,
  pairs,
  productType,
}: StrategyArtworkInput): StrategyArtwork {
  const source = `${title} ${tags || ""} ${pairs || ""}`
    .normalize("NFKC")
    .toLowerCase();
  const shortName = getStrategyShortName(title);

  if (includesAny(source, GRID_KEYWORDS)) {
    const label = includesAny(source, ["网格", "grid"])
      ? "网格策略"
      : includesAny(source, ["仓位递进", "马丁", "martingale"])
        ? "仓位系统"
        : "对冲组合";
    return {
      ...pickArtwork("control", title),
      label,
      shortName,
      detail: compactDetail(
        tags,
        pairs,
        ["黄金", "白银", "网格", "对冲", "双向", "多空", "马丁"],
        productType,
        ["仓位管理", "风险控制"],
      ),
    };
  }

  if (includesAny(source, EXECUTION_KEYWORDS)) {
    const label = includesAny(source, ["突破", "breakout"])
      ? "突破执行"
      : includesAny(source, ["新闻", "事件驱动", "news catcher"])
        ? "事件策略"
        : "短线执行";
    return {
      ...pickArtwork("execution", title),
      label,
      shortName,
      detail: compactDetail(
        tags,
        pairs,
        ["黄金", "白银", "剥头皮", "头皮", "短线", "突破", "新闻", "事件驱动"],
        productType,
        ["快速执行", "风险控制"],
      ),
    };
  }

  if (
    productType === "indicator" ||
    includesAny(source, INTELLIGENCE_KEYWORDS) ||
    /(^|[^a-z])ai([^a-z]|$)/i.test(source)
  ) {
    const label = includesAny(source, ["bitcoin", "crypto", "数字货币", "btc"])
      ? "数字资产"
      : includesAny(source, [
            "多货币",
            "多资产",
            "multi asset",
            "multiasset",
            "portfolio",
          ])
        ? "多资产系统"
        : productType === "indicator"
          ? "智能指标"
          : "智能策略";
    return {
      ...pickArtwork("intelligence", title),
      label,
      shortName,
      detail: compactDetail(
        tags,
        pairs,
        ["AI", "智能", "黄金", "白银", "数字货币", "多资产", "多货币", "指标"],
        productType,
        ["多条件分析", "风险控制"],
      ),
    };
  }

  const isMetal = includesAny(source, [
    "xau",
    "gold",
    "黄金",
    "xag",
    "silver",
    "白银",
  ]);
  return {
    ...pickArtwork("gold", title),
    label: isMetal ? "黄金趋势" : "趋势策略",
    shortName,
    detail: compactDetail(tags, pairs, ["黄金", "趋势", "白银"], productType, [
      "动量跟随",
      "风险控制",
    ]),
  };
}
