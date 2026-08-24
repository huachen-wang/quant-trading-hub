import { describe, expect, it } from "vitest";
import * as db from "./db";

describe("global chain transaction registry", () => {
  it("canonicalizes commerce aliases across all USDT ledgers", async () => {
    delete process.env.DATABASE_URL;
    const hash = "A".repeat(64);
    await db.reserveChainTransaction({
      network: "ERC20",
      normalizedHash: `0x${hash}`,
      usageType: "COMMERCE_INBOUND",
      referenceNo: `ORDER-${Date.now()}`,
    });
    await expect(
      db.reserveChainTransaction({
        network: "ETHEREUM",
        normalizedHash: hash.toLowerCase(),
        usageType: "COLLECTION_INBOUND",
        referenceNo: `FUNDING-${Date.now()}`,
      }),
    ).rejects.toThrow(/另一.*账路/);
  });

  it("preserves case for Solana signatures", async () => {
    delete process.env.DATABASE_URL;
    const base = `SolanaSignature${Date.now()}AbCdEf123456789ABCDEFGHJKLMNPQ`;
    const upperVariant = base.replace("b", "B");
    await expect(
      db.reserveChainTransaction({
        network: "SOLANA",
        normalizedHash: base,
        usageType: "BROKER_DIRECT_INBOUND",
        referenceNo: `DIRECT-${Date.now()}`,
      }),
    ).resolves.toBeTruthy();
    await expect(
      db.reserveChainTransaction({
        network: "SOLANA",
        normalizedHash: upperVariant,
        usageType: "COLLECTION_INBOUND",
        referenceNo: `COLLECTION-${Date.now()}`,
      }),
    ).resolves.toBeTruthy();
  });
});
