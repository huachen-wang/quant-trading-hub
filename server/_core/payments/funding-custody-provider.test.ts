import { describe, expect, it } from "vitest";
import {
  assertFundingCustodyProviderReady,
  getFundingCustodyProviderReadiness,
} from "./funding-custody-provider";

describe("funding custody provider boundary", () => {
  it("keeps manual mode explicit and non-automatic", () => {
    expect(
      getFundingCustodyProviderReadiness({
        FUNDING_CUSTODY_PROVIDER: "MANUAL",
      } as unknown as NodeJS.ProcessEnv),
    ).toMatchObject({
      kind: "MANUAL",
      ready: true,
      automaticAddressAllocation: false,
      automaticChainMonitoring: false,
      automaticPayoutSigning: false,
    });
  });

  it.each(["BVNK", "COBO"])(
    "fails closed for an unimplemented %s adapter",
    (kind) => {
      const env = {
        FUNDING_CUSTODY_PROVIDER: kind,
      } as unknown as NodeJS.ProcessEnv;
      expect(getFundingCustodyProviderReadiness(env).ready).toBe(false);
      expect(() => assertFundingCustodyProviderReady(env)).toThrow(
        /adapter is not implemented/,
      );
    },
  );
});
