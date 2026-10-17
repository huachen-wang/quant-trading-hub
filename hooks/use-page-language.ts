import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { PAGE_LANG_ATTR, applyDocumentLanguage, useLanguage } from "@/lib/language";
import type { ContentLang } from "@/shared/content-pages";

const PAGE_LANG_OWNER_ATTR = "data-page-lang-owner";
let ownerSeq = 0;

/**
 * 固定语言页面的 <html lang>（2026-10-18）。
 *
 * 全站语言开关存在本机（AsyncStorage）。用户之前选过英文，再打开中文合作页时，
 * <html lang> 原本会被改成 en——正文却是中文。内容页用这个 hook 把 lang 固定成正文语言。
 * 只在页面获得焦点时生效（Stack 里返回上一页时旧页面不卸载）；离开时交还给全站开关。
 */
export function usePageLanguage(pageLang: ContentLang) {
  const { language } = useLanguage();
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "web" || typeof document === "undefined") return;
      const root = document.documentElement;
      const owner = String(++ownerSeq);
      root.setAttribute(PAGE_LANG_ATTR, pageLang);
      root.setAttribute(PAGE_LANG_OWNER_ATTR, owner);
      root.lang = pageLang;
      root.dir = "ltr";
      return () => {
        /* 下一个固定语言页面可能已经先接手了，那就不动。 */
        if (root.getAttribute(PAGE_LANG_OWNER_ATTR) !== owner) return;
        root.removeAttribute(PAGE_LANG_ATTR);
        root.removeAttribute(PAGE_LANG_OWNER_ATTR);
        applyDocumentLanguage(languageRef.current);
      };
    }, [pageLang]),
  );
}
