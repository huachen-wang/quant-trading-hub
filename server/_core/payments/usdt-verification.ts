/**
 * 链上 USDT 核验提供器边界。
 *
 * 本版只注册 MANUAL：管理员在外部区块浏览器或托管商核验后，
 * 将到账金额、网络和确认数录入审计流水。配置 RPC URL 不会自动启用；
 * 后续实现 RPC/Cobo 适配器时，必须在这个接口后面提供确认数、重组和幂等保护。
 */

export type UsdtVerificationRequest = {
  network: string;
  txHash: string;
  expectedToken: "USDT";
  expectedRecipient: string;
};

export type UsdtVerificationResult = {
  observedNetwork: string;
  token: "USDT";
  recipient: string;
  receivedAmount: string;
  confirmations: number;
  observedAt: Date;
  providerRef: string | null;
};

export interface UsdtVerificationProvider {
  readonly kind: "MANUAL" | "RPC";
  readonly automatic: boolean;
  verify(
    request: UsdtVerificationRequest,
  ): Promise<UsdtVerificationResult | null>;
}

class ManualUsdtVerificationProvider implements UsdtVerificationProvider {
  readonly kind = "MANUAL" as const;
  readonly automatic = false;

  async verify(_request: UsdtVerificationRequest) {
    // 故意不猜测链上结果；返回 null 表示必须走管理后台人工对账。
    return null;
  }
}

const manualProvider = new ManualUsdtVerificationProvider();

export function getUsdtVerificationProvider(
  env: NodeJS.ProcessEnv = process.env,
): UsdtVerificationProvider {
  const configured = (env.USDT_VERIFICATION_PROVIDER || "MANUAL")
    .trim()
    .toUpperCase();
  if (configured !== "MANUAL") {
    throw new Error(
      "USDT_VERIFICATION_PROVIDER 当前只支持 MANUAL；RPC/Cobo 适配器尚未实现，不能伪装自动核验。",
    );
  }
  return manualProvider;
}
