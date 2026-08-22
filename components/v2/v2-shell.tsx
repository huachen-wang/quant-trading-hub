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
import { trpc } from "@/lib/trpc";
import { V2, V2_LAYOUT } from "./tokens";
import { WalletConnect } from "./wallet/wallet-connect";

type V2ShellProps = { children: ReactNode };

const NAV_ITEMS = [
  { label: "核心策略", path: "/", activeOn: "/", icon: "insights" },
  {
    label: "方案选配",
    path: "/?configure=1",
    activeOn: "CONFIGURE",
    icon: "tune",
  },
  {
    label: "实盘账户",
    path: "/v2-preview/accounts",
    activeOn: "/v2-preview/accounts",
    icon: "monitor-heart",
  },
  {
    label: "EA 商城",
    path: "/market",
    activeOn: "/market",
    icon: "storefront",
  },
] as const;

export function V2Shell({ children }: V2ShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { configure } = useLocalSearchParams<{ configure?: string }>();
  const { width } = useWindowDimensions();
  const isMobile = width < 940;
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

  const nav = NAV_ITEMS.map((item) => {
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
          active && styles.navItemActive,
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons
          name={item.icon}
          size={isMobile ? 17 : 16}
          color={active ? V2.gold : V2.textMuted}
        />
        <Text style={[styles.navText, active && styles.navTextActive]}>
          {item.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.topRule} />
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="返回 EAXAU 首页"
            onPress={() => router.push("/" as never)}
            style={({ pressed }) => [
              styles.brandButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.brand}>EAXAU</Text>
            <View style={styles.brandRule} />
          </Pressable>

          {!isMobile ? <View style={styles.desktopNav}>{nav}</View> : null}

          <View style={styles.headerActions}>
            {!isMobile ? (
              <View
                accessible
                accessibilityLabel={
                  connectedProvider
                    ? `数据来源：${providerLabel} 接口`
                    : "数据来源：确定性模拟数据"
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="联系量化顾问"
              accessibilityHint="打开联系方式"
              onPress={() => setContactOpen(true)}
              style={({ pressed }) => [
                styles.contactButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name="support-agent"
                size={18}
                color={V2.textMuted}
              />
              <Text style={styles.contactText}>顾问</Text>
            </Pressable>
            <WalletConnect compact={isMobile} />
          </View>
        </View>
      </View>

      {isMobile ? (
        <View style={styles.mobileNavWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mobileNav}
          >
            {nav}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.content}>
        {status?.enabled === false ? (
          <View style={styles.disabledState}>
            <MaterialIcons name="construction" size={30} color={V2.amber} />
            <Text style={styles.disabledTitle}>V2 预览暂未开放</Text>
            <Text style={styles.disabledText}>
              该版本当前处于内部验收阶段，请联系管理员开放。
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
  brandButton: {
    width: 124,
    height: 44,
    justifyContent: "center",
  },
  brand: {
    color: V2.text,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: 0,
  },
  brandRule: { width: 68, height: 2, marginTop: 2, backgroundColor: V2.gold },
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
    minWidth: 0,
    height: 44,
    paddingHorizontal: 13,
    borderBottomWidth: 0,
    borderRadius: 4,
  },
  navItemActive: {
    borderBottomColor: V2.gold,
    backgroundColor: "rgba(216,188,131,0.06)",
  },
  navText: {
    color: V2.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  navTextActive: { color: V2.text },
  headerActions: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
    minWidth: 58,
    height: 38,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    backgroundColor: V2.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  contactText: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  mobileNavWrap: {
    minHeight: 45,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    backgroundColor: V2.backgroundRaised,
  },
  mobileNav: { paddingHorizontal: 8, alignItems: "center", gap: 2 },
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
