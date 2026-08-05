export type SearchableAdminStrategy = {
  id?: number | string;
  title?: string | null;
  description?: string | null;
  platform?: string | null;
  productType?: string | null;
  pairs?: string | null;
  timeframe?: string | null;
  tags?: string | null;
  status?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  published: "已发布",
  draft: "草稿",
  archived: "已归档",
};

function normalizeSearchValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

export function filterAdminStrategies<T extends SearchableAdminStrategy>(
  strategies: T[],
  query: string,
): T[] {
  const terms = normalizeSearchValue(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return strategies;

  return strategies.filter((strategy) => {
    const status = normalizeSearchValue(strategy.status);
    const searchableText = [
      strategy.id,
      strategy.id == null ? "" : `#${strategy.id}`,
      strategy.title,
      strategy.description,
      strategy.platform,
      strategy.productType,
      strategy.pairs,
      strategy.timeframe,
      strategy.tags,
      strategy.status,
      STATUS_LABELS[status],
    ]
      .map(normalizeSearchValue)
      .join(" ");

    return terms.every((term) => searchableText.includes(term));
  });
}
