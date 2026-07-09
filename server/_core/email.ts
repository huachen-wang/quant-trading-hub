/**
 * Email Service — 邮件发送
 *
 * 默认使用 Resend（https://resend.com）作为 SMTP 替代方案。
 * 海外服务，对国际邮箱送达率好；国内邮箱（QQ/163/126）也有较稳定的送达率。
 *
 * 环境变量：
 *   RESEND_API_KEY     — Resend 控制台的 API key（必填，re_xxxxxx）
 *   EMAIL_FROM         — 发件人，例如 "EAXAU <noreply@eaxau.com>"
 *                        ⚠️ 域名必须先在 Resend 后台 Verify 通过
 *   EMAIL_REPLY_TO     — 可选，收到回复的邮箱
 *
 * 想换成阿里云 DirectMail / SMTP 的话，只需要替换 sendEmail() 的实现，
 * 上层调用方（verification.ts）完全不用改。
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "EAXAU <noreply@eaxau.com>";
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (!apiKey) {
    console.error("[email] RESEND_API_KEY not configured, email not sent");
    return { ok: false, error: "Email service not configured" };
  }

  try {
    const body: any = {
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    };
    if (params.text) body.text = params.text;
    if (replyTo) body.reply_to = replyTo;

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[email] Resend API error ${res.status}:`, errBody);
      return { ok: false, error: `Resend ${res.status}: ${errBody}` };
    }

    const data = (await res.json()) as { id?: string };
    console.log(`[email] Sent to ${params.to}, id=${data.id}`);
    return { ok: true, id: data.id };
  } catch (err: any) {
    console.error("[email] Send failed:", err);
    return { ok: false, error: err?.message || "Send failed" };
  }
}

/**
 * 验证码邮件 — 标准模板
 */
export async function sendVerificationCodeEmail(to: string, code: string, purpose: string): Promise<SendEmailResult> {
  const purposeLabel: Record<string, string> = {
    register: "注册账号",
    login: "登录验证",
    reset_password: "重置密码",
    bind_email: "绑定邮箱",
    verify_email: "验证邮箱",
  };
  const label = purposeLabel[purpose] || "账号验证";

  const subject = `【EAXAU】您的${label}验证码：${code}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0A1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 32px;color:#F1F5F9;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;padding:10px 20px;background:linear-gradient(135deg,#A8895A,#D8BC83);color:#0A1628;font-weight:900;font-size:18px;border-radius:8px;letter-spacing:0.04em;">EAXAU · SOURCE DESK</div>
    </div>
    <div style="background:rgba(30,41,59,0.6);border:1px solid rgba(148,163,184,0.12);border-radius:16px;padding:32px;">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;color:#F1F5F9;">${label}验证码</h1>
      <p style="font-size:14px;color:#94A3B8;margin:0 0 24px;line-height:1.6;">您正在进行 <b style="color:#D8BC83;">${label}</b> 操作。请在页面中输入下面的验证码完成验证：</p>
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="font-size:32px;font-weight:900;color:#D8BC83;letter-spacing:0.3em;font-family:'SF Mono',monospace;">${code}</div>
      </div>
      <p style="font-size:13px;color:#64748B;margin:0;line-height:1.6;">验证码 <b>5 分钟内有效</b>，请勿向任何人透露。如非本人操作，请忽略此邮件。</p>
    </div>
    <div style="text-align:center;margin-top:24px;font-size:12px;color:#64748B;">
      <p style="margin:0 0 8px;">© 2026 EAXAU · Source Desk</p>
      <p style="margin:0;">本邮件由系统自动发送，请勿回复</p>
    </div>
  </div>
</body>
</html>`;

  const text = `【EAXAU】${label}验证码：${code}\n\n验证码 5 分钟内有效，请勿向任何人透露。\n如非本人操作，请忽略此邮件。`;

  return sendEmail({ to, subject, html, text });
}
