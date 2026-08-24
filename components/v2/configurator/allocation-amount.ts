/**
 * Split a USDT decimal amount across broker weights using 1e-6 integer units.
 * Rounding residue is assigned to the final slot, so the displayed slot total
 * always equals the original target capital exactly.
 */
export function allocateCapitalByWeights(total: string, weights: number[]) {
  if (!weights.length) return [];
  const [whole = "0", fraction = ""] = total.split(".");
  const totalUnits =
    BigInt(whole || "0") * 1_000_000n +
    BigInt(fraction.padEnd(6, "0").slice(0, 6) || "0");
  let allocated = 0n;
  return weights.map((weight, index) => {
    const units =
      index === weights.length - 1
        ? totalUnits - allocated
        : (totalUnits * BigInt(Math.round(weight * 100))) / 10_000n;
    allocated += units;
    const integer = units / 1_000_000n;
    const decimal = (units % 1_000_000n)
      .toString()
      .padStart(6, "0")
      .replace(/0+$/, "");
    return decimal ? `${integer}.${decimal}` : integer.toString();
  });
}
