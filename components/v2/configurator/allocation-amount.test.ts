import { describe, expect, it } from "vitest";
import { allocateCapitalByWeights } from "./allocation-amount";

function toMicros(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 1_000_000n +
    BigInt(fraction.padEnd(6, "0").slice(0, 6) || "0")
  );
}

describe("多券商入金金额分配", () => {
  it("每槽金额合计严格等于目标资金", () => {
    const amounts = allocateCapitalByWeights("50000", [33.33, 33.33, 33.34]);
    expect(amounts).toHaveLength(3);
    expect(amounts.reduce((sum, value) => sum + toMicros(value), 0n)).toBe(
      50_000_000_000n,
    );
  });

  it("保留最多六位 USDT 小数并把余数归入最后一槽", () => {
    const amounts = allocateCapitalByWeights("1.000001", [50, 50]);
    expect(amounts).toEqual(["0.5", "0.500001"]);
  });
});
