import crypto from "node:crypto";
import { isProductionRuntime } from "./runtime-env";

const TOKEN_BYTES = 32;
const MIN_SECRET_LENGTH = 32;
const ALLOWED_PRODUCTION_HOSTS = new Set(["eaxau.com", "www.eaxau.com"]);

type NewsletterEnvironment = Partial<NodeJS.ProcessEnv> & {
  EMAIL_SUBSCRIPTION_SECRET?: string;
  EMAIL_PUBLIC_BASE_URL?: string;
  EMAIL_TRUSTED_PROXY_HOPS?: string;
  RESEND_API_KEY?: string;
  RESEND_WEBHOOK_SECRET?: string;
};

export type NewsletterConfiguration = {
  configured: boolean;
  webhookConfigured: boolean;
  publicBaseUrl: string | null;
  reasons: string[];
};

function resendWebhookSigningKey(secret: string | undefined) {
  const value = secret?.trim() || "";
  if (!value.startsWith("whsec_")) return null;
  const encoded = value.slice("whsec_".length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) return null;
  const key = Buffer.from(encoded, "base64");
  return key.length >= 16 ? key : null;
}

export function newsletterConfigurationStatus(
  env: NewsletterEnvironment = process.env,
): NewsletterConfiguration {
  const reasons: string[] = [];
  const secret = env.EMAIL_SUBSCRIPTION_SECRET?.trim() || "";
  if (secret.length < MIN_SECRET_LENGTH)
    reasons.push("EMAIL_SUBSCRIPTION_SECRET");
  if (!env.RESEND_API_KEY?.trim()) reasons.push("RESEND_API_KEY");
  if (!resendWebhookSigningKey(env.RESEND_WEBHOOK_SECRET))
    reasons.push("RESEND_WEBHOOK_SECRET");
  if (!env.DATABASE_URL?.trim()) reasons.push("DATABASE_URL");

  const configuredUrl = env.EMAIL_PUBLIC_BASE_URL?.trim();
  const fallbackUrl = isProductionRuntime(env) ? null : "http://localhost:8081";
  const candidate = configuredUrl || fallbackUrl;
  let publicBaseUrl: string | null = null;
  if (!candidate) {
    reasons.push("EMAIL_PUBLIC_BASE_URL");
  } else {
    try {
      const url = new URL(candidate);
      const allowedProtocol = isProductionRuntime(env)
        ? url.protocol === "https:" &&
          ALLOWED_PRODUCTION_HOSTS.has(url.hostname)
        : url.protocol === "http:" || url.protocol === "https:";
      if (
        !allowedProtocol ||
        url.username ||
        url.password ||
        url.pathname !== "/"
      ) {
        reasons.push("EMAIL_PUBLIC_BASE_URL");
      } else {
        publicBaseUrl = url.origin;
      }
    } catch {
      reasons.push("EMAIL_PUBLIC_BASE_URL");
    }
  }

  return {
    configured: reasons.length === 0,
    webhookConfigured: Boolean(
      resendWebhookSigningKey(env.RESEND_WEBHOOK_SECRET),
    ),
    publicBaseUrl,
    reasons,
  };
}

export function requireNewsletterSecret(
  env: NewsletterEnvironment = process.env,
) {
  const secret = env.EMAIL_SUBSCRIPTION_SECRET?.trim() || "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error("Email subscription service is not configured");
  }
  return secret;
}

export function requireNewsletterBaseUrl(
  env: NewsletterEnvironment = process.env,
) {
  const status = newsletterConfigurationStatus({
    ...env,
    DATABASE_URL: env.DATABASE_URL || "configured-for-url-validation",
    RESEND_API_KEY: env.RESEND_API_KEY || "configured-for-url-validation",
    EMAIL_SUBSCRIPTION_SECRET:
      env.EMAIL_SUBSCRIPTION_SECRET || "x".repeat(MIN_SECRET_LENGTH),
  });
  if (!status.publicBaseUrl) {
    throw new Error("Email subscription service is not configured");
  }
  return status.publicBaseUrl;
}

export function normalizeMarketingEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createConfirmationToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashConfirmationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function actionSignature(payload: string, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(`eaxau-email-unsubscribe\0${payload}`)
    .digest("base64url");
}

export function createUnsubscribeToken(
  subscriptionId: number,
  consentVersion: number,
  secret: string,
) {
  const payload = `${subscriptionId}.${consentVersion}`;
  return `${payload}.${actionSignature(payload, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string) {
  const match = /^(\d+)\.(\d+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  const payload = `${match[1]}.${match[2]}`;
  const expected = Buffer.from(actionSignature(payload, secret));
  const supplied = Buffer.from(match[3]);
  if (
    expected.length !== supplied.length ||
    !crypto.timingSafeEqual(expected, supplied)
  ) {
    return null;
  }
  const subscriptionId = Number.parseInt(match[1], 10);
  const consentVersion = Number.parseInt(match[2], 10);
  if (
    !Number.isSafeInteger(subscriptionId) ||
    !Number.isSafeInteger(consentVersion)
  ) {
    return null;
  }
  return { subscriptionId, consentVersion };
}

export function privacyHash(
  value: string,
  purpose: "EMAIL" | "IP",
  secret: string,
) {
  return crypto
    .createHmac("sha256", secret)
    .update(`eaxau-email-rate:${purpose}\0${value}`)
    .digest("hex");
}

function deliveryEncryptionKey(secret: string) {
  return crypto
    .createHash("sha256")
    .update(`eaxau-email-delivery\0${secret}`)
    .digest();
}

export function encryptDeliveryPayload(payload: string, secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    deliveryEncryptionKey(secret),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptDeliveryPayload(payload: string, secret: string) {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Invalid delivery payload");
  const [iv, tag, ciphertext] = parts.map((part) =>
    Buffer.from(part, "base64url"),
  );
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Invalid delivery payload");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deliveryEncryptionKey(secret),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function newsletterRequestIp(
  req: {
    headers?: Record<string, unknown>;
    socket?: { remoteAddress?: string | undefined };
  },
  env: NewsletterEnvironment = process.env,
) {
  const socketAddress = req.socket?.remoteAddress || "unknown";
  const trustedProxyHops = Number.parseInt(
    env.EMAIL_TRUSTED_PROXY_HOPS?.trim() || "0",
    10,
  );
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) {
    return socketAddress;
  }
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded !== "string") return socketAddress;
  const chain = forwarded
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!chain.length) return socketAddress;
  return chain[Math.max(0, chain.length - trustedProxyHops)] || socketAddress;
}

type ResendWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

/**
 * Verify the standard-webhooks/Svix signature used by Resend. This stays local
 * so webhook verification does not add a second HTTP or SDK dependency.
 */
export function verifyResendWebhookSignature(input: {
  payload: string;
  headers: ResendWebhookHeaders;
  secret: string;
  now?: Date;
}) {
  const id = input.headers.id.trim();
  const timestampText = input.headers.timestamp.trim();
  if (!id || id.length > 160 || !/^\d{10}$/u.test(timestampText)) return false;
  const timestamp = Number.parseInt(timestampText, 10);
  const nowSeconds = Math.floor((input.now || new Date()).getTime() / 1000);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > 5 * 60
  ) {
    return false;
  }
  const key = resendWebhookSigningKey(input.secret);
  if (!key) return false;
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestampText}.${input.payload}`)
    .digest("base64");
  return input.headers.signature
    .trim()
    .split(/\s+/u)
    .some((entry) => {
      const match = /^v1,([^\s,]+)$/u.exec(entry);
      if (!match) return false;
      const supplied = Buffer.from(match[1]);
      const wanted = Buffer.from(expected);
      return (
        supplied.length === wanted.length &&
        crypto.timingSafeEqual(supplied, wanted)
      );
    });
}
