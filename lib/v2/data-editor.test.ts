import { describe, expect, it } from "vitest";
import { dataEditorFormToOverride, overrideToDataEditorForm } from "./data-editor";

describe("V2 strategy data editor", () => {
  it("round-trips custom metrics and equity points", () => {
    const input = {
      strategyId: "jingge-v51",
      mode: "CUSTOM" as const,
      historyHandoverAt: null,
      note: "sample",
      metrics: { return30dPct: 4.2, tradeCount: 20 },
      equity: [
        { timestamp: "2026-08-01T00:00:00.000Z", balance: 10000, equity: 10020, source: "CUSTOM" as const },
      ],
    };

    expect(dataEditorFormToOverride(input.strategyId, overrideToDataEditorForm(input))).toEqual(input);
  });

  it("rejects custom points on or after the live handover", () => {
    const form = overrideToDataEditorForm({
      strategyId: "jingge-v51",
      mode: "HYBRID",
      historyHandoverAt: "2026-08-02T00:00:00.000Z",
      note: "",
      metrics: {},
      equity: [
        { timestamp: "2026-08-02T00:00:00.000Z", balance: 10000, equity: 10000 },
      ],
    });

    expect(() => dataEditorFormToOverride("jingge-v51", form)).toThrow("必须早于实盘接管时间");
  });
});
