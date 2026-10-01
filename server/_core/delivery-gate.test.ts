import { describe, expect, it } from "vitest";
import {
  assessFreeClaim,
  assessStrategyPurchase,
  classifyStrategyDelivery,
  describeOrderDelivery,
  FREE_CLAIM_MESSAGES,
  isFreeStrategyClaimable,
  PURCHASE_GATE_MESSAGES,
} from "./delivery-gate";

const BROKER_LINK = "https://kaibb.co/register/trader?link_id=a&referrer_id=b";
const FILE_URL = "https://files.example.com/ea/gold-trend.ex5";

const paidProduct = {
  status: "published",
  saleMode: "direct",
  isFree: false,
  downloadUrl: FILE_URL,
};

const freeProduct = { ...paidProduct, isFree: true };

describe("classifyStrategyDelivery", () => {
  it("treats a real file URL as deliverable", () => {
    expect(classifyStrategyDelivery({ downloadUrl: FILE_URL })).toEqual({
      mode: "file",
      downloadUrl: FILE_URL,
    });
    expect(classifyStrategyDelivery({ downloadUrl: `  ${FILE_URL}  ` })).toEqual({
      mode: "file",
      downloadUrl: FILE_URL,
    });
  });

  it.each([null, undefined, "", "   "])("treats downloadUrl %j as no_file", (downloadUrl) => {
    expect(classifyStrategyDelivery({ downloadUrl })).toEqual({
      mode: "contact",
      reason: "no_file",
    });
  });

  it("treats a missing strategy row as no_file", () => {
    expect(classifyStrategyDelivery(null)).toEqual({ mode: "contact", reason: "no_file" });
    expect(classifyStrategyDelivery(undefined)).toEqual({ mode: "contact", reason: "no_file" });
  });

  it.each([
    BROKER_LINK,
    "https://sub.kaibb.co/resource",
    "https://www.bluesyd-au.com/register/trader?link_id=a&referrer_id=b",
  ])("never treats broker registration link %s as a file", (downloadUrl) => {
    expect(classifyStrategyDelivery({ downloadUrl })).toEqual({
      mode: "contact",
      reason: "broker_link",
    });
  });
});

describe("assessStrategyPurchase (orders.create server-side gate)", () => {
  it("allows a published, direct, paid product with a real file", () => {
    expect(assessStrategyPurchase(paidProduct)).toEqual({ ok: true, downloadUrl: FILE_URL });
  });

  it.each([
    [null, "unpublished", "NOT_FOUND"],
    [{ ...paidProduct, status: "draft" }, "unpublished", "NOT_FOUND"],
    [{ ...paidProduct, status: "archived" }, "unpublished", "NOT_FOUND"],
    [{ ...paidProduct, saleMode: "inquiry" }, "inquiry_only", "PRECONDITION_FAILED"],
    [{ ...paidProduct, isFree: true }, "free", "PRECONDITION_FAILED"],
    [{ ...paidProduct, isFree: 1 }, "free", "PRECONDITION_FAILED"],
    [{ ...paidProduct, downloadUrl: null }, "no_file", "PRECONDITION_FAILED"],
    [{ ...paidProduct, downloadUrl: "   " }, "no_file", "PRECONDITION_FAILED"],
    [{ ...paidProduct, downloadUrl: BROKER_LINK }, "broker_link", "PRECONDITION_FAILED"],
  ] as const)("refuses %j with reason %s", (strategy, reason, code) => {
    const result = assessStrategyPurchase(strategy as any);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(reason);
    expect(result.code).toBe(code);
    expect(result.message).toBe(PURCHASE_GATE_MESSAGES[reason]);
  });

  it("keeps the historical check order: status, saleMode, free, then file", () => {
    // 一个同时踩了所有坑的商品要报最先的那个原因，与改动前 orders.create 一致。
    const everything = { status: "draft", saleMode: "inquiry", isFree: true, downloadUrl: BROKER_LINK };
    expect(assessStrategyPurchase(everything)).toMatchObject({ reason: "unpublished" });
    expect(assessStrategyPurchase({ ...everything, status: "published" })).toMatchObject({
      reason: "inquiry_only",
    });
    expect(
      assessStrategyPurchase({ ...everything, status: "published", saleMode: "direct" }),
    ).toMatchObject({ reason: "free" });
    expect(
      assessStrategyPurchase({
        ...everything,
        status: "published",
        saleMode: "direct",
        isFree: false,
      }),
    ).toMatchObject({ reason: "broker_link" });
  });
});

describe("assessFreeClaim (free product delivery)", () => {
  it("allows a published, direct, free product with a real file", () => {
    expect(assessFreeClaim(freeProduct)).toEqual({ ok: true, downloadUrl: FILE_URL });
    expect(isFreeStrategyClaimable(freeProduct)).toBe(true);
  });

  it.each([
    [null, "unpublished"],
    [{ ...freeProduct, status: "draft" }, "unpublished"],
    [{ ...freeProduct, status: "archived" }, "unpublished"],
    [{ ...freeProduct, saleMode: "inquiry" }, "inquiry_only"],
    [{ ...freeProduct, isFree: false }, "not_free"],
    [{ ...freeProduct, isFree: 0 }, "not_free"],
    [{ ...freeProduct, downloadUrl: null }, "no_file"],
    [{ ...freeProduct, downloadUrl: BROKER_LINK }, "broker_link"],
  ] as const)("refuses %j with reason %s", (strategy, reason) => {
    expect(assessFreeClaim(strategy as any)).toEqual({ ok: false, reason });
    expect(isFreeStrategyClaimable(strategy as any)).toBe(false);
    expect(FREE_CLAIM_MESSAGES[reason]).toBeTruthy();
  });

  it("does not let a paid product be claimed for free just because it has a file", () => {
    expect(assessFreeClaim(paidProduct)).toEqual({ ok: false, reason: "not_free" });
  });
});

describe("describeOrderDelivery (orders.detail → success page)", () => {
  const sign = () => "/api/download/secure?token=signed";

  it("does not promise a download before payment", () => {
    for (const status of ["pending", "cancelled", "expired"]) {
      expect(
        describeOrderDelivery({
          order: { status, productKind: "strategy" },
          product: paidProduct,
          signDownloadPath: sign,
          tokenTtlMinutes: 30,
        }),
      ).toEqual({ status: "awaiting_payment", orderStatus: status });
    }
  });

  it("reports refunded orders instead of showing them as paid", () => {
    expect(
      describeOrderDelivery({
        order: { status: "refunded", productKind: "strategy" },
        product: paidProduct,
        signDownloadPath: sign,
        tokenTtlMinutes: 30,
      }),
    ).toEqual({ status: "refunded" });
  });

  it("signs a download only for a paid order on a real file", () => {
    let signed = 0;
    expect(
      describeOrderDelivery({
        order: { status: "paid", productKind: "strategy" },
        product: paidProduct,
        signDownloadPath: () => {
          signed += 1;
          return sign();
        },
        tokenTtlMinutes: 30,
      }),
    ).toEqual({ status: "ready", downloadUrl: sign(), expiresInMinutes: 30 });
    expect(signed).toBe(1);
  });

  it.each([
    [{ ...paidProduct, downloadUrl: BROKER_LINK }, "broker_link"],
    [{ ...paidProduct, downloadUrl: null }, "no_file"],
  ] as const)("marks a paid order on %j as awaiting manual delivery (%s)", (product, reason) => {
    let signed = 0;
    expect(
      describeOrderDelivery({
        order: { status: "paid", productKind: "strategy" },
        product: product as any,
        signDownloadPath: () => {
          signed += 1;
          return sign();
        },
        tokenTtlMinutes: 30,
      }),
    ).toEqual({ status: "contact", reason });
    // 待人工交付的订单绝不签 token。
    expect(signed).toBe(0);
  });

  it("routes paid promo bundles to contact delivery", () => {
    expect(
      describeOrderDelivery({
        order: { status: "paid", productKind: "promo" },
        product: null,
        signDownloadPath: sign,
        tokenTtlMinutes: 30,
      }),
    ).toEqual({ status: "contact", reason: "promo" });
  });

  it("reports a deleted product instead of throwing", () => {
    expect(
      describeOrderDelivery({
        order: { status: "paid", productKind: "strategy" },
        product: null,
        signDownloadPath: sign,
        tokenTtlMinutes: 30,
      }),
    ).toEqual({ status: "unavailable", reason: "product_missing" });
  });

  it("reports a missing signing secret as unavailable, never as a download", () => {
    expect(
      describeOrderDelivery({
        order: { status: "paid", productKind: "strategy" },
        product: paidProduct,
        signDownloadPath: () => {
          throw new Error("DOWNLOAD_SIGNING_SECRET must be configured");
        },
        tokenTtlMinutes: 30,
      }),
    ).toEqual({ status: "unavailable", reason: "signing_unavailable" });
  });
});
