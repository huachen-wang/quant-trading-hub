import { describe, expect, it, vi } from "vitest";
import { CURATED_STRATEGY_CATALOG, syncCuratedStrategyCatalog } from "./strategy-catalog";

describe("curated strategy catalog", () => {
  it("contains unique, editable strategy records", () => {
    const titles = CURATED_STRATEGY_CATALOG.map((strategy) =>
      strategy.title.toLowerCase(),
    );
    expect(new Set(titles).size).toBe(titles.length);
    expect(CURATED_STRATEGY_CATALOG.length).toBeGreaterThanOrEqual(12);
  });

  it("uses neutral generated covers and HTTPS reference sources", () => {
    for (const strategy of CURATED_STRATEGY_CATALOG) {
      expect(strategy.coverImage).toBeNull();
      expect(strategy.sourceUrl).toMatch(/^https:\/\//);
      expect(strategy.evidenceUrl).toMatch(/^https:\/\//);
    }
  });

  it("keeps platform labels aligned with the referenced products", () => {
    const byTitle = new Map(
      CURATED_STRATEGY_CATALOG.map((strategy) => [strategy.title, strategy]),
    );
    expect(byTitle.get("Smart Owl FX")?.platform).toBe("MT4");
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

    await expect(syncCuratedStrategyCatalog(connection as any)).resolves.toBe(0);
    expect(connection.query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE `strategies`"),
      expect.anything(),
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
    expect(updates.some(({ sql }) => sql.includes("CHAR_LENGTH"))).toBe(true);
    expect(updates.some(({ params }) => params[0] === 1)).toBe(true);
  });
});
