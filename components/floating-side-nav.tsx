import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "@/lib/trpc";
import { BrandWordmark } from "@/components/brand-wordmark";

/**
 * 悬浮侧边栏 v3
 *
 * v3 vs v2 改动:
 * - FAB 从右下角圆形 → 左下角胶囊 + "导航" 文字（用户一眼看懂、不挡咨询、不撞手机系统三横）
 * - FAB 形状跟咨询按钮一致（胶囊），颜色独立（古金描边 vs 蓝色实心）
 * - hover 时古金底色加深
 */
export function FloatingSideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isCompact = width < 1024;

  // Hooks 必须在条件之前
  const customEntriesQuery = trpc.siteEntries.list.useQuery(
    { enabled: true },
    {
      enabled: Platform.OS === "web",
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  );

  if (Platform.OS !== "web") return null;

  const customEntries = customEntriesQuery.data ?? [];

  const goTo = (href: string) => {
    setIsOpen(false);
    router.push(href as any);
  };

  const openExternal = (url: string) => {
    setIsOpen(false);
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  // ==== 快捷跳转 ====
  const quickLinks = [
    {
      code: "MKT",
      label: "策略广场",
      sub: "浏览全部 EA 策略",
      href: "/(tabs)",
      matchPaths: ["/", "/(tabs)"],
    },
    {
      code: "GB",
      label: "合购",
      sub: "拼单更优惠",
      href: "/(tabs)/group-buy",
      matchPaths: ["/(tabs)/group-buy", "/group-buy"],
    },
    {
      code: "ACC",
      label: "订阅",
      sub: "月度精选 EA 推送",
      href: "/(tabs)/subscribe",
      matchPaths: ["/(tabs)/subscribe", "/subscribe"],
    },
    {
      code: "B2B",
      label: "合作授权",
      sub: "工作室合作 / 渠道",
      href: "/cooperation",
      matchPaths: ["/cooperation"],
    },
    {
      code: "PRM",
      label: "限时促销",
      sub: "特价 EA 抢购中",
      href: "/promo",
      matchPaths: ["/promo"],
      badge: true,
    },
  ];

  // ==== 项目矩阵 ====
  const matrixSites = [
    { code: "EAX", label: "EAXAU", sub: "eaxau.com", current: true },
    { code: "SRC", label: "源码研究台", sub: "即将上线", disabled: true },
    { code: "XAU", label: "点金", sub: "ddxau.com", url: "https://ddxau.com" },
    { code: "AI", label: "量化风云榜", sub: "eaea.ai", url: "https://eaea.ai" },
  ];

  return (
    <>
      {/* 左下角胶囊 FAB */}
      {!isOpen && (
        <Pressable
          onPress={() => setIsOpen(true)}
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          style={[
            styles.fab,
            isCompact && styles.fabCompact,
            isHovered && styles.fabHover,
          ]}
          accessibilityLabel="打开导航"
        >
          <Ionicons
            name="menu-outline"
            size={isCompact ? 22 : 19}
            color="#C9A96E"
          />
        </Pressable>
      )}

      {/* 遮罩 */}
      {isOpen && (
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
      )}

      {/* 抽屉 */}
      {isOpen && (
        <View style={[styles.drawer, isCompact && styles.drawerCompact]}>
          {/* 抽屉头 */}
          <View style={styles.drawerHeader}>
            <Pressable onPress={() => setIsOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnIcon}>✕</Text>
            </Pressable>
            <BrandWordmark size="sm" style={styles.brand} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 区 1：快捷跳转 */}
            <SectionTitle en="QUICK ACCESS" zh="快捷跳转" />
            <View style={{ paddingHorizontal: 12 }}>
              {quickLinks.map((item) => {
                const isActive = item.matchPaths?.some(
                  (p) => pathname === p || pathname?.startsWith(p),
                );
                return (
                  <Pressable
                    key={item.href}
                    onPress={() => goTo(item.href)}
                    style={({ hovered }: any) => [
                      styles.listItem,
                      isActive && styles.listItemActive,
                      hovered && !isActive && styles.listItemHover,
                    ]}
                  >
                    {isActive && <View style={styles.activeBar} />}
                    <Text style={styles.itemCode}>{item.code}</Text>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={[
                            styles.itemLabel,
                            isActive && { color: "#C9A96E", fontWeight: "600" },
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.badge && <View style={styles.badge} />}
                      </View>
                      <Text style={styles.itemSub}>{item.sub}</Text>
                    </View>
                    {isActive && <Text style={styles.activeArrow}>→</Text>}
                  </Pressable>
                );
              })}
            </View>

            {/* 分隔线 */}
            <View style={styles.divider} />

            {/* 区 2：项目矩阵 */}
            <SectionTitle en="EAXAU MATRIX" zh="项目矩阵" />
            <View style={{ paddingHorizontal: 12 }}>
              {matrixSites.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    if (s.disabled) return;
                    if (s.current) goTo("/(tabs)");
                    else if (s.url) openExternal(s.url);
                  }}
                  style={({ hovered }: any) => [
                    styles.matrixItem,
                    s.current && styles.matrixItemCurrent,
                    s.disabled && styles.matrixItemDisabled,
                    hovered &&
                      !s.current &&
                      !s.disabled &&
                      styles.listItemHover,
                  ]}
                >
                  <Text
                    style={[styles.matrixCode, s.disabled && { opacity: 0.5 }]}
                  >
                    {s.code}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.matrixLabel,
                        s.current && { color: "#C9A96E", fontWeight: "600" },
                        s.disabled && { color: "#475569" },
                      ]}
                    >
                      {s.label}
                    </Text>
                    <Text
                      style={[
                        styles.matrixSub,
                        s.disabled && { color: "#475569" },
                      ]}
                    >
                      {s.sub}
                    </Text>
                  </View>
                  {s.current && (
                    <View style={styles.currentTag}>
                      <Text style={styles.currentTagText}>当前</Text>
                    </View>
                  )}
                  {s.url && <Text style={styles.externalIcon}>↗</Text>}
                </Pressable>
              ))}
            </View>

            {/* 区 3：资源中心 */}
            {customEntries.length > 0 && (
              <>
                <View style={styles.divider} />
                <SectionTitle en="RESOURCES" zh="资源中心" />
                <View style={styles.resourceGrid}>
                  {customEntries.map((entry: any) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => {
                        if (entry.href.startsWith("http"))
                          openExternal(entry.href);
                        else goTo(entry.href);
                      }}
                      style={({ hovered }: any) => [
                        styles.resourceCell,
                        hovered && styles.resourceCellHover,
                      ]}
                    >
                      <Text style={styles.resourceCode}>RES</Text>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.resourceLabel} numberOfLines={1}>
                          {entry.label}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              EAXAU © 2026 · Quant Source Desk
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

function SectionTitle({ en, zh }: { en: string; zh: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <View style={styles.sectionBar} />
      <View>
        <Text style={styles.sectionEn}>{en}</Text>
        <Text style={styles.sectionZh}>{zh}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ===== 左下角胶囊 FAB =====
  fab: {
    position: "absolute" as any,
    bottom: 24,
    left: 8,
    width: 44,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 6,
    backgroundColor: "rgba(15,30,51,0.95)",
    borderWidth: 1.2,
    borderColor: "#C9A96E",
    zIndex: 999,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 4px 12px rgba(0,0,0,0.30)" }
      : { elevation: 8 }),
  },
  fabHover: {
    backgroundColor: "rgba(201,169,110,0.12)",
    borderColor: "#D8BC83",
  },
  fabCompact: {
    left: "auto" as any,
    right: 116,
    top: 8,
    bottom: "auto" as any,
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 6,
    justifyContent: "center",
  },
  // 遮罩
  backdrop: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 1000,
  },

  // 抽屉（280 宽）
  drawer: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: "#0F1E33",
    borderRightWidth: 1,
    borderRightColor: "rgba(201,169,110,0.15)",
    zIndex: 1001,
    ...(Platform.OS === "web"
      ? { boxShadow: "4px 0 24px rgba(0,0,0,0.40)" }
      : { elevation: 12 }),
    flexDirection: "column",
  },
  drawerCompact: {
    width: "88%" as any,
    maxWidth: 320,
  },

  drawerHeader: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#0A1628",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginRight: 16,
  },
  closeBtnIcon: {
    color: "#A8B3C7",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 16,
  },

  brand: {
    flexShrink: 0,
  },

  // 章节标题
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionBar: {
    width: 3,
    height: 14,
    backgroundColor: "#C9A96E",
    borderRadius: 2,
    marginRight: 12,
  },
  sectionEn: {
    color: "#A8B3C7",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    lineHeight: 12,
  },
  sectionZh: {
    color: "#6B7891",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 3,
    lineHeight: 11,
  },

  // 列表项
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 2,
    position: "relative" as any,
  },
  listItemActive: { backgroundColor: "rgba(201,169,110,0.06)" },
  listItemHover: { backgroundColor: "rgba(255,255,255,0.03)" },
  activeBar: {
    position: "absolute" as any,
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: "#C9A96E",
    borderRadius: 2,
  },
  itemCode: {
    width: 28,
    color: "#C9A96E",
    fontSize: 10,
    fontWeight: "900",
    marginRight: 12,
  },
  itemLabel: {
    color: "#F4F6FB",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
  },
  itemSub: { color: "#6B7891", fontSize: 10, marginTop: 2, lineHeight: 12 },
  badge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E63946",
    marginLeft: 8,
  },
  activeArrow: {
    color: "#C9A96E",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 8,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 8,
    marginHorizontal: 20,
  },

  // 项目矩阵
  matrixItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  matrixItemCurrent: {
    backgroundColor: "rgba(201,169,110,0.06)",
    borderWidth: 1,
    borderColor: "rgba(201,169,110,0.25)",
  },
  matrixItemDisabled: { opacity: 0.6 },
  matrixCode: {
    width: 30,
    color: "#C9A96E",
    fontSize: 10,
    fontWeight: "900",
    marginRight: 12,
  },
  matrixLabel: {
    color: "#F4F6FB",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 15,
  },
  matrixSub: { color: "#6B7891", fontSize: 10, marginTop: 2, lineHeight: 11 },
  currentTag: {
    backgroundColor: "rgba(22,163,74,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
  },
  currentTagText: {
    color: "#16A34A",
    fontSize: 9,
    fontWeight: "600",
    lineHeight: 10,
  },
  externalIcon: {
    color: "#A8B3C7",
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 8,
  },

  // 资源中心 2 列
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 6,
  },
  resourceCell: {
    width: 124,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  resourceCellHover: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(201,169,110,0.2)",
  },
  resourceCode: {
    color: "#C9A96E",
    fontSize: 9,
    fontWeight: "900",
  },
  resourceLabel: {
    color: "#F4F6FB",
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 13,
  },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  footerText: {
    color: "#475569",
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
