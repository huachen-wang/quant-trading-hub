import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { trpc } from "@/lib/trpc";

/**
 * 悬浮侧边栏 v2 — 高级版
 *
 * 核心改动 vs v1:
 * - FAB 从左上角 → 右下角（避开 logo + 咨询按钮上方 60px）
 * - 抽屉宽度 320 → 280（更精致）
 * - 列表项左对齐 + 主标 + 副标（信息层级感）
 * - 当前页加 3px 古金竖条 + 浅金底色（active 状态）
 * - 章节标题加 3px 古金竖条 + 英文小字 + 中文（专业感）
 * - 项目矩阵：当前站绿色"当前"标签，外链 ↗ 箭头
 * - 资源中心：2 列网格 + 主标 + 副标
 * - 限时促销加红色 badge 圆点
 */
export function FloatingSideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Hooks 必须在条件之前
  const customEntriesQuery = trpc.siteEntries.list.useQuery(
    { enabled: true },
    {
      enabled: Platform.OS === "web",
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
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

  // ==== 快捷跳转（带副标题）====
  const quickLinks = [
    { emoji: "📊", label: "策略广场", sub: "浏览全部 EA 策略", href: "/(tabs)", matchPaths: ["/", "/(tabs)"] },
    { emoji: "🤝", label: "合购", sub: "拼单更优惠", href: "/(tabs)/group-buy", matchPaths: ["/(tabs)/group-buy", "/group-buy"] },
    { emoji: "📬", label: "订阅", sub: "月度精选 EA 推送", href: "/(tabs)/subscribe", matchPaths: ["/(tabs)/subscribe", "/subscribe"] },
    { emoji: "🏢", label: "合作授权", sub: "工作室合作 / 渠道", href: "/cooperation", matchPaths: ["/cooperation"] },
    { emoji: "🔥", label: "限时促销", sub: "特价 EA 抢购中", href: "/promo", matchPaths: ["/promo"], badge: true },
  ];

  // ==== 项目矩阵 ====
  const matrixSites = [
    { emoji: "🎯", label: "EA 军火库", sub: "eaxau.com", current: true },
    { emoji: "🌟", label: "EA 破解网", sub: "即将上线", disabled: true },
    { emoji: "💰", label: "点金", sub: "ddxau.com", url: "https://ddxau.com" },
    { emoji: "⚖️", label: "量化风云榜", sub: "eaea.ai", url: "https://eaea.ai" },
  ];

  return (
    <>
      {/* 右下角 FAB（贴咨询按钮上方 60px）*/}
      {!isOpen && (
        <Pressable
          onPress={() => setIsOpen(true)}
          style={styles.fab}
          accessibilityLabel="打开导航"
        >
          <Text style={styles.fabIcon}>☰</Text>
        </Pressable>
      )}

      {/* 遮罩 */}
      {isOpen && (
        <Pressable
          style={styles.backdrop}
          onPress={() => setIsOpen(false)}
        />
      )}

      {/* 抽屉 */}
      {isOpen && (
        <View style={styles.drawer}>
          {/* 抽屉头 */}
          <View style={styles.drawerHeader}>
            <Pressable onPress={() => setIsOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnIcon}>✕</Text>
            </Pressable>
            <View style={styles.brand}>
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>EX</Text>
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.brandName}>EAXAU</Text>
                <Text style={styles.brandSub}>量化军火库</Text>
              </View>
            </View>
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
                const isActive = item.matchPaths?.some((p) => pathname === p || pathname?.startsWith(p));
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
                    <Text style={styles.itemEmoji}>{item.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={[styles.itemLabel, isActive && { color: "#C9A96E", fontWeight: "600" }]}>
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
                    hovered && !s.current && !s.disabled && styles.listItemHover,
                  ]}
                >
                  <Text style={[styles.matrixEmoji, s.disabled && { opacity: 0.5 }]}>{s.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.matrixLabel,
                      s.current && { color: "#C9A96E", fontWeight: "600" },
                      s.disabled && { color: "#475569" },
                    ]}>
                      {s.label}
                    </Text>
                    <Text style={[styles.matrixSub, s.disabled && { color: "#475569" }]}>
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

            {/* 区 3：资源中心（仅当后台有数据）*/}
            {customEntries.length > 0 && (
              <>
                <View style={styles.divider} />
                <SectionTitle en="RESOURCES" zh="资源中心" />
                <View style={styles.resourceGrid}>
                  {customEntries.map((entry: any) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => {
                        if (entry.href.startsWith("http")) openExternal(entry.href);
                        else goTo(entry.href);
                      }}
                      style={({ hovered }: any) => [
                        styles.resourceCell,
                        hovered && styles.resourceCellHover,
                      ]}
                    >
                      <Text style={styles.resourceEmoji}>{entry.emoji}</Text>
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

          {/* 抽屉底部 footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>EAXAU © 2026 · 量化军火库</Text>
          </View>
        </View>
      )}
    </>
  );
}

// 章节标题组件
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
  // FAB（右下角）
  fab: {
    position: "absolute" as any,
    bottom: 96, // 咨询按钮一般 24-30px，留 60px 间距 + 自身高度
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#C9A96E",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    // 手机端可能太靠右下，但有 ConsultButton 在更下面，不冲突
  },
  fabIcon: {
    color: "#0A1628",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 24,
  },

  // 遮罩
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 1000,
  },

  // 抽屉（280 宽）
  drawer: {
    position: "absolute" as any,
    top: 0, left: 0, bottom: 0,
    width: 280,
    backgroundColor: "#0F1E33",
    borderRightWidth: 1,
    borderRightColor: "rgba(201,169,110,0.15)",
    zIndex: 1001,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    flexDirection: "column",
  },

  // 抽屉头
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
    width: 28, height: 28, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginRight: 16,
  },
  closeBtnIcon: { color: "#A8B3C7", fontSize: 14, fontWeight: "500", lineHeight: 16 },

  brand: { flexDirection: "row", alignItems: "center" },
  logoMark: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: "#C9A96E",
    alignItems: "center", justifyContent: "center",
  },
  logoMarkText: { color: "#0A1628", fontSize: 9, fontWeight: "900", lineHeight: 11 },
  brandName: { color: "#F4F6FB", fontSize: 13, fontWeight: "700", letterSpacing: 0.3, lineHeight: 14 },
  brandSub: { color: "#C9A96E", fontSize: 9, fontWeight: "600", letterSpacing: 1.4, marginTop: 3, lineHeight: 10 },

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

  // 列表项（快捷跳转）
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 2,
    position: "relative" as any,
  },
  listItemActive: {
    backgroundColor: "rgba(201,169,110,0.06)",
  },
  listItemHover: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  activeBar: {
    position: "absolute" as any,
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: "#C9A96E",
    borderRadius: 2,
  },
  itemEmoji: {
    fontSize: 16,
    marginRight: 14,
  },
  itemLabel: {
    color: "#F4F6FB",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
  },
  itemSub: {
    color: "#6B7891",
    fontSize: 10,
    marginTop: 2,
    lineHeight: 12,
  },
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

  // 分隔线
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
  matrixEmoji: { fontSize: 18, marginRight: 14 },
  matrixLabel: { color: "#F4F6FB", fontSize: 13, fontWeight: "500", lineHeight: 15 },
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

  // 资源中心 2 列网格
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 6,
  },
  resourceCell: {
    width: 124, // (280 - 24 - 6) / 2 = 125
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
  resourceEmoji: { fontSize: 14 },
  resourceLabel: {
    color: "#F4F6FB",
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 13,
  },

  // Footer
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
