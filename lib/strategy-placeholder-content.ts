import { resolveStrategyProfile } from "./strategy-profile";
import { resolveStrategyEahubReference } from "./strategy-eahub-reference";

export const STRATEGY_PLACEHOLDER_VERSION = "strategy-placeholder-v1";

export type StrategyPlaceholderInput = {
  title: string;
  description?: string | null;
  platform?: string | null;
  pairs?: string | null;
  timeframe?: string | null;
  tags?: string | null;
  productType?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanText(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function withoutRepeatedTitle(description: string, title: string) {
  if (!description || !title) return description;
  if (!description.toLocaleLowerCase().startsWith(title.toLocaleLowerCase())) {
    return description;
  }
  return description
    .slice(title.length)
    .replace(/^[\s：:，,。.-]+/, "")
    .trim();
}

export function buildStrategyPlaceholderContent(
  input: StrategyPlaceholderInput,
) {
  const profile = resolveStrategyProfile(input);
  const publicReference = resolveStrategyEahubReference(input.title);
  const [mechanism, market, , risk] = profile.items;
  const title = cleanText(input.title) || "当前策略";
  const description = withoutRepeatedTitle(cleanText(input.description), title);
  const overview =
    description ||
    `以${mechanism.value}为主要框架，重点观察${market.value}中的信号质量与持仓节奏。`;
  const positioning = `${mechanism.value}，通常关注${market.value}；主要风险边界为${risk.value}。`;

  const referenceSection = publicReference
    ? [
        "<h3>公开资料摘要</h3>",
        `<p>${escapeHtml(publicReference.summary)}</p>`,
        `<p><strong>版本提示：</strong>参考页可能对应同名或相近版本，本站实际文件、参数与授权范围仍需单独核对。<a href="${publicReference.url}" target="_blank" rel="noopener noreferrer">查看 EAHub 参考页</a></p>`,
      ]
    : [];

  return [
    `<div data-eaxau-content="${STRATEGY_PLACEHOLDER_VERSION}">`,
    "<p><strong>资料状态：</strong>模板说明。以下内容依据现有名称、标签、品种与周期整理，具体版本参数及实测材料仍待后台补充。</p>",
    "<h3>策略概览</h3>",
    `<p>${escapeHtml(overview)}</p>`,
    `<p><strong>定位参考：</strong>${escapeHtml(positioning)}</p>`,
    ...referenceSection,
    "<blockquote>占位说明不代表已完成回测或实盘核验，策略名称与页面展示指标也不构成收益承诺。</blockquote>",
    "</div>",
  ].join("");
}

export function shouldGenerateStrategyPlaceholder(
  richDescription?: string | null,
  description?: string | null,
) {
  const current = cleanText(richDescription);
  if (!current) return true;

  const legacyDescription = (description || "").trim();
  return current === `<p>${legacyDescription}</p>`;
}
