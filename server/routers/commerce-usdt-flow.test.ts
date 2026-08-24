import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { computeAdminTotp } from "../_core/admin-totp";
import * as db from "../db";

const TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
let appRouter: typeof import("../routers").appRouter;

function context(id: number, role: "user" | "admin"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id,
      openId: `commerce-${role}-${id}`,
      name: role,
      email: `${role}-${id}@example.test`,
      passwordHash: null,
      avatar: null,
      bio: null,
      loginMethod: "password",
      role,
      phone: null,
      phoneVerified: false,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: {
      protocol: "http",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

async function createTestOrder(orderNo: string, userId: number) {
  return db.createOrder({
    orderNo,
    userId,
    productKind: "strategy",
    productId: 9001,
    productTitle: "EA test artifact",
    amount: "700.00",
    currency: "CNY",
    status: "pending",
    expiresAt: new Date(Date.now() + 30 * 60_000),
  });
}

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-24T10:00:00.000Z"));
  delete process.env.DATABASE_URL;
  process.env.ENABLE_USDT_PAYMENT = "true";
  process.env.USDT_TRC20_ADDRESS = `T${"A".repeat(33)}`;
  delete process.env.USDT_ERC20_ADDRESS;
  process.env.USDT_CNY_PER_USDT = "7";
  process.env.ADMIN_TOTP_SECRET_BASE32 = TOTP_SECRET;
  ({ appRouter } = await import("../routers"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("EA merchant USDT ledger", () => {
  it("atomically completes both submitted-tx confirmation paths", async () => {
    const userId = 7801;
    const user = appRouter.createCaller(context(userId, "user"));
    const admin = appRouter.createCaller(context(1, "admin"));

    const confirmOrder = await createTestOrder("EA-USDT-CONFIRM-1", userId);
    const confirmQuote = await user.payments.initiate({
      orderNo: confirmOrder!.orderNo,
      method: "usdt",
    });
    const confirmHash = "a".repeat(64);
    await user.payments.markUsdtSubmitted({
      orderNo: confirmOrder!.orderNo,
      txHashOrNote: confirmHash,
      payerWalletAddress: `T${"B".repeat(33)}`,
      payerOwnershipAttested: true,
    });
    const submittedPayment = (await db.getPaymentsByOrderId(confirmOrder!.id))[0];
    expect(submittedPayment.gatewayOrderNo).toBe(confirmHash);
    await admin.orders.adminConfirmUsdt({
      orderNo: confirmOrder!.orderNo,
      gatewayOrderNo: confirmHash,
      receivedAmount: confirmQuote.settlementQuote!.amount,
      confirmations: 20,
      observedNetwork: "TRC20",
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    expect((await db.getOrderById(confirmOrder!.id))?.status).toBe("paid");
    expect((await db.getPaymentById(submittedPayment.id))?.status).toBe("success");
    expect(await db.listCommerceUsdtEvents(submittedPayment.id)).toHaveLength(3);

    vi.setSystemTime(new Date(Date.now() + 30_000));
    const reconcileOrder = await createTestOrder("EA-USDT-RECONCILE-1", userId);
    const reconcileQuote = await user.payments.initiate({
      orderNo: reconcileOrder!.orderNo,
      method: "usdt",
    });
    const reconcileHash = "b".repeat(64);
    await user.payments.markUsdtSubmitted({
      orderNo: reconcileOrder!.orderNo,
      txHashOrNote: reconcileHash,
      payerWalletAddress: `T${"C".repeat(33)}`,
      payerOwnershipAttested: true,
    });
    const reconciled = await admin.orders.adminReconcileUsdt({
      orderNo: reconcileOrder!.orderNo,
      gatewayOrderNo: reconcileHash,
      receivedAmount: reconcileQuote.settlementQuote!.amount,
      confirmations: 20,
      observedNetwork: "TRC20",
      totpCode: computeAdminTotp(TOTP_SECRET, new Date()),
    });
    expect(reconciled).toMatchObject({
      reviewStatus: "MATCHED",
      orderMarkedPaid: true,
    });
    expect((await db.getOrderById(reconcileOrder!.id))?.status).toBe("paid");
  });
});
