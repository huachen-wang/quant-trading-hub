# EAXAU email subscriptions

The homepage signup is a double opt-in flow for the fixed EAXAU scope
`EDUCATION,PRODUCT_UPDATE`. It does not reuse or import the legacy
`email_subscriptions` contact table.

## Ownership boundary

- EAXAU stores the pending confirmation, confirmation event, email delivery
  ledger and two durable outboxes.
- A confirmed request is posted to XAU CRM as `brand: "eaxau"` and
  `product: "ea_product"`. Unsubscribes, complaints and hard bounces are posted
  to the CRM email-events endpoint.
- XAU CRM remains the operating source for customer identity and campaign
  eligibility. EAXAU's local `ACTIVE` state means only that double opt-in was
  completed. No campaign sender reads the local table.
- The currently deployed CRM contract records brand on source attribution and
  consent evidence, while its email permission row is person/channel scoped.
  A future campaign sender must use CRM eligibility and brand attribution; it
  must not treat the EAXAU local ledger as authorization.

## Runtime configuration

Set these on the EAXAU Railway service. Never commit the values.

| Variable                    | Required value or rule                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Existing production MySQL URL. Startup creates the isolated newsletter tables.                                                          |
| `RESEND_API_KEY`            | Resend production key supplied through the deployment secret store.                                                                     |
| `EMAIL_FROM`                | EAXAU sender on an actually verified domain, for example `EAXAU <updates@eaxau.com>`.                                                   |
| `EMAIL_REPLY_TO`            | Optional monitored business inbox. Reply attribution is not implemented.                                                                |
| `EMAIL_VERIFIED_DOMAINS`    | Exact sender-domain allowlist, currently `eaxau.com`.                                                                                   |
| `EMAIL_SUBSCRIPTION_SECRET` | Stable random secret of at least 32 characters. Rotating it invalidates existing unsubscribe links and encrypted pending confirmations. |
| `EMAIL_PUBLIC_BASE_URL`     | Canonical origin `https://www.eaxau.com`.                                                                                               |
| `EMAIL_TRUSTED_PROXY_HOPS`  | Exact Railway proxy depth after it is measured from a controlled request. `0` ignores forwarded headers and fails safely.               |
| `RESEND_WEBHOOK_SECRET`     | Signing secret for the Resend webhook.                                                                                                  |
| `XAU_CRM_BASE_URL`          | `https://xau-crm.vercel.app` while that is the deployed CRM origin.                                                                     |
| `CRM_INGEST_SECRET`         | Shared CRM website-application ingest secret.                                                                                           |
| `CRM_EMAIL_EVENTS_SECRET`   | Shared CRM normalized email-events ingest secret.                                                                                       |

Configure the Resend webhook as
`https://www.eaxau.com/api/email/resend-webhook` for sent, delivered, delivery
delayed, bounced, complained, suppressed and failed email events.

## Release verification

1. Deploy the code and let the existing advisory-locked startup migrator finish.
2. Check `/api/health`: `emailSubscriptions.configured`,
   `webhookConfigured` and `crmConfigured` must all be `true`.
3. Check the admin-only `subscriptions.marketingOutboxHealth` query. `dead` must
   be zero for both email and CRM outboxes.
4. Use one owned test inbox. Request confirmation, confirm from the explicit
   confirmation page, verify one welcome message, then unsubscribe.
5. Verify CRM shows the same EAXAU source attribution and the resulting
   permission/suppression evidence before enabling any campaign sender.

Do not use a customer's order address as newsletter consent, backfill legacy
contacts, or send a live campaign as part of deployment verification.
