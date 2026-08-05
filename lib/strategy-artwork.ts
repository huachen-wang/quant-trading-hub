export type StrategyArtwork = {
  kind: StrategyArtworkKind;
  image: string;
  label: string;
  shortName: string;
  detail: string;
  accent: string;
  fallback: readonly [string, string, string];
};

export type StrategyArtworkKind = "gold" | "meanReversion" | "breakout" | "grid" | "orderflow" | "portfolio" | "intelligence" | "volatility";

type StrategyArtworkInput = {
  title: string;
  tags?: string | null;
  pairs?: string | null;
  productType?: string | null;
};

type ArtworkBase = Pick<StrategyArtwork, "accent" | "fallback"> & {
  images: readonly string[];
};

const ARTWORK: Record<StrategyArtworkKind, ArtworkBase> = {
  gold: {
    images: ["/strategy-art-v2/gold-momentum.jpg", "/strategy-art/gold-trend.jpg", "/strategy-art/gold-navigation.jpg"],
    accent: "#F4C76B",
    fallback: ["#07101D", "#172033", "#3B2B15"],
  },
  meanReversion: {
    images: ["/strategy-art-v2/mean-reversion.jpg"],
    accent: "#76B8EE",
    fallback: ["#07111D", "#152438", "#332617"],
  },
  breakout: {
    images: ["/strategy-art-v2/breakout-execution.jpg", "/strategy-art/scalping-breakout.jpg", "/strategy-art/execution-engine.jpg"],
    accent: "#6EE7D2",
    fallback: ["#06131C", "#082934", "#12352F"],
  },
  grid: {
    images: ["/strategy-art-v2/grid-control.jpg", "/strategy-art/grid-hedge.jpg"],
    accent: "#8ED8FF",
    fallback: ["#09101F", "#16213B", "#2B2050"],
  },
  orderflow: {
    images: ["/strategy-art-v2/orderflow-depth.jpg"],
    accent: "#79D7F2",
    fallback: ["#07111A", "#102636", "#33201F"],
  },
  portfolio: {
    images: ["/strategy-art-v2/multiasset-network.jpg", "/strategy-art/ai-multiasset.jpg"],
    accent: "#77E2B8",
    fallback: ["#07131A", "#123028", "#272044"],
  },
  intelligence: {
    images: ["/strategy-art-v2/adaptive-signal.jpg"],
    accent: "#B5A2FF",
    fallback: ["#071021", "#132248", "#2B1F55"],
  },
  volatility: {
    images: ["/strategy-art-v2/volatility-prism.jpg"],
    accent: "#FF9A72",
    fallback: ["#0A101B", "#17233A", "#3C1E1A"],
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
  [/waka\s*waka/i, "Waka Waka"],
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
  const matchedRule = SHORT_NAME_RULES.find(([pattern]) => pattern.test(normalized));
  if (matchedRule) return matchedRule[1];

  const localizedAlias = normalized.match(/【\s*([^】]{2,12})\s*】/u)?.[1];
  if (localizedAlias && /\p{Script=Han}/u.test(localizedAlias)) {
    return Array.from(localizedAlias.replace(/\s+/g, "")).slice(0, 7).join("");
  }

  const trailingAlias = normalized.match(/(?:^|[\s_-])([\p{Script=Han}]{2,8})$/u)?.[1];
  if (trailingAlias) {
    return trailingAlias.replace(/(?:中文版|加强版|增强版|最终版)$/g, "").slice(0, 7);
  }

  let cleaned = normalized
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/【[^】]+】/g, " ")
    .replace(/\.(?:ex4|ex5|mq4|mq5|zip)$/i, "")
    .replace(/^eaxau[\s_-]+/i, "")
    .replace(/\b(?:mt4|mt5)\b/gi, " ")
    .replace(/\b(?:v|ver(?:sion)?\s*)\d+(?:[._-]\d+)*\b/gi, " ")
    .replace(/\br\d+(?:[._-]\d+)+\b/gi, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b(?:ea|expert\s+advisor)\b/gi, " ")
    .replace(/(?:中文面板版|中文版|加强版|增强版|强化版|优化版|修复版|高效版|最终版|无限制版|独家调优版)$/g, "")
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
  const genericTail = new Set(["advisor", "edition", "expert", "optimized", "pro", "robot", "scalper", "system", "trader", "trading", "updated"]);
  while (tokens.length > 2 && genericTail.has(tokens[tokens.length - 1].toLowerCase())) {
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

function pickArtwork(kind: StrategyArtworkKind, title: string) {
  const { images, ...appearance } = ARTWORK[kind];
  return {
    kind,
    ...appearance,
    image: images[stableTitleHash(title) % images.length],
  };
}

const GRID_KEYWORDS = ["网格", "对冲", "套利", "双向", "多空", "仓位递进", "马丁", "太极", "grid", "hedge", "martingale", "pair trading", "recovery"];

const EXECUTION_KEYWORDS = ["剥头皮", "头皮", "短线", "突破", "低延迟", "秒单", "scalp", "breakout", "sniper", "single entry"];

const MEAN_REVERSION_KEYWORDS = ["均值回归", "回归", "区间", "震荡", "反转", "mean reversion", "reversion", "range"];

const ORDERFLOW_KEYWORDS = ["订单流", "流动性", "市场深度", "供需", "order flow", "orderflow", "liquidity", "smart money", "smc", "ict"];

const VOLATILITY_KEYWORDS = ["新闻", "事件驱动", "非农", "straddle", "news catcher", "volatility", "fomc", "cpi", "nfp"];

const PORTFOLIO_KEYWORDS = ["多货币", "多策略", "多资产", "数字货币", "组合", "bitcoin", "crypto", "multi asset", "multiasset", "portfolio", "omni"];

const INTELLIGENCE_KEYWORDS = ["智能", "算法", "神经", "深度学习", "自适应", "多条件", "autopilot", "quantum", "adaptive", "machine learning"];

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

function compactDetail(tags: string | null | undefined, pairs: string | null | undefined, excludedTags: readonly string[], productType?: string | null, fallbackTags: readonly [string, string] = ["自动执行", "风险控制"]) {
  const excluded = new Set(excludedTags.map((tag) => tag.toLowerCase()));
  const tagList = (tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => !excluded.has(tag.toLowerCase()))
    .slice(0, 2);

  if (tagList.length === 0) {
    tagList.push(productType === "indicator" ? "信号辅助" : productType === "tool" ? "参数工具" : fallbackTags[0], fallbackTags[1]);
  }

  return `${compactPairs(pairs)} · ${tagList.join(" / ")}`;
}

export function resolveStrategyArtwork({ title, tags, pairs, productType }: StrategyArtworkInput): StrategyArtwork {
  const source = `${title} ${tags || ""} ${pairs || ""}`.normalize("NFKC").toLowerCase();
  const shortName = getStrategyShortName(title);

  if (includesAny(source, VOLATILITY_KEYWORDS)) {
    return {
      ...pickArtwork("volatility", title),
      label: includesAny(source, ["新闻", "news catcher", "非农", "fomc", "cpi", "nfp"]) ? "事件策略" : "波动执行",
      shortName,
      detail: compactDetail(tags, pairs, ["黄金", "白银", "新闻", "事件驱动", "非农", "波动"], productType, ["双向响应", "风险控制"]),
    };
  }

  if (includesAny(source, GRID_KEYWORDS)) {
    const label = includesAny(source, ["网格", "grid"]) ? "网格策略" : includesAny(source, ["仓位递进", "马丁", "martingale"]) ? "仓位系统" : "对冲组合";
    return {
      ...pickArtwork("grid", title),
      label,
      shortName,
      detail: compactDetail(tags, pairs, ["黄金", "白银", "网格", "对冲", "双向", "多空", "马丁"], productType, ["仓位管理", "风险控制"]),
    };
  }

  if (includesAny(source, MEAN_REVERSION_KEYWORDS)) {
    return {
      ...pickArtwork("meanReversion", title),
      label: "均值回归",
      shortName,
      detail: compactDetail(tags, pairs, ["黄金", "白银", "均值回归", "回归", "区间", "震荡", "反转"], productType, ["价差修复", "区间执行"]),
    };
  }

  if (includesAny(source, ORDERFLOW_KEYWORDS)) {
    return {
      ...pickArtwork("orderflow", title),
      label: "订单流策略",
      shortName,
      detail: compactDetail(tags, pairs, ["黄金", "白银", "订单流", "流动性", "市场深度", "供需"], productType, ["深度判断", "执行质量"]),
    };
  }

  if (includesAny(source, EXECUTION_KEYWORDS)) {
    const label = includesAny(source, ["突破", "breakout"]) ? "突破执行" : "短线执行";
    return {
      ...pickArtwork("breakout", title),
      label,
      shortName,
      detail: compactDetail(tags, pairs, ["黄金", "白银", "剥头皮", "头皮", "短线", "突破", "新闻", "事件驱动"], productType, ["快速执行", "风险控制"]),
    };
  }

  if (includesAny(source, PORTFOLIO_KEYWORDS)) {
    const isDigitalAsset = includesAny(source, ["bitcoin", "crypto", "数字货币", "btc"]);
    const label = isDigitalAsset ? "数字资产" : "多资产系统";
    const portfolioArtwork = pickArtwork("portfolio", title);
    return {
      ...portfolioArtwork,
      image: isDigitalAsset ? "/strategy-art-v2/multiasset-network.jpg" : portfolioArtwork.image,
      label,
      shortName,
      detail: compactDetail(tags, pairs, ["AI", "智能", "黄金", "白银", "数字货币", "多资产", "多货币"], productType, ["组合分配", "风险控制"]),
    };
  }

  if (productType === "indicator" || includesAny(source, INTELLIGENCE_KEYWORDS) || /(^|[^a-z])ai([^a-z]|$)/i.test(source)) {
    const label = productType === "indicator" ? "智能指标" : "智能策略";
    return {
      ...pickArtwork("intelligence", title),
      label,
      shortName,
      detail: compactDetail(tags, pairs, ["AI", "智能", "黄金", "白银", "数字货币", "多资产", "多货币", "指标"], productType, ["多条件分析", "风险控制"]),
    };
  }

  const isMetal = includesAny(source, ["xau", "gold", "黄金", "xag", "silver", "白银"]);
  const goldArtwork = pickArtwork("gold", title);
  const image = includesAny(source, ["xag", "silver", "白银"]) ? "/strategy-art-v2/silver-momentum.jpg" : includesAny(source, ["稳健", "低回撤", "防守", "保守"]) ? "/strategy-art-v2/gold-defense.jpg" : goldArtwork.image;
  return {
    ...goldArtwork,
    image,
    label: isMetal ? "黄金趋势" : "趋势策略",
    shortName,
    detail: compactDetail(tags, pairs, ["黄金", "趋势", "白银"], productType, ["动量跟随", "风险控制"]),
  };
}
