import { describe, expect, it } from "vitest";
import { annualizeReturn, formatAnnualizedReturn, formatUsdt } from "./format";

describe("annualized return formatting", () => {
  it("compounds a 90-day return over 365 days", () => {
    expect(annualizeReturn(12.26)).toBeCloseTo(59.8418, 4);
    expect(formatAnnualizedReturn(12.26)).toBe("+59.84%");
  });

  it("preserves zero and supports negative returns above total loss", () => {
    expect(annualizeReturn(0)).toBe(0);
    expect(formatAnnualizedReturn(0)).toBe("0.00%");
    expect(annualizeReturn(-10)).toBeLessThan(0);
  });

  it("rejects unavailable or invalid annualization inputs", () => {
    expect(annualizeReturn(null)).toBeNull();
    expect(annualizeReturn(-100)).toBeNull();
    expect(annualizeReturn(10, 0)).toBeNull();
    expect(formatAnnualizedReturn(null)).toBe("--");
  });
});

describe("USDT amount formatting", () => {
  it("does not mislabel managed capital as USD", () => {
    expect(formatUsdt(50_000)).toBe("50,000 USDT");
    expect(formatUsdt(50_000, true, "en-US")).toBe("50K USDT");
    expect(formatUsdt(null)).toBe("--");
  });
});
