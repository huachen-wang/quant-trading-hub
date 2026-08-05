import { describe, expect, it } from "vitest";
import { resolveStrategyEvidence } from "./strategy-evidence";

describe("strategy evidence resolver", () => {
  it("keeps missing evidence explicit without inventing a link", () => {
    const evidence = resolveStrategyEvidence({
      platform: "MT5",
      pairs: "XAUUSD",
      timeframe: "M15",
    });

    expect(evidence.label).toBe("资料待补");
    expect(evidence.items[0].status).toBe("待补充");
    expect(evidence.items[1].url).toBeUndefined();
    expect(evidence.items[2].status).toBe("基础档案");
  });

  it("labels linked material as reference until explicitly verified", () => {
    const referenced = resolveStrategyEvidence({
      dataStatus: "referenced",
      sourceName: "公开策略目录",
      sourceUrl: "https://example.com/source",
      evidenceUrl: "https://example.com/evidence",
    });
    const verified = resolveStrategyEvidence({
      dataStatus: "verified",
      evidenceUrl: "https://example.com/evidence",
    });

    expect(referenced.label).toBe("参考资料");
    expect(referenced.items[1].status).toBe("外部参考");
    expect(verified.label).toBe("已核验资料");
    expect(verified.items[1].status).toBe("已核验");
  });

  it("ignores non-HTTPS evidence values", () => {
    const evidence = resolveStrategyEvidence({
      sourceUrl: "javascript:alert(1)",
      evidenceUrl: "http://example.com/evidence",
    });

    expect(evidence.items.every((item) => item.url === undefined)).toBe(true);
  });
});
