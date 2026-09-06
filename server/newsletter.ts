import {
  claimNewsletterCrmOutbox,
  claimNewsletterEmailDelivery,
  completeNewsletterCrmOutbox,
  confirmNewsletterSubscription,
  consumeNewsletterRateLimits,
  failNewsletterCrmOutbox,
  markNewsletterDeliveryAccepted,
  markNewsletterDeliveryFailed,
  NewsletterUnavailableError,
  reconcileStoredResendNewsletterEvents,
  recordResendNewsletterEvent,
  requestNewsletterConfirmation,
  unsubscribeNewsletter,
  type NewsletterAttribution,
} from "./newsletter-repository";
import { sendEmail } from "./_core/email";
import {
  createConfirmationToken,
  createUnsubscribeToken,
  decryptDeliveryPayload,
  encryptDeliveryPayload,
  hashConfirmationToken,
  newsletterConfigurationStatus,
  normalizeMarketingEmail,
  privacyHash,
  requireNewsletterBaseUrl,
  requireNewsletterSecret,
  verifyUnsubscribeToken,
} from "./_core/newsletter-security";
import type {
  EaxauEmailLocale,
  EaxauEmailSource,
} from "../shared/email-subscription";

export type NewsletterRequestInput = {
  email: string;
  source: EaxauEmailSource;
  locale: EaxauEmailLocale;
  attribution: NewsletterAttribution;
  requestIp: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mailShell(heading: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#070b12;color:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="max-width:560px;margin:0 auto;padding:36px 24px"><div style="font-size:11px;color:#d8bc83;font-weight:800;letter-spacing:1.5px;margin-bottom:12px">EAXAU · EA MARKETPLACE</div><div style="border:1px solid #263244;background:#0d1420;padding:28px"><h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">${heading}</h1>${body}</div><p style="font-size:11px;line-height:1.6;color:#718096;margin:18px 0 0">EAXAU · eaxau.com</p></div></body></html>`;
}

export function buildConfirmationEmail(
  locale: EaxauEmailLocale,
  confirmationUrl: string,
) {
  const url = escapeHtml(confirmationUrl);
  if (locale === "en") {
    return {
      subject: "Confirm your EAXAU email subscription",
      html: mailShell(
        "Confirm your subscription",
        `<p style="color:#aab7c8;line-height:1.7">You asked to receive EAXAU EA product updates and educational content. Confirm your email to finish subscribing.</p><p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#d8bc83;color:#07101a;text-decoration:none;font-weight:800;padding:12px 18px">Review and confirm</a></p><p style="color:#718096;font-size:12px;line-height:1.6">This link expires in 24 hours. If you did not request it, ignore this message.</p>`,
      ),
      text: `Confirm your EAXAU subscription: ${confirmationUrl}\n\nThe link expires in 24 hours. If you did not request it, ignore this message.`,
    };
  }
  if (locale === "ar") {
    return {
      subject: "تأكيد اشتراك بريد EAXAU",
      html: mailShell(
        "تأكيد الاشتراك",
        `<p dir="rtl" style="color:#aab7c8;line-height:1.8">طلبت تلقي تحديثات منتجات EA والمحتوى التعليمي من EAXAU. أكد بريدك لإتمام الاشتراك.</p><p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#d8bc83;color:#07101a;text-decoration:none;font-weight:800;padding:12px 18px">مراجعة وتأكيد</a></p><p dir="rtl" style="color:#718096;font-size:12px;line-height:1.8">تنتهي صلاحية الرابط خلال 24 ساعة. تجاهل الرسالة إذا لم تطلبها.</p>`,
      ),
      text: `تأكيد اشتراك EAXAU: ${confirmationUrl}\n\nتنتهي صلاحية الرابط خلال 24 ساعة.`,
    };
  }
  return {
    subject: "确认订阅 EAXAU 邮件",
    html: mailShell(
      "确认邮件订阅",
      `<p style="color:#aab7c8;line-height:1.7">你已申请接收 EAXAU 的 EA 产品更新与教育内容。请确认邮箱后完成订阅。</p><p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#d8bc83;color:#07101a;text-decoration:none;font-weight:800;padding:12px 18px">查看并确认</a></p><p style="color:#718096;font-size:12px;line-height:1.6">链接将在 24 小时后失效。如非本人操作，请忽略本邮件。</p>`,
    ),
    text: `确认 EAXAU 邮件订阅：${confirmationUrl}\n\n链接将在 24 小时后失效。如非本人操作，请忽略本邮件。`,
  };
}

export function buildWelcomeEmail(
  locale: EaxauEmailLocale,
  unsubscribeUrl: string,
) {
  const url = escapeHtml(unsubscribeUrl);
  if (locale === "en") {
    return {
      subject: "Your EAXAU subscription is active",
      html: mailShell(
        "Subscription confirmed",
        `<p style="color:#aab7c8;line-height:1.7">You will receive EAXAU EA product updates and educational content. Purchase, payment and trading notices use separate service channels.</p><p style="color:#718096;font-size:12px;line-height:1.6">You can <a href="${url}" style="color:#d8bc83">unsubscribe at any time</a>.</p>`,
      ),
      text: `Your EAXAU subscription is active. You will receive EA product updates and educational content.\n\nUnsubscribe: ${unsubscribeUrl}`,
    };
  }
  if (locale === "ar") {
    return {
      subject: "تم تفعيل اشتراك EAXAU",
      html: mailShell(
        "تم تأكيد الاشتراك",
        `<p dir="rtl" style="color:#aab7c8;line-height:1.8">ستتلقى تحديثات منتجات EA والمحتوى التعليمي من EAXAU. تستخدم إشعارات الشراء والدفع والتداول قنوات خدمة منفصلة.</p><p dir="rtl" style="color:#718096;font-size:12px;line-height:1.8"><a href="${url}" style="color:#d8bc83">إلغاء الاشتراك في أي وقت</a>.</p>`,
      ),
      text: `تم تفعيل اشتراك EAXAU.\n\nإلغاء الاشتراك: ${unsubscribeUrl}`,
    };
  }
  return {
    subject: "EAXAU 邮件订阅已生效",
    html: mailShell(
      "订阅确认成功",
      `<p style="color:#aab7c8;line-height:1.7">后续你会收到 EAXAU 的 EA 产品更新与教育内容。购买、付款和交易通知使用独立的服务通道。</p><p style="color:#718096;font-size:12px;line-height:1.6">你可以随时<a href="${url}" style="color:#d8bc83">退订</a>。</p>`,
    ),
    text: `EAXAU 邮件订阅已生效。后续你会收到 EA 产品更新与教育内容。\n\n退订：${unsubscribeUrl}`,
  };
}

export async function requestEmailNewsletter(input: NewsletterRequestInput) {
  const config = newsletterConfigurationStatus();
  if (!config.configured || !crmNewsletterConfigurationStatus().configured)
    throw new NewsletterUnavailableError(
      "Email subscription service is unavailable",
    );
  const secret = requireNewsletterSecret();
  const normalizedEmail = normalizeMarketingEmail(input.email);
  await consumeNewsletterRateLimits({
    emailHash: privacyHash(normalizedEmail, "EMAIL", secret),
    ipHash: privacyHash(input.requestIp || "unknown", "IP", secret),
    now: new Date(),
  });
  const token = createConfirmationToken();
  await requestNewsletterConfirmation({
    normalizedEmail,
    source: input.source,
    locale: input.locale,
    attribution: input.attribution,
    confirmationTokenHash: hashConfirmationToken(token),
    confirmationPayloadCiphertext: encryptDeliveryPayload(
      JSON.stringify({ token }),
      secret,
    ),
    now: new Date(),
  });
  await drainNewsletterEmailOutbox(1).catch(() => undefined);
  return { ok: true } as const;
}

export async function confirmEmailNewsletter(token: string) {
  const secret = requireNewsletterSecret();
  const result = await confirmNewsletterSubscription({
    confirmationTokenHash: hashConfirmationToken(token),
    now: new Date(),
  });
  if (!result.valid)
    return { ok: false, reason: "INVALID_OR_EXPIRED" } as const;
  await Promise.allSettled([
    drainNewsletterEmailOutbox(1),
    drainNewsletterCrmOutbox(1),
  ]);
  return { ok: true } as const;
}

export async function unsubscribeEmailNewsletter(token: string) {
  const secret = requireNewsletterSecret();
  const claims = verifyUnsubscribeToken(token, secret);
  if (!claims) return { ok: false } as const;
  const result = await unsubscribeNewsletter({ ...claims, now: new Date() });
  if (!result.valid) return { ok: false } as const;
  await drainNewsletterCrmOutbox(1).catch(() => undefined);
  return { ok: true } as const;
}

export async function drainNewsletterEmailOutbox(limit = 10) {
  const config = newsletterConfigurationStatus();
  if (!config.configured) return 0;
  const secret = requireNewsletterSecret();
  const baseUrl = requireNewsletterBaseUrl();
  let handled = 0;
  while (handled < limit) {
    const item = await claimNewsletterEmailDelivery(new Date());
    if (!item) break;
    try {
      let mail;
      if (item.messageKind === "CONFIRMATION") {
        const decrypted = decryptDeliveryPayload(
          item.payloadCiphertext || "",
          secret,
        );
        const token = (JSON.parse(decrypted) as { token?: unknown }).token;
        if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(token)) {
          throw new Error("INVALID_ENCRYPTED_PAYLOAD");
        }
        const confirmationUrl = `${baseUrl}/email/confirm?token=${encodeURIComponent(token)}`;
        mail = buildConfirmationEmail(item.locale, confirmationUrl);
      } else {
        const token = createUnsubscribeToken(
          item.subscriptionId,
          item.consentVersion,
          secret,
        );
        const unsubscribePage = `${baseUrl}/email/unsubscribe?token=${encodeURIComponent(token)}`;
        const oneClickUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
        mail = {
          ...buildWelcomeEmail(item.locale, unsubscribePage),
          headers: {
            "List-Unsubscribe": `<${oneClickUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      }
      const result = await sendEmail({
        ...mail,
        to: item.email,
        idempotencyKey: item.idempotencyKey,
        retryAttempts: 3,
        tags: [
          { name: "brand", value: "eaxau" },
          { name: "kind", value: item.messageKind.toLowerCase() },
        ],
      });
      if (result.ok && result.id) {
        await markNewsletterDeliveryAccepted(item, result.id, new Date());
        // A webhook can beat the provider response by a few milliseconds. If it
        // arrived before provider_message_id was stored, replay the durable event.
        await reconcileStoredResendNewsletterEvents(result.id);
      } else {
        const errorCode = result.ok ? "MISSING_PROVIDER_ID" : result.error;
        const retryable = result.ok ? true : result.retryable;
        await markNewsletterDeliveryFailed(item, {
          retryable,
          errorCode,
          now: new Date(),
        });
      }
    } catch (error) {
      await markNewsletterDeliveryFailed(item, {
        retryable: false,
        errorCode:
          error instanceof Error ? error.message : "DELIVERY_BUILD_FAILED",
        now: new Date(),
      });
    }
    handled += 1;
  }
  return handled;
}

export function crmNewsletterConfigurationStatus(
  env: NodeJS.ProcessEnv = process.env,
) {
  const base = env.XAU_CRM_BASE_URL?.trim();
  let baseUrl: string | null = null;
  try {
    if (base) {
      const parsed = new URL(base);
      const protocolAllowed =
        parsed.protocol === "https:" ||
        (env.NODE_ENV !== "production" && parsed.protocol === "http:");
      if (
        protocolAllowed &&
        !parsed.username &&
        !parsed.password &&
        parsed.pathname === "/"
      ) {
        baseUrl = parsed.origin;
      }
    }
  } catch {
    baseUrl = null;
  }
  return {
    configured: Boolean(
      baseUrl &&
      env.CRM_INGEST_SECRET?.trim() &&
      env.CRM_EMAIL_EVENTS_SECRET?.trim(),
    ),
    baseUrl,
    ingestSecretConfigured: Boolean(env.CRM_INGEST_SECRET?.trim()),
    emailEventsSecretConfigured: Boolean(env.CRM_EMAIL_EVENTS_SECRET?.trim()),
  };
}

function responseErrorCode(status: number, body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (
      typeof parsed.error === "string" &&
      /^[a-z0-9_.-]+$/iu.test(parsed.error)
    ) {
      return `HTTP_${status}_${parsed.error}`;
    }
  } catch {
    // CRM error bodies are not trusted or logged verbatim.
  }
  return `HTTP_${status}`;
}

export async function drainNewsletterCrmOutbox(limit = 10) {
  const config = crmNewsletterConfigurationStatus();
  if (!config.configured || !config.baseUrl) return 0;
  let handled = 0;
  while (handled < limit) {
    const item = await claimNewsletterCrmOutbox(new Date());
    if (!item) break;
    const consent = item.eventKind === "CONSENT_CONFIRMED";
    const endpoint = consent
      ? "/api/integrations/website-applications"
      : "/api/integrations/email-events";
    const secret = consent
      ? process.env.CRM_INGEST_SECRET!
      : process.env.CRM_EMAIL_EVENTS_SECRET!;
    try {
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          "Idempotency-Key":
            item.eventKind === "CONSENT_CONFIRMED"
              ? `eaxau-consent-${item.id}`
              : `eaxau-email-event-${item.id}`,
        },
        body: item.payloadJson,
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) {
        await completeNewsletterCrmOutbox(item, response.status, new Date());
      } else {
        const code = responseErrorCode(
          response.status,
          await response.text().catch(() => ""),
        );
        const retryable =
          response.status === 409 ||
          response.status === 429 ||
          response.status >= 500;
        await failNewsletterCrmOutbox(item, {
          retryable,
          httpStatus: response.status,
          errorCode: code,
          now: new Date(),
        });
      }
    } catch {
      await failNewsletterCrmOutbox(item, {
        retryable: true,
        httpStatus: null,
        errorCode: "NETWORK_ERROR",
        now: new Date(),
      });
    }
    handled += 1;
  }
  return handled;
}

export async function handleVerifiedResendEvent(input: {
  providerEventKey: string;
  providerMessageId: string;
  eventType: string;
  eventOccurredAt: Date;
}) {
  const result = await recordResendNewsletterEvent(input);
  if (result.linked) await drainNewsletterCrmOutbox(1).catch(() => undefined);
  return result;
}
