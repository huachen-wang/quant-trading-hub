import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { generateOrderNo, getOrderExpiresAt, isOrderExpired } from "../_core/order-utils";
import { getGatewayForMethod, getPublicPaymentMethods } from "../_core/payments";
import type { InitiateResult } from "../_core/payments/gateway";
import { signDownloadToken } from "../_core/secure-download";
import * as db from "../db";
import { adminProcedure } from "./_admin";

export function canonicalizeTxHash(value: string) {
  return value.replace(/^0x/i, "").toLowerCase();
}

const txHashSchema = z
  .string()
  .trim()
  .regex(/^(?:0x)?[a-fA-F0-9]{64}$/, "请填写完整的 64 位链上 Tx Hash")
  // EVM 钱包可能带 0x，区块浏览器导出也可能不带；统一为 64 位小写，
  // 防止同一笔交易用两种文本形式重复绑定订单。
  .transform(canonicalizeTxHash);

function parsePaymentAudit(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function storedUsdtQuote(payment: any) {
  const quote = parsePaymentAudit(payment?.callbackRaw).quote as any;
  if (
    !quote ||
    quote.currency !== "USDT" ||
    !["TRC20", "ERC20"].includes(quote.network) ||
    typeof quote.amount !== "string" ||
    typeof quote.recipientAddress !== "string" ||
    typeof quote.expiresAt !== "string" ||
    new Date(quote.expiresAt).getTime() <= Date.now()
  ) {
    return null;
  }
  return quote;
}

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
        if (!product || product.status !== "published") throw new Error("商品不存在或已下架");
        if (product.saleMode !== "direct") throw new Error("此商品仅支持商务咨询授权，无法下单");
        if (product.isFree) throw new Error("免费商品无需下单，可直接下载");
        if (!product.downloadUrl) throw new Error("此 EA 文件尚未完成受控交付配置");
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
        if (product?.downloadUrl) {
          const token = signDownloadToken({
            userId: order.userId,
            productKind: "strategy",
            productId: order.productId,
          });
          downloadUrl = `/api/download/secure?token=${encodeURIComponent(token)}`;
        }
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
    .input(z.object({ orderNo: z.string(), gatewayOrderNo: txHashSchema, note: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      if (
        order.status !== "paid" &&
        (order.status !== "pending" || isOrderExpired(order.expiresAt))
      ) {
        throw new Error("订单已取消或过期，不能确认收款");
      }
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const usdtPayment = allPayments.find((payment: any) => payment.gateway === "usdt-manual" && payment.method === "usdt");
      if (!usdtPayment) throw new Error("未找到 USDT 支付意图");
      if (order.status === "paid" && usdtPayment.status === "success") {
        return { ok: true, message: "该 USDT 到款已确认" };
      }
      if (!usdtPayment.gatewayOrderNo) throw new Error("用户尚未提交 Tx Hash");
      if (usdtPayment.gatewayOrderNo.toLowerCase() !== input.gatewayOrderNo.toLowerCase()) {
        throw new Error("确认的 Tx Hash 与用户提交记录不一致");
      }
      const duplicate = await db.getPaymentByGatewayOrderNo(input.gatewayOrderNo);
      if (duplicate && duplicate.id !== usdtPayment.id) throw new Error("该 Tx Hash 已用于其他支付记录");
      const audit = parsePaymentAudit(usdtPayment.callbackRaw);
      await db.updatePayment(usdtPayment.id, {
        status: "success",
        gatewayOrderNo: input.gatewayOrderNo,
        callbackRaw: JSON.stringify({
          ...audit,
          type: order.status === "paid" ? "admin_confirm_late" : "admin_confirm",
          adminId: ctx.user.id,
          txHash: input.gatewayOrderNo,
          note: input.note || null,
          confirmedAt: new Date().toISOString(),
        }),
        callbackVerified: true,
        paidAt: new Date(),
      });
      if (order.status === "paid") {
        return {
          ok: true,
          message: "订单已由其他通道支付；这笔 USDT 晚到款已单独记录，请人工处理退款或余额。",
        };
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
    .mutation(async ({ ctx, input }): Promise<InitiateResult> => {
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
      const existing = await db.getActivePaymentByOrderId(order.id);
      if (
        input.method === "usdt" &&
        existing?.status === "pending" &&
        existing.gateway === "usdt-manual" &&
        existing.method === "usdt"
      ) {
        const quote = storedUsdtQuote(existing);
        if (quote) {
          return {
            method: "usdt" as const,
            addressInfo: {
              chain: quote.network as "TRC20" | "ERC20",
              address: quote.recipientAddress,
            },
            settlementQuote: quote,
            submittedTxHash: existing.gatewayOrderNo || undefined,
            hint: existing.gatewayOrderNo
              ? "Tx Hash 已提交，等待链上对账。"
              : "已恢复本订单的锁定 USDT 报价。",
          };
        }
      }
      const returnUrl = (process.env.ZPAY_RETURN_URL || "") + "?orderNo=" + encodeURIComponent(order.orderNo);
      const result = await gateway.initiate({ order, method: input.method, returnUrl });
      const settlementQuote = result.settlementQuote;
      const paymentAmount = settlementQuote?.amount || String(order.amount);
      const paymentCurrency = settlementQuote?.currency || order.currency;
      const intentAudit = settlementQuote
        ? JSON.stringify({ type: "usdt_intent", quote: settlementQuote, createdAt: new Date().toISOString() })
        : null;
      if (existing && existing.status === "pending" && existing.gateway === gateway.name && existing.method === input.method) {
        await db.updatePayment(existing.id, {
          gatewayOrderNo: result.gatewayOrderNo || null,
          amount: paymentAmount,
          currency: paymentCurrency,
          callbackRaw: intentAudit,
          errorMessage: null,
        });
      } else {
        if (existing?.status === "pending") {
          await db.updatePayment(existing.id, {
            status: "failed",
            errorMessage: `superseded by ${gateway.name}/${input.method}`,
          });
        }
        await db.createPayment({
          orderId: order.id,
          orderNo: order.orderNo,
          gateway: gateway.name,
          method: input.method,
          gatewayOrderNo: result.gatewayOrderNo || null,
          amount: paymentAmount,
          currency: paymentCurrency,
          status: "pending",
          callbackRaw: intentAudit,
        });
      }
      return result;
    }),

  markUsdtSubmitted: protectedProcedure
    .input(z.object({ orderNo: z.string(), txHashOrNote: txHashSchema }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      if (order.userId !== ctx.user.id) throw new Error("无权操作");
      if (order.status !== "pending" || isOrderExpired(order.expiresAt)) throw new Error("订单已失效");
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const usdtPayment = allPayments.find((payment: any) => payment.gateway === "usdt-manual" && payment.status === "pending");
      if (!usdtPayment) throw new Error("未找到待提交的 USDT 支付记录");
      const duplicate = await db.getPaymentByGatewayOrderNo(input.txHashOrNote);
      if (duplicate && duplicate.id !== usdtPayment.id) throw new Error("该 Tx Hash 已提交，请核对后重试");
      const audit = parsePaymentAudit(usdtPayment.callbackRaw);
      await db.updatePayment(usdtPayment.id, {
        gatewayOrderNo: input.txHashOrNote,
        callbackRaw: JSON.stringify({
          ...audit,
          type: "user_submitted",
          submittedAt: new Date().toISOString(),
          txHash: input.txHashOrNote,
        }),
      });
      return { ok: true, message: "Tx Hash 已提交，等待链上对账确认。" };
    }),
});
