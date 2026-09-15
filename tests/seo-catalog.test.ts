import { describe, expect, it, vi } from "vitest";
import { seoPublishedList, seoStrategyById, PUBLIC_STATUS } from "../server/_core/seo-catalog";

/**
 * 假 drizzle 链。记录 where 里真的带了哪些条件，用来断言「published 过滤真的发出去了」，
 * 而不是只断言返回值。
 */
function fakeDb(rows: any[], opts: { throwOn?: "select" } = {}) {
  const calls: any = { whereArgs: [], limit: null, selected: null };
  const chain: any = {
    select(columns: any) {
      if (opts.throwOn === "select") throw new Error("ECONNREFUSED 10.0.0.1:3306");
      calls.selected = columns;
      return chain;
    },
    from() {
      return chain;
    },
    where(cond: any) {
      calls.whereArgs.push(cond);
      return chain;
    },
    orderBy() {
      return chain;
    },
    limit(n: number) {
      calls.limit = n;
      return Promise.resolve(rows);
    },
  };
  return { db: chain, calls };
}

/**
 * drizzle 的条件对象是有环的（column -> table -> column），JSON.stringify 会炸。
 * 这里带 seen 集合遍历，把里面出现过的标量收集成一个可搜索的字符串，
 * 够用来断言 status / id 真的进了 SQL 条件。
 */
function condText(cond: any): string {
  const seen = new Set<any>();
  const out: string[] = [];
  const walk = (node: any) => {
    if (node === null || node === undefined) return;
    if (typeof node !== "object") {
      out.push(String(node));
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);
    for (const value of Array.isArray(node) ? node : Object.values(node)) walk(value);
  };
  walk(cond);
  return out.join("|");
}

const PUBLISHED_ROW = {
  id: 98,
  title: "Sharkyra Gold v1.2",
  description: "Sharkyra Gold v1.2 面向黄金日内波动，组合方向判断、入场过滤与风险约束。",
  platform: "MT5",
  pairs: "XAUUSD",
  timeframe: "M5,M15",
  price: "0.00",
  saleMode: "inquiry",
  productType: "ea",
};

describe("SEO 查询适配器：没有真实连接时绝不拿 mock 当事实", () => {
  it("getDb 返回 null（没有 DATABASE_URL）→ unavailable，不是 ok、也不是 missing", async () => {
    const one = await seoStrategyById(1, async () => null);
    expect(one.kind).toBe("unavailable");
    expect(one).not.toHaveProperty("strategy");

    const list = await seoPublishedList(24, async () => null);
    expect(list.kind).toBe("unavailable");
    /* 关键：不能退成「ok + 空数组」，那等于对外宣布这个站没有商品 */
    expect(list).not.toHaveProperty("strategies");
  });

  it("拿连接本身抛错 → unavailable", async () => {
    const got = await seoStrategyById(1, async () => {
      throw new Error("pool exploded");
    });
    expect(got.kind).toBe("unavailable");
  });

  it("查询抛错 → unavailable，不降级成 404", async () => {
    const { db } = fakeDb([], { throwOn: "select" });
    expect((await seoStrategyById(98, async () => db)).kind).toBe("unavailable");
    expect((await seoPublishedList(24, async () => db)).kind).toBe("unavailable");
  });
});

describe("SEO 查询适配器：只放行 published", () => {
  it("商品查询条件里带上了 published 与 id", async () => {
    const { db, calls } = fakeDb([PUBLISHED_ROW]);
    const got = await seoStrategyById(98, async () => db);
    expect(got.kind).toBe("ok");
    const text = condText(calls.whereArgs);
    expect(text).toContain(PUBLIC_STATUS);
    expect(text).toContain("98");
    expect(calls.limit).toBe(1);
  });

  it("草稿 / 已归档：过滤后查不到 → missing（404），不会输出商品正文", async () => {
    /* status 过滤发生在 SQL 里，所以非 published 的表现就是 0 行 */
    const { db } = fakeDb([]);
    const got = await seoStrategyById(77, async () => db);
    expect(got.kind).toBe("missing");
  });

  it("首页清单同样只查 published", async () => {
    const { db, calls } = fakeDb([PUBLISHED_ROW]);
    const got = await seoPublishedList(24, async () => db);
    expect(got.kind).toBe("ok");
    expect(condText(calls.whereArgs)).toContain(PUBLIC_STATUS);
    expect(calls.limit).toBe(24);
  });

  it("只选公开列，不把 downloadUrl / downloadPassword 带进渲染层", async () => {
    const { db, calls } = fakeDb([PUBLISHED_ROW]);
    await seoStrategyById(98, async () => db);
    const cols = Object.keys(calls.selected ?? {});
    expect(cols).toContain("title");
    expect(cols).toContain("platform");
    for (const secret of ["downloadUrl", "downloadPassword", "telegramGroup", "qqGroup"]) {
      expect(cols).not.toContain(secret);
    }
    /* 业绩与虚拟数字根本不查出来，渲染层想写也没有 */
    for (const metric of ["totalReturn", "maxDrawdown", "sharpeRatio", "winRate", "virtualSubscribers", "virtualDownloads"]) {
      expect(cols).not.toContain(metric);
    }
  });

  it("非法 id（负数 / 非整数）直接 missing，不去查库", async () => {
    const probe = vi.fn(async () => null);
    expect((await seoStrategyById(-1, probe)).kind).toBe("missing");
    expect((await seoStrategyById(0, probe)).kind).toBe("missing");
    expect((await seoStrategyById(Number.NaN, probe)).kind).toBe("missing");
    expect(probe).not.toHaveBeenCalled();
  });
});
