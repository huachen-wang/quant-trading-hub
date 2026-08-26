import { describe, expect, it } from "vitest";
import { DEMO_STRATEGIES } from "../../server/v2/demo-data";
import { localizeStrategy } from "./localized-content";

describe("localized V2 content", () => {
  it("localizes the complete fallback strategy profile", () => {
    const strategy = localizeStrategy(DEMO_STRATEGIES[0], "ar");
    const headings = strategy.contentBlocks.map((block) => block.heading);

    expect(strategy.name).toBe("Iron Cavalry V5.1");
    expect(headings).toContain("منطق الاستراتيجية");
    expect(headings).toContain("المنهجية والأدلة");
    expect(headings).toContain("مواد الاستراتيجية");
    expect(headings).toContain("حدود المخاطر");
    expect(headings).toContain("الأسئلة الشائعة");
  });

  it("keeps administrator-authored copy instead of overwriting it", () => {
    const custom = structuredClone(DEMO_STRATEGIES[0]);
    const overview = custom.contentBlocks.find(
      (block) => block.type === "rich_text",
    );
    if (overview?.type === "rich_text") {
      overview.paragraphs = ["运营自定义内容"];
    }

    const localized = localizeStrategy(custom, "en");
    const localizedOverview = localized.contentBlocks.find(
      (block) => block.type === "rich_text",
    );

    expect(
      localizedOverview?.type === "rich_text"
        ? localizedOverview.paragraphs
        : [],
    ).toEqual(["运营自定义内容"]);
  });
});
