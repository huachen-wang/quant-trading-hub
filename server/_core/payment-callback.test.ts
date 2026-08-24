import { describe, expect, it } from "vitest";
import { findZpayPaymentAttempt } from "./payment-callback";

describe("ZPay callback payment selection", () => {
  it("does not overwrite a newer USDT attempt", () => {
    const attempts = [
      { id: 2, gateway: "usdt-manual", method: "usdt" },
      { id: 1, gateway: "zpay", method: "alipay" },
    ];

    expect(findZpayPaymentAttempt(attempts, "alipay")).toMatchObject({ id: 1 });
  });

  it("does not select a different ZPay payment method", () => {
    const attempts = [{ id: 1, gateway: "zpay", method: "wxpay" }];
    expect(findZpayPaymentAttempt(attempts, "alipay")).toBeUndefined();
  });
});
