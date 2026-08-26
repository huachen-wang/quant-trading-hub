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
});
