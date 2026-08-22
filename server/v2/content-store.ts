import { contentBlockSchema, type ContentBlock, type CoreStrategy } from "../../shared/v2/contracts";
import * as db from "../db";

type PageContentRow = {
  id: number;
  content: string;
  sortOrder: number;
  isVisible: boolean;
};

type StoredContent = {
  block: ContentBlock;
  recordId: number;
  sortOrder: number;
  isVisible: boolean;
};

export type AdminContentItem = {
  recordId: number | null;
  block: ContentBlock;
  sortOrder: number;
  isVisible: boolean;
  isFallback: boolean;
};

export function strategyContentPageKey(strategyId: string) {
  return `v2_strategy_${strategyId}`;
}

export async function getStoredStrategyContent(
  strategyId: string,
): Promise<StoredContent[]> {
  const rows = (await db.getAllPageContents(
    strategyContentPageKey(strategyId),
  )) as PageContentRow[];
  return rows.flatMap((row): StoredContent[] => {
    try {
      const parsed = contentBlockSchema.safeParse(JSON.parse(row.content));
      return parsed.success
        ? [{ block: parsed.data, recordId: row.id, sortOrder: row.sortOrder, isVisible: row.isVisible }]
        : [];
    } catch {
      return [];
    }
  });
}

export async function withStoredStrategyContent(strategy: CoreStrategy) {
  const stored = await getStoredStrategyContent(strategy.id);
  if (!stored.length) return strategy;

  const storedById = new Map(stored.map((item) => [item.block.id, item]));
  const fallbackIds = new Set(strategy.contentBlocks.map((block) => block.id));
  const merged = strategy.contentBlocks.flatMap((fallback, index) => {
    const override = storedById.get(fallback.id);
    if (!override) return [{ block: fallback, sortOrder: index + 1 }];
    return override.isVisible
      ? [{ block: override.block, sortOrder: override.sortOrder }]
      : [];
  });
  stored.forEach((item) => {
    if (!fallbackIds.has(item.block.id) && item.isVisible) {
      merged.push({ block: item.block, sortOrder: item.sortOrder });
    }
  });
  merged.sort((left, right) => left.sortOrder - right.sortOrder);
  return { ...strategy, contentBlocks: merged.map((item) => item.block) };
}

export async function listStrategyContentForAdmin(
  strategy: CoreStrategy,
): Promise<AdminContentItem[]> {
  const stored = await getStoredStrategyContent(strategy.id);
  const storedById = new Map(stored.map((item) => [item.block.id, item]));
  const fallbackIds = new Set(strategy.contentBlocks.map((block) => block.id));
  const merged: AdminContentItem[] = strategy.contentBlocks.map((fallback, index) => {
    const override = storedById.get(fallback.id);
    return override
      ? {
          recordId: override.recordId as number | null,
          block: override.block,
          sortOrder: override.sortOrder,
          isVisible: override.isVisible,
          isFallback: false,
        }
      : {
          recordId: null as number | null,
          block: fallback,
          sortOrder: index + 1,
          isVisible: true,
          isFallback: true,
        };
  });
  stored.forEach((item) => {
    if (!fallbackIds.has(item.block.id)) {
      merged.push({
        recordId: item.recordId,
        block: item.block,
        sortOrder: item.sortOrder,
        isVisible: item.isVisible,
        isFallback: false,
      });
    }
  });
  return merged.sort((left, right) => left.sortOrder - right.sortOrder);
}

export function contentBlockHeading(block: ContentBlock) {
  return block.heading;
}
