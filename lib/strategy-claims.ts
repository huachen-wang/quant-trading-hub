/**
 * 对外可证据性：把"未核验的参考数据"和"已核验的事实"在文案与数字上分开。
 *
 * 背景：置顶商品的标题由 server/strategy-catalog.ts 主动 UPDATE 成
 * "金戈铁马 V5.1 永不爆仓版本"，同一条记录 winRate=100.00 且 dataStatus='referenced'
 * （即公开资料参考，未经我们核验）。卡片与详情都把这些数字当既成事实直接渲染，
 * sourceName / sourceUrl / dataStatus 在卡片上完全不出现。
 *
 * 这里只做展示层判定，不改数据库里的历史数值，也不用 0 去顶替"未知"。
 */

export type DataStatus = "estimated" | "referenced" | "verified" | null | undefined;

/** 无法用现有材料支持的绝对化说法。命中即从对外标题/描述里摘掉。 */
export const UNEVIDENCED_CLAIM_PATTERNS: RegExp[] = [
  /永不爆仓(版本)?/g,
  /不爆仓(版本)?/g,
  /零爆仓/g,
  /全网(收益)?第一/g,
  /收益第一/g,
  /稳赚(不赔)?/g,
  /稳定盈利/g,
  /保本/g,
  /零回撤/g,
  /无回撤/g,
  /百分百(盈利|胜率)?/g,
  /100%\s*(胜率|盈利|盈利率)/g,
  /躺赚/g,
  /一夜暴富/g,
];

export function hasUnevidencedClaim(value?: string | null) {
  const text = (value || "").trim();
  if (!text) return false;
  return UNEVIDENCED_CLAIM_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/**
 * 摘掉绝对化说法，保留版本号（V5.1）、商品名与其余信息。
 * 只删说法，不改版本、不改编号、不动其它商品的正常文案。
 */
export function stripUnevidencedClaims(value?: string | null) {
  let text = (value || "").trim();
  if (!text) return "";
  for (const pattern of UNEVIDENCED_CLAIM_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, " ");
  }
  return text
    .replace(/[·、，,]\s*(?=[·、，,]|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s·、，,-]+|[\s·、，,-]+$/g, "")
    .trim();
}

export type VerifyStatus = {
  key: "verified" | "referenced" | "unverified";
  /** 卡片上的短标签 */
  short: string;
  /** 详情页上的完整标签 */
  label: string;
  tone: "success" | "primary" | "warning";
};

export function resolveVerifyStatus(dataStatus: DataStatus): VerifyStatus {
  if (dataStatus === "verified") {
    return { key: "verified", short: "已核验", label: "已核验数据", tone: "success" };
  }
  if (dataStatus === "referenced") {
    return { key: "referenced", short: "参考", label: "公开资料参考 · 待核验", tone: "primary" };
  }
  return { key: "unverified", short: "待核验", label: "未核验 · 待补材料", tone: "warning" };
}

export type MetricKind = "winRate" | "maxDrawdown" | "totalReturn" | "sharpeRatio";

export type MetricDisplay = {
  /** 直接渲染的字符串；未知或不可作为事实展示时是 "—"，绝不用 0 顶替 */
  display: string;
  /** 是否为未核验的参考数字，调用方据此加"参考"标记 */
  isReference: boolean;
  /** 数字本身被压下（未知，或该值等同于一个无法证明的承诺） */
  suppressed: boolean;
};

const UNKNOWN = "—";

function parseMetric(value: unknown) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

/**
 * 未核验的参考数据里，"胜率 100%"和"最大回撤 0"本身就是一句无法证明的承诺
 * （从不亏 / 从不回撤），所以不渲染具体数字，只显示未知并要求补材料。
 * 其余参考数字照常显示，但带"参考"标记。已核验数据按原样显示。
 */
export function resolveMetricDisplay(
  value: unknown,
  kind: MetricKind,
  dataStatus: DataStatus,
  suffix = "%",
): MetricDisplay {
  const num = parseMetric(value);
  if (num === null) return { display: UNKNOWN, isReference: false, suppressed: true };

  const verified = dataStatus === "verified";
  if (!verified) {
    const impliesPromise =
      (kind === "winRate" && num >= 100) || (kind === "maxDrawdown" && num <= 0);
    if (impliesPromise) return { display: UNKNOWN, isReference: true, suppressed: true };
  }

  return {
    display: `${String(value).trim()}${suffix}`,
    isReference: !verified,
    suppressed: false,
  };
}

/** 来源链接只允许 http / https 跳转，挡掉 javascript: data: 之类。 */
export function safeExternalUrl(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return undefined;
  if (!/^https?:\/\//i.test(raw)) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : undefined;
  } catch {
    return undefined;
  }
}
