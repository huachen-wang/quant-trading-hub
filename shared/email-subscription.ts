export const EAXAU_EMAIL_BRAND_SCOPE = "EAXAU" as const;
export const EAXAU_EMAIL_SOURCE_KEY = "eaxau" as const;
export const EAXAU_EMAIL_CONTENT_SCOPE = "EDUCATION,PRODUCT_UPDATE" as const;
export const EAXAU_EMAIL_NOTICE_VERSION = "eaxau-email-v1-2026-09" as const;

export const EAXAU_EMAIL_SOURCES = ["HOME_MARKETPLACE"] as const;

export type EaxauEmailSource = (typeof EAXAU_EMAIL_SOURCES)[number];

export const EAXAU_EMAIL_SOURCE_PATHS: Record<EaxauEmailSource, string> = {
  HOME_MARKETPLACE: "/",
};

export const EAXAU_EMAIL_LOCALES = ["zh", "en", "ar"] as const;
export type EaxauEmailLocale = (typeof EAXAU_EMAIL_LOCALES)[number];
