/**
 * SMS Service — 短信发送抽象层
 *
 * 当前状态：未启用（feature flag 关闭）。代码留接口，等阿里云签名审核通过
 * 或决定使用国际短信通道时，填充对应实现并打开 ENABLE_PHONE_VERIFICATION。
 *
 * 切换方案不需要改业务代码 —— 业务代码统一调 sendVerificationCodeSms()。
 */

import { isPhoneVerificationEnabled } from "@/constants/features";

interface SendSmsParams {
  to: string; // 手机号（E.164 格式带 + 国际区号，如 +8613800138000）
  code: string;
  purpose: string;
}

interface SendSmsResult {
  ok: boolean;
  error?: string;
  provider?: string;
}

/**
 * 入口：根据手机号判断走哪个通道。
 *  - +86 开头 → 阿里云短信
 *  - 其他 → 国际短信通道（Twilio / Vonage 等）
 */
export async function sendVerificationCodeSms(params: SendSmsParams): Promise<SendSmsResult> {
  if (!isPhoneVerificationEnabled()) {
    return { ok: false, error: "Phone verification not enabled" };
  }

  const phone = params.to.trim();
  if (phone.startsWith("+86") || (!phone.startsWith("+") && phone.length === 11)) {
    return sendViaAliyun(params);
  }
  return sendViaInternational(params);
}

/**
 * 阿里云短信 —— 占位实现
 *
 * 启用时需要：
 *   1. 在阿里云完成签名 + 模板审核
 *   2. .env 添加：
 *      ALIYUN_SMS_ACCESS_KEY_ID=...
 *      ALIYUN_SMS_ACCESS_KEY_SECRET=...
 *      ALIYUN_SMS_SIGN_NAME=EAXAU
 *      ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxxxxx
 *   3. 把下面的 throw 替换成真正的 SDK 调用
 *
 * SDK 推荐：@alicloud/dysmsapi20170525
 *   pnpm add @alicloud/dysmsapi20170525 @alicloud/openapi-client
 */
async function sendViaAliyun(params: SendSmsParams): Promise<SendSmsResult> {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    return { ok: false, error: "Aliyun SMS not configured", provider: "aliyun" };
  }

  // TODO: 实装阿里云 SDK 调用
  // import * as Dysmsapi from "@alicloud/dysmsapi20170525";
  // import { Config } from "@alicloud/openapi-client";
  // const config = new Config({ accessKeyId, accessKeySecret });
  // config.endpoint = "dysmsapi.aliyuncs.com";
  // const client = new Dysmsapi.default(config);
  // const phone = params.to.replace(/^\+86/, "");
  // const req = new Dysmsapi.SendSmsRequest({
  //   phoneNumbers: phone,
  //   signName,
  //   templateCode,
  //   templateParam: JSON.stringify({ code: params.code }),
  // });
  // const res = await client.sendSms(req);
  // const success = res.body?.code === "OK";
  // return { ok: success, provider: "aliyun", error: success ? undefined : res.body?.message };

  console.warn("[sms] Aliyun SMS not implemented yet");
  return { ok: false, error: "Aliyun SMS not implemented", provider: "aliyun" };
}

/**
 * 国际短信 —— 占位实现
 *
 * 候选服务：
 *   - Twilio（最主流）
 *   - Vonage（前 Nexmo）
 *   - MessageBird
 *
 * 启用时需要：
 *   .env 添加对应服务的 API key
 *   填充实现
 */
async function sendViaInternational(params: SendSmsParams): Promise<SendSmsResult> {
  // TODO: 实装 Twilio / Vonage 等国际短信服务调用
  console.warn("[sms] International SMS not implemented yet");
  return { ok: false, error: "International SMS not implemented", provider: "international" };
}
