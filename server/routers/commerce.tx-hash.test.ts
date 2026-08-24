import { describe, expect, it } from "vitest";
import { canonicalizeTxHash } from "./commerce";

describe("USDT tx hash canonicalization", () => {
  it("treats prefixed and unprefixed EVM hashes as the same transaction", () => {
    const hash = "AB".repeat(32);
    expect(canonicalizeTxHash(`0x${hash}`)).toBe(hash.toLowerCase());
    expect(canonicalizeTxHash(hash)).toBe(hash.toLowerCase());
  });
});
