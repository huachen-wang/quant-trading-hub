import { describe, expect, it } from "vitest";
import {
  accountSchema,
  alliancePlatformCatalogSchema,
  allianceStrategyCatalogSchema,
  allocationDraftSchema,
  overviewSchema,
} from "./contracts";
import {
  createDemoOverview,
  DEFAULT_ALLOCATION,
  DEMO_ACCOUNTS,
  DEMO_PLATFORMS,
  DEMO_STRATEGIES,
} from "../../server/v2/demo-data";

describe("EAXAU V2 contracts", () => {
  it("validates the aggregated six-strategy overview", () => {
    const overview = overviewSchema.parse(createDemoOverview());
    expect(overview.strategies).toHaveLength(6);
    expect(new Set(overview.strategies.map((item) => item.homeSlot)).size).toBe(6);
    expect(overview.source.dataMode).toBe("DEMO");
  });

  it("keeps every demo object inside the public DTO contract", () => {
    expect(() => allianceStrategyCatalogSchema.parse(DEMO_STRATEGIES)).not.toThrow();
    expect(() => alliancePlatformCatalogSchema.parse(DEMO_PLATFORMS)).not.toThrow();
    expect(() => accountSchema.array().parse(DEMO_ACCOUNTS)).not.toThrow();
    expect(() => allocationDraftSchema.parse(DEFAULT_ALLOCATION)).not.toThrow();
  });

  it("fails closed when an upstream provider replaces a strategy or broker id", () => {
    const overview = createDemoOverview();
    expect(() =>
      overviewSchema.parse({
        ...overview,
        strategies: [
          { ...overview.strategies[0], id: "unapproved-strategy" },
          ...overview.strategies.slice(1),
        ],
      }),
    ).toThrow(/canonical ID/);
    expect(() =>
      overviewSchema.parse({
        ...overview,
        platforms: [
          { ...overview.platforms[0], id: "unapproved-broker" },
          ...overview.platforms.slice(1),
        ],
      }),
    ).toThrow(/canonical ID/);
  });

  it("never marks deterministic preview data as LIVE", () => {
    expect(DEMO_STRATEGIES.every((item) => item.source.dataMode === "DEMO")).toBe(true);
    expect(DEMO_PLATFORMS.every((item) => item.source.dataMode === "DEMO")).toBe(true);
    expect(DEMO_ACCOUNTS.every((item) => item.source.dataMode === "DEMO")).toBe(true);
  });
});
