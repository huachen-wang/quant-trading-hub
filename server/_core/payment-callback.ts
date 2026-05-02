/**
 * Payment Callback Routes
 *
 * 处理支付网关的异步通知（webhook）。
 * 因为 ZPay 用的是传统表单 POST，不走 tRPC，所以单独挂在 Express 上。
 *
 * 挂载路由：
 *   POST /api/payment/zpay/notify    异步通知（验签 + 更新订单）
 *   GET  /api/payment/zpay/notify    （某些网关也会用 GET，做容错）
 *   GET  /api/payment/zpay/return    同步跳转（暂时只重定向，业务在前端 success 页处理）
 *
 * 集成方法：
 *   在 server/_core/index.ts 里 import 这个文件并调用 registerPaymentRoutes(app)。
 */

import type { Express, Request, Response } from "express";
import express from "express";
import { zpayGateway } from "./payments/zpay";
import {
  getOrderByOrderNo,
  markOrderPaid,
  createPayment,
  updatePayment,
  getActivePaymentByOrderId,
} from "../db";

export function registerPaymentRoutes(app: Express): void {
  // ZPay 用 form-encoded POST，需要先确保 body parser 启用
  // （如果项目主入口已经 app.use(express.urlencoded({ extended: true }))，
  //  这里不需要重复调用；如果没有，下面这行会兜底）
  const formParser = express.urlencoded({ extended: true });

  // ─── 异步通知 (POST + GET 兼容) ───
  const notifyHandler = async (req: Request, res: Response) => {
    try {
      // ZPay 的回调可能在 body 也可能在 query
      const payload = { ...(req.query || {}), ...(req.body || {}) } as Record<string, any>;
      const outTradeNo = String(payload.out_trade_no || "");

      console.log(`[zpay/notify] payload received: orderNo=${outTradeNo}`);

      if (!outTradeNo) {
        return res.status(400).send("missing out_trade_no");
      }

      // 1. 查订单
      const order = await getOrderByOrderNo(outTradeNo);
      if (!order) {
        console.warn(`[zpay/notify] order not found: ${outTradeNo}`);
        return res.status(404).send("order not found");
      }

      // 2. 幂等：已支付订单直接返回 success
      if (order.status === "paid") {
        console.log(`[zpay/notify] order ${outTradeNo} already paid, returning success`);
        return res.send(zpayGateway.successResponseText());
      }

      // 3. 验签 + 业务校验
      const verifyResult = await zpayGateway.verifyCallback({
        payload,
        expectedOrderNo: outTradeNo,
      });

      if (!verifyResult.valid) {
        console.error(
          `[zpay/notify] verify failed for ${outTradeNo}: ${verifyResult.errorMessage}`,
        );
        return res.status(400).send("verify failed");
      }

      // 4. 验证金额
      if (
        typeof verifyResult.amount === "number" &&
        Math.abs(verifyResult.amount - parseFloat(String(order.amount))) > 0.01
      ) {
        console.error(
          `[zpay/notify] amount mismatch: expected ${order.amount}, got ${verifyResult.amount}`,
        );
        return res.status(400).send("amount mismatch");
      }

      if (!verifyResult.shouldMarkPaid) {
        // trade_status 不是 TRADE_SUCCESS（可能是 TRADE_CLOSED 等）
        console.log(`[zpay/notify] not should-mark-paid for ${outTradeNo}`);
        return res.send(zpayGateway.successResponseText());
      }

      // 5. 更新或创建 payment 记录
      const existingPayment = await getActivePaymentByOrderId(order.id);
      if (existingPayment) {
        await updatePayment(existingPayment.id, {
          status: "success",
          gatewayOrderNo: verifyResult.gatewayOrderNo || null,
          callbackRaw: JSON.stringify(payload),
          callbackVerified: true,
          paidAt: new Date(),
        });
      } else {
        await createPayment({
          orderId: order.id,
          orderNo: order.orderNo,
          gateway: zpayGateway.name,
          gatewayOrderNo: verifyResult.gatewayOrderNo || null,
          method: verifyResult.paymentMethod || "unknown",
          amount: order.amount,
          currency: order.currency,
          status: "success",
          callbackRaw: JSON.stringify(payload),
          callbackVerified: true,
          paidAt: new Date(),
        });
      }

      // 6. 更新订单状态
      await markOrderPaid(order.id, {
        paymentMethod: verifyResult.paymentMethod || null,
        paymentGateway: zpayGateway.name,
      });

      console.log(`[zpay/notify] ✓ order ${outTradeNo} marked as paid`);

      // 7. 给 ZPay 返回 "success"
      return res.send(zpayGateway.successResponseText());
    } catch (err: any) {
      console.error("[zpay/notify] handler error:", err);
      return res.status(500).send("error: " + (err?.message || "unknown"));
    }
  };

  app.post("/api/payment/zpay/notify", formParser, notifyHandler);
  app.get("/api/payment/zpay/notify", notifyHandler);

  // ─── 同步跳转 ───
  // ZPay 让用户付完后 GET 这个 URL，应该重定向到前端的 success 页
  app.get("/api/payment/zpay/return", (req: Request, res: Response) => {
    const outTradeNo = String(req.query.out_trade_no || "");
    const successUrl = outTradeNo
      ? `/checkout/success?orderNo=${encodeURIComponent(outTradeNo)}`
      : "/checkout/success";
    res.redirect(successUrl);
  });

  console.log("[payment] routes registered: /api/payment/zpay/notify, /api/payment/zpay/return");
}
