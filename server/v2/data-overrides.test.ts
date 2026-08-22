import { describe, expect, it } from "vitest";
import { DEMO_STRATEGIES, createDemoOverview } from "./demo-data";
import {
  applyStrategyDataOverride,
  createStrategyDataOverrideSample,
  rebuildOverviewFromStrategies,
} from "./data-overrides";

describe("V2 strategy data overrides", () => {
  it("turns a generated sample into editable custom history", () => {
    const base = DEMO_STRATEGIES[0];
    const sample = createStrategyDataOverrideSample(base);
    const applied = applyStrategyDataOverride(base, sample);

    expect(applied.source.dataMode).toBe("CUSTOM");
    expect(applied.positions).toEqual([]);
    expect(applied.equity.every((point) => point.source === "CUSTOM")).toBe(true);
  });

  it("keeps custom points before handover and live points after it", () => {
    const base = DEMO_STRATEGIES[0];
    const handover = base.equity.at(-2)!.timestamp;
    const live = {
      ...base,
      equity: base.equity.map((point) => ({ ...point, source: "LIVE" as const })),
      source: { ...base.source, dataMode: "LIVE" as const },
    };
    const override = {
      ...createStrategyDataOverrideSample(base, "HYBRID"),
      historyHandoverAt: handover,
      equity: base.equity.slice(0, -2),
    };

    const applied = applyStrategyDataOverride(live, override);

    expect(applied.source.dataMode).toBe("HYBRID");
    expect(applied.equity.at(-1)?.source).toBe("LIVE");
    expect(applied.equity[0]?.source).toBe("CUSTOM");
    expect(applied.positions).toHaveLength(base.positions.length);
  });

  it("rebuilds the portfolio source and totals from strategy data", () => {
    const overview = createDemoOverview();
    const first = applyStrategyDataOverride(
      DEMO_STRATEGIES[0],
      createStrategyDataOverrideSample(DEMO_STRATEGIES[0]),
    );
    const rebuilt = rebuildOverviewFromStrategies(overview, [first, ...DEMO_STRATEGIES.slice(1)]);

    expect(rebuilt.source.dataMode).toBe("CUSTOM");
    expect(rebuilt.portfolio.equitySeries.length).toBeGreaterThan(0);
  });
});
