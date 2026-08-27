import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContactModal } from "@/components/contact-modal";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import { LanguageMenu } from "./language-menu";
import { V2, V2_LAYOUT } from "./tokens";
import { WalletConnect } from "./wallet/wallet-connect";

type V2ShellProps = { children: ReactNode };

const NAV_ITEMS = [
  { id: "STRATEGIES", path: "/", activeOn: "/", icon: "insights" },
  {
    id: "CONFIGURE",
    path: "/?configure=1",
    activeOn: "CONFIGURE",
    icon: "tune",
  },
  {
    id: "ACCOUNTS",
    path: "/v2-preview/accounts",
    activeOn: "/v2-preview/accounts",
    icon: "monitor-heart",
  },
  {
    id: "LIBRARY",
    path: "/v2-preview/ea-library",
    activeOn: "/v2-preview/ea-library",
    icon: "storefront",
  },
] as const;

export function V2Shell({ children }: V2ShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { configure } = useLocalSearchParams<{ configure?: string }>();
  const { width } = useWindowDimensions();
  const isMobile = width < 1120;
  const isVeryNarrow = width < 410;
  const { language, text } = useLanguage();
  const [contactOpen, setContactOpen] = useState(false);
  const { data: status } = trpc.v2.status.useQuery(undefined, {
    staleTime: 60_000,
  });
  const providerLabel =
    status?.provider === "HTTP"
      ? "DATA CORE"
      : status?.provider === "NIUBANG"
        ? "NIUBANG DATA"
        : "DEMO";
  const connectedProvider =
    status?.provider === "HTTP" || status?.provider === "NIUBANG";

  const navLabels = {
    STRATEGIES: text("核心策略", "Strategies", "الاستراتيجيات"),
    CONFIGURE: text("方案选配", "Configure", "بناء الخطة"),
    ACCOUNTS: text("实盘账户", "Accounts", "الحسابات"),
    LIBRARY: text("EA 商城", "EA Library", "مكتبة EA"),
  } as const;

  const nav = NAV_ITEMS.map((item) => {
    const isLibrary = item.id === "LIBRARY";
    const active =
      item.activeOn === "/"
        ? (pathname === "/" ||
            pathname === "/v2-preview" ||
            pathname.startsWith("/v2-preview/strategies/")) &&
          configure !== "1"
        : item.activeOn === "CONFIGURE"
          ? (pathname === "/" || pathname === "/v2-preview") &&
            configure === "1"
          : item.activeOn
            ? pathname.startsWith(item.activeOn)
            : false;
    return (
      <Pressable
        key={item.path}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        onPress={() => router.push(item.path as never)}
        style={({ pressed }) => [
          styles.navItem,
          isMobile && styles.navItemMobile,
          isLibrary && styles.navItemCommerce,
          active && styles.navItemActive,
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons
          name={item.icon}
          size={isMobile ? 15 : 16}
          color={active || isLibrary ? V2.gold : V2.textMuted}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.navText,
            isMobile && styles.navTextMobile,
            isLibrary && styles.navTextCommerce,
            active && styles.navTextActive,
          ]}
        >
          {navLabels[item.id]}
        </Text>
      </Pressable>
    );
  });

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.topRule} />
      <View style={styles.header}>
        <View
          style={[styles.headerInner, isMobile && styles.headerInnerMobile]}
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={text(
              "返回 AI量化联盟首页",
              "Return to AI Quant Alliance home",
              "العودة إلى الصفحة الرئيسية لتحالف EAXAU الكمي",
            )}
            onPress={() => router.push("/" as never)}
            style={({ pressed }) => [
              styles.brandButton,
              isVeryNarrow && styles.brandButtonCompact,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.brandCopy}>
              <Text
                numberOfLines={1}
                style={[
                  styles.brand,
                  language !== "zh" && styles.brandInternational,
                  isVeryNarrow && styles.brandCompact,
                ]}
              >
                {isVeryNarrow
                  ? "EAXAU"
                  : text(
                      "AI量化联盟",
                      "AI QUANT ALLIANCE",
                      "تحالف EAXAU الكمي",
                    )}
              </Text>
              <Text style={styles.brandDomain}>eaxau.com</Text>
            </View>
            <View
              style={[
                styles.brandRule,
                isVeryNarrow && styles.brandRuleCompact,
              ]}
            />
          </Pressable>

          {!isMobile ? <View style={styles.desktopNav}>{nav}</View> : null}

          <View
            style={[
              styles.headerActions,
              isMobile && styles.headerActionsMobile,
            ]}
          >
            {!isMobile ? (
              <View
                accessible
                accessibilityLabel={
                  connectedProvider
                    ? text(
                        `数据来源：${providerLabel} 接口`,
                        `Data source: ${providerLabel}`,
                        `مصدر البيانات: ${providerLabel}`,
                      )
                    : text(
                        "数据来源：确定性模拟数据",
                        "Data source: deterministic demo",
                        "مصدر البيانات: بيانات تجريبية ثابتة",
                      )
                }
                style={styles.providerState}
              >
                <View
                  style={[
                    styles.providerDot,
                    {
                      backgroundColor: connectedProvider ? V2.green : V2.amber,
                    },
                  ]}
                />
                <Text style={styles.providerText}>{providerLabel}</Text>
              </View>
            ) : null}
            <LanguageMenu compact={isMobile} />
            {!isMobile ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text(
                  "联系量化顾问",
                  "Contact a quant advisor",
                  "تواصل مع مستشار كمي",
                )}
                accessibilityHint={text(
                  "打开联系方式",
                  "Open contact details",
                  "فتح بيانات التواصل",
                )}
                onPress={() => setContactOpen(true)}
                style={({ pressed }) => [
                  styles.contactButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="support-agent" size={18} color={V2.gold} />
                <Text style={styles.contactText}>
                  {text("联系顾问", "Talk to advisor", "تواصل مع مستشار")}
                </Text>
              </Pressable>
            ) : null}
            <WalletConnect compact={isMobile} />
          </View>
        </View>
      </View>

      {isMobile ? (
        <>
          <View style={styles.mobileNavWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mobileNav}
            >
              {nav.slice(0, NAV_ITEMS.length - 1)}
            </ScrollView>
          </View>
          <View style={styles.mobileConversionBar}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/v2-preview/ea-library" as never)}
              style={({ pressed }) => [
                styles.mobileMarketButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name="storefront"
                size={17}
                color={V2.background}
              />
              <Text style={styles.mobileMarketText}>
                {text("进入 EA 商城", "Open EA Market", "فتح سوق EA")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setContactOpen(true)}
              style={({ pressed }) => [
                styles.mobileContactButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="support-agent" size={17} color={V2.gold} />
              <Text style={styles.mobileContactText}>
                {text("联系量化顾问", "Talk to advisor", "تواصل مع مستشار")}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={styles.content}>
        {status?.enabled === false ? (
          <View style={styles.disabledState}>
            <MaterialIcons name="construction" size={30} color={V2.amber} />
            <Text style={styles.disabledTitle}>
              {text(
                "V2 预览暂未开放",
                "V2 preview is not available",
                "معاينة V2 غير متاحة حاليا",
              )}
            </Text>
            <Text style={styles.disabledText}>
              {text(
                "该版本当前处于内部验收阶段，请联系管理员开放。",
                "This version is in internal review. Contact an administrator for access.",
                "هذا الإصدار قيد المراجعة الداخلية. تواصل مع المسؤول لطلب الوصول.",
              )}
            </Text>
          </View>
        ) : (
          children
        )}
      </View>
      <ContactModal
        visible={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: V2.background },
  topRule: { height: 1, backgroundColor: "rgba(216,188,131,0.34)" },
  header: {
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    backgroundColor: "rgba(7,11,18,0.98)",
    zIndex: 20,
  },
  headerInner: {
    width: "100%",
    maxWidth: V2_LAYOUT.maxWidth,
    minHeight: 60,
    alignSelf: "center",
    paddingHorizontal: Platform.OS === "web" ? 28 : 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  headerInnerMobile: { paddingHorizontal: 10, gap: 8 },
  brandButton: {
    width: 164,
    height: 44,
    justifyContent: "center",
  },
  brandButtonCompact: { width: 86 },
  brandCopy: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  brand: {
    color: V2.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: 0,
  },
  brandInternational: { fontSize: 13 },
  brandCompact: { fontSize: 21, lineHeight: 25 },
  brandDomain: { color: V2.textDim, fontSize: 7, fontWeight: "800" },
  brandRule: { width: 86, height: 2, marginTop: 2, backgroundColor: V2.gold },
  brandRuleCompact: { width: 52 },
  desktopNav: {
    flex: 1,
    height: 60,
    flexDirection: "row",
    alignItems: "stretch",
  },
  navItem: {
    minWidth: 96,
    height: "100%",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  navItemMobile: {
    minWidth: 92,
    flexGrow: 1,
    flexShrink: 1,
    height: 44,
    paddingHorizontal: 2,
    gap: 4,
    borderBottomWidth: 0,
    borderRadius: 4,
  },
  navItemActive: {
    borderBottomColor: V2.gold,
    backgroundColor: "rgba(216,188,131,0.06)",
  },
  navItemCommerce: {
    backgroundColor: "rgba(216,188,131,0.045)",
  },
  navText: {
    color: V2.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  navTextMobile: { fontSize: 11 },
  navTextCommerce: { color: V2.gold },
  navTextActive: { color: V2.text },
  headerActions: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerActionsMobile: { gap: 6 },
  providerState: {
    minHeight: 34,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
  },
  providerDot: { width: 7, height: 7, borderRadius: 4 },
  providerText: {
    color: V2.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  contactButton: {
    minWidth: 106,
    height: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.66)",
    borderRadius: 4,
    backgroundColor: "rgba(216,188,131,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  contactText: { color: V2.gold, fontSize: 11, fontWeight: "900" },
  mobileNavWrap: {
    minHeight: 45,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    backgroundColor: V2.backgroundRaised,
  },
  mobileNav: {
    flexGrow: 1,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  mobileConversionBar: {
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    backgroundColor: "rgba(9,14,23,0.98)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  mobileMarketButton: {
    flex: 1,
    minWidth: 0,
    height: 36,
    paddingHorizontal: 9,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mobileMarketText: {
    color: V2.background,
    fontSize: 11,
    fontWeight: "900",
  },
  mobileContactButton: {
    flex: 1,
    minWidth: 0,
    height: 36,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.66)",
    borderRadius: 4,
    backgroundColor: "rgba(216,188,131,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mobileContactText: { color: V2.gold, fontSize: 11, fontWeight: "900" },
  content: { flex: 1, minHeight: 0 },
  disabledState: {
    flex: 1,
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 24,
  },
  disabledTitle: { color: V2.text, fontSize: 17, fontWeight: "900" },
  disabledText: {
    color: V2.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  pressed: { opacity: 0.72 },
});
