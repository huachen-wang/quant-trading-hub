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
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.lang =
      language === "en" ? "en" : language === "ar" ? "ar" : "zh-CN";
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
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

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
