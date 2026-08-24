import { beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { resetMockManagedSessions } from "./mock-store";
import { resetV2ProviderForTests } from "../v2/provider";
import { appRouter } from "../routers";

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

const draft = {
  termDays: 90 as const,
  capitalMode: "MIXED" as const,
  targetCapital: "50000",
  settlementAsset: "USDT" as const,
  riskProfile: "BALANCED" as const,
  maxDrawdownPct: 12,
  exitMode: "NATURAL_EXIT" as const,
  strategies: [
    "jingge-v51",
    "night-hunter",
    "quantum-queen",
    "gold-reaper",
    "black-aura",
    "bitcoin-core",
  ].map((strategyId, index) => ({
    strategyId,
    weightPct: index === 5 ? 15 : 17,
    riskMultiplier: 1,
  })),
  executionSlots: [
    {
      brokerId: "atlas-prime",
      capitalWeightPct: 55,
      fundingSource: "DIRECT_BROKER" as const,
    },
    {
      brokerId: "vertex",
      capitalWeightPct: 45,
      fundingSource: "MANAGED_VAULT" as const,
    },
  ],
};

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.V2_DATA_PROVIDER = "DEMO";
  delete process.env.MANAGED_VAULT_ENABLED;
  resetV2ProviderForTests();
  resetMockManagedSessions();
});

describe("managed sessions router", () => {
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
    expect(result.readiness.vaultActivationBlocked).toBe(true);
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

  it("blocks ACTIVE even after manual authorization while data is demo and vault is disabled", async () => {
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
      });
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
