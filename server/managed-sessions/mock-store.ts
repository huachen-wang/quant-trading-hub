import type {
  ManagedSessionDraftInput,
  ManagedSessionStatus,
} from "../../shared/managed-sessions/contracts";
import { timestampsForManagedTransition } from "./state-machine";

export type ManagedSessionAggregate = {
  id: number;
  sessionNo: string;
  userId: number;
  status: ManagedSessionStatus;
  termDays: 30 | 90 | 180;
  capitalMode: ManagedSessionDraftInput["capitalMode"];
  targetCapital: string;
  settlementAsset: "USDT";
  riskProfile: ManagedSessionDraftInput["riskProfile"];
  maxDrawdownPct: string;
  exitMode: ManagedSessionDraftInput["exitMode"];
  tradeAuthorizationStatus: "NOT_REQUESTED" | "PENDING" | "GRANTED" | "REVOKED";
  withdrawalPermission: "NONE";
  executionEnabled: boolean;
  version: number;
  submittedAt: Date | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
  exitRequestedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  strategies: Array<{
    id: number;
    strategyId: string;
    weightPct: string;
    riskMultiplier: string;
    sortOrder: number;
  }>;
  executionSlots: Array<{
    id: number;
    slotKey: string;
    brokerId: string;
    label: string | null;
    capitalWeightPct: string;
    fundingSource: "DIRECT_BROKER" | "MANAGED_VAULT";
    connectionStatus: "UNLINKED" | "PENDING" | "VERIFIED" | "REVOKED";
    tradePermission: "NOT_REQUESTED" | "PENDING" | "GRANTED" | "REVOKED";
    withdrawalPermission: "NONE";
    accountAlias: string | null;
    authorizationReference: string | null;
  }>;
  events: Array<{
    id: number;
    eventType: string;
    actorUserId: number | null;
    fromStatus: string | null;
    toStatus: string | null;
    payload: string | null;
    createdAt: Date;
  }>;
};

let nextSessionId = 1;
let nextChildId = 1;
let nextEventId = 1;
let rows: ManagedSessionAggregate[] = [];

function draftChildren(sessionId: number, input: ManagedSessionDraftInput) {
  return {
    strategies: input.strategies.map((strategy, index) => ({
      id: nextChildId++,
      strategyId: strategy.strategyId,
      weightPct: strategy.weightPct.toFixed(2),
      riskMultiplier: strategy.riskMultiplier.toFixed(2),
      sortOrder: index + 1,
    })),
    executionSlots: input.executionSlots.map((slot, index) => ({
      id: nextChildId++,
      slotKey: `SLOT-${sessionId}-${index + 1}`,
      brokerId: slot.brokerId,
      label: slot.label ?? null,
      capitalWeightPct: slot.capitalWeightPct.toFixed(2),
      fundingSource: slot.fundingSource,
      connectionStatus: "UNLINKED" as const,
      tradePermission: "NOT_REQUESTED" as const,
      withdrawalPermission: "NONE" as const,
      accountAlias: null,
      authorizationReference: null,
    })),
  };
}

export function createMockManagedSessionDraft(
  userId: number,
  sessionNo: string,
  input: ManagedSessionDraftInput,
) {
  const id = nextSessionId++;
  const now = new Date();
  const children = draftChildren(id, input);
  const row: ManagedSessionAggregate = {
    id,
    sessionNo,
    userId,
    status: "DRAFT",
    termDays: input.termDays,
    capitalMode: input.capitalMode,
    targetCapital: input.targetCapital,
    settlementAsset: "USDT",
    riskProfile: input.riskProfile,
    maxDrawdownPct: input.maxDrawdownPct.toFixed(2),
    exitMode: input.exitMode,
    tradeAuthorizationStatus: "NOT_REQUESTED",
    withdrawalPermission: "NONE",
    executionEnabled: false,
    version: 1,
    submittedAt: null,
    activatedAt: null,
    expiresAt: null,
    exitRequestedAt: null,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
    ...children,
    events: [
      {
        id: nextEventId++,
        eventType: "DRAFT_CREATED",
        actorUserId: userId,
        fromStatus: null,
        toStatus: "DRAFT",
        payload: JSON.stringify({
          strategyCount: input.strategies.length,
          executionSlotCount: input.executionSlots.length,
          executionSideEffects: false,
        }),
        createdAt: now,
      },
    ],
  };
  rows = [row, ...rows];
  return structuredClone(row);
}

export function getMockManagedSessionByNo(sessionNo: string) {
  const row = rows.find((item) => item.sessionNo === sessionNo);
  return row ? structuredClone(row) : null;
}

export function listMockManagedSessions(userId?: number) {
  return structuredClone(
    rows
      .filter((row) => userId === undefined || row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  );
}

export function replaceMockManagedSessionDraft(
  sessionNo: string,
  input: ManagedSessionDraftInput,
) {
  const row = rows.find((item) => item.sessionNo === sessionNo);
  if (!row) return null;
  const children = draftChildren(row.id, input);
  Object.assign(row, {
    termDays: input.termDays,
    capitalMode: input.capitalMode,
    targetCapital: input.targetCapital,
    settlementAsset: "USDT",
    riskProfile: input.riskProfile,
    maxDrawdownPct: input.maxDrawdownPct.toFixed(2),
    exitMode: input.exitMode,
    version: row.version + 1,
    updatedAt: new Date(),
    ...children,
  });
  row.events.push({
    id: nextEventId++,
    eventType: "DRAFT_UPDATED",
    actorUserId: row.userId,
    fromStatus: "DRAFT",
    toStatus: "DRAFT",
    payload: JSON.stringify({ executionSideEffects: false }),
    createdAt: row.updatedAt,
  });
  return structuredClone(row);
}

export function transitionMockManagedSession(
  sessionNo: string,
  actorUserId: number | null,
  toStatus: ManagedSessionStatus,
  eventType: string,
  data?: {
    tradeAuthorizationStatus?: ManagedSessionAggregate["tradeAuthorizationStatus"];
    executionEnabled?: boolean;
    eventPayload?: Record<string, unknown>;
    timestamps?: Partial<{
      submittedAt: Date;
      activatedAt: Date;
      expiresAt: Date;
      exitRequestedAt: Date;
      endedAt: Date;
      executionEnabled: boolean;
    }>;
  },
) {
  const row = rows.find((item) => item.sessionNo === sessionNo);
  if (!row) return null;
  const now = new Date();
  const fromStatus = row.status;
  Object.assign(
    row,
    timestampsForManagedTransition(toStatus, now),
    data?.timestamps ?? {},
    {
      status: toStatus,
      version: row.version + 1,
      updatedAt: now,
    },
  );
  if (data?.tradeAuthorizationStatus) {
    row.tradeAuthorizationStatus = data.tradeAuthorizationStatus;
  }
  if (data?.executionEnabled !== undefined) {
    row.executionEnabled = data.executionEnabled;
  }
  row.events.push({
    id: nextEventId++,
    eventType,
    actorUserId,
    fromStatus,
    toStatus,
    payload: data?.eventPayload ? JSON.stringify(data.eventPayload) : null,
    createdAt: now,
  });
  return structuredClone(row);
}

export function updateMockManagedExecutionSlot(
  sessionNo: string,
  slotKey: string,
  input: {
    connectionStatus: "UNLINKED" | "PENDING" | "VERIFIED" | "REVOKED";
    tradePermission: "NOT_REQUESTED" | "PENDING" | "GRANTED" | "REVOKED";
    accountAlias?: string | null;
    authorizationReference?: string | null;
    actorUserId: number;
  },
) {
  const row = rows.find((item) => item.sessionNo === sessionNo);
  const slot = row?.executionSlots.find((item) => item.slotKey === slotKey);
  if (!row || !slot) return null;
  Object.assign(slot, {
    connectionStatus: input.connectionStatus,
    tradePermission: input.tradePermission,
    withdrawalPermission: "NONE",
    accountAlias: input.accountAlias ?? null,
    authorizationReference: input.authorizationReference ?? null,
  });
  const now = new Date();
  row.updatedAt = now;
  row.events.push({
    id: nextEventId++,
    eventType: "EXECUTION_SLOT_REVIEWED",
    actorUserId: input.actorUserId,
    fromStatus: row.status,
    toStatus: row.status,
    payload: JSON.stringify({
      slotKey,
      connectionStatus: input.connectionStatus,
      tradePermission: input.tradePermission,
      withdrawalPermission: "NONE",
    }),
    createdAt: now,
  });
  return structuredClone(row);
}

export function resetMockManagedSessions() {
  rows = [];
  nextSessionId = 1;
  nextChildId = 1;
  nextEventId = 1;
}
