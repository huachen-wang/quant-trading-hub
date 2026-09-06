import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createConfirmationToken,
  createUnsubscribeToken,
  decryptDeliveryPayload,
  encryptDeliveryPayload,
  hashConfirmationToken,
  newsletterConfigurationStatus,
  newsletterRequestIp,
  verifyResendWebhookSignature,
  verifyUnsubscribeToken,
} from "./newsletter-security";

const SECRET = "newsletter-secret-with-at-least-32-characters";
const WEBHOOK_SECRET = `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;

describe("newsletter security", () => {
  it("uses opaque confirmation tokens and stores only their hash", () => {
    const token = createConfirmationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(hashConfirmationToken(token)).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashConfirmationToken(token)).not.toContain(token);
  });

  it("binds unsubscribe links to subscription and consent version", () => {
    const token = createUnsubscribeToken(42, 3, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({
      subscriptionId: 42,
      consentVersion: 3,
    });
    expect(
      verifyUnsubscribeToken(token.replace("42.3", "42.4"), SECRET),
    ).toBeNull();
    expect(verifyUnsubscribeToken(token, `${SECRET}-wrong`)).toBeNull();
  });

  it("encrypts confirmation payloads and rejects tampering", () => {
    const plaintext = JSON.stringify({ token: "private-confirmation-token" });
    const encrypted = encryptDeliveryPayload(plaintext, SECRET);
    expect(encrypted).not.toContain("private-confirmation-token");
    expect(decryptDeliveryPayload(encrypted, SECRET)).toBe(plaintext);
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    expect(() => decryptDeliveryPayload(tampered, SECRET)).toThrow();
  });

  it("fails closed for incomplete or non-EAXAU production configuration", () => {
    expect(
      newsletterConfigurationStatus({ NODE_ENV: "production" }),
    ).toMatchObject({
      configured: false,
    });
    expect(
      newsletterConfigurationStatus({
        NODE_ENV: "production",
        DATABASE_URL: "mysql://configured",
        RESEND_API_KEY: "re_configured",
        RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET,
        EMAIL_SUBSCRIPTION_SECRET: SECRET,
        EMAIL_PUBLIC_BASE_URL: "https://attacker.example",
      }),
    ).toMatchObject({ configured: false, publicBaseUrl: null });
    expect(
      newsletterConfigurationStatus({
        NODE_ENV: "production",
        DATABASE_URL: "mysql://configured",
        RESEND_API_KEY: "re_configured",
        RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET,
        EMAIL_SUBSCRIPTION_SECRET: SECRET,
        EMAIL_PUBLIC_BASE_URL: "https://eaxau.com",
      }),
    ).toMatchObject({ configured: true, publicBaseUrl: "https://eaxau.com" });
  });

  it("ignores forwarded IPs until an exact trusted proxy depth is configured", () => {
    const request = {
      headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.8" },
      socket: { remoteAddress: "10.0.0.9" },
    };
    expect(newsletterRequestIp(request, {})).toBe("10.0.0.9");
    expect(
      newsletterRequestIp(request, { EMAIL_TRUSTED_PROXY_HOPS: "1" }),
    ).toBe("10.0.0.8");
    expect(
      newsletterRequestIp(request, { EMAIL_TRUSTED_PROXY_HOPS: "2" }),
    ).toBe("198.51.100.10");
  });

  it("verifies Resend signatures and rejects replay, payload and timestamp changes", () => {
    const now = new Date("2026-09-07T01:02:03.000Z");
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const id = "msg_test_123";
    const payload = JSON.stringify({ type: "email.delivered" });
    const signingKey = crypto.randomBytes(32);
    const secret = `whsec_${signingKey.toString("base64")}`;
    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(`${id}.${timestamp}.${payload}`)
      .digest("base64");
    const verify = (
      overrides: Partial<{
        payload: string;
        timestamp: string;
        signature: string;
        now: Date;
      }> = {},
    ) =>
      verifyResendWebhookSignature({
        payload: overrides.payload || payload,
        secret,
        now: overrides.now || now,
        headers: {
          id,
          timestamp: overrides.timestamp || timestamp,
          signature: overrides.signature || `v1,old v1,${signature}`,
        },
      });
    expect(verify()).toBe(true);
    expect(verify({ payload: `${payload} ` })).toBe(false);
    expect(verify({ signature: "v1,invalid" })).toBe(false);
    expect(verify({ now: new Date(now.getTime() + 301_000) })).toBe(false);
  });
});
