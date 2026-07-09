import { describe, expect, it } from "vitest";
import { getInternalStrategyRoute, shouldUseContactForDownload } from "../lib/download-links";

describe("download link routing", () => {
  it("routes missing and broker registration links to contact", () => {
    expect(shouldUseContactForDownload(null)).toBe(true);
    expect(shouldUseContactForDownload("  ")).toBe(true);
    expect(shouldUseContactForDownload("https://kaibb.co/register/trader?link_id=a&referrer_id=b")).toBe(true);
    expect(shouldUseContactForDownload("https://sub.kaibb.co/resource")).toBe(true);
    expect(shouldUseContactForDownload("https://www.bluesyd-au.com/register/trader?link_id=a&referrer_id=b")).toBe(true);
  });

  it("keeps real resource links downloadable", () => {
    expect(shouldUseContactForDownload("https://example.com/files/ea.zip")).toBe(false);
    expect(shouldUseContactForDownload("https://www.mql5.com/en/market/product/103540")).toBe(false);
  });

  it("recognizes the legacy internal strategy link", () => {
    expect(getInternalStrategyRoute("strategy/30")).toBe("/strategy/30");
    expect(getInternalStrategyRoute("/strategy/30")).toBe("/strategy/30");
    expect(getInternalStrategyRoute("https://kaibb.co/strategy/30")).toBeNull();
  });
});
