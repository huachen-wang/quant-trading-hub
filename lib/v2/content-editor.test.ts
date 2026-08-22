import { describe, expect, it } from "vitest";
import { DEMO_STRATEGIES } from "../../server/v2/demo-data";
import { contentBlockSchema } from "../../shared/v2/contracts";
import { blockToEditorForm, editorFormToBlock } from "./content-editor";

describe("V2 content block editor", () => {
  it("round-trips every supported content block type", () => {
    for (const block of DEMO_STRATEGIES[0].contentBlocks) {
      const restored = editorFormToBlock(blockToEditorForm(block));
      expect(() => contentBlockSchema.parse(restored)).not.toThrow();
      expect(restored).toEqual(block);
    }
  });

  it("falls back to PENDING for an unknown evidence status", () => {
    const block = editorFormToBlock({
      id: "evidence-test",
      type: "evidence",
      heading: "证据",
      body: "",
      items: "样本 | 等待上传 | UNKNOWN",
    });
    expect(block.type).toBe("evidence");
    if (block.type === "evidence") {
      expect(block.items[0].status).toBe("PENDING");
    }
  });
});
