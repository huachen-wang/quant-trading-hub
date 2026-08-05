import { describe, expect, it, vi } from "vitest";
import {
  CURATED_STRATEGY_CATALOG,
  JINGE_TIE_MA_TITLE,
  syncCuratedStrategyCatalog,
} from "./strategy-catalog";
import {
  USER_STRATEGY_CATALOG,
  USER_STRATEGY_SEEDS,
} from "./user-strategy-catalog";

describe("curated strategy catalog", () => {
  it("contains unique, editable strategy records", () => {
    const titles = CURATED_STRATEGY_CATALOG.map((strategy) =>
      strategy.title.toLowerCase(),
    );
    expect(new Set(titles).size).toBe(titles.length);
    expect(CURATED_STRATEGY_CATALOG.length).toBeGreaterThanOrEqual(70);
  });

  it("uses generated covers and only valid optional HTTPS sources", () => {
    for (const strategy of CURATED_STRATEGY_CATALOG) {
      expect(strategy.coverImage).toBeNull();
      if (strategy.sourceUrl) expect(strategy.sourceUrl).toMatch(/^https:\/\//);
      if (strategy.evidenceUrl)
        expect(strategy.evidenceUrl).toMatch(/^https:\/\//);
      expect(strategy.sourceUrl).not.toBe("https://www.mql0.com/strategies");
      expect(strategy.evidenceUrl).not.toBe("https://www.mql0.com/strategies");
    }
  });

  it("normalizes uploaded file variants into publishable product names", () => {
    expect(USER_STRATEGY_CATALOG).toHaveLength(USER_STRATEGY_SEEDS.length);
    expect(USER_STRATEGY_CATALOG.length).toBeGreaterThanOrEqual(55);
    for (const strategy of USER_STRATEGY_CATALOG) {
      expect(strategy.title).not.toMatch(/\.(?:ex4|ex5|mq4|mq5|set|zip|rar)$/i);
      expect(strategy.description).toContain("联系确认");
      expect(strategy.sourceName).toMatch(/用户|EAHub/);
    }
  });

  it("keeps platform labels aligned with the referenced products", () => {
    const byTitle = new Map(
      CURATED_STRATEGY_CATALOG.map((strategy) => [strategy.title, strategy]),
    );
    expect(byTitle.get("Smart Owl FX")?.platform).toBe("MT4");
    expect(byTitle.get("Gold Snap MT5 v2.0")?.sourceUrl).toBe(
      "https://www.eahub.cn/thread-200096-1-1.html",
    );
    for (const strategy of CURATED_STRATEGY_CATALOG) {
      if (strategy.title.includes("MT5")) {
        expect(strategy.platform).toBe("MT5");
      }
    }
  });

  it("does nothing after the content migration has already been applied", async () => {
    const connection = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT `migrationKey`")) {
          return [[{ migrationKey: "applied" }], []];
        }
        return [[], []];
      }),
    };

    await expect(syncCuratedStrategyCatalog(connection as any)).resolves.toBe(
      0,
    );
    expect(connection.query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE `strategies`"),
      expect.anything(),
    );
  });

  it("fills sparse detail content while keeping the update guarded", async () => {
    let placeholderUpdate: { sql: string; params: unknown[] } | undefined;
    const connection = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("SELECT `migrationKey`")) return [[], []];
        if (sql.includes("SELECT id, title, description")) {
          return [
            [
              {
                id: 901,
                title: "TwisterPro Scalper EA",
                description: "旧版摘要",
                platform: "MT5",
                pairs: "XAUUSD",
                timeframe: "M15",
                tags: "剥头皮,短线",
                productType: "ea",
              },
            ],
            [],
          ];
        }
        if (sql.includes("SELECT `id` FROM `strategies`")) {
          return [[{ id: 1 }], []];
        }
        if (sql.includes("SET richDescription = ?")) {
          placeholderUpdate = { sql, params: params || [] };
          return [{ affectedRows: 1 }, []];
        }
        if (sql.includes("UPDATE")) return [{ affectedRows: 0 }, []];
        return [[], []];
      }),
    };

    await expect(syncCuratedStrategyCatalog(connection as any)).resolves.toBe(
      1,
    );
    expect(placeholderUpdate?.params[0]).toContain("模板说明");
    expect(placeholderUpdate?.params[0]).toContain("EAHub");
    expect(placeholderUpdate?.sql).toContain("richDescription IS NULL");
    expect(placeholderUpdate?.sql).toContain(
      "TRIM(richDescription) = CONCAT('<p>', COALESCE(description, ''), '</p>')",
    );
  });

  it("syncs through an idempotent content migration without changing API contracts", async () => {
    const inserts: unknown[][] = [];
    const updates: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("SELECT `migrationKey`")) return [[], []];
        if (sql.includes("SELECT `id` FROM `strategies`")) return [[], []];
        if (sql.includes("UPDATE `strategies`")) {
          updates.push({ sql, params: params || [] });
          return [{ affectedRows: 0 }, []];
        }
        if (sql.includes("INSERT INTO `strategies`")) {
          inserts.push(params || []);
          return [{ affectedRows: 1 }, []];
        }
        return [[], []];
      }),
    };

    const changed = await syncCuratedStrategyCatalog(connection as any);
    expect(changed).toBe(CURATED_STRATEGY_CATALOG.length);
    expect(inserts).toHaveLength(CURATED_STRATEGY_CATALOG.length);
    expect(inserts.every((params) => params.length === 15)).toBe(true);
    expect(
      updates.some(({ sql }) => sql.includes("`saleMode` = 'inquiry'")),
    ).toBe(true);
    expect(updates.some(({ sql }) => sql.includes("CHAR_LENGTH"))).toBe(true);
    expect(
      updates.some(
        ({ sql, params }) =>
          sql.includes("`sourceUrl` = NULL") &&
          params.includes("https://www.mql0.com/strategies"),
      ),
    ).toBe(true);
    expect(
      updates.some(
        ({ sql }) =>
          sql.includes("`evidenceUrl` = IF") &&
          sql.includes("thread-200486-1-1.html"),
      ),
    ).toBe(true);
    expect(updates.some(({ params }) => params[0] === 1)).toBe(true);
    expect(
      updates.some(
        ({ sql, params }) =>
          sql.includes("`title` LIKE '%V4.3%'") &&
          params[0] === JINGE_TIE_MA_TITLE,
      ),
    ).toBe(true);
  });
});
