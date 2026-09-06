import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./email";

describe("Resend email adapter", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "EAXAU <noreply@eaxau.com>");
    vi.stubEnv("EMAIL_VERIFIED_DOMAINS", "eaxau.com");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("passes one stable idempotency key, unsubscribe headers and tags", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "resend-message-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendEmail({
        to: "reader@example.com",
        subject: "Welcome",
        html: "<p>Welcome</p>",
        idempotencyKey: "eaxau-welcome-stable-v1",
        headers: {
          "List-Unsubscribe":
            "<https://eaxau.com/api/email/unsubscribe?token=signed>",
        },
        tags: [{ name: "brand", value: "eaxau" }],
      }),
    ).resolves.toEqual({ ok: true, id: "resend-message-1", attempts: 1 });
    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(request.headers).toMatchObject({
      "Idempotency-Key": "eaxau-welcome-stable-v1",
    });
    expect(JSON.parse(String(request.body))).toMatchObject({
      to: ["reader@example.com"],
      headers: { "List-Unsubscribe": expect.stringContaining("eaxau.com") },
      tags: [{ name: "brand", value: "eaxau" }],
    });
  });

  it("retries transient failures with the same body and key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"name":"rate_limit_exceeded","message":"private"}', {
          status: 429,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "resend-message-2" }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendEmail({
      to: "reader@example.com",
      subject: "Confirm",
      html: "confirm",
      idempotencyKey: "eaxau-confirm-stable-v1",
      retryAttempts: 2,
    });
    expect(result).toEqual({ ok: true, id: "resend-message-2", attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject(
      fetchMock.mock.calls[1]![1],
    );
  });

  it("does not retry permanent errors or expose provider response text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          '{"name":"validation_error","message":"contains@example.com"}',
          { status: 400 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendEmail({
        to: "reader@example.com",
        subject: "Confirm",
        html: "confirm",
        retryAttempts: 3,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "HTTP_400_validation_error",
      retryable: false,
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.error).mock.calls)).not.toContain(
      "contains@example.com",
    );
  });

  it("rejects a sender outside the exact verified-domain allowlist", async () => {
    vi.stubEnv("EMAIL_FROM", "EAXAU <noreply@sub.eaxau.com>");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendEmail({
        to: "reader@example.com",
        subject: "Confirm",
        html: "confirm",
      }),
    ).resolves.toMatchObject({ ok: false, error: "FROM_DOMAIN_NOT_VERIFIED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
