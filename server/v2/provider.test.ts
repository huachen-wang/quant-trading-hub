import { afterEach, describe, expect, it } from "vitest";
import { getV2Provider, resetV2ProviderForTests } from "./provider";

const ENV_KEYS = [
  "V2_DATA_PROVIDER",
  "QUANT_DATA_CORE_URL",
  "NIUBANG_DATA_URL",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  resetV2ProviderForTests();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("V2 provider selection", () => {
  it("honors an explicit DEMO selection even when provider URLs exist", () => {
    process.env.V2_DATA_PROVIDER = "DEMO";
    process.env.QUANT_DATA_CORE_URL = "https://quant.example";
    process.env.NIUBANG_DATA_URL = "https://niubang.example";

    expect(getV2Provider().kind).toBe("DEMO");
  });

  it("does not substitute Niubang when HTTP is explicitly selected without its URL", () => {
    process.env.V2_DATA_PROVIDER = "HTTP";
    delete process.env.QUANT_DATA_CORE_URL;
    process.env.NIUBANG_DATA_URL = "https://niubang.example";

    expect(getV2Provider().kind).toBe("DEMO");
  });

  it("prefers Niubang during automatic selection when both URLs exist", () => {
    delete process.env.V2_DATA_PROVIDER;
    process.env.QUANT_DATA_CORE_URL = "https://quant.example";
    process.env.NIUBANG_DATA_URL = "https://niubang.example";

    expect(getV2Provider().kind).toBe("NIUBANG");
  });
});
