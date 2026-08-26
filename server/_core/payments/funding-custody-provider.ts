export type FundingCustodyProviderKind = "MANUAL" | "BVNK" | "COBO";

export type FundingCustodyProviderReadiness = {
  kind: FundingCustodyProviderKind;
  ready: boolean;
  automaticAddressAllocation: boolean;
  automaticChainMonitoring: boolean;
  automaticPayoutSigning: boolean;
  reason: string;
};

export function getFundingCustodyProviderReadiness(
  env: NodeJS.ProcessEnv = process.env,
): FundingCustodyProviderReadiness {
  const kind = (env.FUNDING_CUSTODY_PROVIDER || "MANUAL")
    .trim()
    .toUpperCase() as FundingCustodyProviderKind;
  if (!(["MANUAL", "BVNK", "COBO"] as const).includes(kind)) {
    throw new Error(
      "FUNDING_CUSTODY_PROVIDER must be MANUAL, BVNK, or COBO",
    );
  }
  if (kind !== "MANUAL") {
    return {
      kind,
      ready: false,
      automaticAddressAllocation: false,
      automaticChainMonitoring: false,
      automaticPayoutSigning: false,
      reason: `${kind} provider adapter is not implemented; refusing to pretend custody automation is active`,
    };
  }
  return {
    kind,
    ready: true,
    automaticAddressAllocation: false,
    automaticChainMonitoring: false,
    automaticPayoutSigning: false,
    reason:
      "MANUAL: addresses, receipts and external-wallet payouts require explicit admin audit steps",
  };
}

export function assertFundingCustodyProviderReady(
  env: NodeJS.ProcessEnv = process.env,
) {
  const readiness = getFundingCustodyProviderReadiness(env);
  if (!readiness.ready) {
    throw new Error(`[funding-custody] ${readiness.reason}`);
  }
  return readiness;
}
