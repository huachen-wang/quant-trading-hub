import crypto from "node:crypto";
import type { ManagedSessionStatus } from "../../shared/managed-sessions/contracts";

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
    throw new Error(`资管会话状态不允许从 ${from} 变更为 ${to}`);
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

export function managedSessionExpiresAt(
  termDays: 30 | 90 | 180,
  activatedAt = new Date(),
) {
  return new Date(activatedAt.getTime() + termDays * 24 * 60 * 60 * 1000);
}

export type ManagedTransitionPatch = Partial<{
  submittedAt: Date;
  activatedAt: Date;
  expiresAt: Date;
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
