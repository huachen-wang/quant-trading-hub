import { describe, expect, it } from "vitest";
import { languageLocale, normalizeLanguage } from "./language-core";

describe("language helpers", () => {
  it("defaults unknown and empty values to Chinese", () => {
    expect(normalizeLanguage(undefined)).toBe("zh");
    expect(normalizeLanguage(null)).toBe("zh");
    expect(normalizeLanguage("fr")).toBe("zh");
    expect(normalizeLanguage("zh")).toBe("zh");
  });

  it("recognizes English and Arabic and maps languages to stable locales", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("ar")).toBe("ar");
    expect(languageLocale("zh")).toBe("zh-CN");
    expect(languageLocale("en")).toBe("en-US");
    expect(languageLocale("ar")).toBe("ar-AE");
  });
});
