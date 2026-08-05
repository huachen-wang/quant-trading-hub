import { describe, expect, it } from "vitest";
import { resolveStrategyEahubReference } from "./strategy-eahub-reference";

describe("EAHub strategy references", () => {
  it("matches known Chinese and English strategy names", () => {
    expect(resolveStrategyEahubReference("金戈铁马 V5.1")?.url).toContain(
      "eahub.cn/thread-201119",
    );
    expect(
      resolveStrategyEahubReference("TwisterPro Scalper EA")?.summary,
    ).toContain("M15");
    expect(
      resolveStrategyEahubReference("ArtQuant Gold v3.2")?.summary,
    ).toContain("多模块");
  });

  it("does not force an unrelated source onto unmatched names", () => {
    expect(
      resolveStrategyEahubReference("Custom Strategy 2026"),
    ).toBeUndefined();
  });
});
