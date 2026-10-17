import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { CommunityFooter } from "@/components/community/community-entry-points";
import { PageHead } from "@/components/page-head";
import { PcTopNav } from "@/components/pc-top-nav";
import { ScreenContainer } from "@/components/screen-container";
import { V2 } from "@/components/v2/tokens";
import { usePageLanguage } from "@/hooks/use-page-language";
import { FixedLanguageScope } from "@/lib/language";
import {
  contentBlocks,
  otherLanguage,
  requireContentPage,
  type ContentPage,
} from "@/shared/content-pages";
import { ContentBlocks } from "./content-blocks";

/** 面包屑 + 另一种语言的链接（指向同一篇内容的翻译，不是英文首页）。 */
export function ContentTopBar({ page, align = "left" }: { page: ContentPage; align?: "left" | "center" }) {
  const other = otherLanguage(page);
  return (
    <View style={[styles.topBar, align === "center" && styles.topBarCenter]}>
      <Text style={styles.crumbs} role="navigation" numberOfLines={2}>
        {page.breadcrumb.map((crumb, index) => (
          <Text key={index}>
            {index > 0 ? <Text style={styles.crumbSep}> › </Text> : null}
            {crumb.href ? (
              <Link href={crumb.href as Href} style={styles.crumbLink} push>
                {crumb.label}
              </Link>
            ) : (
              <Text style={styles.crumbCurrent}>{crumb.label}</Text>
            )}
          </Text>
        ))}
      </Text>
      <Link
        href={other.path as Href}
        style={styles.langLink}
        push
        {...({ hrefLang: other.lang, lang: other.lang } as Record<string, string>)}
      >
        {other.label}
      </Link>
    </View>
  );
}

/** 固定语言的内容页：<html lang>、页脚文案都跟正文语言走。 */
export function ContentLanguageFrame({ page, children }: { page: ContentPage; children: ReactNode }) {
  usePageLanguage(page.lang);
  return <FixedLanguageScope language={page.lang === "en" ? "en" : "zh"}>{children}</FixedLanguageScope>;
}

/** 指南页、英文合作页：顶栏 + 面包屑 + 正文 + 交流群与客服。 */
export function ContentArticlePage({ path }: { path: string }) {
  const page = requireContentPage(path);
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  return (
    <ScreenContainer>
      <PageHead title={page.title} description={page.description} />
      <PcTopNav />
      <ContentLanguageFrame page={page}>
        <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
          <View
            style={[styles.column, { paddingHorizontal: desktop ? 0 : 16 }]}
            role={page.schemaType === "Article" ? "article" : "main"}
          >
            <ContentTopBar page={page} />
            <ContentBlocks blocks={contentBlocks(page)} lang={page.lang} />
          </View>
          <CommunityFooter />
        </ScrollView>
      </ContentLanguageFrame>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0A1628" },
  pageContent: { paddingBottom: 24 },
  column: { width: "100%", maxWidth: 860, alignSelf: "center", paddingTop: 20, paddingBottom: 28 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  topBarCenter: { width: "100%", maxWidth: 860 },
  crumbs: { flex: 1, color: "#94A3B8", fontSize: 13, lineHeight: 20 },
  crumbSep: { color: "#64748B" },
  crumbLink: { color: "#CBD5E1" },
  crumbCurrent: { color: "#94A3B8" },
  langLink: {
    color: V2.gold,
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.5)",
    borderRadius: 6,
  },
});
