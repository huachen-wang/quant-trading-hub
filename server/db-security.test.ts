import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const capture = vi.hoisted(() => ({ queries: [] as Array<{ sql: string; params: unknown[] }>, affectedRows: 1, rows: [] as any[] }));
vi.mock("mysql2/promise", () => ({ default: { createPool: () => ({}) } }));
vi.mock("drizzle-orm/mysql2", async (importOriginal) => {
  const original = await importOriginal<any>();
  const builder = original.drizzle.mock();
  return { drizzle: () => ({
    update: (table: any) => ({ set: (values: any) => ({ where: async (where: any) => {
      capture.queries.push(builder.update(table).set(values).where(where).toSQL());
      return [{ affectedRows: capture.affectedRows }];
    } }) }),
    select: () => ({ from: (table: any) => ({ where: (where: any) => ({ limit: async (limit: number) => {
      capture.queries.push(builder.select().from(table).where(where).limit(limit).toSQL());
      return capture.rows;
    } }) }) }),
  }) };
});
import * as db from "./db";
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "offline-fixture-only");
  capture.queries = []; capture.affectedRows = 1; capture.rows = [];
});
afterEach(() => vi.unstubAllEnvs());

describe("production SQL and affected-row handling (no database connection)", () => {
  it("cancellation requires pending and reports a losing race", async () => {
    capture.affectedRows = 0;
    expect(await db.cancelOrder(42)).toBe(false);
    expect(capture.queries[0].sql).toMatch(/where \(`orders`\.`id` = \? and `orders`\.`status` = \?\)/);
    expect(capture.queries[0].params).toEqual(["cancelled", 42, "pending"]);
  });
  it("payment uses an atomic allowed-state transition", async () => {
    expect(await db.markOrderPaid(42, { paymentGateway: "zpay" })).toBe(true);
    expect(capture.queries[0].sql).toContain('`orders`.`status` in (?, ?, ?)');
    expect(capture.queries[0].params.slice(-4)).toEqual([42, "pending", "expired", "cancelled"]);
    capture.affectedRows = 0;
    expect(await db.markOrderPaid(42, {})).toBe(false);
  });
  it("expiration requires pending and expiry time; cron counts mysql affectedRows", async () => {
    expect(await db.expireOrder(42)).toBe(true);
    expect(capture.queries[0].sql).toContain('`orders`.`expiresAt` <= NOW()');
    expect(capture.queries[0].params).toEqual(["expired", 42, "pending"]);
    capture.affectedRows = 3;
    expect(await db.expireStaleOrders()).toBe(3);
  });
  it("password updates increment the session version in the same statement", async () => {
    await db.updateUserPassword(42, "fixture-hash", { expectedSessionVersion: 7 });
    expect(capture.queries[0].sql).toContain('`sessionVersion` = `users`.`sessionVersion` + 1');
    expect(capture.queries[0].sql).toContain('and `users`.`sessionVersion` = ?');
    expect(capture.queries[0].params).toEqual(["fixture-hash", 42, 7]);
    capture.affectedRows = 0;
    await expect(db.updateUserPassword(42, "fixture-hash", { expectedSessionVersion: 7 })).rejects.toThrow();
    capture.affectedRows = 1;
    await db.updateUserPassword(42, "fixture-hash", { verifiedEmail: "owner@example.test" });
    expect(capture.queries.at(-1)!.sql).toContain('`emailVerifiedAt` = ?');
    expect(capture.queries.at(-1)!.sql).toContain('and `users`.`email` = ?');
  });
  it("first email confirmation atomically clears old credentials and persists proof once", async () => {
    capture.rows = [{ id: 42, email: "Owner@example.test", emailVerifiedAt: new Date(), sessionVersion: 1 }];
    await db.confirmUserEmail(42, "owner@example.test");
    expect(capture.queries[0].sql).toContain('`users`.`emailVerifiedAt` is null');
    expect(capture.queries[0].sql).toContain('`passwordHash` = ?');
    expect(capture.queries[0].params).toContain(null);
    expect(capture.queries[0].sql).toContain('`users`.`sessionVersion` + 1');
    capture.queries = [];
    expect(await db.isUserEmailVerified("owner@example.test")).toBe(true);
    expect(capture.queries[0].sql).toContain('from `users`');
    expect(capture.queries[0].sql).toContain('`users`.`emailVerifiedAt` is not null');
    expect(capture.queries[0].sql).not.toContain("verification_codes");
  });
  it("profile email verification only records the proof", async () => {
    await db.markUserEmailVerified(42, "owner@example.test");
    expect(capture.queries[0].sql).toContain('`users`.`emailVerifiedAt` is null');
    expect(capture.queries[0].sql).not.toContain('passwordHash');
    expect(capture.queries[0].sql).not.toContain('sessionVersion');
  });
  it("logout increments the stored version", async () => {
    await db.revokeUserSessions(42);
    expect(capture.queries[0].sql).toContain('`sessionVersion` = `users`.`sessionVersion` + 1');
    expect(capture.queries[0].params).toEqual([42]);
  });
  it("migration backfills only proven emails and discards untrusted legacy passwords", () => {
    const migration = readFileSync("drizzle/0009_auth_session_version.sql", "utf8");
    for (const part of ["INFORMATION_SCHEMA.COLUMNS", "targetType = 'email' AND used = true", "MAX(purpose = 'register') AS registeredWithCode",
      "u.passwordHash = IF(proof.registeredWithCode = 1, u.passwordHash, NULL)",
      "u.sessionVersion = IF(proof.registeredWithCode = 1, u.sessionVersion, u.sessionVersion + 1)", "WHERE u.emailVerifiedAt IS NULL"]) expect(migration).toContain(part);
  });
});
