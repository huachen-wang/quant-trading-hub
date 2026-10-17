import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  languageLocale,
  normalizeLanguage,
  type AppLanguage,
  type AppLocale,
} from "./language-core";

export {
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  languageLocale,
  normalizeLanguage,
  type AppLanguage,
  type AppLocale,
} from "./language-core";

type LanguageContextValue = {
  language: AppLanguage;
  locale: AppLocale;
  isEnglish: boolean;
  isRtl: boolean;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  text: (chinese: string, english: string, arabic?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * 固定语言的内容页（/cooperation 中文、/en/… 英文，2026-10-18）在 <html> 上写这个属性，
 * 页面 lang 跟正文语言走，不跟全站语言开关走。见 hooks/use-page-language.ts。
 */
export const PAGE_LANG_ATTR = "data-page-lang";

/** 写 <html lang/dir>：有固定语言页面时用页面语言，否则用全站语言开关。 */
export function applyDocumentLanguage(language: AppLanguage) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const root = document.documentElement;
  const pageLang = root.getAttribute(PAGE_LANG_ATTR);
  if (pageLang) {
    root.lang = pageLang;
    root.dir = "ltr";
    return;
  }
  root.lang = language === "en" ? "en" : language === "ar" ? "ar" : "zh-CN";
  root.dir = language === "ar" ? "rtl" : "ltr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("zh");
  const userSelected = useRef(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((savedLanguage) => {
        if (!active || userSelected.current || savedLanguage === null) return;
        setLanguageState(normalizeLanguage(savedLanguage));
      })
      .catch(() => {
        // Storage is optional; Chinese remains the deterministic default.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    userSelected.current = true;
    setLanguageState(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage).catch(() => {
      // The in-memory selection still works when persistence is unavailable.
    });
  }, []);

  const toggleLanguage = useCallback(() => {
    const currentIndex = LANGUAGE_OPTIONS.findIndex(
      (option) => option.id === language,
    );
    const nextIndex = (currentIndex + 1) % LANGUAGE_OPTIONS.length;
    setLanguage(LANGUAGE_OPTIONS[nextIndex].id);
  }, [language, setLanguage]);

  const text = useCallback(
    (chinese: string, english: string, arabic?: string) => {
      if (language === "en") return english;
      if (language === "ar") return arabic ?? english;
      return chinese;
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      locale: languageLocale(language),
      isEnglish: language === "en",
      isRtl: language === "ar",
      setLanguage,
      toggleLanguage,
      text,
    }),
    [language, setLanguage, text, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * 固定语言的子树（2026-10-18）：英文内容页里的页脚等共用组件跟正文语言一致。
 * 只影响这棵子树里的 text() 取值，不改、不保存全站语言设置。
 */
export function FixedLanguageScope({
  language,
  children,
}: {
  language: AppLanguage;
  children: ReactNode;
}) {
  const parent = useLanguage();
  const value = useMemo<LanguageContextValue>(
    () => ({
      ...parent,
      language,
      locale: languageLocale(language),
      isEnglish: language === "en",
      isRtl: language === "ar",
      text: (chinese: string, english: string, arabic?: string) =>
        language === "en" ? english : language === "ar" ? (arabic ?? english) : chinese,
    }),
    [parent, language],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
