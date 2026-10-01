import { describe, expect, it } from "vitest";
import { toPublicStrategy } from "./strategy-public";

describe("public strategy projection", () => {
  it("never returns the private EA source URL", () => {
    const projected = toPublicStrategy({
      id: 7,
      title: "EA",
      downloadUrl: "https://private.example/source.ex5",
    });

    expect(projected).not.toHaveProperty("downloadUrl");
    expect(projected.downloadAvailable).toBe(true);
  });

  it.each([
    ["https://kaibb.co/register/trader?link_id=a&referrer_id=b"],
    ["https://www.bluesyd-au.com/register/trader?link_id=a&referrer_id=b"],
    ["https://sub.kaibb.co/resource"],
  ])("does not advertise %s as a downloadable file", (downloadUrl) => {
    const projected = toPublicStrategy({ id: 7, title: "EA", downloadUrl });

    expect(projected).not.toHaveProperty("downloadUrl");
    // 开户推荐链接不是交付文件：详情页必须落到"联系确认交付"，
    // 而不是"付款后解锁"。
    expect(projected.downloadAvailable).toBe(false);
  });

  it("treats a missing or blank asset URL as no download", () => {
    expect(toPublicStrategy({ id: 7, title: "EA" }).downloadAvailable).toBe(false);
    expect(
      toPublicStrategy({ id: 7, title: "EA", downloadUrl: "   " }).downloadAvailable,
    ).toBe(false);
  });
});
