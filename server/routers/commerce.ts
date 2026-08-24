import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { generateOrderNo, getOrderExpiresAt, isOrderExpired } from "../_core/order-utils";
import { getGatewayForMethod, getPublicPaymentMethods } from "../_core/payments";
import type { InitiateResult } from "../_core/payments/gateway";
import { signDownloadToken } from "../_core/secure-download";
import * as db from "../db";
import { adminProcedure } from "./_admin";
import { matchAdminTotpStep } from "../_core/admin-totp";
import {
  assertSecurityAttemptAllowed,
  clearSecurityFailures,
  recordSecurityFailure,
  requestIp,
} from "../_core/admin-security-throttle";

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

const usdtReviewStatusSchema = z.enum([
  "AWAITING_TX",
  "PENDING_REVIEW",
  "MATCHED",
  "UNDERPAID",
  "OVERPAID",
  "WRONG_NETWORK",
  "QUOTE_EXPIRED_RECEIPT",
  "DUPLICATE_TX",
  "REFUND_PENDING",
  "REFUNDED",
  "REJECTED",
]);

const usdtAmountSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/)
  .refine((value) => Number(value) > 0, "USDT 金额必须大于 0");

const totpCodeSchema = z.string().trim().regex(/^\d{6}$/);

function toMicroUsdt(value: string | number) {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
}

function validateCommerceAddress(address: string, network: "TRC20" | "ERC20") {
  return network === "TRC20"
    ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
    : /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function assertCommerceTotp(
  adminId: number,
  code: string,
  action: string,
  ip = "unknown",
) {
  const principal = `admin:${adminId}`;
  try {
    assertSecurityAttemptAllowed("ADMIN_TOTP", principal, ip);
  } catch (error) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: error instanceof Error ? error.message : "动态验证尝试过多",
    });
  }
  const timeStep = matchAdminTotpStep(code);
  if (timeStep === null) {
    recordSecurityFailure("ADMIN_TOTP", principal, ip);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "动态码未配置、已过期或不正确。",
    });
  }
  clearSecurityFailures("ADMIN_TOTP", principal, ip);
  try {
    await db.consumeAdminTotpStep({ adminId, timeStep, action });
  } catch (error) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        error instanceof Error
          ? error.message
          : "该动态码已用于另一个敏感操作，请等待下一个动态码。",
    });
  }
}

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
    .input(z.object({
      orderNo: z.string(),
      gatewayOrderNo: txHashSchema,
      receivedAmount: usdtAmountSchema,
      confirmations: z.number().int().min(1),
      observedNetwork: z.enum(["TRC20", "ERC20"]),
      note: z.string().trim().max(500).optional(),
      totpCode: totpCodeSchema,
    }))
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
      if (
        order.status === "paid" &&
        order.paymentGateway !== "usdt-manual"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "订单已由其他通道支付；请使用完整 USDT 对账流程登记为 REFUND_PENDING。",
        });
      }
      if (order.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "订单状态已变更，请使用完整 USDT 对账流程。",
        });
      }
      if (!usdtPayment.gatewayOrderNo) throw new Error("用户尚未提交 Tx Hash");
      if (usdtPayment.gatewayOrderNo.toLowerCase() !== input.gatewayOrderNo.toLowerCase()) {
        throw new Error("确认的 Tx Hash 与用户提交记录不一致");
      }
      const duplicate = await db.getPaymentByGatewayOrderNo(input.gatewayOrderNo);
      if (duplicate && duplicate.id !== usdtPayment.id) throw new Error("该 Tx Hash 已用于其他支付记录");
      const audit = parsePaymentAudit(usdtPayment.callbackRaw);
      const quote = audit.quote as any;
      if (
        !quote ||
        toMicroUsdt(input.receivedAmount) !== toMicroUsdt(quote.amount) ||
        input.observedNetwork !== quote.network ||
        !quote.expiresAt ||
        new Date(quote.expiresAt).getTime() <
          new Date(usdtPayment.submittedAt ?? new Date()).getTime()
      ) {
        throw new Error("金额、网络或报价时效不匹配，请使用完整 USDT 对账流程标记异常");
      }
      await assertCommerceTotp(
        ctx.user.id,
        input.totpCode,
        "CONFIRM_COMMERCE_USDT",
        requestIp(ctx.req),
      );
      const receivedAmount = input.receivedAmount;
      const observedNetwork = input.observedNetwork;
      await db.reconcileCommerceUsdtAtomically({
        paymentId: usdtPayment.id,
        orderId: order.id,
        orderNo: order.orderNo,
        actorUserId: ctx.user.id,
        network: input.observedNetwork,
        normalizedHash: input.gatewayOrderNo,
        expectedPaymentStatus: usdtPayment.status,
        paymentUpdate: {
          status: "success",
          gatewayOrderNo: input.gatewayOrderNo,
          callbackRaw: JSON.stringify({
            ...audit,
            type: "admin_confirm",
            adminId: ctx.user.id,
            txHash: input.gatewayOrderNo,
            note: input.note || null,
            confirmedAt: new Date().toISOString(),
          }),
          callbackVerified: true,
          receivedAmount,
          confirmations: input.confirmations,
          observedNetwork,
          usdtReviewStatus: "MATCHED",
          verificationMode: "MANUAL",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          reviewNote:
            input.note ?? "管理员已在外部区块浏览器/钱包人工核对。",
          paidAt: new Date(),
        },
        eventType: "MANUAL_PAYMENT_CONFIRMED",
        eventPayload: JSON.stringify({
          txHash: input.gatewayOrderNo,
          receivedAmount,
          confirmations: input.confirmations,
          observedNetwork,
        }),
        markOrderPaid: true,
      });
      return { ok: true };
    }),

  adminPendingUsdt: adminProcedure.query(async () => {
    return db.listUsdtPayments({ reviewStatus: "PENDING_REVIEW" });
  }),

  adminUsdtQueue: adminProcedure
    .input(
      z
        .object({
          reviewStatus: usdtReviewStatusSchema.optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(({ input }) =>
      db.listUsdtPayments({
        reviewStatus: input?.reviewStatus,
        limit: input?.limit ?? 100,
      }),
    ),

  adminReconcileUsdt: adminProcedure
    .input(
      z.object({
        orderNo: z.string(),
        gatewayOrderNo: txHashSchema,
        receivedAmount: usdtAmountSchema,
        confirmations: z.number().int().min(1),
        observedNetwork: z.enum(["TRC20", "ERC20"]),
        note: z.string().trim().max(1000).optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const payment = allPayments.find(
        (item: any) =>
          item.gateway === "usdt-manual" && item.method === "usdt",
      );
      if (!payment) throw new Error("未找到 USDT 商户收款意图");
      if (!payment.gatewayOrderNo) throw new Error("用户尚未提交 Tx Hash");
      if (payment.gatewayOrderNo !== input.gatewayOrderNo) {
        throw new Error("对账 Tx Hash 与用户提交记录不一致");
      }
      if (
        payment.status === "success" &&
        payment.usdtReviewStatus === "MATCHED" &&
        order.status === "paid" &&
        order.paymentGateway === "usdt-manual"
      ) {
        return { ok: true, reviewStatus: "MATCHED" as const, orderMarkedPaid: true };
      }
      const duplicate = await db.getPaymentByGatewayOrderNo(
        input.gatewayOrderNo,
      );
      const quotedAmount = toMicroUsdt(payment.quotedAmount ?? payment.amount);
      const receivedAmount = toMicroUsdt(input.receivedAmount);
      const quoteExpired =
        payment.quoteExpiresAt &&
        new Date(payment.submittedAt ?? new Date()).getTime() >
          new Date(payment.quoteExpiresAt).getTime();
      const result =
        duplicate && duplicate.id !== payment.id
          ? "DUPLICATE_TX"
          : input.observedNetwork !== payment.settlementNetwork
            ? "WRONG_NETWORK"
            : receivedAmount < quotedAmount
              ? "UNDERPAID"
              : receivedAmount > quotedAmount
                ? "OVERPAID"
                : quoteExpired
                  ? "QUOTE_EXPIRED_RECEIPT"
                  : order.status !== "pending" || isOrderExpired(order.expiresAt)
                    ? "REFUND_PENDING"
                    : "MATCHED";
      const matched = result === "MATCHED";
      await assertCommerceTotp(
        ctx.user.id,
        input.totpCode,
        "RECONCILE_COMMERCE_USDT",
        requestIp(ctx.req),
      );
      await db.reconcileCommerceUsdtAtomically({
        paymentId: payment.id,
        orderId: order.id,
        orderNo: order.orderNo,
        actorUserId: ctx.user.id,
        network: input.observedNetwork,
        normalizedHash: input.gatewayOrderNo,
        expectedPaymentStatus: payment.status,
        paymentUpdate: {
          status: matched ? "success" : payment.status,
          receivedAmount: input.receivedAmount,
          confirmations: input.confirmations,
          observedNetwork: input.observedNetwork,
          usdtReviewStatus: result,
          verificationMode: "MANUAL",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          reviewNote: input.note ?? null,
          callbackVerified: matched,
          paidAt: matched ? new Date() : payment.paidAt,
        },
        eventType: "USDT_RECONCILED",
        eventPayload: JSON.stringify({
          result,
          receivedAmount: input.receivedAmount,
          confirmations: input.confirmations,
          observedNetwork: input.observedNetwork,
        }),
        markOrderPaid: matched,
      });
      return { ok: true, reviewStatus: result, orderMarkedPaid: matched };
    }),

  adminSetUsdtReviewStatus: adminProcedure
    .input(
      z.object({
        orderNo: z.string(),
        reviewStatus: z.enum([
          "UNDERPAID",
          "OVERPAID",
          "WRONG_NETWORK",
          "QUOTE_EXPIRED_RECEIPT",
          "DUPLICATE_TX",
          "REFUND_PENDING",
          "REJECTED",
        ]),
        note: z.string().trim().min(3).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const payment = allPayments.find(
        (item: any) => item.gateway === "usdt-manual",
      );
      if (!payment) throw new Error("未找到 USDT 商户收款意图");
      await db.updatePayment(payment.id, {
        usdtReviewStatus: input.reviewStatus,
        verificationMode: "MANUAL",
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
        reviewNote: input.note,
        status: payment.status,
      });
      await db.createCommerceUsdtEvent({
        paymentId: payment.id,
        orderId: order.id,
        actorUserId: ctx.user.id,
        eventType: "USDT_REVIEW_STATUS_UPDATED",
        payload: JSON.stringify({ reviewStatus: input.reviewStatus }),
      });
      return { ok: true, reviewStatus: input.reviewStatus };
    }),

  adminVerifyUsdtRefundAddress: adminProcedure
    .input(
      z.object({
        orderNo: z.string(),
        refundRecipientAddress: z.string().trim().min(8).max(255),
        recipientVerificationReference: z.string().trim().min(6).max(240),
        note: z.string().trim().max(1000).optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const payment = allPayments.find(
        (item: any) => item.gateway === "usdt-manual" && item.method === "usdt",
      );
      if (
        !payment?.receivedAmount ||
        !payment.observedNetwork ||
        !payment.payerWalletAddress
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "只有已登记实收金额和原付款钱包的 USDT 支付才能核验退款地址。",
        });
      }
      if (input.refundRecipientAddress !== payment.payerWalletAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "退款地址必须与客户提交并声明归属的原付款钱包一致。",
        });
      }
      if (
        !validateCommerceAddress(
          input.refundRecipientAddress,
          payment.observedNetwork,
        )
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `退款地址不符合 ${payment.observedNetwork} 格式。`,
        });
      }
      await assertCommerceTotp(
        ctx.user.id,
        input.totpCode,
        "VERIFY_COMMERCE_USDT_REFUND_ADDRESS",
        requestIp(ctx.req),
      );
      const verificationHash = crypto
        .createHash("sha256")
        .update(input.recipientVerificationReference)
        .digest("hex");
      await db.updatePayment(payment.id, {
        usdtReviewStatus: "REFUND_PENDING",
        refundRecipientAddress: input.refundRecipientAddress,
        refundVerificationRef: verificationHash,
        refundRecipientVerifiedBy: ctx.user.id,
        refundRecipientVerifiedAt: new Date(),
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
        reviewNote: input.note ?? "已核验退款地址等于原付款钱包。",
      });
      await db.createCommerceUsdtEvent({
        paymentId: payment.id,
        orderId: order.id,
        actorUserId: ctx.user.id,
        eventType: "USDT_REFUND_ADDRESS_VERIFIED",
        payload: JSON.stringify({
          refundRecipientAddress: input.refundRecipientAddress,
          verificationReferenceHash: verificationHash,
        }),
      });
      return { ok: true, reviewStatus: "REFUND_PENDING" as const };
    }),

  adminRecordUsdtRefund: adminProcedure
    .input(
      z.object({
        orderNo: z.string(),
        refundAmount: usdtAmountSchema,
        refundNetwork: z.enum(["TRC20", "ERC20"]),
        refundTxHash: txHashSchema,
        note: z.string().trim().max(1000).optional(),
        totpCode: totpCodeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const payment = allPayments.find(
        (item: any) => item.gateway === "usdt-manual" && item.method === "usdt",
      );
      if (!payment?.receivedAmount || !payment.observedNetwork) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "只有已登记链上实收金额的 USDT 支付才能退款。",
        });
      }
      if (
        !payment.refundRecipientAddress ||
        !payment.refundRecipientVerifiedAt ||
        payment.refundRecipientAddress !== payment.payerWalletAddress
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "退款地址尚未通过独立 TOTP 步骤核验为原付款钱包。",
        });
      }
      if (payment.refundTxHash) {
        throw new TRPCError({ code: "CONFLICT", message: "该支付已登记退款交易。" });
      }
      if (toMicroUsdt(input.refundAmount) > toMicroUsdt(payment.receivedAmount)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "退款金额不得超过链上实际到账金额。",
        });
      }
      if (input.refundNetwork !== payment.observedNetwork) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "退款网络必须与已核验的原收款网络一致。",
        });
      }
      await assertCommerceTotp(
        ctx.user.id,
        input.totpCode,
        "RECORD_COMMERCE_USDT_REFUND",
        requestIp(ctx.req),
      );
      const fullRefund =
        toMicroUsdt(input.refundAmount) === toMicroUsdt(payment.receivedAmount);
      await db.recordCommerceUsdtRefundAtomically({
        paymentId: payment.id,
        orderId: order.id,
        orderNo: order.orderNo,
        actorUserId: ctx.user.id,
        network: input.refundNetwork,
        normalizedHash: input.refundTxHash,
        expectedPaymentStatus: payment.status,
        paymentUpdate: {
          status: fullRefund ? "refunded" : payment.status,
          usdtReviewStatus: "REFUNDED",
          refundAmount: input.refundAmount,
          refundNetwork: input.refundNetwork,
          refundTxHash: input.refundTxHash,
          refundedBy: ctx.user.id,
          refundedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          reviewNote: input.note ?? "管理员已在外部企业钱包登记退款交易。",
        },
        eventPayload: JSON.stringify({
          refundAmount: input.refundAmount,
          refundNetwork: input.refundNetwork,
          refundTxHash: input.refundTxHash,
          fullRefund,
        }),
        markOrderRefunded:
          fullRefund &&
          order.status === "paid" &&
          order.paymentGateway === "usdt-manual",
      });
      return {
        ok: true,
        reviewStatus: "REFUNDED" as const,
        orderMarkedRefunded:
          fullRefund && order.paymentGateway === "usdt-manual",
      };
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
      const usdtAuditFields = settlementQuote
        ? {
            settlementNetwork: settlementQuote.network,
            settlementToken: "USDT",
            recipientAddress: settlementQuote.recipientAddress,
            quotedAmount: settlementQuote.amount,
            quoteExpiresAt: new Date(settlementQuote.expiresAt),
            usdtReviewStatus: "AWAITING_TX" as const,
            verificationMode: "MANUAL" as const,
          }
        : {};
      const reusesExisting = Boolean(
        existing &&
          existing.status === "pending" &&
          existing.gateway === gateway.name &&
          existing.method === input.method,
      );
      if (reusesExisting) {
        await db.updatePayment(existing.id, {
          gatewayOrderNo: result.gatewayOrderNo || null,
          amount: paymentAmount,
          currency: paymentCurrency,
          callbackRaw: intentAudit,
          errorMessage: null,
          ...usdtAuditFields,
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
          ...usdtAuditFields,
        });
      }
      if (settlementQuote) {
        const payment = reusesExisting && existing?.id
          ? await db.getPaymentById(existing.id)
          : await db.getActivePaymentByOrderId(order.id);
        if (payment) {
          await db.createCommerceUsdtEvent({
            paymentId: payment.id,
            orderId: order.id,
            actorUserId: ctx.user.id,
            eventType: "USDT_QUOTE_CREATED",
            payload: JSON.stringify({
              network: settlementQuote.network,
              token: "USDT",
              amount: settlementQuote.amount,
              recipientAddress: settlementQuote.recipientAddress,
              expiresAt: settlementQuote.expiresAt,
              verificationMode: "MANUAL",
            }),
          });
        }
      }
      return result;
    }),

  markUsdtSubmitted: protectedProcedure
    .input(
      z.object({
        orderNo: z.string(),
        txHashOrNote: txHashSchema,
        payerWalletAddress: z.string().trim().min(8).max(255),
        payerOwnershipAttested: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await db.getOrderByOrderNo(input.orderNo);
      if (!order) throw new Error("订单不存在");
      if (order.userId !== ctx.user.id) throw new Error("无权操作");
      if (!["pending", "expired"].includes(order.status)) {
        throw new Error("订单已取消、退款或已由其他通道完成");
      }
      const allPayments = await db.getPaymentsByOrderId(order.id);
      const usdtPayment = allPayments.find((payment: any) => payment.gateway === "usdt-manual" && payment.status === "pending");
      if (!usdtPayment) throw new Error("未找到待提交的 USDT 支付记录");
      const duplicate = await db.getPaymentByGatewayOrderNo(input.txHashOrNote);
      if (duplicate && duplicate.id !== usdtPayment.id) throw new Error("该 Tx Hash 已提交，请核对后重试");
      const audit = parsePaymentAudit(usdtPayment.callbackRaw);
      const quote = audit.quote as any;
      const submittedAt = new Date();
      const late =
        quote?.expiresAt &&
        submittedAt.getTime() > new Date(quote.expiresAt).getTime();
      const network = usdtPayment.settlementNetwork ?? quote?.network;
      if (!network) throw new Error("该 USDT 报价缺少唯一结算网络");
      if (
        !["TRC20", "ERC20"].includes(network) ||
        !validateCommerceAddress(
          input.payerWalletAddress,
          network as "TRC20" | "ERC20",
        )
      ) {
        throw new Error(`付款钱包地址不符合 ${network} 格式`);
      }
      await db.reconcileCommerceUsdtAtomically({
        paymentId: usdtPayment.id,
        orderId: order.id,
        orderNo: order.orderNo,
        actorUserId: ctx.user.id,
        network,
        normalizedHash: input.txHashOrNote,
        expectedPaymentStatus: usdtPayment.status,
        paymentUpdate: {
          gatewayOrderNo: input.txHashOrNote,
          callbackRaw: JSON.stringify({
            ...audit,
            type: "user_submitted",
            submittedAt: new Date().toISOString(),
            txHash: input.txHashOrNote,
          }),
          submittedAt,
          payerWalletAddress: input.payerWalletAddress,
          payerOwnershipAttestedAt: new Date(),
          usdtReviewStatus: late
            ? "QUOTE_EXPIRED_RECEIPT"
            : "PENDING_REVIEW",
          verificationMode: "MANUAL",
        },
        eventType: "USDT_TX_SUBMITTED",
        eventPayload: JSON.stringify({
          txHash: input.txHashOrNote,
          submittedAt: submittedAt.toISOString(),
          late,
        }),
        markOrderPaid: false,
      });
      return { ok: true, message: "Tx Hash 已提交，等待链上对账确认。" };
    }),
});
