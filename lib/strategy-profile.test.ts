import { describe, expect, it } from "vitest";
import { resolveStrategyProfile } from "./strategy-profile";

describe("strategy profile resolver", () => {
  it("turns existing strategy metadata into a consistent four-part profile", () => {
    const profile = resolveStrategyProfile({
      title: "Gold Breakout Pro",
      tags: "黄金,突破,短线",
      pairs: "XAUUSD",
      timeframe: "M15",
      platform: "MT5",
    });

    expect(profile.kind).toBe("breakout");
    expect(profile.items).toHaveLength(4);
    expect(profile.items[2].value).toBe("XAUUSD · M15");
    expect(profile.items[2].note).toContain("点差");
    expect(profile.items[2].note).toContain("MT5");
  });

  it("keeps missing metadata explicit instead of inventing settings", () => {
    const profile = resolveStrategyProfile({ title: "Unknown Strategy" });

    expect(profile.items[2].value).toBe("品种待确认 · 周期待确认");
    expect(profile.note).toContain("沟通确认");
  });

  it("describes grid risk without claiming guaranteed safety", () => {
    const profile = resolveStrategyProfile({
      title: "V4 Grid Bot",
      tags: "网格,对冲",
      pairs: "XAUUSD",
      timeframe: "H1",
    });

    expect(profile.kind).toBe("grid");
    expect(profile.items[3].value).toContain("仓位累积");
    expect(profile.items.map((item) => item.value).join(" ")).not.toContain(
      "保证",
    );
  });
});
