import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

/**
 * 悬浮侧边栏（左上角入口）
 *
 * 折叠态：左上角一个 ☰ 按钮（z-index 高于内容、低于 Modal）
 * 展开态：从左侧滑入 320px 宽抽屉，内含三个区：
 *   1. 项目矩阵（写死的 4 个子站）
 *   2. 快捷跳转（5 个主栏目，跟顶导一致，方便用户少移动鼠标）
 *   3. 自定义入口（后台 trpc.siteEntries.list 拉数据）
 */
export function FloatingSideNav() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const update = () => {
      try { setWindowWidth(Dimensions.get("window").width); } catch {}
    };
    update();
    const sub = Dimensions.addEventListener("change", update);
    return () => { try { sub?.remove(); } catch {} };
  }, []);

  // 拉后台自定义入口
  const customEntriesQuery = trpc.siteEntries?.list?.useQuery?.(
    { enabled: true },
    {
      // 安全降级：如果后端 trpc 没注册这个 router，前端不报错
      enabled: Platform.OS === "web",
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  );
  const customEntries = customEntriesQuery?.data ?? [];

  // 仅 web 端显示，原生 App 走自己的导航
  if (Platform.OS !== "web") return null;
  if (windowWidth === 0) return null;

  const goTo = (href: string) => {
    setIsOpen(false);
    router.push(href as any);
  };

  const openExternal = (url: string) => {
    setIsOpen(false);
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  // ==== 写死的项目矩阵 ====
  const matrixSites = [
    { emoji: "🎯", label: "EA 军火库", subtitle: "eaxau.com（当前）", current: true },
    { emoji: "🌟", label: "EA 破解网", subtitle: "即将上线", disabled: true },
    { emoji: "💰", label: "点金", subtitle: "ddxau.com", url: "https://ddxau.com" },
    { emoji: "⚖️", label: "量化风云榜", subtitle: "eaea.ai", url: "https://eaea.ai" },
  ];

  // ==== 写死的快捷跳转（跟顶导一致）====
  const quickLinks = [
    { emoji: "📊", label: "策略广场", href: "/(tabs)" },
    { emoji: "🤝", label: "合购", href: "/(tabs)/group-buy" },
    { emoji: "📬", label: "订阅", href: "/(tabs)/subscribe" },
    { emoji: "🏢", label: "合作授权", href: "/cooperation" },
    { emoji: "🔥", label: "限时促销", href: "/promo" },
  ];

  return (
    <>
      {/* 左上角悬浮按钮 */}
      <Pressable
        onPress={() => setIsOpen(true)}
        style={[styles.fab, isOpen && styles.fabHidden]}
        accessibilityLabel="打开导航"
      >
        <Text style={styles.fabIcon}>☰</Text>
      </Pressable>

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
          {/* 抽屉头部 */}
          <View style={styles.drawerHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>EX</Text>
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.drawerBrand}>EAXAU</Text>
                <Text style={styles.drawerSub}>· 量化军火库 ·</Text>
              </View>
            </View>
            <Pressable onPress={() => setIsOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnIcon}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* 区 1：快捷跳转 */}
            <Text style={styles.sectionLabel}>快捷跳转</Text>
            <View style={styles.entryGrid}>
              {quickLinks.map((item) => (
                <Pressable
                  key={item.href}
                  onPress={() => goTo(item.href)}
                  style={styles.entryCell}
                >
                  <Text style={styles.entryEmoji}>{item.emoji}</Text>
                  <Text style={styles.entryLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 区 2：项目矩阵 */}
            <Text style={styles.sectionLabel}>EAXAU 项目矩阵</Text>
            <View style={styles.matrixList}>
              {matrixSites.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    if (s.disabled) return;
                    if (s.current) goTo("/(tabs)");
                    else if (s.url) openExternal(s.url);
                  }}
                  style={[
                    styles.matrixItem,
                    s.current && styles.matrixItemCurrent,
                    s.disabled && styles.matrixItemDisabled,
                  ]}
                >
                  <Text style={styles.matrixEmoji}>{s.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.matrixLabel,
                      s.current && { color: "#C9A96E" },
                      s.disabled && { color: "#64748B" },
                    ]}>
                      {s.label}
                    </Text>
                    <Text style={styles.matrixSub}>{s.subtitle}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* 区 3：自定义入口（后台可编辑）*/}
            {customEntries.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>更多入口</Text>
                <View style={styles.entryGrid}>
                  {customEntries.map((entry: any) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => {
                        if (entry.href.startsWith("http")) {
                          openExternal(entry.href);
                        } else {
                          goTo(entry.href);
                        }
                      }}
                      style={styles.entryCell}
                    >
                      <Text style={styles.entryEmoji}>{entry.emoji}</Text>
                      <Text style={styles.entryLabel} numberOfLines={1}>
                        {entry.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {customEntriesQuery?.isLoading && (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color="#C9A96E" />
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // 悬浮按钮
  fab: {
    position: "absolute" as any,
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90, // 低于顶导（顶导 100），不挡 logo
    // 注意：如果你顶导左上角有 logo，FAB 会跟它重叠。下面 fabHidden 在抽屉打开时隐藏 FAB。
  },
  fabHidden: { opacity: 0 },
  fabIcon: {
    color: "#F4F6FB",
    fontSize: 18,
    fontWeight: "700",
  },

  // 遮罩
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 1000,
  },

  // 抽屉
  drawer: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    bottom: 0,
    width: 320,
    backgroundColor: "#0A1628",
    borderRightWidth: 1,
    borderRightColor: "rgba(148,163,184,0.18)",
    zIndex: 1001,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#C9A96E",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: { color: "#0A1628", fontSize: 13, fontWeight: "900" },
  drawerBrand: { color: "#F4F6FB", fontSize: 15, fontWeight: "800", letterSpacing: 0.4 },
  drawerSub: { color: "#C9A96E", fontSize: 9, fontWeight: "600", letterSpacing: 1.5, marginTop: 2 },

  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  closeBtnIcon: { color: "#A8B3C7", fontSize: 16, fontWeight: "600" },

  // 区块标题
  sectionLabel: {
    color: "#A8B3C7",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },

  // 二纵 emoji 网格
  entryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 6,
  },
  entryCell: {
    width: 95, // (320 - 24 padding - 6 gap) / 2 ≈ 145，但要再小点排得开
    paddingVertical: 14,
    paddingHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
    alignItems: "center",
  },
  entryEmoji: { fontSize: 22, marginBottom: 4 },
  entryLabel: { color: "#F4F6FB", fontSize: 12, fontWeight: "500", textAlign: "center" },

  // 项目矩阵列表（一纵）
  matrixList: { paddingHorizontal: 12, gap: 6 },
  matrixItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  matrixItemCurrent: {
    borderColor: "rgba(201,169,110,0.4)",
    backgroundColor: "rgba(201,169,110,0.06)",
  },
  matrixItemDisabled: { opacity: 0.5 },
  matrixEmoji: { fontSize: 22, marginRight: 12 },
  matrixLabel: { color: "#F4F6FB", fontSize: 14, fontWeight: "600" },
  matrixSub: { color: "#A8B3C7", fontSize: 11, marginTop: 2 },
});
