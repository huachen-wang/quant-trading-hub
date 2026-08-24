import { describe, expect, it } from "vitest";
import {
  assertManagedSessionTransition,
  canTransitionManagedSession,
  managedSessionExpiresAt,
} from "./state-machine";

describe("managed session state machine", () => {
  it("supports the reviewed authorization and time-bounded exit path", () => {
    const path = [
      "DRAFT",
      "PENDING_REVIEW",
      "PENDING_AUTHORIZATION",
      "READY",
      "ACTIVE",
      "EXIT_REQUESTED",
      "WINDING_DOWN",
      "ENDED",
    ] as const;
    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionManagedSession(path[index], path[index + 1])).toBe(
        true,
      );
    }
  });

  it("does not allow a draft to bypass review and become active", () => {
    expect(canTransitionManagedSession("DRAFT", "ACTIVE")).toBe(false);
    expect(() => assertManagedSessionTransition("DRAFT", "ACTIVE")).toThrow(
      /DRAFT.*ACTIVE/,
    );
  });

  it("makes terminal states immutable", () => {
    expect(canTransitionManagedSession("ENDED", "ACTIVE")).toBe(false);
    expect(canTransitionManagedSession("CANCELLED", "DRAFT")).toBe(false);
    expect(canTransitionManagedSession("REJECTED", "PENDING_REVIEW")).toBe(
      false,
    );
  });

  it("computes a deterministic term expiry from activation time", () => {
    const start = new Date("2026-08-24T00:00:00.000Z");
    expect(managedSessionExpiresAt(30, start).toISOString()).toBe(
      "2026-09-23T00:00:00.000Z",
    );
    expect(managedSessionExpiresAt(180, start).toISOString()).toBe(
      "2027-02-20T00:00:00.000Z",
    );
  });
});
