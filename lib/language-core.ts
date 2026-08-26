export type AppLanguage = "zh" | "en" | "ar";
export type AppLocale = "zh-CN" | "en-US" | "ar-AE";

export const LANGUAGE_OPTIONS = [
  { id: "zh", shortLabel: "中", nativeLabel: "简体中文", direction: "ltr" },
  { id: "en", shortLabel: "EN", nativeLabel: "English", direction: "ltr" },
  { id: "ar", shortLabel: "ع", nativeLabel: "العربية", direction: "rtl" },
] as const satisfies ReadonlyArray<{
  id: AppLanguage;
  shortLabel: string;
  nativeLabel: string;
  direction: "ltr" | "rtl";
}>;

export const LANGUAGE_STORAGE_KEY = "eaxau:language:v1";

export function normalizeLanguage(value: unknown): AppLanguage {
  return value === "en" || value === "ar" ? value : "zh";
}

export function languageLocale(language: AppLanguage): AppLocale {
  if (language === "en") return "en-US";
  if (language === "ar") return "ar-AE";
  return "zh-CN";
}
