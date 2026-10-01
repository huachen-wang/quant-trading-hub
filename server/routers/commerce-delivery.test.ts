/**
 * 交付门禁的路由级测试：直接以 createCaller 打 tRPC procedure，等价于绕过前端的
 * 脚本客户端。使用无 DATABASE_URL 时的内存 mock store，不联网、不写生产库。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { verifyDownloadToken } from "../_core/secure-download";
import * as db from "../db";

const SIGNING_SECRET = "delivery-gate-test-secret-with-more-than-32-bytes";
const BROKER_LINK = "https://kaibb.co/register/trader?link_id=a&referrer_id=b";
const FILE_URL = "https://files.eaxau.example/ea/gold-trend.ex5";
const originalSigningSecret = process.env.DOWNLOAD_SIGNING_SECRET;

let appRouter: typeof import("../routers").appRouter;
let orderSeq = 0;

function request(): TrpcContext["req"] {
  return {
    protocol: "http",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as TrpcContext["req"];
}

function userContext(id: number, role: "user" | "admin" = "user"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id,
      openId: `delivery-${role}-${id}`,
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
    req: request(),
    res: {} as TrpcContext["res"],
  };
}

function anonymousContext(): TrpcContext {
  return { user: null, req: request(), res: {} as TrpcContext["res"] };
}

/** createMockStrategy 会强制 isFree=false / saleMode=inquiry，所以先建再改。 */
async function seedStrategy(overrides: Record<string, unknown> = {}) {
  const created = await db.createStrategy({
    title: "Gate EA",
    platform: "MT4",
    pairs: "XAUUSD",
    status: "published",
  } as any);
  const updated = await db.updateStrategy(created!.id, {
    saleMode: "direct",
    isFree: false,
    price: "199.00",
    downloadUrl: FILE_URL,
    ...overrides,
  } as any);
  return updated!;
}

async function seedOrder(input: {
  userId: number;
  productKind: "strategy" | "promo";
  productId: number;
  paid?: boolean;
}) {
  orderSeq += 1;
  const orderNo = `EX-GATE-${orderSeq}`;
  const order = await db.createOrder({
    orderNo,
    userId: input.userId,
    productKind: input.productKind,
    productId: input.productId,
    productTitle: "Gate item",
    amount: "199.00",
    currency: "CNY",
    status: "pending",
    expiresAt: new Date(Date.now() + 30 * 60_000),
  });
  if (input.paid) {
    await db.markOrderPaid(order!.id, { paymentMethod: "alipay", paymentGateway: "zpay" });
  }
  return (await db.getOrderByOrderNo(orderNo))!;
}

function tokenFromPath(path: string) {
  return decodeURIComponent(path.split("token=")[1] ?? "");
}

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  process.env.DOWNLOAD_SIGNING_SECRET = SIGNING_SECRET;
  ({ appRouter } = await import("../routers"));
});

afterAll(() => {
  if (originalSigningSecret === undefined) {
    delete process.env.DOWNLOAD_SIGNING_SECRET;
  } else {
    process.env.DOWNLOAD_SIGNING_SECRET = originalSigningSecret;
  }
});

describe("orders.create re-validates deliverability on the server", () => {
  it("rejects anonymous callers before touching the product", async () => {
    const strategy = await seedStrategy();
    await expect(
      appRouter
        .createCaller(anonymousContext())
        .orders.create({ productKind: "strategy", productId: strategy.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a broker registration link even when the caller bypasses the detail page DTO", async () => {
    const userId = 9101;
    const strategy = await seedStrategy({ downloadUrl: BROKER_LINK });
    await expect(
      appRouter
        .createCaller(userContext(userId))
        .orders.create({ productKind: "strategy", productId: strategy.id }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("客服确认交付方式"),
    });
    expect(await db.getUserOrders(userId)).toHaveLength(0);
  });

  it("rejects a product without a delivery file", async () => {
    const userId = 9102;
    const strategy = await seedStrategy({ downloadUrl: null });
    await expect(
      appRouter
        .createCaller(userContext(userId))
        .orders.create({ productKind: "strategy", productId: strategy.id }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("尚未完成受控交付配置"),
    });
    expect(await db.getUserOrders(userId)).toHaveLength(0);
  });

  it("rejects free products and points to the free claim path instead of a paid order", async () => {
    const userId = 9103;
    const strategy = await seedStrategy({ isFree: true, price: "0.00" });
    await expect(
      appRouter
        .createCaller(userContext(userId))
        .orders.create({ productKind: "strategy", productId: strategy.id }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("免费商品无需下单"),
    });
    expect(await db.getUserOrders(userId)).toHaveLength(0);
  });

  it.each([
    ["inquiry-only", { saleMode: "inquiry" }, "PRECONDITION_FAILED", "商务咨询授权"],
    ["draft", { status: "draft" }, "NOT_FOUND", "已下架"],
    ["archived", { status: "archived" }, "NOT_FOUND", "已下架"],
  ])("rejects a %s product", async (_label, overrides, code, fragment) => {
    const strategy = await seedStrategy(overrides);
    await expect(
      appRouter
        .createCaller(userContext(9104))
        .orders.create({ productKind: "strategy", productId: strategy.id }),
    ).rejects.toMatchObject({ code, message: expect.stringContaining(fragment) });
  });

  it("creates an order for a published, direct, paid product backed by a real file", async () => {
    const userId = 9105;
    const strategy = await seedStrategy();
    const result = await appRouter
      .createCaller(userContext(userId))
      .orders.create({ productKind: "strategy", productId: strategy.id });

    expect(result).toMatchObject({ ok: true, isExisting: false });
    expect(result.orderNo).toMatch(/^EX\d{8}[0-9A-F]{8}$/);
    const order = await db.getOrderByOrderNo(result.orderNo);
    expect(order).toMatchObject({
      userId,
      productKind: "strategy",
      productId: strategy.id,
      amount: "199.00",
      status: "pending",
    });
  });
});

describe("payments.initiate re-checks deliverability before taking money", () => {
  it("refuses to start payment when the product became a broker link after the order was created", async () => {
    const userId = 9201;
    const strategy = await seedStrategy();
    const caller = appRouter.createCaller(userContext(userId));
    const created = await caller.orders.create({ productKind: "strategy", productId: strategy.id });
    await db.updateStrategy(strategy.id, { downloadUrl: BROKER_LINK });

    await expect(
      caller.payments.initiate({ orderNo: created.orderNo, method: "usdt" }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("客服确认交付方式"),
    });
    expect((await db.getOrderByOrderNo(created.orderNo))?.status).toBe("pending");
  });

  it.each([
    ["unpublished (draft)", { status: "draft" }, "NOT_FOUND", "已下架"],
    ["archived", { status: "archived" }, "NOT_FOUND", "已下架"],
    ["switched to inquiry-only", { saleMode: "inquiry" }, "PRECONDITION_FAILED", "商务咨询授权"],
    ["made free", { isFree: true, price: "0.00" }, "PRECONDITION_FAILED", "免费商品无需下单"],
  ])("refuses to start payment when the product was %s after the order was created, creating no payment intent", async (_label, patch, code, fragment) => {
    const userId = 9210 + Math.floor(Math.random() * 1000);
    const strategy = await seedStrategy();
    const caller = appRouter.createCaller(userContext(userId));
    const created = await caller.orders.create({ productKind: "strategy", productId: strategy.id });
    await db.updateStrategy(strategy.id, patch as any);

    for (const method of ["usdt", "alipay"] as const) {
      await expect(
        caller.payments.initiate({ orderNo: created.orderNo, method }),
      ).rejects.toMatchObject({ code, message: expect.stringContaining(fragment) });
    }
    const order = (await db.getOrderByOrderNo(created.orderNo))!;
    expect(order.status).toBe("pending");
    expect(await db.getPaymentsByOrderId(order.id)).toHaveLength(0);
  });

  it("refuses to initiate payment again on a refunded order and creates no payment intent", async () => {
    const userId = 9203;
    const strategy = await seedStrategy();
    const order = await seedOrder({ userId, productKind: "strategy", productId: strategy.id, paid: true });
    await db.markOrderRefunded(order.id);

    await expect(
      appRouter.createCaller(userContext(userId)).payments.initiate({ orderNo: order.orderNo, method: "usdt" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("已退款") });
    expect((await db.getOrderByOrderNo(order.orderNo))?.status).toBe("refunded");
    expect(await db.getPaymentsByOrderId(order.id)).toHaveLength(0);
  });

  it("keeps the owner check: another user cannot initiate payment on someone else's order", async () => {
    const owner = 9204;
    const strategy = await seedStrategy();
    const order = await seedOrder({ userId: owner, productKind: "strategy", productId: strategy.id });
    await expect(
      appRouter.createCaller(userContext(9205)).payments.initiate({ orderNo: order.orderNo, method: "usdt" }),
    ).rejects.toThrow(/无权访问/);
    expect(await db.getPaymentsByOrderId(order.id)).toHaveLength(0);
  });

  it("refuses to start payment when the file was cleared after the order was created", async () => {
    const userId = 9202;
    const strategy = await seedStrategy();
    const caller = appRouter.createCaller(userContext(userId));
    const created = await caller.orders.create({ productKind: "strategy", productId: strategy.id });
    await db.updateStrategy(strategy.id, { downloadUrl: null });

    await expect(
      caller.payments.initiate({ orderNo: created.orderNo, method: "alipay" }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("尚未完成受控交付配置"),
    });
    const order = (await db.getOrderByOrderNo(created.orderNo))!;
    expect(await db.getPaymentsByOrderId(order.id)).toHaveLength(0);
  });
});

describe("orders.detail reports the real delivery state for the success page", () => {
  it("does not promise a download while the order is still pending", async () => {
    const userId = 9301;
    const strategy = await seedStrategy();
    const order = await seedOrder({ userId, productKind: "strategy", productId: strategy.id });
    const detail = await appRouter
      .createCaller(userContext(userId))
      .orders.detail({ orderNo: order.orderNo });

    expect(detail.delivery).toEqual({ status: "awaiting_payment", orderStatus: "pending" });
    expect(detail.downloadUrl).toBeNull();
  });

  it("signs a download link only for a paid order on a real file, and the token belongs to the buyer", async () => {
    const userId = 9302;
    const strategy = await seedStrategy();
    const order = await seedOrder({ userId, productKind: "strategy", productId: strategy.id, paid: true });
    const detail = await appRouter
      .createCaller(userContext(userId))
      .orders.detail({ orderNo: order.orderNo });

    expect(detail.delivery).toMatchObject({ status: "ready", expiresInMinutes: 30 });
    expect(detail.downloadUrl).toMatch(/^\/api\/download\/secure\?token=/);
    expect(verifyDownloadToken(tokenFromPath(detail.downloadUrl!))).toMatchObject({
      ok: true,
      userId,
      productKind: "strategy",
      productId: strategy.id,
    });
  });

  it("marks a paid order on a broker-link product as awaiting manual delivery, with no download link", async () => {
    const userId = 9303;
    const strategy = await seedStrategy({ downloadUrl: BROKER_LINK });
    const order = await seedOrder({ userId, productKind: "strategy", productId: strategy.id, paid: true });
    const detail = await appRouter
      .createCaller(userContext(userId))
      .orders.detail({ orderNo: order.orderNo });

    expect(detail.status).toBe("paid");
    expect(detail.delivery).toEqual({ status: "contact", reason: "broker_link" });
    expect(detail.downloadUrl).toBeNull();
  });

  it("marks a paid order whose product has no file as awaiting manual delivery", async () => {
    const userId = 9304;
    const strategy = await seedStrategy({ downloadUrl: null });
    const order = await seedOrder({ userId, productKind: "strategy", productId: strategy.id, paid: true });
    const detail = await appRouter
      .createCaller(userContext(userId))
      .orders.detail({ orderNo: order.orderNo });

    expect(detail.delivery).toEqual({ status: "contact", reason: "no_file" });
    expect(detail.downloadUrl).toBeNull();
  });

  it("routes a paid promo bundle to contact delivery", async () => {
    const userId = 9305;
    const order = await seedOrder({ userId, productKind: "promo", productId: 1, paid: true });
    const detail = await appRouter
      .createCaller(userContext(userId))
      .orders.detail({ orderNo: order.orderNo });

    expect(detail.delivery).toEqual({ status: "contact", reason: "promo" });
    expect(detail.downloadUrl).toBeNull();
  });

  it("reports a deleted product as unavailable instead of failing the whole query", async () => {
    const userId = 9306;
    const strategy = await seedStrategy();
    const order = await seedOrder({ userId, productKind: "strategy", productId: strategy.id, paid: true });
    await db.deleteStrategy(strategy.id);
    const detail = await appRouter
      .createCaller(userContext(userId))
      .orders.detail({ orderNo: order.orderNo });

    expect(detail.delivery).toEqual({ status: "unavailable", reason: "product_missing" });
    expect(detail.downloadUrl).toBeNull();
  });

  it("reports a missing signing secret as unavailable, never as 'order not found'", async () => {
    const userId = 9307;
    const strategy = await seedStrategy();
    const order = await seedOrder({ userId, productKind: "strategy", productId: strategy.id, paid: true });
    delete process.env.DOWNLOAD_SIGNING_SECRET;
    try {
      const detail = await appRouter
        .createCaller(userContext(userId))
        .orders.detail({ orderNo: order.orderNo });
      expect(detail.status).toBe("paid");
      expect(detail.delivery).toEqual({ status: "unavailable", reason: "signing_unavailable" });
      expect(detail.downloadUrl).toBeNull();
    } finally {
      process.env.DOWNLOAD_SIGNING_SECRET = SIGNING_SECRET;
    }
  });

  it("reports refunded orders as refunded", async () => {
    const userId = 9308;
    const strategy = await seedStrategy();
    const order = await seedOrder({ userId, productKind: "strategy", productId: strategy.id, paid: true });
    await db.markOrderRefunded(order.id);
    const detail = await appRouter
      .createCaller(userContext(userId))
      .orders.detail({ orderNo: order.orderNo });

    expect(detail.delivery).toEqual({ status: "refunded" });
    expect(detail.downloadUrl).toBeNull();
  });

  it("does not expose another user's paid order or its download link", async () => {
    const owner = 9309;
    const strategy = await seedStrategy();
    const order = await seedOrder({ userId: owner, productKind: "strategy", productId: strategy.id, paid: true });
    await expect(
      appRouter.createCaller(userContext(9310)).orders.detail({ orderNo: order.orderNo }),
    ).rejects.toThrow(/无权访问/);
    await expect(
      appRouter.createCaller(anonymousContext()).orders.detail({ orderNo: order.orderNo }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("downloads.claimFree delivers free files without faking a payment", () => {
  it("requires login", async () => {
    const strategy = await seedStrategy({ isFree: true, price: "0.00" });
    await expect(
      appRouter.createCaller(anonymousContext()).downloads.claimFree({ strategyId: strategy.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("issues a signed download link for a legitimate free file and creates no order", async () => {
    const userId = 9401;
    const strategy = await seedStrategy({ isFree: true, price: "0.00" });
    const result = await appRouter
      .createCaller(userContext(userId))
      .downloads.claimFree({ strategyId: strategy.id });

    expect(result).toMatchObject({ delivery: "file", expiresInMinutes: 30 });
    if (result.delivery !== "file") throw new Error("expected a file delivery");
    expect(result.downloadUrl).toMatch(/^\/api\/download\/secure\?token=/);
    expect(verifyDownloadToken(tokenFromPath(result.downloadUrl))).toMatchObject({
      ok: true,
      userId,
      productKind: "strategy",
      productId: strategy.id,
    });
    // 不伪造付款：免费领取不建订单、不写支付记录。
    expect(await db.getUserOrders(userId)).toHaveLength(0);
    expect(await db.hasUserPurchased(userId, strategy.id)).toBe(false);
  });

  it.each([
    ["no file", { downloadUrl: null }, "no_file"],
    ["broker registration link", { downloadUrl: BROKER_LINK }, "broker_link"],
  ])("routes a free product with %s to contact instead of a token", async (_label, overrides, reason) => {
    const userId = 9402;
    const strategy = await seedStrategy({ isFree: true, price: "0.00", ...overrides });
    const result = await appRouter
      .createCaller(userContext(userId))
      .downloads.claimFree({ strategyId: strategy.id });

    expect(result).toEqual({ delivery: "contact", reason });
    expect(await db.getUserOrders(userId)).toHaveLength(0);
  });

  it("refuses to hand out a paid product for free", async () => {
    const strategy = await seedStrategy();
    await expect(
      appRouter.createCaller(userContext(9403)).downloads.claimFree({ strategyId: strategy.id }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("付费商品"),
    });
  });

  it.each([
    ["draft", { status: "draft" }, "NOT_FOUND"],
    ["archived", { status: "archived" }, "NOT_FOUND"],
    ["inquiry-only", { saleMode: "inquiry" }, "PRECONDITION_FAILED"],
  ])("refuses a %s free product", async (_label, overrides, code) => {
    const strategy = await seedStrategy({ isFree: true, price: "0.00", ...overrides });
    await expect(
      appRouter.createCaller(userContext(9404)).downloads.claimFree({ strategyId: strategy.id }),
    ).rejects.toMatchObject({ code });
  });

  it("refuses unknown strategy ids", async () => {
    await expect(
      appRouter.createCaller(userContext(9405)).downloads.claimFree({ strategyId: 987654321 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("fails closed without leaking configuration when the signing secret is missing", async () => {
    const strategy = await seedStrategy({ isFree: true, price: "0.00" });
    delete process.env.DOWNLOAD_SIGNING_SECRET;
    try {
      await expect(
        appRouter.createCaller(userContext(9406)).downloads.claimFree({ strategyId: strategy.id }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: expect.not.stringContaining("DOWNLOAD_SIGNING_SECRET"),
      });
    } finally {
      process.env.DOWNLOAD_SIGNING_SECRET = SIGNING_SECRET;
    }
  });
});
