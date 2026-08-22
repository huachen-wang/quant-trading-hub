import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePathname, useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
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

type V2ShellProps = { children: ReactNode };

const NAV_ITEMS = [
  { label: "六策略", path: "/v2-preview", icon: "insights" },
  { label: "自主分仓", path: "/v2-preview/allocate", icon: "account-tree" },
  { label: "账户观察", path: "/v2-preview/accounts", icon: "monitor-heart" },
  { label: "EA 资料库", path: "/v2-preview/ea-library", icon: "inventory-2" },
] as const;

export function V2Shell({ children }: V2ShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;
  const [contactOpen, setContactOpen] = useState(false);
  const { data: status } = trpc.v2.status.useQuery(undefined, {
    staleTime: 60_000,
  });

  const activePath = useMemo(() => {
    return (
      [...NAV_ITEMS]
        .reverse()
        .find((item) =>
          item.path === "/v2-preview"
            ? pathname === item.path
            : pathname.startsWith(item.path),
        )?.path ?? "/v2-preview"
    );
  }, [pathname]);

  const nav = NAV_ITEMS.map((item) => {
    const active = activePath === item.path;
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
            accessibilityLabel="返回 EAXAU V2 首页"
            onPress={() => router.push("/v2-preview" as never)}
            style={({ pressed }) => [styles.brandButton, pressed && styles.pressed]}
          >
            <Text style={styles.brand}>EAXAU</Text>
            <View style={styles.brandRule} />
          </Pressable>

          {!isMobile ? <View style={styles.desktopNav}>{nav}</View> : null}

          <View style={styles.headerActions}>
            <View style={styles.providerState}>
              <View
                style={[
                  styles.providerDot,
                  {
                    backgroundColor:
                      status?.provider === "HTTP" ? V2.green : V2.amber,
                  },
                ]}
              />
              {!isMobile ? (
                <Text style={styles.providerText}>
                  {status?.provider === "HTTP" ? "DATA CORE" : "DEMO"}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setContactOpen(true)}
              style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
            >
              <MaterialIcons name="support-agent" size={18} color={V2.background} />
              <Text style={styles.contactText}>{isMobile ? "联系" : "联系顾问"}</Text>
            </Pressable>
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
            <Text style={styles.disabledText}>该版本当前处于内部验收阶段，请联系管理员开放。</Text>
          </View>
        ) : (
          children
        )}
      </View>
      <ContactModal visible={contactOpen} onClose={() => setContactOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: V2.background },
  topRule: { height: 1, backgroundColor: "rgba(216,188,131,0.34)" },
  header: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    backgroundColor: "rgba(7,11,18,0.98)",
    zIndex: 20,
  },
  headerInner: {
    width: "100%",
    maxWidth: V2_LAYOUT.maxWidth,
    minHeight: 68,
    alignSelf: "center",
    paddingHorizontal: Platform.OS === "web" ? 28 : 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  brandButton: {
    width: 142,
    height: 48,
    justifyContent: "center",
  },
  brand: {
    color: V2.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },
  brandRule: { width: 76, height: 2, marginTop: 3, backgroundColor: V2.gold },
  desktopNav: { flex: 1, height: 68, flexDirection: "row", alignItems: "stretch" },
  navItem: {
    minWidth: 104,
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
  navItemActive: { borderBottomColor: V2.gold, backgroundColor: "rgba(216,188,131,0.06)" },
  navText: { color: V2.textMuted, fontSize: 13, fontWeight: "700", letterSpacing: 0 },
  navTextActive: { color: V2.text },
  headerActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 10 },
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
  providerText: { color: V2.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0 },
  contactButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  contactText: { color: V2.background, fontSize: 12, fontWeight: "900", letterSpacing: 0 },
  mobileNavWrap: {
    height: 45,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    backgroundColor: V2.backgroundRaised,
  },
  mobileNav: { paddingHorizontal: 8, alignItems: "center", gap: 2 },
  content: { flex: 1, minHeight: 0 },
  disabledState: { flex: 1, minHeight: 420, alignItems: "center", justifyContent: "center", gap: 9, padding: 24 },
  disabledTitle: { color: V2.text, fontSize: 17, fontWeight: "900" },
  disabledText: { color: V2.textMuted, fontSize: 12, textAlign: "center", lineHeight: 18 },
  pressed: { opacity: 0.72 },
});
