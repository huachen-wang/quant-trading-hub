import crypto from "node:crypto";
import { routeHarness } from "../../../tests/helpers/route-call";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { zpayGateway } from "./zpay";
import { registerPaymentRoutes } from "../payment-callback";
import * as db from "../../db";

const fakeKey = "offline-zpay-fixture";
const http = routeHarness();
let sequence = 0;

function payload(orderNo: string, changes: Record<string, string> = {}, key = fakeKey) {
  const fields: Record<string, string> = {
    pid: "fixture-merchant", out_trade_no: orderNo, trade_no: "fixture-trade", money: "29.00",
    type: "alipay", trade_status: "TRADE_SUCCESS", ...changes,
  };
  const signed = Object.keys(fields).sort().filter((name) => fields[name] !== "")
    .map((name) => `${name}=${fields[name]}`).join("&") + key;
  return { ...fields, sign: crypto.createHash("md5").update(signed).digest("hex") };
}

async function order(attempt = "alipay") {
  const created = await db.createOrder({
    orderNo: `OFFLINE-ZPAY-${++sequence}`, userId: 17, productKind: "promo", productId: 1,
    productTitle: "fixture", amount: "29.00", currency: "CNY", status: "pending",
  });
  if (attempt) await db.createPayment({
    orderId: created!.id, orderNo: created!.orderNo, gateway: attempt === "usdt" ? "usdt-manual" : "zpay",
    method: attempt, amount: "29.00", currency: "CNY", status: "pending",
  });
  return created!;
}

async function notify(fields: Record<string, string>, method = "POST") {
  const query = new URLSearchParams(fields).toString();
  return http.call(method, `/api/payment/zpay/notify${method === "GET" ? `?${query}` : ""}`, method === "POST" ? fields : {});

}

beforeAll(() => registerPaymentRoutes(http.app));
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("ZPAY_PID", "fixture-merchant");
  vi.stubEnv("ZPAY_KEY", fakeKey);
  vi.stubEnv("ZPAY_NOTIFY_URL", "https://example.test/notify");
  vi.stubEnv("ENABLE_ZPAY", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("P1: ZPay callbacks fail closed and require a payment attempt", () => {
  it.each(["ZPAY_PID", "ZPAY_KEY", "ZPAY_NOTIFY_URL"])("rejects missing/blank %s", async (name) => {
    const item = await order();
    for (const missing of ["", "   "]) {
      vi.stubEnv(name, missing);
      const forged = payload(item.orderNo, { pid: "" }, "");
      expect(await zpayGateway.verifyCallback({ payload: forged })).toMatchObject({ valid: false, shouldMarkPaid: false });
      expect((await notify(forged)).status).toBe(503);
      expect((await db.getOrderById(item.id)).status).toBe("pending");
    }
  });

  it("rejects a disabled gateway even with a valid signature", async () => {
    vi.stubEnv("ENABLE_ZPAY", "false");
    expect(await zpayGateway.verifyCallback({ payload: payload("fixture") })).toMatchObject({ valid: false });
  });

  it.each(["", "usdt", "wxpay"])("cannot manufacture or substitute a payment attempt (%s)", async (method) => {
    const item = await order(method);
    const before = await db.getPaymentsByOrderId(item.id);
    expect((await notify(payload(item.orderNo))).status).toBe(400);
    expect((await db.getOrderById(item.id)).status).toBe("pending");
    expect(await db.getPaymentsByOrderId(item.id)).toEqual(before);
  });

  it.each(["NaN", "Infinity", "29junk", "29.001", "0", "28.99"])("rejects malformed or mismatched amount %s", async (money) => {
    const item = await order();
    expect((await notify(payload(item.orderNo, { money }))).status).toBe(400);
    expect((await db.getOrderById(item.id)).status).toBe("pending");
  });

  it.each(["GET", "POST"])("accepts a matching signed %s notification and replay preserves the first payment", async (method) => {
    const item = await order();
    expect(await (await notify(payload(item.orderNo), method)).text()).toBe("success");
    const first = { ...await db.getOrderById(item.id) };
    expect(first.status).toBe("paid");
    expect(await (await notify(payload(item.orderNo), method)).text()).toBe("success");
    expect(await db.getOrderById(item.id)).toEqual(first);
  });

  it("records a late ZPay payment without overwriting an already-paid USDT order", async () => {
    const item = await order();
    await db.markOrderPaid(item.id, { paymentGateway: "usdt-manual", paymentMethod: "usdt" });
    expect((await notify(payload(item.orderNo))).status).toBe(200);
    expect(await db.getOrderById(item.id)).toMatchObject({ status: "paid", paymentGateway: "usdt-manual" });
    expect((await db.getPaymentsByOrderId(item.id))[0].status).toBe("success");
  });

  it("rejects a bad signature without returning either signature", async () => {
    const result = await zpayGateway.verifyCallback({ payload: { ...payload("fixture"), sign: "0".repeat(32) } });
    expect(result).toEqual({ valid: false, shouldMarkPaid: false, errorMessage: "Sign mismatch" });
  });
});
