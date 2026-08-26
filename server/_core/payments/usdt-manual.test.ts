import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usdtGateway } from "./usdt-manual";

const keys = [
  "ENABLE_USDT_PAYMENT",
  "USDT_TRC20_ADDRESS",
  "USDT_ERC20_ADDRESS",
  "USDT_CNY_PER_USDT",
  "USDT_DEFAULT_NETWORK",
  "ADMIN_TOTP_SECRET_BASE32",
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

describe("USDT manual settlement quote", () => {
  beforeEach(() => {
    process.env.ENABLE_USDT_PAYMENT = "true";
    process.env.USDT_TRC20_ADDRESS = `T${"A".repeat(33)}`;
    delete process.env.USDT_ERC20_ADDRESS;
    process.env.USDT_CNY_PER_USDT = "7.2000";
    process.env.ADMIN_TOTP_SECRET_BASE32 =
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  });

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("stays disabled until both an address and a positive quote rate exist", () => {
    delete process.env.USDT_CNY_PER_USDT;
    expect(usdtGateway.isEnabled()).toBe(false);
    process.env.USDT_CNY_PER_USDT = "0";
    expect(usdtGateway.isEnabled()).toBe(false);
    process.env.USDT_CNY_PER_USDT = "7.2";
    expect(usdtGateway.isEnabled()).toBe(true);
  });

  it("returns an exact, auditable USDT quote rounded up to cents", async () => {
    const expiresAt = new Date("2026-08-24T12:30:00.000Z");
    const result = await usdtGateway.initiate({
      method: "usdt",
      order: {
        amount: "100.00",
        currency: "CNY",
        expiresAt,
      } as any,
    });

    expect(result.addressInfo).toMatchObject({
      chain: "TRC20",
      address: `T${"A".repeat(33)}`,
    });
    expect(result.settlementQuote).toEqual({
      amount: "13.89",
      currency: "USDT",
      sourceAmount: "100.00",
      sourceCurrency: "CNY",
      cnyPerUsdt: "7.2000",
      network: "TRC20",
      recipientAddress: `T${"A".repeat(33)}`,
      expiresAt: expiresAt.toISOString(),
    });
  });

  it("rejects unsupported source currencies", async () => {
    await expect(
      usdtGateway.initiate({
        method: "usdt",
        order: { amount: "10.00", currency: "USD", expiresAt: new Date() } as any,
      }),
    ).rejects.toThrow("无法生成 USDT 报价");
  });
});
