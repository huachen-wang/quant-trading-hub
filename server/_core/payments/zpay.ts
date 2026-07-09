/**
 * ZPay 聚合支付网关
 *
 * ZPay（彩虹易支付官方运营版）使用 MD5 签名 + form 跳转的传统模式。
 *
 * 文档参考：彩虹易支付 / ZPay 商户接口文档
 *
 * 关键 API：
 *   - 提交支付：跳转 GET {gateway}/submit.php?{params with sign}
 *   - 异步通知：网关 POST 到 ZPAY_NOTIFY_URL
 *   - 同步跳转：用户支付完跳到 ZPAY_RETURN_URL
 *
 * 签名规则（MD5）：
 *   1. 把所有非空参数（除 sign 和 sign_type）按 key 字母序升序
 *   2. 拼接成 key1=val1&key2=val2&...（不做 URL 编码）
 *   3. 末尾追加商户密钥 KEY（直接拼，不带 &）
 *   4. MD5 取小写
 */

import crypto from "node:crypto";
import type {
  PaymentGateway,
  InitiateOptions,
  InitiateResult,
  CallbackVerifyOptions,
  CallbackVerifyResult,
} from "./gateway";
import { isZpayEnabled } from "../../../constants/features";

class ZpayGateway implements PaymentGateway {
  readonly name = "zpay";

  private get pid(): string {
    return process.env.ZPAY_PID || "";
  }
  private get key(): string {
    return process.env.ZPAY_KEY || "";
  }
  private get gateway(): string {
    return (process.env.ZPAY_GATEWAY || "https://zpayz.cn").replace(/\/$/, "");
  }
  private get notifyUrl(): string {
    return process.env.ZPAY_NOTIFY_URL || "";
  }
  private get returnUrl(): string {
    return process.env.ZPAY_RETURN_URL || "";
  }

  isEnabled(): boolean {
    return isZpayEnabled() && !!this.pid && !!this.key && !!this.notifyUrl;
  }

  getSupportedMethods(): string[] {
    // 你确认只开支付宝 + 微信，QQ 钱包不开
    return ["alipay", "wxpay"];
  }

  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    if (!this.isEnabled()) {
      throw new Error("ZPay 网关未配置或未启用");
    }
    if (!this.getSupportedMethods().includes(opts.method)) {
      throw new Error(`ZPay 不支持支付方式：${opts.method}`);
    }

    const params: Record<string, string> = {
      pid: this.pid,
      type: opts.method, // alipay | wxpay
      out_trade_no: opts.order.orderNo,
      notify_url: this.notifyUrl,
      return_url: opts.returnUrl || this.returnUrl,
      name: opts.order.productTitle,
      money: Number(opts.order.amount).toFixed(2),
      sitename: "EAXAU Source Desk",
    };

    const sign = this.buildSign(params);
    const allParams = { ...params, sign, sign_type: "MD5" };

    // 构造跳转 URL（GET 模式）
    const queryString = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    const payUrl = `${this.gateway}/submit.php?${queryString}`;

    return {
      method: opts.method,
      payUrl,
      hint:
        opts.method === "alipay"
          ? "点击跳转后用支付宝扫码支付"
          : "点击跳转后用微信扫码支付",
    };
  }

  async verifyCallback(opts: CallbackVerifyOptions): Promise<CallbackVerifyResult> {
    const payload = opts.payload || {};
    const sign = String(payload.sign || "");
    const tradeStatus = String(payload.trade_status || "");
    const outTradeNo = String(payload.out_trade_no || "");
    const tradeNo = String(payload.trade_no || "");
    const money = parseFloat(payload.money || "0");
    const pid = String(payload.pid || "");

    // 1. 验证 pid 是自己的
    if (pid !== this.pid) {
      return { valid: false, shouldMarkPaid: false, errorMessage: "PID mismatch" };
    }

    // 2. 验签
    const verifyParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k === "sign" || k === "sign_type") continue;
      if (v === null || v === undefined || v === "") continue;
      verifyParams[k] = String(v);
    }
    const expectedSign = this.buildSign(verifyParams);
    if (expectedSign !== sign.toLowerCase()) {
      return {
        valid: false,
        shouldMarkPaid: false,
        errorMessage: `Sign mismatch (got ${sign}, expected ${expectedSign})`,
      };
    }

    // 3. 验证订单号
    if (opts.expectedOrderNo && opts.expectedOrderNo !== outTradeNo) {
      return {
        valid: true,
        shouldMarkPaid: false,
        errorMessage: "Order number mismatch",
      };
    }

    // 4. 验证支付状态
    const isPaid = tradeStatus === "TRADE_SUCCESS";

    return {
      valid: true,
      shouldMarkPaid: isPaid,
      orderNo: outTradeNo,
      amount: money,
      gatewayOrderNo: tradeNo,
      paymentMethod: String(payload.type || ""),
    };
  }

  successResponseText(): string {
    // ZPay 要求成功处理后返回纯文本 "success"
    return "success";
  }

  /**
   * MD5 签名
   * 1. 按 key 字母序排序
   * 2. 拼成 k1=v1&k2=v2&...
   * 3. 末尾直接追加 KEY（不带 &）
   * 4. MD5 → lower hex
   */
  private buildSign(params: Record<string, string>): string {
    const keys = Object.keys(params)
      .filter((k) => k !== "sign" && k !== "sign_type")
      .filter((k) => params[k] !== "" && params[k] !== null && params[k] !== undefined)
      .sort();
    const queryString = keys.map((k) => `${k}=${params[k]}`).join("&");
    const toSign = queryString + this.key;
    return crypto.createHash("md5").update(toSign, "utf8").digest("hex").toLowerCase();
  }
}

export const zpayGateway = new ZpayGateway();
