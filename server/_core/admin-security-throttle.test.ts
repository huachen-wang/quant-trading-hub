import { beforeEach, describe, expect, it } from "vitest";
import {
  assertSecurityAttemptAllowed,
  clearSecurityFailures,
  recordSecurityFailure,
  requestIp,
  resetSecurityThrottleForTests,
} from "./admin-security-throttle";

describe("admin security throttle", () => {
  beforeEach(resetSecurityThrottleForTests);

  it("locks the same principal and IP after five failures", () => {
    for (let index = 0; index < 5; index += 1) {
      recordSecurityFailure("TOTP", "admin:1", "203.0.113.5", 1_000);
    }
    expect(() =>
      assertSecurityAttemptAllowed("TOTP", "admin:1", "203.0.113.5", 2_000),
    ).toThrow(/15 分钟/);
    expect(() =>
      assertSecurityAttemptAllowed("TOTP", "admin:1", "203.0.113.6", 2_000),
    ).toThrow(/15 分钟/);
    expect(() =>
      assertSecurityAttemptAllowed("TOTP", "admin:2", "203.0.113.6", 2_000),
    ).not.toThrow();
  });

  it("clears failures after a successful verification", () => {
    recordSecurityFailure("ADMIN_LOGIN", "admin@example.com", "127.0.0.1");
    clearSecurityFailures("ADMIN_LOGIN", "admin@example.com", "127.0.0.1");
    expect(() =>
      assertSecurityAttemptAllowed(
        "ADMIN_LOGIN",
        "admin@example.com",
        "127.0.0.1",
      ),
    ).not.toThrow();
  });

  it("ignores spoofable forwarded addresses unless an exact proxy depth is configured", () => {
    const request = {
      headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.8" },
      socket: { remoteAddress: "10.0.0.9" },
    };
    expect(requestIp(request, {} as NodeJS.ProcessEnv)).toBe("10.0.0.9");
    expect(
      requestIp(
        request,
        { ADMIN_TRUSTED_PROXY_HOPS: "1" } as unknown as NodeJS.ProcessEnv,
      ),
    ).toBe("10.0.0.8");
    expect(
      requestIp(
        request,
        { ADMIN_TRUSTED_PROXY_HOPS: "2" } as unknown as NodeJS.ProcessEnv,
      ),
    ).toBe("198.51.100.10");
  });
});
