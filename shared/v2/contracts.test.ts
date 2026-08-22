import { describe, expect, it } from "vitest";
import {
  accountSchema,
  allocationDraftSchema,
  coreStrategySchema,
  overviewSchema,
  platformSchema,
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
    expect(() => coreStrategySchema.array().parse(DEMO_STRATEGIES)).not.toThrow();
    expect(() => platformSchema.array().parse(DEMO_PLATFORMS)).not.toThrow();
    expect(() => accountSchema.array().parse(DEMO_ACCOUNTS)).not.toThrow();
    expect(() => allocationDraftSchema.parse(DEFAULT_ALLOCATION)).not.toThrow();
  });

  it("never marks deterministic preview data as LIVE", () => {
    expect(DEMO_STRATEGIES.every((item) => item.source.dataMode === "DEMO")).toBe(true);
    expect(DEMO_PLATFORMS.every((item) => item.source.dataMode === "DEMO")).toBe(true);
    expect(DEMO_ACCOUNTS.every((item) => item.source.dataMode === "DEMO")).toBe(true);
  });
});
