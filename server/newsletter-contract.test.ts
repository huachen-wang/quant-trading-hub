import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("newsletter consent and CRM boundary", () => {
  const repository = readFileSync("server/newsletter-repository.ts", "utf8");
  const service = readFileSync("server/newsletter.ts", "utf8");
  const requestStart = repository.indexOf(
    "export async function requestNewsletterConfirmation",
  );
  const confirmStart = repository.indexOf(
    "export async function confirmNewsletterSubscription",
  );
  const unsubscribeStart = repository.indexOf(
    "export async function unsubscribeNewsletter",
  );

  it("does not publish marketing permission before email confirmation", () => {
    const requestPath = repository.slice(requestStart, confirmStart);
    expect(requestPath).toContain("PENDING_VERIFICATION");
    expect(requestPath).not.toContain("email_subscription_crm_outbox");
    expect(requestPath).not.toContain("EXPRESS_CONSENT");
  });

  it("keeps signup closed until the CRM delivery contract is configured", () => {
    const requestStart = service.indexOf(
      "export async function requestEmailNewsletter",
    );
    const confirmStart = service.indexOf(
      "export async function confirmEmailNewsletter",
    );
    expect(service.slice(requestStart, confirmStart)).toContain(
      "crmNewsletterConfigurationStatus().configured",
    );
  });

  it("atomically records confirmed consent and its CRM outbox fact", () => {
    const confirmPath = repository.slice(confirmStart, unsubscribeStart);
    expect(confirmPath).toContain("consent_basis='EXPRESS_CONSENT'");
    expect(confirmPath).toContain("email_subscription_crm_outbox");
    expect(confirmPath).toContain("CONSENT_CONFIRMED");
    expect(confirmPath).toContain(
      "INSERT IGNORE INTO email_subscription_deliveries",
    );
  });

  it("keeps legacy UNKNOWN contacts outside the permission ledger", () => {
    expect(repository).not.toMatch(/\bemail_subscriptions\b/u);
    expect(repository).not.toMatch(/contact_type/iu);
  });
});
