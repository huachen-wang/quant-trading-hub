import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveDatabaseUrl } from "./migrate";

describe("production database configuration", () => {
  it("fails closed instead of falling back to volatile mock storage", () => {
    expect(() => resolveDatabaseUrl({ NODE_ENV: "production" })).toThrow(
      "DATABASE_URL must be configured in production",
    );
  });

  it("also treats Railway as production when NODE_ENV is absent", () => {
    expect(() =>
      resolveDatabaseUrl({
        RAILWAY_ENVIRONMENT_ID: "production-id",
      }),
    ).toThrow("DATABASE_URL must be configured in production");
  });

  it("allows mock storage only outside production", () => {
    expect(resolveDatabaseUrl({ NODE_ENV: "development" })).toBeNull();
  });

  it("uses the idempotent runtime migrator instead of replaying archival SQL", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    );
    expect(packageJson.scripts["db:push"]).toBe("tsx server/migrate.ts");
    expect(journal.entries.at(-1)?.tag).toBe("0002_add_new_fields");
    expect(
      journal.entries.some((entry: { tag: string }) =>
        entry.tag.includes("ai_alliance_usdt_funding"),
      ),
    ).toBe(false);
  });

  it("creates an isolated double-opt-in ledger without importing legacy contacts", () => {
    const migrator = readFileSync("server/migrate.ts", "utf8");
    for (const table of [
      "email_marketing_subscriptions",
      "email_subscription_rate_limits",
      "email_subscription_deliveries",
      "email_subscription_provider_events",
      "email_subscription_events",
      "email_subscription_crm_outbox",
    ]) {
      expect(migrator).toMatch(
        new RegExp("CREATE TABLE IF NOT EXISTS \\\\`" + table + "\\\\`"),
      );
    }
    expect(migrator).not.toMatch(
      /INSERT\s+(?:IGNORE\s+)?INTO\s+[`\\]*email_marketing_subscriptions[\s\S]{0,500}\bSELECT\b[\s\S]{0,500}\bemail_subscriptions\b/iu,
    );
  });
});
