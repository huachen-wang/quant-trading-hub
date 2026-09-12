import { describe, expect, it } from "vitest";
import {
  hasUnevidencedClaim,
  resolveMetricDisplay,
  resolveVerifyStatus,
  safeExternalUrl,
  stripUnevidencedClaims,
} from "../lib/strategy-claims";
import { JINGE_TIE_MA_TITLE } from "../server/strategy-catalog";

describe("unevidenced claims in product copy", () => {
  it("strips the absolute claim but keeps the version", () => {
    expect(stripUnevidencedClaims("金戈铁马 V5.1 永不爆仓版本")).toBe("金戈铁马 V5.1");
    expect(stripUnevidencedClaims("金戈铁马 正版云控 全网收益第一")).toBe("金戈铁马 正版云控");
    expect(stripUnevidencedClaims("Gold Reaper 稳赚不赔 V2.3")).toBe("Gold Reaper V2.3");
  });

  it("leaves ordinary product names untouched", () => {
    for (const title of [
      "V4 Grid Bot EA v1.0",
      "QEA XAUUSD v3.0",
      "Waka Waka EA MT5",
      "黄金屋 Gold House V1.8",
    ]) {
      expect(stripUnevidencedClaims(title)).toBe(title);
      expect(hasUnevidencedClaim(title)).toBe(false);
    }
  });

  it("detects the claim wherever it appears", () => {
    expect(hasUnevidencedClaim("金戈铁马 V5.1 永不爆仓版本")).toBe(true);
    expect(hasUnevidencedClaim("零回撤 网格")).toBe(true);
    expect(hasUnevidencedClaim("100% 胜率")).toBe(true);
    expect(hasUnevidencedClaim("")).toBe(false);
    expect(hasUnevidencedClaim(null)).toBe(false);
  });

  it("the catalog no longer writes an absolute claim into the featured title", () => {
    expect(hasUnevidencedClaim(JINGE_TIE_MA_TITLE)).toBe(false);
    expect(JINGE_TIE_MA_TITLE).toContain("金戈铁马");
    expect(JINGE_TIE_MA_TITLE).toContain("V5.1");
    expect(JINGE_TIE_MA_TITLE).not.toContain("永不爆仓");
  });
});

describe("metric rendering by verification status", () => {
  it("refuses to print a 100% win rate that we have not verified", () => {
    const r = resolveMetricDisplay("100.00", "winRate", "referenced");
    expect(r.display).toBe("—");
    expect(r.suppressed).toBe(true);
    expect(r.display).not.toContain("100");
  });

  it("refuses to print a zero drawdown that we have not verified", () => {
    expect(resolveMetricDisplay("0.00", "maxDrawdown", "referenced").display).toBe("—");
    expect(resolveMetricDisplay("0", "maxDrawdown", null).display).toBe("—");
  });

  it("still shows ordinary reference figures, marked as reference", () => {
    const r = resolveMetricDisplay("72.60", "winRate", "referenced");
    expect(r.display).toBe("72.60%");
    expect(r.isReference).toBe(true);
    expect(r.suppressed).toBe(false);
  });

  it("prints verified data as-is without a reference marker", () => {
    const r = resolveMetricDisplay("100.00", "winRate", "verified");
    expect(r.display).toBe("100.00%");
    expect(r.isReference).toBe(false);
    const dd = resolveMetricDisplay("0.00", "maxDrawdown", "verified");
    expect(dd.display).toBe("0.00%");
    expect(dd.suppressed).toBe(false);
  });

  it("shows unknown as unknown, never as a fabricated zero", () => {
    for (const value of [null, undefined, "", "   ", "n/a"]) {
      const r = resolveMetricDisplay(value, "totalReturn", "referenced");
      expect(r.display).toBe("—");
      expect(r.display).not.toBe("0%");
      expect(r.display).not.toBe("0.00%");
    }
  });

  it("keeps negative returns visible rather than hiding a loss", () => {
    expect(resolveMetricDisplay("-18.40", "totalReturn", "referenced").display).toBe("-18.40%");
  });
});

describe("verify status mapping", () => {
  it("maps every stored dataStatus to a customer-facing label", () => {
    expect(resolveVerifyStatus("verified")).toMatchObject({ key: "verified", tone: "success" });
    expect(resolveVerifyStatus("referenced")).toMatchObject({ key: "referenced", tone: "primary" });
    expect(resolveVerifyStatus("estimated")).toMatchObject({ key: "unverified", tone: "warning" });
    expect(resolveVerifyStatus(null)).toMatchObject({ key: "unverified", tone: "warning" });
    expect(resolveVerifyStatus(undefined).short).toBe("待核验");
  });

  it("never labels unverified data as verified", () => {
    for (const status of ["referenced", "estimated", null, undefined] as const) {
      expect(resolveVerifyStatus(status).key).not.toBe("verified");
      expect(resolveVerifyStatus(status).short).not.toBe("已核验");
    }
  });
});

describe("source link safety", () => {
  it("allows http and https source pages", () => {
    expect(safeExternalUrl("https://www.eahub.cn/thread-201119-1-1.html")).toBe(
      "https://www.eahub.cn/thread-201119-1-1.html",
    );
    expect(safeExternalUrl("http://www.eahub.cn/thread-201119-1-1.html")).toBe(
      "http://www.eahub.cn/thread-201119-1-1.html",
    );
  });

  it("blocks everything that is not an http(s) navigation", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "  ",
      "",
      null,
      undefined,
      "www.eahub.cn/thread-201119-1-1.html",
    ]) {
      expect(safeExternalUrl(bad)).toBeUndefined();
    }
  });
});
