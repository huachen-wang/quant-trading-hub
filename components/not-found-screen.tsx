import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CommunityFooter } from "@/components/community/community-entry-points";
import { PcTopNav } from "@/components/pc-top-nav";
import { ScreenContainer } from "@/components/screen-container";
import { V2 } from "@/components/v2/tokens";
import { PageHead } from "@/components/page-head";
import { useLanguage } from "@/lib/language";
import { NOT_FOUND_TITLE } from "@/shared/seo-meta";

/**
 * 品牌 404：服务端对不存在的地址返回 404（见 server/_core/spa-routes.ts），
 * 应用挂载后显示这一页，代替 Expo 默认的英文「Unmatched Route」。
 * app/+not-found.tsx 和 app/_sitemap.tsx（关掉 Expo 自带的路由表页）都渲染它。
 */
export function NotFoundScreen() {
  const router = useRouter();
  const { text } = useLanguage();
  return (
    <ScreenContainer>
      <PageHead title={NOT_FOUND_TITLE} />
      <PcTopNav />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          <Text style={styles.code}>404</Text>
          <Text style={styles.title}>{text("页面不存在", "Page not found", "الصفحة غير موجودة")}</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace("/" as never)}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>{text("回商城", "Back to the store", "العودة إلى المتجر")}</Text>
          </Pressable>
        </View>
        <CommunityFooter />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  body: { flexGrow: 1, minHeight: 320, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  code: { color: V2.gold, fontSize: 13, fontWeight: "900" },
  title: { color: V2.text, fontSize: 22, fontWeight: "900" },
  button: {
    marginTop: 6,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 4,
    backgroundColor: V2.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: V2.background, fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
