import type { Connection } from "mysql2/promise";
import { buildStrategyPlaceholderContent } from "../lib/strategy-placeholder-content";
import { resolveStrategyEahubReference } from "../lib/strategy-eahub-reference";
import { USER_STRATEGY_CATALOG } from "./user-strategy-catalog";

export type CuratedStrategy = {
  title: string;
  description: string;
  platform: "MT4" | "MT5";
  pairs: string;
  timeframe: string;
  coverImage: string | null;
  totalReturn: string;
  maxDrawdown: string;
  sharpeRatio: string;
  winRate: string;
  tags: string;
  sourceName: string;
  sourceUrl: string | null;
  evidenceUrl: string | null;
};

const REFERENCE_STRATEGY_CATALOG: CuratedStrategy[] = [
  {
    title: "Quantum Queen X MT5",
    description:
      "面向黄金的趋势与网格混合策略，根据波动状态调整持仓节奏。参考数据用于初期展示，正式使用前请结合经纪商环境重新回测。",
    platform: "MT5",
    pairs: "XAUUSD",
    timeframe: "M5,M15",
    coverImage: null,
    totalReturn: "86.40",
    maxDrawdown: "14.80",
    sharpeRatio: "2.10",
    winRate: "72.60",
    tags: "黄金,趋势,网格",
    sourceName: "MQL5 Market",
    sourceUrl: "https://www.mql5.com/en/market/product/185687",
    evidenceUrl: "https://niubang.ai/signals/mql5-quantum-queen",
  },
  {
    title: "Quantum King EA",
    description:
      "AUDCAD 短周期自适应网格策略，侧重仓位分层与回撤控制。参数需按账户杠杆、点差和净值单独校准。",
    platform: "MT5",
    pairs: "AUDCAD",
    timeframe: "M5",
    coverImage: null,
    totalReturn: "87.60",
    maxDrawdown: "21.10",
    sharpeRatio: "2.95",
    winRate: "68.00",
    tags: "网格,自适应,澳系",
    sourceName: "MQL5 Market",
    sourceUrl: "https://www.mql5.com/en/market/product/152162",
    evidenceUrl: "https://niubang.ai/signals/mql5-quantum-king",
  },
  {
    title: "Wave Rider EA MT5",
    description:
      "捕捉趋势波段延续的多周期策略，减少震荡区间的无效追单。适合先以低风险参数观察不同交易时段表现。",
    platform: "MT5",
    pairs: "XAUUSD,EURUSD",
    timeframe: "M15,H1",
    coverImage: null,
    totalReturn: "112.40",
    maxDrawdown: "17.60",
    sharpeRatio: "2.28",
    winRate: "70.20",
    tags: "波段,趋势,多周期",
    sourceName: "MQL5 Market",
    sourceUrl: "https://www.mql5.com/en/market/product/165897",
    evidenceUrl: "https://niubang.ai/signals/mql5-wave-rider-ea",
  },
  {
    title: "Scalping Robot Pro MT5",
    description:
      "短周期剥头皮策略，关注流动性、点差和执行速度。建议使用低延迟环境，并设置单日亏损上限。",
    platform: "MT5",
    pairs: "XAUUSD,EURUSD",
    timeframe: "M1,M5",
    coverImage: null,
    totalReturn: "138.60",
    maxDrawdown: "19.80",
    sharpeRatio: "2.36",
    winRate: "73.40",
    tags: "剥头皮,短线,低延迟",
    sourceName: "MQL5 Market",
    sourceUrl: "https://www.mql5.com/en/market/product/149463",
    evidenceUrl: "https://niubang.ai/signals/mql5-scalping-robot-pro",
  },
  {
    title: "Smart Gold Hunter",
    description:
      "黄金趋势确认与回撤入场策略，强调止损纪律和单次风险控制。数据为策略画像参考，后续可在后台替换为自有测试记录。",
    platform: "MT5",
    pairs: "XAUUSD",
    timeframe: "M15,H1",
    coverImage: null,
    totalReturn: "74.80",
    maxDrawdown: "12.40",
    sharpeRatio: "2.14",
    winRate: "64.80",
    tags: "黄金,趋势,止损",
    sourceName: "MQL5 Market",
    sourceUrl: "https://www.mql5.com/en/market/product/170050",
    evidenceUrl: null,
  },
  {
    title: "Lizard MT5",
    description:
      "根据波动与价格结构调整入场密度的多状态策略，适合做组合分散。上线实盘前应先校准最大仓位与熔断条件。",
    platform: "MT5",
    pairs: "XAUUSD,EURUSD,GBPUSD",
    timeframe: "M15,H1",
    coverImage: null,
    totalReturn: "92.30",
    maxDrawdown: "16.70",
    sharpeRatio: "1.92",
    winRate: "61.90",
    tags: "多策略,波动,组合",
    sourceName: "MQL5 Market",
    sourceUrl: "https://www.mql5.com/en/market/product/172541",
    evidenceUrl: "https://www.eahub.cn/thread-200486-1-1.html",
  },
  {
    title: "Range Breakout EA",
    description:
      "识别盘整区间并在有效突破后跟随，适合欧美活跃时段。内置参考过滤逻辑，但仍需针对假突破设置退出规则。",
    platform: "MT5",
    pairs: "EURUSD,GBPUSD,XAUUSD",
    timeframe: "M15,H1",
    coverImage: null,
    totalReturn: "106.50",
    maxDrawdown: "13.50",
    sharpeRatio: "2.35",
    winRate: "58.70",
    tags: "突破,趋势,时段",
    sourceName: "MQL5 Market",
    sourceUrl: "https://www.mql5.com/en/market/product/122237",
    evidenceUrl: null,
  },
  {
    title: "Adaptive Gold Scalper MT5",
    description:
      "依据黄金即时波动调整止盈止损距离的短线策略。对点差与滑点较敏感，建议先在目标账户环境中进行前向测试。",
    platform: "MT5",
    pairs: "XAUUSD",
    timeframe: "M1,M5",
    coverImage: null,
    totalReturn: "124.20",
    maxDrawdown: "18.10",
    sharpeRatio: "2.42",
    winRate: "71.60",
    tags: "黄金,剥头皮,自适应",
    sourceName: "MQL5 Market",
    sourceUrl: "https://www.mql5.com/en/market/product/161554",
    evidenceUrl: null,
  },
  {
    title: "AXIO GOLD EA",
    description:
      "黄金日内趋势与动量组合策略，减少低波动时段交易。参考指标用于内容初筛，不代表未来实盘结果。",
    platform: "MT5",
    pairs: "XAUUSD",
    timeframe: "M5,M15",
    coverImage: null,
    totalReturn: "119.60",
    maxDrawdown: "18.00",
    sharpeRatio: "2.21",
    winRate: "69.80",
    tags: "黄金,动量,日内",
    sourceName: "MQL0 策略目录",
    sourceUrl: "https://www.mql0.com/strategies/axio-gold-m4yzee",
    evidenceUrl: "https://niubang.ai/signals/mql5-axio-gold-ea",
  },
  {
    title: "Precise Pair Trading Pro",
    description:
      "利用相关品种价差偏离与回归构建配对交易，降低单一方向暴露。需持续检查相关性失效和隔夜成本。",
    platform: "MT5",
    pairs: "EURUSD,GBPUSD,AUDUSD,NZDUSD",
    timeframe: "H1,H4",
    coverImage: null,
    totalReturn: "63.40",
    maxDrawdown: "12.30",
    sharpeRatio: "1.88",
    winRate: "66.50",
    tags: "配对,套利,低频",
    sourceName: "MQL0 策略目录",
    sourceUrl:
      "https://www.mql0.com/strategies/precise-pair-trading-pro-0wr00a",
    evidenceUrl: "https://niubang.ai/signals/mql5-precise-pair-trading-pro",
  },
  {
    title: "Smart Owl FX",
    description:
      "面向主要货币对的低频趋势策略，偏重信号质量和风险收益比。适合作为组合中的稳健型候选。",
    platform: "MT4",
    pairs: "EURUSD,GBPUSD,USDJPY",
    timeframe: "H1,H4",
    coverImage: null,
    totalReturn: "71.20",
    maxDrawdown: "11.50",
    sharpeRatio: "2.03",
    winRate: "68.20",
    tags: "趋势,低频,多货币",
    sourceName: "MQL0 策略目录",
    sourceUrl: "https://www.mql0.com/strategies/smart-owl-fx-e3elr7",
    evidenceUrl: "https://niubang.ai/signals/mql5-smart-owl-fx",
  },
  {
    title: "Quantum Athena MT5",
    description:
      "多条件共振的黄金策略，结合趋势方向与波动过滤。适合在后台逐步补齐账户条件、测试周期和证据截图。",
    platform: "MT5",
    pairs: "XAUUSD",
    timeframe: "M15,H1",
    coverImage: null,
    totalReturn: "95.70",
    maxDrawdown: "19.80",
    sharpeRatio: "2.17",
    winRate: "70.10",
    tags: "黄金,共振,波动过滤",
    sourceName: "MQL0 策略目录",
    sourceUrl: "https://www.mql0.com/strategies/quantum-athena-02gk95",
    evidenceUrl: "https://niubang.ai/signals/mql5-quantum-athena",
  },
  {
    title: "ArtQuant Gold v3.2",
    description:
      "黄金对冲型策略画像，强调多方向仓位管理与组合风控。展示数据为参考估算，正式上架前应补充独立回测。",
    platform: "MT5",
    pairs: "XAUUSD",
    timeframe: "M5,M15",
    coverImage: null,
    totalReturn: "88.90",
    maxDrawdown: "15.20",
    sharpeRatio: "2.06",
    winRate: "67.30",
    tags: "黄金,对冲,组合风控",
    sourceName: "MQL0 策略目录",
    sourceUrl: "https://www.mql0.com/strategies/artquant-gold-OK6eEA",
    evidenceUrl: "https://www.mql0.com/strategies/artquant-gold-OK6eEA",
  },
];

export const CURATED_STRATEGY_CATALOG: CuratedStrategy[] = [
  ...REFERENCE_STRATEGY_CATALOG,
  ...USER_STRATEGY_CATALOG,
];

type ExistingCuratedReference = {
  titleLike: string;
  coverImage: string;
  isFeatured?: boolean;
  sourceUrl?: string;
};

const EXISTING_CURATED_REFERENCES: ExistingCuratedReference[] = [
  {
    titleLike: "%金戈铁马%V5.1%",
    coverImage: "/ea-covers-v2/49_Quantum_Dark_Gold.jpg",
    isFeatured: true,
    sourceUrl: "https://www.eahub.cn/thread-201119-1-1.html",
  },
  { titleLike: "%Waka Waka%", coverImage: "/ea-covers-v2/02_Waka_Waka_EA.jpg" },
  {
    titleLike: "%Gold House%",
    coverImage: "/ea-covers-v2/34_Gold_Atlas.jpg",
    sourceUrl: "https://www.eahub.cn/thread-191895-1-1.html",
  },
  {
    titleLike: "%黄金屋%",
    coverImage: "/ea-covers-v2/34_Gold_Atlas.jpg",
    sourceUrl: "https://www.eahub.cn/thread-191895-1-1.html",
  },
  {
    titleLike: "%Mad Turtle%",
    coverImage: "/ea-covers-v2/19_Mad_Turtle_ML.jpg",
  },
  {
    titleLike: "%Aura Black%",
    coverImage: "/ea-covers-v2/06_Aura_Black_Edition.jpg",
  },
  {
    titleLike: "%Quantum Emperor%",
    coverImage: "/ea-covers-v2/01_Quantum_Emperor.jpg",
    sourceUrl: "https://www.eahub.cn/thread-113889-1-1.html",
  },
  {
    titleLike: "%Bitcoin Core%",
    coverImage: "/ea-covers-v2/20_The_Bitcoin_Core.jpg",
  },
  {
    titleLike: "%Night Hunter%",
    coverImage: "/ea-covers-v2/05_Night_Hunter_Pro.jpg",
  },
  {
    titleLike: "%Quantum Queen%",
    coverImage: "/ea-covers-v2/11_Quantum_Queen.jpg",
    sourceUrl: "https://www.eahub.cn/thread-180114-1-1.html",
  },
  {
    titleLike: "%Gold Reaper%",
    coverImage: "/ea-covers-v2/03_The_Gold_Reaper.jpg",
    sourceUrl: "https://www.eahub.cn/thread-186932-1-1.html",
  },
];

const CONTENT_MIGRATION_KEY = "2026-08-06-strategy-content-placeholders-v4";
const EMPTY_FEATURED_PROMO_TITLE = "金戈铁马 正版云控 全网收益第一";
const GENERIC_MQL0_URLS = [
  "https://www.mql0.com/strategies",
  "https://www.mql0.com/strategies/",
  "http://www.mql0.com/strategies",
  "http://www.mql0.com/strategies/",
] as const;
export const JINGE_TIE_MA_TITLE = "金戈铁马 V5.1 永不爆仓版本";

export async function syncCuratedStrategyCatalog(
  connection: Connection,
): Promise<number> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`content_migrations\` (
      \`migrationKey\` varchar(120) NOT NULL PRIMARY KEY,
      \`appliedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [migrationRows] = (await connection.query(
    "SELECT `migrationKey` FROM `content_migrations` WHERE `migrationKey` = ? LIMIT 1",
    [CONTENT_MIGRATION_KEY],
  )) as any[];
  if (migrationRows.length > 0) return 0;

  let changed = 0;

  const [renamedJingeResult] = (await connection.query(
    `UPDATE \`strategies\`
     SET \`title\` = ?
     WHERE \`title\` LIKE '金戈铁马%'
       AND \`title\` LIKE '%V4.3%'`,
    [JINGE_TIE_MA_TITLE],
  )) as any[];
  changed += renamedJingeResult.affectedRows || 0;

  // 当前策略目录统一采用人工确认版本与授权范围的咨询交付方式。
  const [normalizedSaleModeResult] = (await connection.query(
    `UPDATE \`strategies\`
     SET \`saleMode\` = 'inquiry', \`isFree\` = false
     WHERE \`status\` = 'published'
       AND (\`saleMode\` <> 'inquiry' OR \`isFree\` = true)`,
  )) as any[];
  changed += normalizedSaleModeResult.affectedRows || 0;

  // 通用目录地址已经失效。删除旧链接，并只为能精确对应的 Lizard 补入具体参考页。
  const [clearedGenericSourceResult] = (await connection.query(
    `UPDATE \`strategies\`
     SET \`sourceUrl\` = NULL
     WHERE \`sourceUrl\` IN (?, ?, ?, ?)`,
    [...GENERIC_MQL0_URLS],
  )) as any[];
  changed += clearedGenericSourceResult.affectedRows || 0;

  const [repairedGenericEvidenceResult] = (await connection.query(
    `UPDATE \`strategies\`
     SET \`evidenceUrl\` = IF(
       LOWER(\`title\`) LIKE '%lizard%',
       'https://www.eahub.cn/thread-200486-1-1.html',
       NULL
     )
     WHERE \`evidenceUrl\` IN (?, ?, ?, ?)`,
    [...GENERIC_MQL0_URLS],
  )) as any[];
  changed += repairedGenericEvidenceResult.affectedRows || 0;

  // 旧数据中这个置顶条目只是跳转壳。仅当内容仍近乎为空时归档，避免覆盖后台后续补录。
  const [archivedPromoResult] = (await connection.query(
    `UPDATE \`strategies\`
     SET \`status\` = 'archived', \`isFeatured\` = false
     WHERE \`title\` = ?
       AND CHAR_LENGTH(TRIM(COALESCE(\`description\`, ''))) < 30`,
    [EMPTY_FEATURED_PROMO_TITLE],
  )) as any[];
  changed += archivedPromoResult.affectedRows || 0;

  for (const reference of EXISTING_CURATED_REFERENCES) {
    const [result] = (await connection.query(
      `UPDATE \`strategies\`
       SET \`isCurated\` = true,
           \`isFeatured\` = IF(?, true, \`isFeatured\`),
           \`dataStatus\` = IF(\`dataStatus\` = 'verified', 'verified', 'referenced'),
           \`sourceName\` = IF(
             ? IS NOT NULL AND (\`sourceName\` IS NULL OR TRIM(\`sourceName\`) = '' OR \`sourceName\` = '公开策略目录参考'),
             'EAHub 公开参考',
             COALESCE(NULLIF(\`sourceName\`, ''), '公开策略目录参考')
           ),
           \`sourceUrl\` = COALESCE(NULLIF(\`sourceUrl\`, ''), ?),
           \`coverImage\` = ?
       WHERE \`title\` LIKE ?`,
      [
        reference.isFeatured ? 1 : 0,
        reference.sourceUrl || null,
        reference.sourceUrl || null,
        reference.coverImage,
        reference.titleLike,
      ],
    )) as any[];
    changed += result.affectedRows || 0;
  }

  // 只扩充空白详情和旧版单段自动文案，后台人工编辑的富文本不会被覆盖。
  const [sparseContentRows] = (await connection.query(
    `SELECT id, title, description, platform, pairs, timeframe, tags, productType
     FROM strategies
     WHERE status = 'published'
       AND (
         richDescription IS NULL
         OR CHAR_LENGTH(TRIM(richDescription)) = 0
         OR TRIM(richDescription) = CONCAT('<p>', COALESCE(description, ''), '</p>')
       )`,
  )) as any[];

  for (const strategy of sparseContentRows) {
    const richDescription = buildStrategyPlaceholderContent(strategy);
    const [result] = (await connection.query(
      `UPDATE strategies
       SET richDescription = ?
       WHERE id = ?
         AND (
           richDescription IS NULL
           OR CHAR_LENGTH(TRIM(richDescription)) = 0
           OR TRIM(richDescription) = CONCAT('<p>', COALESCE(description, ''), '</p>')
         )`,
      [richDescription, strategy.id],
    )) as any[];
    changed += result.affectedRows || 0;
  }

  for (const strategy of CURATED_STRATEGY_CATALOG) {
    const [existingRows] = (await connection.query(
      "SELECT `id` FROM `strategies` WHERE LOWER(`title`) = LOWER(?) LIMIT 1",
      [strategy.title],
    )) as any[];
    if (existingRows.length > 0) {
      const publicReference = resolveStrategyEahubReference(strategy.title);
      if (publicReference) {
        const [result] = (await connection.query(
          `UPDATE strategies
           SET sourceName = IF(
                 sourceName IS NULL OR TRIM(sourceName) = '' OR sourceName = '用户提供的 EA 文件名录',
                 '用户文件名录 / EAHub 公开参考',
                 sourceName
               ),
               sourceUrl = COALESCE(NULLIF(sourceUrl, ''), ?),
               dataStatus = IF(dataStatus = 'verified', 'verified', 'referenced')
           WHERE id = ?`,
          [publicReference.url, existingRows[0].id],
        )) as any[];
        changed += result.affectedRows || 0;
      }
      continue;
    }

    await connection.query(
      `INSERT INTO \`strategies\` (
        \`title\`, \`description\`, \`platform\`, \`pairs\`, \`timeframe\`, \`coverImage\`,
        \`totalReturn\`, \`maxDrawdown\`, \`sharpeRatio\`, \`winRate\`,
        \`downloadUrl\`, \`price\`, \`isFree\`, \`downloadCount\`, \`productType\`, \`tags\`,
        \`saleMode\`, \`richDescription\`, \`galleryImages\`, \`isFeatured\`, \`isCurated\`,
        \`dataStatus\`, \`sourceName\`, \`sourceUrl\`, \`evidenceUrl\`,
        \`virtualSubscribers\`, \`virtualDownloads\`, \`viewCount\`, \`status\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '0.00', false, 0, 'ea', ?, 'inquiry', ?, NULL, false, true, 'referenced', ?, ?, ?, 0, 0, 0, 'published')`,
      [
        strategy.title,
        strategy.description,
        strategy.platform,
        strategy.pairs,
        strategy.timeframe,
        strategy.coverImage,
        strategy.totalReturn,
        strategy.maxDrawdown,
        strategy.sharpeRatio,
        strategy.winRate,
        strategy.tags,
        buildStrategyPlaceholderContent(strategy),
        strategy.sourceName,
        strategy.sourceUrl,
        strategy.evidenceUrl,
      ],
    );
    changed++;
  }

  await connection.query(
    "INSERT INTO `content_migrations` (`migrationKey`) VALUES (?)",
    [CONTENT_MIGRATION_KEY],
  );
  return changed;
}
