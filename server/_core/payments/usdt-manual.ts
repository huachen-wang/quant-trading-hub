/**
 * USDT 手动确认网关
 *
 * 流程：
 *   1. 用户在收银台选 USDT 支付
 *   2. 后端返回收款地址 + 二维码图片 URL
 *   3. 用户按锁定报价转账，提交链上 tx hash
 *   4. Admin 核对网络、收款地址、tx hash 和实际到账金额后手动确认
 *
 * 这是早期阶段的简化方案。等业务量起来后，可以升级为：
 *   - 接入 TronLink / OKLink Pay / 链上监控自动到账
 *   - 上传截图到 Vercel Blob / R2 自动 OCR 校验
 */

import type {
  PaymentGateway,
  InitiateOptions,
  InitiateResult,
  CallbackVerifyOptions,
  CallbackVerifyResult,
} from "./gateway";
import { isUsdtPaymentEnabled } from "../../../constants/features";

class UsdtManualGateway implements PaymentGateway {
  readonly name = "usdt-manual";

  private get trc20Address(): string {
    return process.env.USDT_TRC20_ADDRESS || "";
  }
  private get erc20Address(): string {
    return process.env.USDT_ERC20_ADDRESS || "";
  }

  private get cnyPerUsdt(): number {
    return Number(process.env.USDT_CNY_PER_USDT || "");
  }

  isEnabled(): boolean {
    return (
      isUsdtPaymentEnabled() &&
      (!!this.trc20Address || !!this.erc20Address) &&
      Number.isFinite(this.cnyPerUsdt) &&
      this.cnyPerUsdt > 0
    );
  }

  getSupportedMethods(): string[] {
    return ["usdt"];
  }

  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    if (!this.isEnabled()) {
      throw new Error("USDT 支付未配置或未启用");
    }

    // 优先 TRC20（手续费低，主流），有则用，没有降级 ERC20
    const chain = this.trc20Address ? "TRC20" : "ERC20";
    const address = chain === "TRC20" ? this.trc20Address : this.erc20Address;

    const sourceAmount = Number(opts.order.amount);
    if (!Number.isFinite(sourceAmount) || sourceAmount <= 0 || opts.order.currency !== "CNY") {
      throw new Error("当前订单无法生成 USDT 报价");
    }
    // 手动结算 MVP 锁定到分，向上取整避免汇率换算导致少付。
    const paymentAmount = (Math.ceil((sourceAmount / this.cnyPerUsdt) * 100) / 100).toFixed(2);
    const expiresAt = (opts.order.expiresAt || new Date(Date.now() + 30 * 60 * 1000)).toISOString();

    // 只在明确配置后展示二维码，避免默认路径 404 或与当前地址不一致。
    const qrCodeUrl = chain === "TRC20"
      ? process.env.USDT_TRC20_QR_URL
      : process.env.USDT_ERC20_QR_URL;

    return {
      method: "usdt",
      addressInfo: {
        chain,
        address,
        ...(qrCodeUrl ? { qrCodeUrl } : {}),
      },
      settlementQuote: {
        amount: paymentAmount,
        currency: "USDT",
        sourceAmount: String(opts.order.amount),
        sourceCurrency: opts.order.currency,
        cnyPerUsdt: this.cnyPerUsdt.toFixed(4),
        network: chain,
        recipientAddress: address,
        expiresAt,
      },
      hint: `请在报价有效期内通过 ${chain} 网络转账 ${paymentAmount} USDT，并提交链上 tx hash。`,
    };
  }

  async verifyCallback(_opts: CallbackVerifyOptions): Promise<CallbackVerifyResult> {
    // USDT 不走自动回调，走 admin 手动确认
    return {
      valid: false,
      shouldMarkPaid: false,
      errorMessage: "USDT does not support automatic callback",
    };
  }

  successResponseText(): string {
    return "ok";
  }
}

export const usdtGateway = new UsdtManualGateway();
