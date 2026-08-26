import crypto from "node:crypto";
import type {
  BrokerFundingStatus,
  ManagedSessionStatus,
} from "../../shared/managed-sessions/contracts";

export const MANAGED_SESSION_TRANSITIONS: Record<
  ManagedSessionStatus,
  readonly ManagedSessionStatus[]
> = {
  DRAFT: ["PENDING_REVIEW", "CANCELLED"],
  PENDING_REVIEW: ["PENDING_AUTHORIZATION", "REJECTED", "CANCELLED"],
  PENDING_AUTHORIZATION: ["READY", "REJECTED", "CANCELLED"],
  READY: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["EXIT_REQUESTED"],
  EXIT_REQUESTED: ["WINDING_DOWN"],
  WINDING_DOWN: ["ENDED"],
  ENDED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransitionManagedSession(
  from: ManagedSessionStatus,
  to: ManagedSessionStatus,
) {
  return MANAGED_SESSION_TRANSITIONS[from].includes(to);
}

export function assertManagedSessionTransition(
  from: ManagedSessionStatus,
  to: ManagedSessionStatus,
) {
  if (!canTransitionManagedSession(from, to)) {
    throw new Error(`资管委托状态不允许从 ${from} 变更为 ${to}`);
  }
}

export function generateManagedSessionNo(now = new Date()) {
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `MS${date}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

export type ManagedTransitionPatch = Partial<{
  submittedAt: Date;
  activatedAt: Date;
  exitRequestedAt: Date;
  endedAt: Date;
  executionEnabled: boolean;
}>;

export function timestampsForManagedTransition(
  to: ManagedSessionStatus,
  at = new Date(),
): ManagedTransitionPatch {
  switch (to) {
    case "PENDING_REVIEW":
      return { submittedAt: at };
    case "ACTIVE":
      return { activatedAt: at };
    case "EXIT_REQUESTED":
      return { exitRequestedAt: at };
    case "ENDED":
      return { endedAt: at, executionEnabled: false };
    case "CANCELLED":
    case "REJECTED":
      return { executionEnabled: false };
    default:
      return {};
  }
}

export const BROKER_FUNDING_TRANSITIONS: Record<
  BrokerFundingStatus,
  readonly BrokerFundingStatus[]
> = {
  DRAFT: ["WAITING_ACCOUNT", "WAITING_INSTRUCTIONS", "CANCELLED"],
  WAITING_ACCOUNT: ["WAITING_INSTRUCTIONS", "EXCEPTION", "CANCELLED"],
  WAITING_INSTRUCTIONS: ["READY_TO_FUND", "EXCEPTION", "CANCELLED"],
  READY_TO_FUND: ["TX_SUBMITTED", "EXCEPTION", "CANCELLED"],
  TX_SUBMITTED: ["RECEIVED", "BROKER_CREDIT_PENDING", "CREDITED", "EXCEPTION"],
  RECEIVED: ["RECONCILED", "EXCEPTION"],
  RECONCILED: ["AWAITING_PAYOUT", "EXCEPTION"],
  AWAITING_PAYOUT: ["PAYOUT_SUBMITTED", "EXCEPTION"],
  PAYOUT_SUBMITTED: ["BROKER_CREDIT_PENDING", "CREDITED", "EXCEPTION"],
  BROKER_CREDIT_PENDING: ["CREDITED", "EXCEPTION"],
  CREDITED: [],
  EXCEPTION: [
    "WAITING_ACCOUNT",
    "WAITING_INSTRUCTIONS",
    "READY_TO_FUND",
    "TX_SUBMITTED",
    "RECEIVED",
    "CANCELLED",
  ],
  CANCELLED: [],
};

export function assertBrokerFundingTransition(
  from: BrokerFundingStatus,
  to: BrokerFundingStatus,
) {
  if (!BROKER_FUNDING_TRANSITIONS[from].includes(to)) {
    throw new Error(`券商入金状态不允许从 ${from} 变更为 ${to}`);
  }
}

export function generateBrokerFundingIntentNo(now = new Date()) {
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `BF${date}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}
