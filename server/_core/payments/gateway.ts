/**
 * Payment Gateway Abstract Interface
 *
 * 所有支付网关（ZPay、USDT、未来的支付宝直连/微信直连等）都实现这个接口。
 * 上层调用方（routers.ts、checkout 页面）不需要知道具体网关，只调用统一 API。
 *
 * 当前实装：
 *   - ZPay（聚合支付：支付宝 + 微信）
 *   - USDT 手动确认
 *
 * 未来可扩展：
 *   - alipay-direct.ts（拿到营业执照后接支付宝商户直连）
 *   - wechat-direct.ts（同上）
 */

import type { Order } from "../../../drizzle/schema";

export interface InitiateOptions {
  order: Order;
  method: string; // alipay | wxpay | qqpay | usdt
  /** 用户当前的客户端 IP（部分网关需要） */
  clientIp?: string;
  /** 用户支付完成后跳转的页面（同步 return_url） */
  returnUrl?: string;
}

export interface InitiateResult {
  /** 支付方式实际类型，用于前端展示 */
  method: string;
  /** 跳转支付页 URL（PC 网页端用；扫码支付时也是包含二维码内容的页面 URL） */
  payUrl?: string;
  /** 二维码内容（如果网关直接返回二维码原始数据） */
  qrCodeContent?: string;
  /** 二维码图片 URL（如果网关直接返回二维码图片） */
  qrCodeImageUrl?: string;
  /** USDT 收款地址（仅 usdt 方式） */
  addressInfo?: {
    chain: "TRC20" | "ERC20";
    address: string;
    qrCodeUrl?: string; // 收款地址二维码图片本地路径
  };
  /** 网关订单号 */
  gatewayOrderNo?: string;
  /** 备注信息（前端展示给用户） */
  hint?: string;
}

export interface CallbackVerifyOptions {
  /** 网关回调的原始参数（query 或 body） */
  payload: Record<string, any>;
  /** 应该等于的订单号 */
  expectedOrderNo?: string;
}

export interface CallbackVerifyResult {
  valid: boolean;
  /** 验签 + 业务校验都通过才算 success */
  shouldMarkPaid: boolean;
  orderNo?: string;
  amount?: number;
  gatewayOrderNo?: string;
  paymentMethod?: string;
  errorMessage?: string;
}

export interface PaymentGateway {
  /** 网关名（写入 payments.gateway） */
  readonly name: string;
  /** 是否启用（feature flag 或 env 检查） */
  isEnabled(): boolean;
  /** 该网关支持的支付方式列表 */
  getSupportedMethods(): string[];
  /** 发起支付（创建支付意图，返回前端展示需要的信息） */
  initiate(opts: InitiateOptions): Promise<InitiateResult>;
  /** 验证异步回调 + 返回处理结果 */
  verifyCallback(opts: CallbackVerifyOptions): Promise<CallbackVerifyResult>;
  /** 网关回调成功后给网关的响应文本（如 ZPay 要求 "success"） */
  successResponseText(): string;
}
