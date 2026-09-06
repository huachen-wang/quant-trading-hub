import express, { type Express } from "express";
import { z } from "zod";
import {
  handleVerifiedResendEvent,
  unsubscribeEmailNewsletter,
} from "../newsletter";
import {
  requireNewsletterBaseUrl,
  verifyResendWebhookSignature,
} from "./newsletter-security";

const supportedEmailEvents = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
  "email.failed",
] as const;

const resendEventSchema = z
  .object({
    type: z.string().min(1).max(80),
    created_at: z.string().datetime({ offset: true }),
    data: z
      .object({
        email_id: z.string().trim().min(3).max(160),
      })
      .passthrough(),
  })
  .passthrough();

const tokenSchema = z.string().regex(/^\d+\.\d+\.[A-Za-z0-9_-]{43}$/u);

export function registerNewsletterRoutes(app: Express) {
  // This route must be registered before express.json(): Svix verifies the raw body.
  app.post(
    "/api/email/resend-webhook",
    express.raw({ type: "application/json", limit: "256kb" }),
    async (req, res) => {
      const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
      if (!secret || !Buffer.isBuffer(req.body)) {
        res.status(401).json({ ok: false });
        return;
      }
      const providerEventKey = String(req.headers["svix-id"] || "");
      const payload = req.body.toString("utf8");
      try {
        if (
          !verifyResendWebhookSignature({
            payload,
            secret,
            headers: {
              id: providerEventKey,
              timestamp: String(req.headers["svix-timestamp"] || ""),
              signature: String(req.headers["svix-signature"] || ""),
            },
          })
        ) {
          res.status(400).json({ ok: false });
          return;
        }
        const event = resendEventSchema.parse(JSON.parse(payload));
        if (!(supportedEmailEvents as readonly string[]).includes(event.type)) {
          res.status(200).json({ ok: true, ignored: true });
          return;
        }
        try {
          await handleVerifiedResendEvent({
            providerEventKey,
            providerMessageId: event.data.email_id,
            eventType: event.type,
            eventOccurredAt: new Date(event.created_at),
          });
        } catch {
          // A valid event must be retried when our durable store is unavailable.
          res.status(503).json({ ok: false });
          return;
        }
        res.status(200).json({ ok: true });
      } catch {
        res.status(400).json({ ok: false });
      }
    },
  );

  app.get("/api/email/unsubscribe", (req, res) => {
    const token = tokenSchema.safeParse(req.query.token);
    if (!token.success) {
      res.status(400).send("Invalid unsubscribe link");
      return;
    }
    try {
      const baseUrl = requireNewsletterBaseUrl();
      res.redirect(
        303,
        `${baseUrl}/email/unsubscribe?token=${encodeURIComponent(token.data)}`,
      );
    } catch {
      res.status(503).send("Email preferences are temporarily unavailable");
    }
  });

  // RFC 8058 one-click endpoint. Invalid/superseded tokens still receive a
  // blank 200; durable-store outages receive 503 so the request can be retried.
  app.post("/api/email/unsubscribe", async (req, res) => {
    const token = tokenSchema.safeParse(req.query.token);
    if (!token.success) {
      res.status(400).end();
      return;
    }
    try {
      await unsubscribeEmailNewsletter(token.data);
      res.status(200).end();
    } catch {
      res.status(503).end();
    }
  });
}
