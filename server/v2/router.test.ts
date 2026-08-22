import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";

const originalFlag = process.env.EAXAU_V2_ENABLED;

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  const now = new Date();
  return {
    ...createContext(),
    user: {
      id: 1,
      openId: "v2-admin-test",
      email: "admin@example.test",
      name: "V2 Admin",
      passwordHash: null,
      avatar: null,
      bio: null,
      loginMethod: "password",
      role: "admin",
      phone: null,
      phoneVerified: false,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
  };
}

afterEach(() => {
  if (originalFlag === undefined) delete process.env.EAXAU_V2_ENABLED;
  else process.env.EAXAU_V2_ENABLED = originalFlag;
});

describe("EAXAU V2 router", () => {
  it("returns the six-strategy demo overview when enabled", async () => {
    process.env.EAXAU_V2_ENABLED = "true";
    const caller = appRouter.createCaller(createContext());

    const overview = await caller.v2.overview();

    expect(overview.source.dataMode).toBe("DEMO");
    expect(overview.strategies).toHaveLength(6);
  });

  it("reports disabled status and blocks preview data", async () => {
    process.env.EAXAU_V2_ENABLED = "false";
    const caller = appRouter.createCaller(createContext());

    await expect(caller.v2.status()).resolves.toMatchObject({ enabled: false });
    await expect(caller.v2.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects stale admin reorder lists before writing", async () => {
    process.env.EAXAU_V2_ENABLED = "true";
    const caller = appRouter.createCaller(createAdminContext());

    await expect(
      caller.v2.adminContent.reorder({
        strategyId: "jingge-v51",
        blockIds: ["stale-client-block"],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
