import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const gateway = vi.hoisted(() => ({ name: "zpay", initiate: vi.fn(async () => ({ method: "alipay", payUrl: "https://example.test/payment" })) }));
vi.mock("../_core/payments", () => ({ getGatewayForMethod: () => gateway, getPublicPaymentMethods: () => [] }));
import { ordersRouter, paymentsRouter } from "./commerce";
import * as db from "../db";

let sequence = 0;
const context = { user: { id: 71, role: "user" }, req: { headers: {}, socket: {} }, res: {} } as any;
async function seed(expired = false) {
  return (await db.createOrder({ orderNo: `OFFLINE-STATE-${++sequence}`, userId: 71, productKind: "promo", productId: 42,
    productTitle: "fixture", amount: "29.00", currency: "CNY", status: "pending", expiresAt: new Date(Date.now() + (expired ? -60_000 : 60_000)) }))!;
}
const activePromo = () => ({ id: 42, title: "fixture", isVisible: true, status: "active", promoPrice: "29.00", originalPrice: "39.00", promoEndTime: new Date(Date.now() + 60_000), stock: -1 });
beforeEach(() => { vi.stubEnv("DATABASE_URL", ""); vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("P1: atomic order cancellation", () => {
  it("cannot cancel an order paid between the route read and the UPDATE", async () => {
    const item = await seed();
    const cancel = db.cancelOrder;
    vi.spyOn(db, "cancelOrder").mockImplementationOnce(async (id) => {
      await db.markOrderPaid(id, { paymentGateway: "zpay", paymentMethod: "alipay" });
      return cancel(id);
    });
    await expect(ordersRouter.createCaller(context).cancel({ orderNo: item.orderNo })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.getOrderById(item.id)).toMatchObject({ status: "paid", paymentGateway: "zpay" });
  });
  it("permits late payment if cancellation wins first, then rejects further cancellation", async () => {
    const item = await seed();
    expect(await db.cancelOrder(item.id)).toBe(true);
    expect(await db.markOrderPaid(item.id, { paymentGateway: "zpay", paymentMethod: "alipay" })).toBe(true);
    expect(await db.cancelOrder(item.id)).toBe(false);
    expect(await db.getOrderById(item.id)).toMatchObject({ status: "paid" });
  });
  it("does not overwrite paid or refunded orders on repeated notifications", async () => {
    const item = await seed();
    await db.markOrderPaid(item.id, { paymentGateway: "usdt-manual", paymentMethod: "usdt" });
    expect(await db.markOrderPaid(item.id, { paymentGateway: "zpay" })).toBe(false);
    expect(await db.getOrderById(item.id)).toMatchObject({ paymentGateway: "usdt-manual" });
    await db.markOrderRefunded(item.id);
    expect(await db.markOrderPaid(item.id, { paymentGateway: "zpay" })).toBe(false);
    expect(await db.cancelOrder(item.id)).toBe(false);
    expect(await db.getOrderById(item.id)).toMatchObject({ status: "refunded" });
  });
});

describe("P2: expiration preserves late USDT reconciliation", () => {
  it("opening an expired order persists expired and still accepts a transaction receipt", async () => {
    const item = await seed(true);
    await db.createPayment({ orderId: item.id, orderNo: item.orderNo, gateway: "usdt-manual", method: "usdt", amount: "4.00", currency: "USDT", status: "pending",
      settlementNetwork: "TRC20", callbackRaw: JSON.stringify({ quote: { network: "TRC20", amount: "4.00", expiresAt: new Date(Date.now() - 60_000).toISOString() } }) });
    expect(await ordersRouter.createCaller(context).detail({ orderNo: item.orderNo })).toMatchObject({ status: "expired" });
    expect(await db.getOrderById(item.id)).toMatchObject({ status: "expired" });
    expect(await paymentsRouter.createCaller(context).markUsdtSubmitted({ orderNo: item.orderNo, txHashOrNote: "a".repeat(64), payerWalletAddress: "T" + "A".repeat(33), payerOwnershipAttested: true })).toMatchObject({ ok: true });
    expect((await db.getPaymentsByOrderId(item.id))[0]).toMatchObject({ usdtReviewStatus: "QUOTE_EXPIRED_RECEIPT" });
  });
  it("returns paid when payment wins a concurrent expiration", async () => {
    const item = await seed(true);
    const expire = db.expireOrder;
    vi.spyOn(db, "expireOrder").mockImplementationOnce(async (id) => {
      await db.markOrderPaid(id, { paymentGateway: "zpay" });
      return expire(id);
    });
    expect(await ordersRouter.createCaller(context).detail({ orderNo: item.orderNo })).toMatchObject({ status: "paid" });
    expect(await db.getOrderById(item.id)).toMatchObject({ status: "paid" });
  });
  it("payment initiation uses the same expiration transition", async () => {
    const item = await seed(true);
    await expect(paymentsRouter.createCaller(context).initiate({ orderNo: item.orderNo, method: "alipay" })).rejects.toThrow("过期");
    expect(await db.getOrderById(item.id)).toMatchObject({ status: "expired" });
    expect(gateway.initiate).not.toHaveBeenCalled();
  });
});

describe("P2: promo eligibility before ordering and payment", () => {
  it.each([
    { isVisible: false }, { status: "expired" }, { status: "soldout" }, { stock: 0 },
    { promoEndTime: new Date(0) }, { promoEndTime: "invalid" },
  ])("rejects unavailable promo %j", async (changes) => {
    vi.spyOn(db, "getPromoProductById").mockResolvedValue({ ...activePromo(), ...changes } as any);
    const create = vi.spyOn(db, "createOrder");
    await expect(ordersRouter.createCaller(context).create({ productKind: "promo", productId: 42 })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    const item = await seed();
    await expect(paymentsRouter.createCaller(context).initiate({ orderNo: item.orderNo, method: "alipay" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(gateway.initiate).not.toHaveBeenCalled();
  });
  it("allows active promos and rechecks a later visibility change", async () => {
    const product = activePromo();
    vi.spyOn(db, "getPromoProductById").mockImplementation(async () => product as any);
    const result = await ordersRouter.createCaller(context).create({ productKind: "promo", productId: 42 });
    expect(result.ok).toBe(true);
    expect(await paymentsRouter.createCaller(context).initiate({ orderNo: result.orderNo, method: "alipay" })).toMatchObject({ method: "alipay" });
    product.isVisible = false;
    await expect(paymentsRouter.createCaller(context).initiate({ orderNo: result.orderNo, method: "alipay" })).rejects.toThrow();
    expect(gateway.initiate).toHaveBeenCalledTimes(1);
  });
});
