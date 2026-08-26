import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { resetMockManagedSessions } from "./mock-store";
import { resetV2ProviderForTests } from "../v2/provider";
import { appRouter } from "../routers";
import {
  ALLIANCE_STRATEGY_IDS,
  type ManagedSessionDraftInput,
} from "../../shared/managed-sessions/contracts";
import { computeAdminTotp } from "../_core/admin-totp";

const TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

function createUserContext(id = 91): TrpcContext {
  const now = new Date();
  return {
    user: {
      id,
      openId: `managed-user-${id}`,
      name: "Managed User",
      email: `managed-${id}@example.test`,
      passwordHash: null,
      avatar: null,
      bio: null,
      loginMethod: "password",
      role: "user",
      phone: null,
      phoneVerified: false,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  const context = createUserContext(1);
  return {
    ...context,
    user: { ...context.user!, role: "admin" },
  };
}

const draft: ManagedSessionDraftInput = {
  onboardingMode: "SELF_OPENED" as const,
  fundsRoute: "BROKER_DIRECT" as const,
  targetCapital: "50000",
  settlementAsset: "USDT" as const,
  riskProfile: "BALANCED" as const,
  maxDrawdownPct: 12,
  exitMode: "NATURAL_EXIT" as const,
  strategies: ALLIANCE_STRATEGY_IDS.map((strategyId, index) => ({
    strategyId,
    weightPct: index === 5 ? 15 : 17,
    riskMultiplier: 1,
  })),
  executionSlots: [
    {
      brokerId: "exness",
      capitalWeightPct: 55,
    },
    {
      brokerId: "blueberry-markets",
      capitalWeightPct: 45,
    },
  ],
};

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.V2_DATA_PROVIDER = "DEMO";
  process.env.ADMIN_TOTP_SECRET_BASE32 = TOTP_SECRET;
  resetV2ProviderForTests();
  resetMockManagedSessions();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("managed sessions router", () => {
  it("reports every collection route unavailable without a configured TOTP", async () => {
    delete process.env.ADMIN_TOTP_SECRET_BASE32;
    const caller = appRouter.createCaller(createUserContext());
    const capabilities = await caller.v2.managedSessions.capabilities();
    expect(capabilities.collectionOperational).toBe(false);
    expect(
      capabilities.brokers.every((broker) => !broker.collectionOperational),
    ).toBe(true);
  });

  it("creates only an inert draft with six strategies and separated permissions", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.v2.managedSessions.create(draft);

    expect(result.status).toBe("DRAFT");
    expect(result.strategies).toHaveLength(6);
    expect(result.executionSlots).toHaveLength(2);
    expect(result.executionEnabled).toBe(false);
    expect(result.tradeAuthorizationStatus).toBe("NOT_REQUESTED");
    expect(result.withdrawalPermission).toBe("NONE");
    expect(result.executionContract).toMatchObject({
      draftHasExternalSideEffects: false,
      submitHasExternalSideEffects: false,
    });
    expect(result.readiness.unavailableStrategyIds).toContain("bitcoin-core");
    expect(result.readiness.providerActivationBlocked).toBe(true);
    expect(result).not.toHaveProperty("termDays");
    expect(result).not.toHaveProperty("expiresAt");
    expect(result).not.toHaveProperty("capitalMode");
    expect(result.fundsRoute).toBe("BROKER_DIRECT");
  });

  it("submits a draft for review without enabling execution", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const created = await caller.v2.managedSessions.create(draft);
    const submitted = await caller.v2.managedSessions.submit({
      sessionNo: created.sessionNo,
    });

    expect(submitted.status).toBe("PENDING_REVIEW");
    expect(submitted.executionEnabled).toBe(false);
    expect(submitted.events.at(-1)?.eventType).toBe("SUBMITTED_FOR_REVIEW");
  });

  it("does not expose one user's draft to another user", async () => {
    const owner = appRouter.createCaller(createUserContext(91));
    const stranger = appRouter.createCaller(createUserContext(92));
    const created = await owner.v2.managedSessions.create(draft);

    await expect(
      stranger.v2.managedSessions.byId({ sessionNo: created.sessionNo }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps early funding inert until authorization and allows broker-direct tx without a payer wallet", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T13:00:00.000Z"));
    const owner = appRouter.createCaller(createUserContext());
    const admin = appRouter.createCaller(createAdminContext());
    const directDraft: ManagedSessionDraftInput = {
      ...draft,
      executionSlots: [{ brokerId: "exness", capitalWeightPct: 100 }],
    };
    const created = await owner.v2.managedSessions.create(directDraft);
    const submitted = await owner.v2.managedSessions.submit({
      sessionNo: created.sessionNo,
    });
    const exnessSlot = submitted.executionSlots.find(
      (slot: any) => slot.brokerId === "exness",
    )!;
    const intent = await owner.v2.managedSessions.createFundingIntent({
      sessionNo: created.sessionNo,
      slotKey: exnessSlot.slotKey,
      expectedAmount: "50000",
    });
    expect(intent.status).toBe("DRAFT");
    await expect(
      owner.v2.managedSessions.submitFundingIntent({
        sessionNo: created.sessionNo,
        intentNo: intent.intentNo,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    await admin.v2.managedSessions.adminTransition({
      sessionNo: created.sessionNo,
      toStatus: "PENDING_AUTHORIZATION",
    });
    await admin.v2.managedSessions.adminReviewSlot({
      sessionNo: created.sessionNo,
      slotKey: exnessSlot.slotKey,
      connectionStatus: "VERIFIED",
      tradePermission: "GRANTED",
      accountAlias: "客户券商账户",
      authorizationReference: "external-account-reference",
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    await admin.v2.managedSessions.adminTransition({
      sessionNo: created.sessionNo,
      toStatus: "READY",
    });
    const waiting = await owner.v2.managedSessions.submitFundingIntent({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
    });
    expect(waiting.status).toBe("WAITING_INSTRUCTIONS");
    vi.setSystemTime(new Date(Date.now() + 30_000));
    await admin.v2.managedSessions.adminSetDirectFundingInstructions({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      network: "TRON",
      depositAddress: `T${"A".repeat(33)}`,
      instructionsExpireAt: new Date(Date.now() + 60 * 60_000),
      brokerPortalInstructionRef: "broker-portal-screenshot-hash",
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    await expect(
      owner.v2.managedSessions.submitFundingTransaction({
        sessionNo: created.sessionNo,
        intentNo: intent.intentNo,
        txHash: "f".repeat(64),
        declaredAmount: "1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const tx = await owner.v2.managedSessions.submitFundingTransaction({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      txHash: "a".repeat(64),
      declaredAmount: "50000",
    });
    expect(tx.status).toBe("TX_SUBMITTED");
    expect(tx).not.toHaveProperty("payerWalletAddress");
    vi.setSystemTime(new Date(Date.now() + 30_000));
    await expect(
      admin.v2.managedSessions.adminMarkFundingCredited({
        sessionNo: created.sessionNo,
        intentNo: intent.intentNo,
        creditedAmount: "1",
        brokerCreditReference: "broker-credit-underfunded",
        totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("allows one administrator to request and approve a collection payout only with fresh TOTP steps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T14:00:00.000Z"));
    const owner = appRouter.createCaller(createUserContext(501));
    const admin = appRouter.createCaller(createAdminContext());
    const platformDraft: ManagedSessionDraftInput = {
      ...draft,
      onboardingMode: "PLATFORM_ASSISTED",
      fundsRoute: "PLATFORM_COLLECTION",
      executionSlots: [{ brokerId: "exness", capitalWeightPct: 100 }],
    };
    const created = await owner.v2.managedSessions.create(platformDraft);
    const submitted = await owner.v2.managedSessions.submit({
      sessionNo: created.sessionNo,
    });
    await admin.v2.managedSessions.adminTransition({
      sessionNo: created.sessionNo,
      toStatus: "PENDING_AUTHORIZATION",
    });
    const slot = submitted.executionSlots[0];
    await admin.v2.managedSessions.adminReviewSlot({
      sessionNo: created.sessionNo,
      slotKey: slot.slotKey,
      connectionStatus: "VERIFIED",
      tradePermission: "GRANTED",
      authorizationReference: "verified-broker-account-reference",
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    await admin.v2.managedSessions.adminTransition({
      sessionNo: created.sessionNo,
      toStatus: "READY",
    });
    vi.setSystemTime(new Date(Date.now() + 30_000));
    await admin.v2.managedSessions.adminSetCollectionApproval({
      brokerId: "exness",
      status: "APPROVED",
      approvalReference: "written-channel-approval",
      approvedEntity: "Example Licensed Entity",
      approvedRegion: "AU",
      approvedChannelId: "channel-001",
      validUntil: new Date(Date.now() + 86_400_000),
      allowedNetworks: ["TRON"],
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    const intent = await owner.v2.managedSessions.createFundingIntent({
      sessionNo: created.sessionNo,
      slotKey: slot.slotKey,
      expectedAmount: "50000",
    });
    await owner.v2.managedSessions.submitFundingIntent({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
    });
    vi.setSystemTime(new Date(Date.now() + 30_000));
    const address = await admin.v2.managedSessions.adminCreateCollectionAddress({
      label: "single-use-test-address",
      network: "TRON",
      address: `T${"B".repeat(33)}`,
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    vi.setSystemTime(new Date(Date.now() + 30_000));
    await admin.v2.managedSessions.adminAssignCollectionAddress({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      addressId: address.id,
      instructionsExpireAt: new Date(Date.now() + 60 * 60_000),
      customerEligibilityReference: "external-eligibility-case-001",
      scopeAttested: true,
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    await owner.v2.managedSessions.submitFundingTransaction({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      txHash: "b".repeat(64),
      declaredAmount: "50000",
      payerWalletAddress: `T${"C".repeat(33)}`,
      payerOwnershipAttested: true,
    });
    await admin.v2.managedSessions.adminRecordFundingReceipt({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      receivedAmount: "50000",
      confirmations: 20,
      observedNetwork: "TRON",
    });
    vi.setSystemTime(new Date(Date.now() + 30_000));
    await admin.v2.managedSessions.adminScreenFunding({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      screeningStatus: "CLEARED",
      screeningProviderRef: "screening-case-001",
      complianceNote: "External provider returned a clear result.",
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    vi.setSystemTime(new Date(Date.now() + 30_000));
    await admin.v2.managedSessions.adminReconcileFunding({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      result: "MATCHED",
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    vi.setSystemTime(new Date(Date.now() + 30_000));
    const requestCode = computeAdminTotp(TOTP_SECRET, new Date());
    await expect(
      admin.v2.managedSessions.adminRequestPayout({
        sessionNo: created.sessionNo,
        intentNo: intent.intentNo,
        payoutAmount: "1",
        payoutNetwork: "TRON",
        payoutDestination: `T${"D".repeat(33)}`,
        payoutDestinationReference: "broker-portal-deposit-reference",
        totpCode: requestCode,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await admin.v2.managedSessions.adminRequestPayout({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      payoutAmount: "50000",
      payoutNetwork: "TRON",
      payoutDestination: `T${"D".repeat(33)}`,
      payoutDestinationReference: "broker-portal-deposit-reference",
      totpCode: requestCode,
    });
    await expect(
      admin.v2.managedSessions.adminApprovePayout({
        sessionNo: created.sessionNo,
        intentNo: intent.intentNo,
        totpCode: requestCode,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    vi.setSystemTime(new Date(Date.now() + 30_000));
    const approved = await admin.v2.managedSessions.adminApprovePayout({
      sessionNo: created.sessionNo,
      intentNo: intent.intentNo,
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    expect(approved.payoutApproved).toBe(true);
    expect((approved as any).payoutApprovedBy).toBe(
      createAdminContext().user!.id,
    );
  });

  it("blocks ACTIVE even after manual authorization while data is demo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    const owner = appRouter.createCaller(createUserContext());
    const admin = appRouter.createCaller(createAdminContext());
    const created = await owner.v2.managedSessions.create(draft);
    await owner.v2.managedSessions.submit({ sessionNo: created.sessionNo });
    const awaitingAuthorization =
      await admin.v2.managedSessions.adminTransition({
        sessionNo: created.sessionNo,
        toStatus: "PENDING_AUTHORIZATION",
      });

    for (const [
      index,
      slot,
    ] of awaitingAuthorization.executionSlots.entries()) {
      await admin.v2.managedSessions.adminReviewSlot({
        sessionNo: created.sessionNo,
        slotKey: slot.slotKey,
        connectionStatus: "VERIFIED",
        tradePermission: "GRANTED",
        accountAlias: `脱敏槽位-${index + 1}`,
        authorizationReference: `agreement-reference-${index + 1}`,
        totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
      });
      vi.setSystemTime(new Date(Date.now() + 30_000));
    }
    const ready = await admin.v2.managedSessions.adminTransition({
      sessionNo: created.sessionNo,
      toStatus: "READY",
    });
    expect(ready.withdrawalPermission).toBe("NONE");
    expect(ready.executionEnabled).toBe(false);

    await expect(
      admin.v2.managedSessions.adminTransition({
        sessionNo: created.sessionNo,
        toStatus: "ACTIVE",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
