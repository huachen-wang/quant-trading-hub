import crypto from "node:crypto";
import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleEvent: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("../newsletter", () => ({
  handleVerifiedResendEvent: mocks.handleEvent,
  unsubscribeEmailNewsletter: mocks.unsubscribe,
}));

import { registerNewsletterRoutes } from "./newsletter-routes";

const signingKey = Buffer.from("0123456789abcdef0123456789abcdef");
const webhookSecret = `whsec_${signingKey.toString("base64")}`;

function signedHeaders(payload: string, now = new Date()) {
  const id = "evt_resend_test_1";
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return {
    "Content-Type": "application/json",
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
  };
}

describe("newsletter HTTP routes", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", webhookSecret);
    vi.stubEnv(
      "EMAIL_SUBSCRIPTION_SECRET",
      "newsletter-secret-with-at-least-32-characters",
    );
    vi.stubEnv("EMAIL_PUBLIC_BASE_URL", "http://localhost:8081");
    mocks.handleEvent.mockResolvedValue({ duplicate: false, linked: true });
    mocks.unsubscribe.mockResolvedValue({ ok: true });
    const app = express();
    registerNewsletterRoutes(app);
    app.use(express.json());
    server = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("test server missing address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("accepts a valid signed Resend event with the untouched body", async () => {
    const payload = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: "provider-message-1" },
    });
    const response = await fetch(`${baseUrl}/api/email/resend-webhook`, {
      method: "POST",
      headers: signedHeaders(payload),
      body: payload,
    });
    expect(response.status).toBe(200);
    expect(mocks.handleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEventKey: "evt_resend_test_1",
        providerMessageId: "provider-message-1",
        eventType: "email.delivered",
      }),
    );
  });

  it("rejects tampered webhook payloads before persistence", async () => {
    const original = JSON.stringify({ type: "email.delivered" });
    const response = await fetch(`${baseUrl}/api/email/resend-webhook`, {
      method: "POST",
      headers: signedHeaders(original),
      body: JSON.stringify({ type: "email.complained" }),
    });
    expect(response.status).toBe(400);
    expect(mocks.handleEvent).not.toHaveBeenCalled();
  });

  it("returns 503 for a valid event when durable persistence fails", async () => {
    mocks.handleEvent.mockRejectedValueOnce(new Error("database down"));
    const payload = JSON.stringify({
      type: "email.complained",
      created_at: new Date().toISOString(),
      data: { email_id: "provider-message-2" },
    });
    const response = await fetch(`${baseUrl}/api/email/resend-webhook`, {
      method: "POST",
      headers: signedHeaders(payload),
      body: payload,
    });
    expect(response.status).toBe(503);
  });

  it("returns 503 for a valid one-click token when persistence fails", async () => {
    mocks.unsubscribe.mockRejectedValueOnce(new Error("database down"));
    const token = `1.1.${"a".repeat(43)}`;
    const response = await fetch(
      `${baseUrl}/api/email/unsubscribe?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      },
    );
    expect(response.status).toBe(503);
  });
});
