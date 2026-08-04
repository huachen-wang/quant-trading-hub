import { describe, expect, it } from "vitest";
import { getLocalStrategyCover, resolveStrategyCover } from "./strategy-covers";

describe("strategy cover resolver", () => {
  it("maps known Chinese and English strategy names to local optimized covers", () => {
    expect(getLocalStrategyCover("金戈铁马 正版云控 V4.3")).toContain(
      "49_Quantum_Dark_Gold.jpg",
    );
    expect(getLocalStrategyCover("Quantum Queen X MT5")).toContain(
      "11_Quantum_Queen.jpg",
    );
  });

  it("keeps the database image for unknown strategies", () => {
    expect(
      resolveStrategyCover("Unknown EA", "https://example.com/cover.png"),
    ).toBe("https://example.com/cover.png");
  });

  it("returns null when no image is available", () => {
    expect(resolveStrategyCover("Unknown EA", null)).toBeNull();
  });

  it("keeps newly curated reference strategies on their neutral generated covers", () => {
    expect(resolveStrategyCover("ArtQuant Gold v3.2", null)).toBeNull();
  });
});
