import { describe, expect, it } from "vitest";
import {
  assertManagedSessionTransition,
  assertBrokerFundingTransition,
  canTransitionManagedSession,
} from "./state-machine";

describe("managed session state machine", () => {
  it("supports the reviewed authorization and user-requested exit path", () => {
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

  it("does not allow an exception to jump over reconciliation or dual approval", () => {
    expect(() =>
      assertBrokerFundingTransition("EXCEPTION", "PAYOUT_SUBMITTED"),
    ).toThrow(/EXCEPTION.*PAYOUT_SUBMITTED/);
    expect(() =>
      assertBrokerFundingTransition("EXCEPTION", "BROKER_CREDIT_PENDING"),
    ).toThrow(/EXCEPTION.*BROKER_CREDIT_PENDING/);
    expect(() =>
      assertBrokerFundingTransition("EXCEPTION", "RECEIVED"),
    ).not.toThrow();
  });
});
