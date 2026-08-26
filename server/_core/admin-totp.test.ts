import { describe, expect, it } from "vitest";
import * as db from "../db";
import {
  computeAdminTotp,
  isAdminTotpConfigured,
  matchAdminTotpStep,
  verifyAdminTotp,
} from "./admin-totp";

const RFC_SHA1_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("admin RFC 6238 TOTP", () => {
  it("matches the RFC SHA-1 vector truncated to six digits", () => {
    expect(computeAdminTotp(RFC_SHA1_SECRET, new Date(59_000))).toBe("287082");
  });

  it("accepts only the configured ±1 step window", () => {
    const now = new Date("2026-08-24T12:00:15.000Z");
    const env = {
      ADMIN_TOTP_SECRET_BASE32: RFC_SHA1_SECRET,
    } as unknown as NodeJS.ProcessEnv;
    expect(verifyAdminTotp(computeAdminTotp(RFC_SHA1_SECRET, now), env, now)).toBe(true);
    expect(verifyAdminTotp(computeAdminTotp(RFC_SHA1_SECRET, now, -1), env, now)).toBe(true);
    expect(verifyAdminTotp(computeAdminTotp(RFC_SHA1_SECRET, now, 1), env, now)).toBe(true);
    expect(verifyAdminTotp(computeAdminTotp(RFC_SHA1_SECRET, now, 2), env, now)).toBe(false);
    expect(matchAdminTotpStep("12345", env, now)).toBeNull();
  });

  it("fails closed for malformed or weak secrets", () => {
    expect(isAdminTotpConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(() =>
      isAdminTotpConfigured({ ADMIN_TOTP_SECRET_BASE32: "NOT@BASE32" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/格式无效/);
    expect(() =>
      isAdminTotpConfigured({ ADMIN_TOTP_SECRET_BASE32: "JBSWY3DP" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/至少需要 20 bytes/);
  });

  it("consumes a time step once per administrator", async () => {
    const adminId = Math.floor(Math.random() * 1_000_000_000) + 1;
    const timeStep = Math.floor(Date.now() / 30_000);
    await db.consumeAdminTotpStep({ adminId, timeStep, action: "FIRST" });
    await expect(
      db.consumeAdminTotpStep({ adminId, timeStep, action: "REPLAY" }),
    ).rejects.toThrow(/已用于另一个敏感操作/);
    await expect(
      db.consumeAdminTotpStep({ adminId, timeStep: timeStep + 1, action: "NEXT" }),
    ).resolves.toBeUndefined();
  });
});
