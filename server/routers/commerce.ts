import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { generateOrderNo, getOrderExpiresAt, isOrderExpired } from "../_core/order-utils";
import { getGatewayForMethod, getPublicPaymentMethods } from "../_core/payments";
import * as db from "../db";
import { adminProcedure } from "./_admin";

export const ordersRouter = router({
  create: protectedProcedure
    .input(z.object({ productKind: z.enum(["strategy", "promo"]), productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      let product: any = null;
      let productTitle = "";
      let productCover: string | null = null;
      let amount = "0.00";
      let originalAmount: string | null = null;
      if (input.productKind === "strategy") {
        product = await db.getStrategyById(input.productId);
        if (!product) throw new Error("商品不存在或已下架");
        if (product.saleMode !== "direct") throw new Error("此商品仅支持商务咨询授权，无法下单");
        if (product.isFree) throw new Error("免费商品无需下单，可直接下载");
        productTitle = product.title;
        productCover = product.coverImage;
        amount = String(product.price || "0.00");
        originalAmount = product.originalPrice ? String(product.originalPrice) : null;
      } else {
        product = await db.getPromoProductById(input.productId);
        if (!product) throw new Error("商品不存在或已下架");
        productTitle = product.title;
        productCover = product.coverImage;
        amount = String(product.promoPrice);
        originalAmount = String(product.originalPrice);
      }
      if (parseFloat(amount) <= 0) throw new Error("商品金额异常");
      const existing = await db.getUserOrders(ctx.user.id, { status: "pending", limit: 5 });
      const dup = existing.find(
        (order: any) =>
          order.productKind === input.productKind &&
          order.productId === input.productId &&
          !isOrderExpired(order.expiresAt),
      );
      if (dup) {
        return { ok: true, orderNo: dup.orderNo, isExisting: true };
      }
      const orderNo = generateOrderNo();
      await db.createOrder({
        orderNo,
        userId: ctx.user.id,
        productKind: input.productKind,
        productId: input.productId,
        productTitle,
        productCover,
        amount,
        originalAmount,
        status: "pending",
        expiresAt: getOrderExpiresAt(30),
      });
      return { ok: true, orderNo, isExisting: false };
    }),

  detail: protectedProcedure
    .input(z.object({ orderNo: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") throw new Error("无权访问此订单");
      if (order.status === "pending" && isOrderExpired(order.expiresAt)) {
        await db.cancelOrder(order.id);
        (order as any).status = "expired";
      }
      const paymentsList = await db.getPaymentsByOrderId(order.id);
      let downloadUrl: string | null = null;
      if (order.status === "paid" && order.productKind === "strategy") {
        const product = await db.getStrategyById(order.productId);
        downloadUrl = product?.downloadUrl || null;
      }
      return { ...order, payments: paymentsList, downloadUrl };
    }),

  myList: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "paid", "cancelled", "refunded", "expired"]).optional(), limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => db.getUserOrders(ctx.user.id, { status: input?.status, limit: input?.limit || 50 })),

  cancel: protectedProcedure
    .input(z.object({ orderNo: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      if (order.userId !== ctx.user.id) throw new Error("无权操作");
      if (order.status !== "pending") throw new Error("当前状态无法取消");
      await db.cancelOrder(order.id);
      return { ok: true };
    }),

  adminList: adminProcedure
    .input(z.object({ status: z.enum(["pending", "paid", "cancelled", "refunded", "expired"]).optional(), limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.listAllOrders({ status: input?.status, limit: input?.limit });
    }),

  adminConfirmUsdt: adminProcedure
    .input(z.object({ orderNo: z.string(), gatewayOrderNo: z.string().optional(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      if (order.status === "paid") return { ok: true, message: "订单已支付" };
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const usdtPayment = allPayments.find((payment: any) => payment.gateway === "usdt-manual" && payment.method === "usdt");
      if (usdtPayment) {
        await db.updatePayment(usdtPayment.id, {
          status: "success",
          gatewayOrderNo: input.gatewayOrderNo || null,
          callbackRaw: JSON.stringify({ type: "admin_confirm", adminId: ctx.user.id, txHash: input.gatewayOrderNo, confirmedAt: new Date().toISOString() }),
          callbackVerified: true,
          paidAt: new Date(),
        });
      } else {
        await db.createPayment({
          orderId: order.id,
          orderNo: order.orderNo,
          gateway: "usdt-manual",
          method: "usdt",
          gatewayOrderNo: input.gatewayOrderNo || null,
          amount: order.amount,
          currency: order.currency,
          status: "success",
          callbackRaw: JSON.stringify({ type: "admin_confirm_no_intent", adminId: ctx.user.id }),
          callbackVerified: true,
          paidAt: new Date(),
        });
      }
      await db.markOrderPaid(order.id, { paymentMethod: "usdt", paymentGateway: "usdt-manual" });
      return { ok: true };
    }),

  adminPendingUsdt: adminProcedure.query(async () => {
    return db.listPendingUsdtPayments();
  }),
});

export const paymentsRouter = router({
  listMethods: publicProcedure.query(() => getPublicPaymentMethods()),

  initiate: protectedProcedure
    .input(z.object({ orderNo: z.string(), method: z.enum(["alipay", "wxpay", "usdt"]) }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      if (order.userId !== ctx.user.id) throw new Error("无权访问此订单");
      if (order.status === "paid") throw new Error("订单已支付");
      if (order.status === "cancelled" || order.status === "expired") throw new Error("订单已失效");
      if (isOrderExpired(order.expiresAt)) {
        await db.cancelOrder(order.id);
        throw new Error("订单已过期，请重新下单");
      }
      const gateway = getGatewayForMethod(input.method);
      if (!gateway) {
        throw new Error(`不支持的支付方式：${input.method}`);
      }
      const returnUrl = (process.env.ZPAY_RETURN_URL || "") + "?orderNo=" + encodeURIComponent(order.orderNo);
      const result = await gateway.initiate({ order, method: input.method, returnUrl });
      const existing = await db.getActivePaymentByOrderId(order.id);
      if (existing && existing.status === "pending") {
        await db.updatePayment(existing.id, { gateway: gateway.name, method: input.method, gatewayOrderNo: result.gatewayOrderNo || null });
      } else {
        await db.createPayment({
          orderId: order.id,
          orderNo: order.orderNo,
          gateway: gateway.name,
          method: input.method,
          gatewayOrderNo: result.gatewayOrderNo || null,
          amount: order.amount,
          currency: order.currency,
          status: "pending",
        });
      }
      return result;
    }),

  markUsdtSubmitted: protectedProcedure
    .input(z.object({ orderNo: z.string(), txHashOrNote: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      if (order.userId !== ctx.user.id) throw new Error("无权操作");
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const usdtPayment = allPayments.find((payment: any) => payment.gateway === "usdt-manual" && payment.status === "pending");
      if (!usdtPayment) throw new Error("未找到待提交的 USDT 支付记录");
      await db.updatePayment(usdtPayment.id, {
        callbackRaw: JSON.stringify({ type: "user_submitted", submittedAt: new Date().toISOString(), userNote: input.txHashOrNote || null }),
      });
      return { ok: true, message: "已通知客服，30 分钟内确认。" };
    }),
});
