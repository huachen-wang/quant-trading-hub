import crypto from "node:crypto";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { getDatabasePool } from "./db";
import {
  EAXAU_EMAIL_BRAND_SCOPE,
  EAXAU_EMAIL_CONTENT_SCOPE,
  EAXAU_EMAIL_NOTICE_VERSION,
  EAXAU_EMAIL_SOURCE_KEY,
  EAXAU_EMAIL_SOURCE_PATHS,
  type EaxauEmailLocale,
  type EaxauEmailSource,
} from "../shared/email-subscription";

const HOUR_MS = 60 * 60 * 1000;
const CONFIRMATION_COOLDOWN_MS = 60 * 1000;
export const CONFIRMATION_LIFETIME_MS = 24 * HOUR_MS;
const EMAIL_ATTEMPTS_PER_HOUR = 5;
const IP_ATTEMPTS_PER_HOUR = 20;

export class NewsletterUnavailableError extends Error {}
export class NewsletterRateLimitError extends Error {}

export type NewsletterAttribution = Partial<{
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  referrer: string;
}>;

type SubscriptionRow = RowDataPacket & {
  id: number;
  applicationId: string;
  normalizedEmail: string;
  brandScope: string;
  sourceKey: string;
  sourcePath: string;
  attributionJson: string | null;
  locale: EaxauEmailLocale;
  status: "PENDING_CONFIRMATION" | "ACTIVE" | "UNSUBSCRIBED" | "SUPPRESSED";
  consentBasis: "PENDING_VERIFICATION" | "EXPRESS_CONSENT" | "DECLINED";
  evidenceCapturedAt: Date;
  noticeVersion: string;
  contentScope: string;
  regionCode: string;
  confirmationExpiresAt: Date | null;
  confirmationRequestedAt: Date | null;
  consentVersion: number;
  confirmedAt: Date | null;
  createdAt: Date;
};

type DeliveryRow = RowDataPacket & {
  id: number;
  idempotencyKey: string;
  deliveryStatus: string;
};

export type ConfirmationDelivery = {
  subscriptionId: number;
  email: string;
  locale: EaxauEmailLocale;
  consentVersion: number;
  idempotencyKey: string;
};

export type WelcomeDelivery = ConfirmationDelivery & {
  confirmedAt: Date;
};

export type OutboxItem = {
  id: number;
  eventKind: "CONSENT_CONFIRMED" | "UNSUBSCRIBED" | "PROVIDER_EVENT";
  payloadJson: string;
  attemptCount: number;
  leaseToken: string;
};

export type EmailDeliveryOutboxItem = {
  id: number;
  subscriptionId: number;
  messageKind: "CONFIRMATION" | "WELCOME";
  consentVersion: number;
  idempotencyKey: string;
  payloadCiphertext: string | null;
  email: string;
  locale: EaxauEmailLocale;
  applicationId: string;
  confirmedAt: Date | null;
  attemptCount: number;
  leaseToken: string;
};

function requirePool() {
  const pool = getDatabasePool();
  if (!pool)
    throw new NewsletterUnavailableError(
      "Email subscription database is unavailable",
    );
  return pool;
}

async function inTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
) {
  const connection = await requirePool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function subscriptionSelect() {
  return `
    SELECT id, application_id AS applicationId, normalized_email AS normalizedEmail,
      brand_scope AS brandScope, source_key AS sourceKey, source_path AS sourcePath,
      attribution_json AS attributionJson, locale, status, consent_basis AS consentBasis,
      evidence_captured_at AS evidenceCapturedAt, notice_version AS noticeVersion,
      content_scope AS contentScope, region_code AS regionCode,
      confirmation_expires_at AS confirmationExpiresAt,
      confirmation_requested_at AS confirmationRequestedAt,
      consent_version AS consentVersion, confirmed_at AS confirmedAt,
      created_at AS createdAt
    FROM email_marketing_subscriptions
  `;
}

async function consumeRateBucket(
  connection: PoolConnection,
  keyType: "EMAIL" | "IP",
  keyHash: string,
  limit: number,
  now: Date,
) {
  const windowStartedAt = new Date(
    Math.floor(now.getTime() / HOUR_MS) * HOUR_MS,
  );
  await connection.execute(
    `INSERT INTO email_subscription_rate_limits
      (key_type, key_hash, window_started_at, attempt_count)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE attempt_count=attempt_count+1`,
    [keyType, keyHash, windowStartedAt],
  );
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT attempt_count AS attemptCount
     FROM email_subscription_rate_limits
     WHERE key_type=? AND key_hash=? AND window_started_at=?`,
    [keyType, keyHash, windowStartedAt],
  );
  return Number(rows[0]?.attemptCount || 0) <= limit;
}

export async function consumeNewsletterRateLimits(input: {
  emailHash: string;
  ipHash: string;
  now: Date;
}) {
  const allowed = await inTransaction(async (connection) => {
    const emailAllowed = await consumeRateBucket(
      connection,
      "EMAIL",
      input.emailHash,
      EMAIL_ATTEMPTS_PER_HOUR,
      input.now,
    );
    const ipAllowed = await consumeRateBucket(
      connection,
      "IP",
      input.ipHash,
      IP_ATTEMPTS_PER_HOUR,
      input.now,
    );
    await connection.execute(
      "DELETE FROM email_subscription_rate_limits WHERE updated_at < DATE_SUB(?, INTERVAL 2 DAY) LIMIT 500",
      [input.now],
    );
    return emailAllowed && ipAllowed;
  });
  if (!allowed)
    throw new NewsletterRateLimitError("Too many subscription requests");
}

export async function requestNewsletterConfirmation(input: {
  normalizedEmail: string;
  source: EaxauEmailSource;
  locale: EaxauEmailLocale;
  attribution: NewsletterAttribution;
  confirmationTokenHash: string;
  confirmationPayloadCiphertext: string;
  now: Date;
}) {
  return inTransaction(
    async (connection): Promise<ConfirmationDelivery | null> => {
      const applicationId = crypto.randomUUID();
      const consentVersion = 1;
      const sourcePath = EAXAU_EMAIL_SOURCE_PATHS[input.source];
      const evidenceSource = `form:eaxau-email:${applicationId}:v${consentVersion}:double-opt-in`;
      const attributionJson = Object.keys(input.attribution).length
        ? JSON.stringify(input.attribution)
        : null;
      const confirmationExpiresAt = new Date(
        input.now.getTime() + CONFIRMATION_LIFETIME_MS,
      );
      const [insert] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO email_marketing_subscriptions (
        application_id, normalized_email, brand_scope, source_key, source_path,
        attribution_json, locale, status, consent_basis, basis_detail,
        evidence_source, evidence_captured_at, notice_version, content_scope,
        region_code, confirmation_token_hash, confirmation_expires_at,
        confirmation_requested_at, consent_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_CONFIRMATION', 'PENDING_VERIFICATION',
        ?, ?, ?, ?, ?, 'UNKNOWN', ?, ?, ?, ?)`,
        [
          applicationId,
          input.normalizedEmail,
          EAXAU_EMAIL_BRAND_SCOPE,
          EAXAU_EMAIL_SOURCE_KEY,
          sourcePath,
          attributionJson,
          input.locale,
          "Homepage checkbox recorded; awaiting email confirmation",
          evidenceSource,
          input.now,
          EAXAU_EMAIL_NOTICE_VERSION,
          EAXAU_EMAIL_CONTENT_SCOPE,
          input.confirmationTokenHash,
          confirmationExpiresAt,
          input.now,
          consentVersion,
        ],
      );

      const [rows] = await connection.execute<SubscriptionRow[]>(
        `${subscriptionSelect()} WHERE normalized_email=? AND brand_scope=? LIMIT 1 FOR UPDATE`,
        [input.normalizedEmail, EAXAU_EMAIL_BRAND_SCOPE],
      );
      let row = rows[0];
      if (!row)
        throw new NewsletterUnavailableError(
          "Subscription row was not created",
        );

      if (insert.affectedRows === 0) {
        if (row.status === "ACTIVE" || row.status === "SUPPRESSED") return null;
        const lastRequest = row.confirmationRequestedAt?.getTime() || 0;
        if (input.now.getTime() - lastRequest < CONFIRMATION_COOLDOWN_MS)
          return null;
        const nextVersion = row.consentVersion + 1;
        const nextEvidence = `form:eaxau-email:${row.applicationId}:v${nextVersion}:double-opt-in`;
        await connection.execute(
          `UPDATE email_marketing_subscriptions SET
          source_key=?, source_path=?, attribution_json=?, locale=?,
          status='PENDING_CONFIRMATION', consent_basis='PENDING_VERIFICATION',
          basis_detail=?, evidence_source=?, evidence_captured_at=?,
          notice_version=?, content_scope=?, region_code='UNKNOWN',
          confirmation_token_hash=?, confirmation_expires_at=?,
          confirmation_requested_at=?, consent_version=?, confirmed_at=NULL,
          unsubscribed_at=NULL, suppression_reason=NULL
         WHERE id=?`,
          [
            EAXAU_EMAIL_SOURCE_KEY,
            sourcePath,
            attributionJson,
            input.locale,
            "Homepage checkbox recorded; awaiting email confirmation",
            nextEvidence,
            input.now,
            EAXAU_EMAIL_NOTICE_VERSION,
            EAXAU_EMAIL_CONTENT_SCOPE,
            input.confirmationTokenHash,
            confirmationExpiresAt,
            input.now,
            nextVersion,
            row.id,
          ],
        );
        row = {
          ...row,
          sourcePath,
          attributionJson,
          locale: input.locale,
          consentVersion: nextVersion,
        };
        await connection.execute(
          `UPDATE email_subscription_deliveries SET
          delivery_status='DEAD', error_code='TOKEN_ROTATED', payload_ciphertext=NULL
         WHERE subscription_id=? AND message_kind='CONFIRMATION'
           AND consent_version<? AND delivery_status IN ('PENDING','FAILED')`,
          [row.id, nextVersion],
        );
      }

      const idempotencyKey = `eaxau-confirm-${row.applicationId}-v${row.consentVersion}`;
      await connection.execute(
        `INSERT IGNORE INTO email_subscription_events
        (subscription_id, event_key, event_type, consent_version, detail_json, occurred_at)
       VALUES (?, ?, 'CONSENT_REQUESTED', ?, ?, ?)`,
        [
          row.id,
          `eaxau:consent-requested:${row.applicationId}:v${row.consentVersion}`,
          row.consentVersion,
          JSON.stringify({
            brand: EAXAU_EMAIL_BRAND_SCOPE,
            sourceKey: EAXAU_EMAIL_SOURCE_KEY,
            sourcePath,
            noticeVersion: EAXAU_EMAIL_NOTICE_VERSION,
            contentScope: EAXAU_EMAIL_CONTENT_SCOPE,
          }),
          input.now,
        ],
      );
      await connection.execute(
        `INSERT IGNORE INTO email_subscription_deliveries
        (subscription_id, brand_scope, message_kind, consent_version, idempotency_key, payload_ciphertext)
       VALUES (?, ?, 'CONFIRMATION', ?, ?, ?)`,
        [
          row.id,
          EAXAU_EMAIL_BRAND_SCOPE,
          row.consentVersion,
          idempotencyKey,
          input.confirmationPayloadCiphertext,
        ],
      );
      return {
        subscriptionId: row.id,
        email: row.normalizedEmail,
        locale: row.locale,
        consentVersion: row.consentVersion,
        idempotencyKey,
      };
    },
  );
}

function parseAttribution(row: SubscriptionRow) {
  let saved: NewsletterAttribution = {};
  try {
    saved = row.attributionJson ? JSON.parse(row.attributionJson) : {};
  } catch {
    saved = {};
  }
  return {
    utmSource: saved.utmSource || null,
    utmMedium: saved.utmMedium || null,
    utmCampaign: saved.utmCampaign || null,
    utmContent: saved.utmContent || null,
    utmTerm: saved.utmTerm || null,
    landingPath: row.sourcePath,
    referrer: saved.referrer || null,
    capturedAt: row.evidenceCapturedAt.toISOString(),
  };
}

function buildCrmConsentPayload(row: SubscriptionRow, confirmedAt: Date) {
  const contactKey = crypto
    .createHash("sha256")
    .update(row.normalizedEmail)
    .digest("hex");
  return {
    applicationId: row.applicationId,
    reference: `EAXAU-MAIL-${row.applicationId.slice(0, 8).toUpperCase()}`,
    version: row.consentVersion,
    status: "new",
    platformCode: "EMAIL_NEWSLETTER",
    platformName: "EAXAU 邮件订阅",
    contactMethod: "email",
    contact: row.normalizedEmail,
    contactKey,
    capitalScale: null,
    owner: null,
    firstContactDueAt: null,
    firstContactedAt: null,
    nextAction: "按已确认范围发送 EAXAU 内容",
    nextActionAt: null,
    matchedChannel: "Resend",
    benefitSummary: "EAXAU EA 产品更新与教育内容",
    settlementStatus: "not_applicable",
    submittedAt: row.createdAt.toISOString(),
    updatedAt: confirmedAt.toISOString(),
    brand: "eaxau",
    product: "ea_product",
    attribution: parseAttribution(row),
    consent: {
      marketingOptIn: true,
      noticeVersion: row.noticeVersion,
      capturedAt: confirmedAt.toISOString(),
      evidence: `form:eaxau-email:${row.applicationId}:v${row.consentVersion}:confirmed`,
      scope: ["EDUCATION", "PRODUCT_UPDATE"],
      regionCode: "UNKNOWN",
    },
  };
}

export async function confirmNewsletterSubscription(input: {
  confirmationTokenHash: string;
  now: Date;
}) {
  return inTransaction(
    async (
      connection,
    ): Promise<{
      valid: boolean;
      delivery: WelcomeDelivery | null;
    }> => {
      const [rows] = await connection.execute<SubscriptionRow[]>(
        `${subscriptionSelect()} WHERE confirmation_token_hash=? LIMIT 1 FOR UPDATE`,
        [input.confirmationTokenHash],
      );
      const row = rows[0];
      if (
        !row ||
        row.status === "UNSUBSCRIBED" ||
        row.status === "SUPPRESSED"
      ) {
        return { valid: false, delivery: null };
      }
      if (
        row.status !== "ACTIVE" &&
        (!row.confirmationExpiresAt ||
          row.confirmationExpiresAt.getTime() < input.now.getTime())
      ) {
        return { valid: false, delivery: null };
      }

      const confirmedAt = row.confirmedAt || input.now;
      await connection.execute(
        `UPDATE email_marketing_subscriptions SET
        status='ACTIVE', consent_basis='EXPRESS_CONSENT',
        basis_detail='Homepage checkbox plus email confirmation',
        evidence_captured_at=?, confirmed_at=?, unsubscribed_at=NULL
       WHERE id=?`,
        [confirmedAt, confirmedAt, row.id],
      );

      const confirmationEventKey = `eaxau:consent-confirmed:${row.applicationId}:v${row.consentVersion}`;
      await connection.execute(
        `INSERT IGNORE INTO email_subscription_events
        (subscription_id, event_key, event_type, consent_version, detail_json, occurred_at)
       VALUES (?, ?, 'CONSENT_CONFIRMED', ?, ?, ?)`,
        [
          row.id,
          confirmationEventKey,
          row.consentVersion,
          JSON.stringify({
            brand: EAXAU_EMAIL_BRAND_SCOPE,
            sourceKey: EAXAU_EMAIL_SOURCE_KEY,
            noticeVersion: row.noticeVersion,
            contentScope: row.contentScope,
            consentBasis: "EXPRESS_CONSENT",
          }),
          confirmedAt,
        ],
      );
      await connection.execute(
        `INSERT IGNORE INTO email_subscription_crm_outbox
        (subscription_id, event_key, event_kind, payload_json)
       VALUES (?, ?, 'CONSENT_CONFIRMED', ?)`,
        [
          row.id,
          confirmationEventKey,
          JSON.stringify(buildCrmConsentPayload(row, confirmedAt)),
        ],
      );

      const idempotencyKey = `eaxau-welcome-${row.applicationId}-v${row.consentVersion}`;
      await connection.execute(
        `INSERT IGNORE INTO email_subscription_deliveries
        (subscription_id, brand_scope, message_kind, consent_version, idempotency_key)
       VALUES (?, ?, 'WELCOME', ?, ?)`,
        [row.id, EAXAU_EMAIL_BRAND_SCOPE, row.consentVersion, idempotencyKey],
      );
      const [deliveries] = await connection.execute<DeliveryRow[]>(
        `SELECT id, idempotency_key AS idempotencyKey, delivery_status AS deliveryStatus
       FROM email_subscription_deliveries WHERE idempotency_key=? LIMIT 1`,
        [idempotencyKey],
      );
      if (
        ["ACCEPTED", "SENT", "DELIVERED"].includes(
          deliveries[0]?.deliveryStatus,
        )
      ) {
        return { valid: true, delivery: null };
      }
      return {
        valid: true,
        delivery: {
          subscriptionId: row.id,
          email: row.normalizedEmail,
          locale: row.locale,
          consentVersion: row.consentVersion,
          idempotencyKey,
          confirmedAt,
        },
      };
    },
  );
}

export async function unsubscribeNewsletter(input: {
  subscriptionId: number;
  consentVersion: number;
  now: Date;
}) {
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute<SubscriptionRow[]>(
      `${subscriptionSelect()} WHERE id=? LIMIT 1 FOR UPDATE`,
      [input.subscriptionId],
    );
    const row = rows[0];
    if (!row || row.consentVersion !== input.consentVersion)
      return { valid: false } as const;
    const eventKey = `eaxau:unsubscribed:${row.applicationId}:v${row.consentVersion}`;
    if (row.status !== "UNSUBSCRIBED") {
      await connection.execute(
        `UPDATE email_marketing_subscriptions SET
          status='UNSUBSCRIBED', consent_basis='DECLINED', unsubscribed_at=?
         WHERE id=? AND status<>'SUPPRESSED'`,
        [input.now, row.id],
      );
      await connection.execute(
        `UPDATE email_subscription_deliveries SET
          delivery_status='DEAD', error_code='UNSUBSCRIBED', payload_ciphertext=NULL
         WHERE subscription_id=? AND delivery_status IN ('PENDING','FAILED')`,
        [row.id],
      );
      await connection.execute(
        `INSERT IGNORE INTO email_subscription_events
          (subscription_id, event_key, event_type, consent_version, detail_json, occurred_at)
         VALUES (?, ?, 'UNSUBSCRIBED', ?, ?, ?)`,
        [
          row.id,
          eventKey,
          row.consentVersion,
          JSON.stringify({
            brand: EAXAU_EMAIL_BRAND_SCOPE,
            source: "EMAIL_PREFERENCE_PAGE",
          }),
          input.now,
        ],
      );
      const payload = {
        events: [
          {
            provider: "eaxau",
            providerEventKey: eventKey,
            eventType: "UNSUBSCRIBED",
            email: row.normalizedEmail,
            occurredAt: input.now.toISOString(),
            payload: {
              brand: "eaxau",
              source: "email-preference-page",
              applicationId: row.applicationId,
              consentVersion: row.consentVersion,
            },
          },
        ],
      };
      await connection.execute(
        `INSERT IGNORE INTO email_subscription_crm_outbox
          (subscription_id, event_key, event_kind, payload_json)
         VALUES (?, ?, 'UNSUBSCRIBED', ?)`,
        [row.id, eventKey, JSON.stringify(payload)],
      );
    }
    return { valid: true } as const;
  });
}

export async function claimNewsletterEmailDelivery(
  now: Date,
): Promise<EmailDeliveryOutboxItem | null> {
  return inTransaction(async (connection) => {
    await connection.execute(
      `UPDATE email_subscription_deliveries d
       JOIN email_marketing_subscriptions s ON s.id=d.subscription_id
       SET d.delivery_status='DEAD', d.error_code='TOKEN_EXPIRED', d.payload_ciphertext=NULL
       WHERE d.message_kind='CONFIRMATION'
         AND (d.delivery_status IN ('PENDING','FAILED')
           OR (d.delivery_status='PROCESSING' AND d.lease_expires_at<=?))
         AND s.confirmation_expires_at<=?`,
      [now, now],
    );
    const [rows] = await connection.execute<
      (RowDataPacket & Omit<EmailDeliveryOutboxItem, "leaseToken">)[]
    >(
      `SELECT d.id, d.subscription_id AS subscriptionId,
        d.message_kind AS messageKind, d.consent_version AS consentVersion,
        d.idempotency_key AS idempotencyKey,
        d.payload_ciphertext AS payloadCiphertext,
        d.attempt_count AS attemptCount,
        s.normalized_email AS email, s.locale, s.application_id AS applicationId,
        s.confirmed_at AS confirmedAt
       FROM email_subscription_deliveries d
       JOIN email_marketing_subscriptions s ON s.id=d.subscription_id
       WHERE ((d.delivery_status IN ('PENDING','FAILED') AND d.next_attempt_at<=?)
          OR (d.delivery_status='PROCESSING' AND d.lease_expires_at<=?))
         AND d.consent_version=s.consent_version
         AND ((d.message_kind='CONFIRMATION' AND s.status='PENDING_CONFIRMATION')
           OR (d.message_kind='WELCOME' AND s.status='ACTIVE'))
       ORDER BY d.id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [now, now],
    );
    const row = rows[0];
    if (!row) return null;
    const leaseToken = crypto.randomBytes(24).toString("hex");
    const leaseExpiresAt = new Date(now.getTime() + 2 * 60 * 1000);
    await connection.execute(
      `UPDATE email_subscription_deliveries SET
        delivery_status='PROCESSING', attempt_count=attempt_count+1,
        lease_token=?, lease_expires_at=?
       WHERE id=?`,
      [leaseToken, leaseExpiresAt, row.id],
    );
    return { ...row, attemptCount: row.attemptCount + 1, leaseToken };
  });
}

export async function markNewsletterDeliveryAccepted(
  item: Pick<EmailDeliveryOutboxItem, "id" | "leaseToken">,
  providerMessageId: string,
  now: Date,
) {
  await requirePool().execute(
    `UPDATE email_subscription_deliveries SET
      provider_message_id=?, delivery_status='ACCEPTED', delivery_status_at=?,
      error_code=NULL, payload_ciphertext=NULL, lease_token=NULL, lease_expires_at=NULL
     WHERE id=? AND delivery_status='PROCESSING' AND lease_token=?`,
    [providerMessageId, now, item.id, item.leaseToken],
  );
}

export async function markNewsletterDeliveryFailed(
  item: Pick<EmailDeliveryOutboxItem, "id" | "leaseToken" | "attemptCount">,
  input: { retryable: boolean; errorCode: string; now: Date },
) {
  const delayMs = Math.min(
    60 * 60 * 1000,
    30_000 * 2 ** Math.min(item.attemptCount - 1, 7),
  );
  await requirePool().execute(
    `UPDATE email_subscription_deliveries SET
      delivery_status=?, delivery_status_at=?, error_code=?, next_attempt_at=?,
      lease_token=NULL, lease_expires_at=NULL
     WHERE id=? AND delivery_status='PROCESSING' AND lease_token=?`,
    [
      input.retryable ? "FAILED" : "DEAD",
      input.now,
      input.errorCode.slice(0, 80),
      new Date(input.now.getTime() + delayMs),
      item.id,
      item.leaseToken,
    ],
  );
}

const providerStatus: Record<string, string> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DELAYED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
  "email.suppressed": "SUPPRESSED",
  "email.failed": "FAILED",
};

const crmProviderEventType: Record<string, string> = {
  "email.sent": "OTHER",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DEFERRED",
  "email.bounced": "HARD_BOUNCE",
  "email.complained": "COMPLAINT",
  "email.suppressed": "BLOCKED",
  "email.failed": "OTHER",
};

export async function recordResendNewsletterEvent(input: {
  providerEventKey: string;
  providerMessageId: string;
  eventType: string;
  eventOccurredAt: Date;
}) {
  return inTransaction(async (connection) => {
    const [insert] = await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO email_subscription_provider_events
        (provider_event_key, provider_message_id, event_type, event_occurred_at)
       VALUES (?, ?, ?, ?)`,
      [
        input.providerEventKey,
        input.providerMessageId,
        input.eventType,
        input.eventOccurredAt,
      ],
    );
    const duplicate = insert.affectedRows === 0;
    const [rows] = await connection.execute<
      (RowDataPacket & {
        subscriptionId: number;
        normalizedEmail: string;
        applicationId: string;
        consentVersion: number;
      })[]
    >(
      `SELECT d.subscription_id AS subscriptionId, s.normalized_email AS normalizedEmail,
        s.application_id AS applicationId, s.consent_version AS consentVersion
       FROM email_subscription_deliveries d
       JOIN email_marketing_subscriptions s ON s.id=d.subscription_id
       WHERE d.provider_message_id=? LIMIT 1 FOR UPDATE`,
      [input.providerMessageId],
    );
    const linked = rows[0];
    if (!linked) return { duplicate, linked: false } as const;
    const status = providerStatus[input.eventType] || "FAILED";
    await connection.execute(
      `UPDATE email_subscription_deliveries SET
        delivery_status=?, delivery_status_at=?
       WHERE provider_message_id=?
         AND (delivery_status='ACCEPTED' OR delivery_status_at IS NULL OR delivery_status_at<=?)`,
      [
        status,
        input.eventOccurredAt,
        input.providerMessageId,
        input.eventOccurredAt,
      ],
    );

    if (["BOUNCED", "COMPLAINED", "SUPPRESSED"].includes(status)) {
      await connection.execute(
        `UPDATE email_marketing_subscriptions SET
          status='SUPPRESSED', suppression_reason=?
         WHERE id=?`,
        [status, linked.subscriptionId],
      );
      await connection.execute(
        `INSERT IGNORE INTO email_subscription_events
          (subscription_id, event_key, event_type, consent_version, detail_json, occurred_at)
         VALUES (?, ?, 'SUPPRESSED', ?, ?, ?)`,
        [
          linked.subscriptionId,
          `resend:${input.providerEventKey}`,
          linked.consentVersion,
          JSON.stringify({ provider: "resend", reason: status }),
          input.eventOccurredAt,
        ],
      );
    }

    const payload = {
      events: [
        {
          provider: "resend",
          providerEventKey: input.providerEventKey,
          eventType: crmProviderEventType[input.eventType] || "OTHER",
          email: linked.normalizedEmail,
          occurredAt: input.eventOccurredAt.toISOString(),
          payload: {
            brand: "eaxau",
            providerMessageId: input.providerMessageId,
            applicationId: linked.applicationId,
          },
        },
      ],
    };
    await connection.execute(
      `INSERT IGNORE INTO email_subscription_crm_outbox
        (subscription_id, event_key, event_kind, payload_json)
       VALUES (?, ?, 'PROVIDER_EVENT', ?)`,
      [
        linked.subscriptionId,
        `eaxau:crm-provider-event:${input.providerEventKey}`,
        JSON.stringify(payload),
      ],
    );
    return { duplicate, linked: true } as const;
  });
}

export async function reconcileStoredResendNewsletterEvents(
  providerMessageId: string,
) {
  const [rows] = await requirePool().execute<
    (RowDataPacket & {
      providerEventKey: string;
      eventType: string;
      eventOccurredAt: Date;
    })[]
  >(
    `SELECT provider_event_key AS providerEventKey, event_type AS eventType,
      event_occurred_at AS eventOccurredAt
     FROM email_subscription_provider_events
     WHERE provider_message_id=? ORDER BY id`,
    [providerMessageId],
  );
  for (const row of rows) {
    await recordResendNewsletterEvent({
      providerEventKey: row.providerEventKey,
      providerMessageId,
      eventType: row.eventType,
      eventOccurredAt: row.eventOccurredAt,
    });
  }
  return rows.length;
}

export async function claimNewsletterCrmOutbox(
  now: Date,
): Promise<OutboxItem | null> {
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute<
      (RowDataPacket & {
        id: number;
        eventKind: OutboxItem["eventKind"];
        payloadJson: string;
        attemptCount: number;
      })[]
    >(
      `SELECT id, event_kind AS eventKind, payload_json AS payloadJson,
        attempt_count AS attemptCount
       FROM email_subscription_crm_outbox
       WHERE ((status IN ('PENDING','FAILED') AND next_attempt_at<=?)
          OR (status='PROCESSING' AND lease_expires_at<=?))
       ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [now, now],
    );
    const row = rows[0];
    if (!row) return null;
    const leaseToken = crypto.randomBytes(24).toString("hex");
    const leaseExpiresAt = new Date(now.getTime() + 2 * 60 * 1000);
    await connection.execute(
      `UPDATE email_subscription_crm_outbox SET
        status='PROCESSING', attempt_count=attempt_count+1,
        lease_token=?, lease_expires_at=?
       WHERE id=?`,
      [leaseToken, leaseExpiresAt, row.id],
    );
    return {
      id: row.id,
      eventKind: row.eventKind,
      payloadJson: row.payloadJson,
      attemptCount: row.attemptCount + 1,
      leaseToken,
    };
  });
}

export async function completeNewsletterCrmOutbox(
  item: Pick<OutboxItem, "id" | "leaseToken">,
  httpStatus: number,
  now: Date,
) {
  await requirePool().execute(
    `UPDATE email_subscription_crm_outbox SET
      status='APPLIED', applied_at=?, lease_token=NULL, lease_expires_at=NULL,
      last_http_status=?, last_error_code=NULL
     WHERE id=? AND status='PROCESSING' AND lease_token=?`,
    [now, httpStatus, item.id, item.leaseToken],
  );
}

export async function failNewsletterCrmOutbox(
  item: Pick<OutboxItem, "id" | "leaseToken" | "attemptCount">,
  input: {
    retryable: boolean;
    httpStatus: number | null;
    errorCode: string;
    now: Date;
  },
) {
  const delayMs = Math.min(
    60 * 60 * 1000,
    30_000 * 2 ** Math.min(item.attemptCount - 1, 7),
  );
  await requirePool().execute(
    `UPDATE email_subscription_crm_outbox SET
      status=?, next_attempt_at=?, lease_token=NULL, lease_expires_at=NULL,
      last_http_status=?, last_error_code=?
     WHERE id=? AND status='PROCESSING' AND lease_token=?`,
    [
      input.retryable ? "FAILED" : "DEAD",
      new Date(input.now.getTime() + delayMs),
      input.httpStatus,
      input.errorCode.slice(0, 120),
      item.id,
      item.leaseToken,
    ],
  );
}

export async function getNewsletterOutboxHealth() {
  const [deliveryRows] = await requirePool().execute<
    (RowDataPacket & {
      due: number | string;
      processing: number | string;
      dead: number | string;
    })[]
  >(
    `SELECT
      COALESCE(SUM(delivery_status IN ('PENDING','FAILED')), 0) AS due,
      COALESCE(SUM(delivery_status='PROCESSING'), 0) AS processing,
      COALESCE(SUM(delivery_status='DEAD'), 0) AS dead
     FROM email_subscription_deliveries`,
  );
  const [crmRows] = await requirePool().execute<
    (RowDataPacket & {
      due: number | string;
      processing: number | string;
      dead: number | string;
    })[]
  >(
    `SELECT
      COALESCE(SUM(status IN ('PENDING','FAILED')), 0) AS due,
      COALESCE(SUM(status='PROCESSING'), 0) AS processing,
      COALESCE(SUM(status='DEAD'), 0) AS dead
     FROM email_subscription_crm_outbox`,
  );
  const normalize = (row: {
    due: number | string;
    processing: number | string;
    dead: number | string;
  }) => ({
    due: Number(row.due),
    processing: Number(row.processing),
    dead: Number(row.dead),
  });
  return {
    email: normalize(deliveryRows[0] || { due: 0, processing: 0, dead: 0 }),
    crm: normalize(crmRows[0] || { due: 0, processing: 0, dead: 0 }),
  };
}
