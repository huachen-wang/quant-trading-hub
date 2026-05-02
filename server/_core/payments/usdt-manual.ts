/**
 * USDT 手动确认网关
 *
 * 流程：
 *   1. 用户在收银台选 USDT 支付
 *   2. 后端返回收款地址 + 二维码图片 URL
 *   3. 用户用钱包转账后，**联系客服 Telegram/QQ 提供截图**
 *      （先用手动渠道沟通，避免引入文件上传基础设施）
 *   4. 用户点击页面"我已支付"按钮 → payment.status = pending（等待确认）
 *   5. Admin 在后台收到截图 → 验证后台手动确认 → 调 trpc.orders.adminConfirmUsdt 改单
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

  isEnabled(): boolean {
    return isUsdtPaymentEnabled() && (!!this.trc20Address || !!this.erc20Address);
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

    // 二维码图片：约定放在 /public/payment/usdt-{chain}.png
    // 后台首次部署时把二维码图片上传到 public/payment/ 即可
    const qrCodeUrl = `/payment/usdt-${chain.toLowerCase()}.png`;

    return {
      method: "usdt",
      addressInfo: {
        chain,
        address,
        qrCodeUrl,
      },
      hint: `请通过 ${chain} 网络转账 USDT 至上方地址。转账完成后联系客服 Telegram 提供截图，我们会在 30 分钟内确认到账。`,
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
