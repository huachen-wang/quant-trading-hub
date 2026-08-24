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
  termDays: number;
  capitalMode: "DIRECT_BROKER";
  onboardingMode: ManagedSessionDraftInput["onboardingMode"];
  fundsRoute: ManagedSessionDraftInput["fundsRoute"];
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
    fundingSource: "DIRECT_BROKER";
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
let nextFundingId = 1;
let nextFundingEventId = 1;
let nextCollectionAddressId = 1;
let fundingRows: any[] = [];
let collectionAddresses: any[] = [];
let collectionApprovals: any[] = [];

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
      fundingSource: "DIRECT_BROKER" as const,
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
    termDays: 0,
    capitalMode: "DIRECT_BROKER",
    onboardingMode: input.onboardingMode,
    fundsRoute: input.fundsRoute,
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
    termDays: 0,
    capitalMode: "DIRECT_BROKER",
    onboardingMode: input.onboardingMode,
    fundsRoute: input.fundsRoute,
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

function hydrateMockFunding(row: any) {
  return {
    ...structuredClone(row),
    events: structuredClone(
      row.events.sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    ),
  };
}

export function createMockBrokerFundingIntent(
  session: ManagedSessionAggregate,
  slot: ManagedSessionAggregate["executionSlots"][number],
  intentNo: string,
  expectedAmount: string,
) {
  const now = new Date();
  const row: any = {
    id: nextFundingId++,
    intentNo,
    sessionId: session.id,
    slotId: slot.id,
    userId: session.userId,
    brokerId: slot.brokerId,
    status: "DRAFT",
    asset: "USDT",
    fundsRoute: session.fundsRoute,
    custodyProvider: "MANUAL",
    externalProviderRef: null,
    instructionSource: null,
    collectionAddressId: null,
    network: null,
    depositAddress: null,
    depositTag: null,
    expectedAmount,
    declaredAmount: null,
    payerWalletAddress: null,
    payerOwnershipAttestedAt: null,
    txHash: null,
    receivedAmount: null,
    observedNetwork: null,
    creditedAmount: null,
    confirmations: null,
    reconciliationResult: null,
    screeningStatus:
      session.fundsRoute === "PLATFORM_COLLECTION" ? "PENDING" : null,
    screeningProviderRef: null,
    complianceNote: null,
    clearedBy: null,
    clearedAt: null,
    payoutAmount: null,
    payoutNetwork: null,
    payoutDestination: null,
    payoutTxHash: null,
    payoutRequestedBy: null,
    payoutRequestedAt: null,
    payoutApprovedBy: null,
    payoutApprovedAt: null,
    payoutSubmittedAt: null,
    verifiedRefundAddress: null,
    refundAddressVerifiedBy: null,
    refundAddressVerifiedAt: null,
    refundAmount: null,
    refundTxHash: null,
    brokerCreditReference: null,
    exceptionReason: null,
    resolutionNote: null,
    resumeStatus: null,
    instructionsIssuedAt: null,
    instructionsExpireAt: null,
    submittedAt: null,
    receivedAt: null,
    reconciledAt: null,
    creditedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    events: [
      {
        id: nextFundingEventId++,
        fundingIntentId: nextFundingId - 1,
        sessionId: session.id,
        actorUserId: session.userId,
        eventType: "FUNDING_INTENT_CREATED",
        fromStatus: null,
        toStatus: "DRAFT",
        payload: JSON.stringify({
          fundsRoute: session.fundsRoute,
          asset: "USDT",
          externalTransferTriggered: false,
        }),
        createdAt: now,
      },
    ],
  };
  fundingRows.unshift(row);
  return hydrateMockFunding(row);
}

export function getMockBrokerFundingIntent(intentNo: string) {
  const row = fundingRows.find((item) => item.intentNo === intentNo);
  return row ? hydrateMockFunding(row) : null;
}

export function listMockBrokerFundingIntents(input: {
  userId?: number;
  sessionId?: number;
  status?: string;
  fundsRoute?: string;
  limit?: number;
}) {
  return fundingRows
    .filter(
      (row) =>
        (input.userId === undefined || row.userId === input.userId) &&
        (input.sessionId === undefined || row.sessionId === input.sessionId) &&
        (!input.status || row.status === input.status) &&
        (!input.fundsRoute || row.fundsRoute === input.fundsRoute),
    )
    .slice(0, input.limit ?? 100)
    .map(hydrateMockFunding);
}

export function findMockBrokerFundingByTxHash(txHash: string) {
  const row = fundingRows.find(
    (item) =>
      item.txHash === txHash ||
      item.payoutTxHash === txHash ||
      item.refundTxHash === txHash,
  );
  return row ? hydrateMockFunding(row) : null;
}

export function transitionMockBrokerFundingIntent(
  intentNo: string,
  expectedFrom: string | string[],
  toStatus: string,
  actorUserId: number,
  eventType: string,
  patch: Record<string, unknown> = {},
  eventPayload: Record<string, unknown> = {},
) {
  const row = fundingRows.find((item) => item.intentNo === intentNo);
  if (!row) return null;
  const expected = Array.isArray(expectedFrom) ? expectedFrom : [expectedFrom];
  if (!expected.includes(row.status)) {
    throw new Error("券商入金记录已被其他操作更新，请刷新后重试");
  }
  const now = new Date();
  const fromStatus = row.status;
  Object.assign(row, patch, { status: toStatus, updatedAt: now });
  row.events.push({
    id: nextFundingEventId++,
    fundingIntentId: row.id,
    sessionId: row.sessionId,
    actorUserId,
    eventType,
    fromStatus,
    toStatus,
    payload: Object.keys(eventPayload).length
      ? JSON.stringify(eventPayload)
      : null,
    createdAt: now,
  });
  return hydrateMockFunding(row);
}

export function appendMockBrokerFundingAuditEvent(
  intentNo: string,
  actorUserId: number,
  eventType: string,
  patch: Record<string, unknown> = {},
  eventPayload: Record<string, unknown> = {},
) {
  const row = fundingRows.find((item) => item.intentNo === intentNo);
  if (!row) return null;
  const now = new Date();
  Object.assign(row, patch, { updatedAt: now });
  row.events.push({
    id: nextFundingEventId++,
    fundingIntentId: row.id,
    sessionId: row.sessionId,
    actorUserId,
    eventType,
    fromStatus: row.status,
    toStatus: row.status,
    payload: Object.keys(eventPayload).length
      ? JSON.stringify(eventPayload)
      : null,
    createdAt: now,
  });
  return hydrateMockFunding(row);
}

export function createMockCollectionAddress(input: any) {
  if (
    collectionAddresses.some(
      (item) => item.network === input.network && item.address === input.address,
    )
  ) {
    throw new Error("该网络地址已存在");
  }
  const now = new Date();
  const row = {
    id: nextCollectionAddressId++,
    ...input,
    asset: "USDT",
    status: "AVAILABLE",
    currentFundingIntentId: null,
    reservedAt: null,
    usedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  collectionAddresses.push(row);
  return structuredClone(row);
}

export function listMockCollectionAddresses(status?: string) {
  return structuredClone(
    collectionAddresses.filter((item) => !status || item.status === status),
  );
}

export function assignMockCollectionAddress(
  intentNo: string,
  addressId: number,
  actorUserId: number,
  instructionsExpireAt?: Date | null,
  eligibility?: {
    referenceHash: string;
    attestedAt: Date;
  },
) {
  const intent = fundingRows.find((item) => item.intentNo === intentNo);
  const address = collectionAddresses.find((item) => item.id === addressId);
  if (!intent || !address) return null;
  if (address.status !== "AVAILABLE" || address.currentFundingIntentId) {
    throw new Error("代收地址已被分配或不可用");
  }
  address.status = "RESERVED";
  address.currentFundingIntentId = intent.id;
  address.reservedAt = new Date();
  address.updatedAt = new Date();
  return transitionMockBrokerFundingIntent(
    intentNo,
    "WAITING_INSTRUCTIONS",
    "READY_TO_FUND",
    actorUserId,
    "COLLECTION_ADDRESS_ASSIGNED",
    {
      collectionAddressId: address.id,
      instructionSource: "PLATFORM_ADDRESS_POOL",
      custodyProvider: "MANUAL",
      network: address.network,
      depositAddress: address.address,
      depositTag: address.depositTag,
      instructionsIssuedAt: new Date(),
      instructionsExpireAt: instructionsExpireAt ?? null,
      customerEligibilityReferenceHash:
        eligibility?.referenceHash ?? null,
      customerEligibilityAttestedBy: eligibility ? actorUserId : null,
      customerEligibilityAttestedAt: eligibility?.attestedAt ?? null,
    },
    {
      addressId: address.id,
      network: address.network,
      customerScopeAttested: Boolean(eligibility),
    },
  );
}

export function markMockCollectionAddressUsed(intentId: number) {
  const address = collectionAddresses.find(
    (item) => item.currentFundingIntentId === intentId,
  );
  if (!address) return;
  address.status = "USED";
  address.usedAt = new Date();
  address.updatedAt = new Date();
}

export function getMockCollectionApproval(brokerId: string) {
  const row = collectionApprovals.find((item) => item.brokerId === brokerId);
  return row ? structuredClone(row) : null;
}

export function listMockCollectionApprovals() {
  return structuredClone(collectionApprovals);
}

export function upsertMockCollectionApproval(input: any) {
  const now = new Date();
  const existing = collectionApprovals.find(
    (item) => item.brokerId === input.brokerId,
  );
  if (existing) {
    Object.assign(existing, input, { updatedAt: now });
    return structuredClone(existing);
  }
  const row = {
    id: collectionApprovals.length + 1,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  collectionApprovals.push(row);
  return structuredClone(row);
}

export function resetMockManagedSessions() {
  rows = [];
  nextSessionId = 1;
  nextChildId = 1;
  nextEventId = 1;
  nextFundingId = 1;
  nextFundingEventId = 1;
  nextCollectionAddressId = 1;
  fundingRows = [];
  collectionAddresses = [];
  collectionApprovals = [];
}
