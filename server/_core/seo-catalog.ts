import { and, desc, eq } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { getDbForSeo } from "../db";
import type { ListLookup, SeoStrategy, StrategyLookup } from "./seo-render";

/**
 * SEO 专用只读查询适配器。
 *
 * 为什么不直接用 server/db.ts 的 getStrategies / getStrategyById：
 * 1. 它们在 `getDb()` 返回 null（没有 DATABASE_URL / 连接创建失败）时会退回 mock 数据。
 *    mock 对本地开发有用，但如果被当成事实渲染进初始 HTML，就是在给搜索引擎和访客
 *    发布不存在的商品。这里**永远不调用 mock 兜底**：没有真实连接就是 unavailable。
 * 2. `getStrategyById` 没有 status 过滤，草稿 / 已归档的商品也会被查出来。
 *    对外初始 HTML 只允许 `status = 'published'`，其余按「没有这个页面」处理。
 *
 * 三态是对外契约：ok → 200；missing → 404；unavailable → 503。
 * 这个模块只读，不改购买、下载、订单或任何业务接口的语义。
 */

const { strategies } = schema;

/** 对外初始 HTML 只认这一个状态。 */
export const PUBLIC_STATUS = "published";

/**
 * SSR 部署标记。跟着这个模块走，所以只有"真实 DB + published 过滤"的这一版才输出它。
 * 固定字符串，不含环境、版本号以外的任何信息，也不暴露内部路径或凭据。
 * 改动 SSR 数据通道时请一并升版，方便线上回读确认跑的是哪一代。
 */
export const SEO_REVISION = "public-catalog-v3";

/** 只挑初始 HTML 真正用得到的列，不把 downloadUrl 之类的东西带进渲染层。 */
const PUBLIC_COLUMNS = {
  id: strategies.id,
  title: strategies.title,
  description: strategies.description,
  richDescription: strategies.richDescription,
  platform: strategies.platform,
  pairs: strategies.pairs,
  timeframe: strategies.timeframe,
  coverImage: strategies.coverImage,
  price: strategies.price,
  isFree: strategies.isFree,
  saleMode: strategies.saleMode,
  productType: strategies.productType,
  tags: strategies.tags,
  updatedAt: strategies.updatedAt,
} as const;

export type SeoDb = {
  select: (columns?: unknown) => any;
};

/** 默认取真实连接；测试可以注入一个假的 db（或 null 表示没有连接）。 */
export type DbGetter = () => Promise<SeoDb | null>;

const defaultGetter: DbGetter = () => getDbForSeo();

/**
 * 单个商品。必须同时满足：真实连接可用、id 存在、status = published。
 * 少任何一条都不会渲染商品正文。
 */
export async function seoStrategyById(
  id: number,
  getDb: DbGetter = defaultGetter,
): Promise<StrategyLookup> {
  if (!Number.isInteger(id) || id <= 0) return { kind: "missing" };

  let db: SeoDb | null;
  try {
    db = await getDb();
  } catch (error: any) {
    console.error("[SEO] database handle unavailable:", error?.message || error);
    return { kind: "unavailable", reason: "db_handle_failed" };
  }
  /* 没有真实连接就直说读不到，绝不退回 mock 当成真实商品发出去。 */
  if (!db) return { kind: "unavailable", reason: "no_database_connection" };

  try {
    const rows = await db
      .select(PUBLIC_COLUMNS)
      .from(strategies)
      .where(and(eq(strategies.id, id), eq(strategies.status, PUBLIC_STATUS)))
      .limit(1);
    const row = Array.isArray(rows) ? rows[0] : undefined;
    /* 查得到但不是 published，以及根本查不到，对外都是「没有这个页面」。 */
    if (!row) return { kind: "missing" };
    return { kind: "ok", strategy: row as SeoStrategy };
  } catch (error: any) {
    console.error(`[SEO] strategy ${id} query failed:`, error?.message || error);
    return { kind: "unavailable", reason: "query_failed" };
  }
}

/** 首页清单。同样只要 published，且没有真实连接就是 unavailable，不返回空清单假装「没有商品」。 */
export async function seoPublishedList(
  limit = 24,
  getDb: DbGetter = defaultGetter,
): Promise<ListLookup> {
  let db: SeoDb | null;
  try {
    db = await getDb();
  } catch (error: any) {
    console.error("[SEO] database handle unavailable:", error?.message || error);
    return { kind: "unavailable", reason: "db_handle_failed" };
  }
  if (!db) return { kind: "unavailable", reason: "no_database_connection" };

  try {
    const rows = await db
      .select(PUBLIC_COLUMNS)
      .from(strategies)
      .where(eq(strategies.status, PUBLIC_STATUS))
      .orderBy(desc(strategies.isFeatured), desc(strategies.isCurated), desc(strategies.createdAt))
      .limit(limit);
    return { kind: "ok", strategies: (Array.isArray(rows) ? rows : []) as SeoStrategy[] };
  } catch (error: any) {
    console.error("[SEO] published list query failed:", error?.message || error);
    return { kind: "unavailable", reason: "query_failed" };
  }
}
