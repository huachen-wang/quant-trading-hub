import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navigationFiles = [
  "app/(tabs)/favorites.tsx",
  "app/auth/login.tsx",
  "app/auth/register.tsx",
  "app/checkout/[orderNo].tsx",
  "app/checkout/success.tsx",
  "components/floating-side-nav.tsx",
  "components/pc-footer.tsx",
  "components/pc-top-nav.tsx",
];

describe("public navigation URLs", () => {
  it.each(navigationFiles)("does not expose an Expo route group in %s", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/["'`]\/\(tabs\)(?:\/|["'`])/);
  });
});
