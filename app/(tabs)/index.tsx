import { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Animated, StyleSheet, Linking, Platform, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { ContactModal } from "@/components/contact-modal";
import { SubscribeModal } from "@/components/subscribe-modal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

type PlatformFilter = "MT4" | "MT5" | undefined;
type OrderBy = "latest" | "return" | "hot";

const PAGE_SIZE = 12;
const { width: SW } = Dimensions.get("window");

const TAG_FILTERS = [
  { label: "全部", value: "" },
  { label: "黄金", value: "黄金" },
  { label: "马丁", value: "马丁" },
  { label: "对冲", value: "对冲" },
  { label: "趋势", value: "趋势" },
  { label: "剥头皮", value: "剥头皮" },
  { label: "网格", value: "网格" },
  { label: "多品种", value: "多品种" },
];

// ─── 快捷入口（去掉合购，保留3个，点金放第三） ───
const QUICK_ENTRIES = [
  {
    id: "cooperation",
    title: "工作室合作",
    subtitle: "策略观摩 · 源头扶持",
    icon: "🤝",
    gradient: ["#0F172A", "#1E3A8A", "#2563EB"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/cooperation",
    accentColor: "#60A5FA",
  },
  {
    id: "promo",
    title: "全网EA提货",
    subtitle: "源头直供 · 限时特惠",
    icon: "⚡",
    gradient: ["#1A0000", "#7F1D1D", "#DC2626"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/promo",
    accentColor: "#F87171",
  },
  {
    id: "ddxau",
    title: "点金DDXAU",
    subtitle: "四维共振 · 订单流",
    icon: "🏆",
    gradient: ["#1A0E00", "#78350F", "#D97706"] as readonly [string, string, ...string[]],
    type: "link" as const,
    target: "https://ddxau.com",
    accentColor: "#FBBF24",
  },
];

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(undefined);
  const [orderBy, setOrderBy] = useState<OrderBy>("hot");
  const [tagFilter, setTagFilter] = useState("");
  const [showContactModal, setShowContactModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedStrategyTitle, setSelectedStrategyTitle] = useState("");

  const [allStrategies, setAllStrategies] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ─── 动画 ───
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;
  const entryAnims = useRef(QUICK_ENTRIES.map(() => new Animated.Value(0))).current;
  const entrySlides = useRef(QUICK_ENTRIES.map(() => new Animated.Value(30))).current;

  useEffect(() => {
    // Hero 动画
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    // 入口卡片依次入场
    QUICK_ENTRIES.forEach((_, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(entryAnims[i], { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
          Animated.spring(entrySlides[i], { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        ]).start();
      }, 200 + i * 120);
    });
  }, []);

  const { data: initialData, isLoading, refetch, isRefetching } = trpc.strategies.list.useQuery({
    platform: platformFilter,
    orderBy,
    tag: tagFilter || undefined,
    limit: PAGE_SIZE,
    offset: 0,
  });

  useEffect(() => {
    if (initialData) {
      setAllStrategies(initialData);
      setOffset(initialData.length);
      setHasMore(initialData.length >= PAGE_SIZE);
    }
  }, [initialData]);

  const loadMoreQuery = trpc.strategies.list.useQuery(
    { platform: platformFilter, orderBy, tag: tagFilter || undefined, limit: PAGE_SIZE, offset },
    { enabled: false }
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      const result = await loadMoreQuery.refetch();
      if (result.data && result.data.length > 0) {
        setAllStrategies((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newItems = result.data.filter((s: any) => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
        setOffset((prev) => prev + result.data.length);
        setHasMore(result.data.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Load more failed:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, isLoading, loadMoreQuery]);

  const handleRefresh = useCallback(async () => {
    setOffset(0);
    setHasMore(true);
    await refetch();
  }, [refetch]);

  const handleSubscribePress = (title: string) => {
    setSelectedStrategyTitle(title);
    setShowSubscribeModal(true);
  };

  const handleStrategyPress = (id: number) => {
    router.push(`/strategy/${id}` as any);
  };

  const handleEntryPress = (entry: typeof QUICK_ENTRIES[0]) => {
    if (entry.type === "link") {
      Linking.openURL(entry.target);
    } else {
      router.push(entry.target as any);
    }
  };

  // ═══════════════════ 快捷入口 - 3列横排炫酷卡片 ═══════════════════
  const renderQuickEntries = () => (
    <View style={qeStyles.container}>
      {QUICK_ENTRIES.map((entry, i) => (
        <Animated.View
          key={entry.id}
          style={[
            qeStyles.entryWrap,
            { opacity: entryAnims[i], transform: [{ translateY: entrySlides[i] }] },
          ]}
        >
          <TouchableOpacity
            onPress={() => handleEntryPress(entry)}
            activeOpacity={0.85}
            style={qeStyles.entryTouchable}
          >
            {/* 外发光 */}
            <View style={[qeStyles.entryGlow, { backgroundColor: entry.accentColor + "12" }]} />
            <LinearGradient
              colors={entry.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={qeStyles.entryCard}
            >
              {/* 装饰光线 */}
              <View style={[qeStyles.entryShine, { backgroundColor: entry.accentColor + "08" }]} />
              {/* 图标 */}
              <View style={[qeStyles.iconWrap, { backgroundColor: entry.accentColor + "20", borderColor: entry.accentColor + "30" }]}>
                <Text style={qeStyles.entryIcon}>{entry.icon}</Text>
              </View>
              {/* 文字 */}
              <Text style={qeStyles.entryTitle}>{entry.title}</Text>
              <Text style={[qeStyles.entrySubtitle, { color: entry.accentColor + "CC" }]}>{entry.subtitle}</Text>
              {/* 箭头 */}
              <View style={[qeStyles.arrowWrap, { backgroundColor: entry.accentColor + "18" }]}>
                <Text style={[qeStyles.arrowText, { color: entry.accentColor }]}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );

  // ═══════════════════ 顶部 Hero 区域 ═══════════════════
  const renderHero = () => (
    <Animated.View style={[heroStyles.container, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}>
      <LinearGradient
        colors={["#0A0E1A", "#111827", "#0F172A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={heroStyles.gradient}
      >
        {/* 装饰元素 */}
        <View style={heroStyles.decorLine1} />
        <View style={heroStyles.decorLine2} />
        <View style={heroStyles.decorDot1} />
        <View style={heroStyles.decorDot2} />

        {/* 品牌标识 */}
        <View style={heroStyles.brandRow}>
          <View style={heroStyles.liveDot} />
          <Text style={heroStyles.brandText}>量化军火库</Text>
          <View style={heroStyles.brandDivider} />
          <Text style={heroStyles.brandSub}>QUANT ARSENAL</Text>
        </View>

        {/* 主标题 */}
        <Text style={heroStyles.title}>全网EA源头提货</Text>
        <Text style={heroStyles.tagline}>
          200+源码库 · 100%破解能力 · 独家调优
        </Text>

        {/* 数据指标 */}
        <View style={heroStyles.statsRow}>
          {[
            { num: "200+", label: "EA源码", color: "#FBBF24" },
            { num: "30+", label: "合作工作室", color: "#60A5FA" },
            { num: "50+", label: "独家版", color: "#34D399" },
          ].map((stat, i) => (
            <View key={i} style={heroStyles.statItem}>
              <Text style={[heroStyles.statNum, { color: stat.color }]}>{stat.num}</Text>
              <Text style={heroStyles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );

  // ═══════════════════ 筛选区域 ═══════════════════
  const renderFilters = () => (
    <View style={filterStyles.container}>
      {/* 标题行 */}
      <View style={filterStyles.titleRow}>
        <View style={filterStyles.titleLeft}>
          <View style={filterStyles.titleAccent} />
          <Text style={[filterStyles.titleText, { color: colors.foreground }]}>策略广场</Text>
        </View>
        <View style={filterStyles.titleRight}>
          <TouchableOpacity
            onPress={() => setShowContactModal(true)}
            style={filterStyles.uploadBtn}
            activeOpacity={0.8}
          >
            <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={filterStyles.uploadBtnInner}>
              <Text style={filterStyles.uploadBtnText}>+ 上架EA</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/search" as any)}
            style={[filterStyles.searchBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 平台 + 排序 */}
      <View style={filterStyles.filterRow}>
        {/* 平台筛选 */}
        <View style={filterStyles.filterGroup}>
          {[
            { label: "全部", value: undefined },
            { label: "MT4", value: "MT4" as PlatformFilter },
            { label: "MT5", value: "MT5" as PlatformFilter },
          ].map((item) => {
            const isActive = platformFilter === item.value;
            return (
              <TouchableOpacity
                key={item.label}
                onPress={() => setPlatformFilter(item.value)}
                style={[
                  filterStyles.filterChip,
                  isActive
                    ? { backgroundColor: "#D97706", borderColor: "#D97706" }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[filterStyles.filterChipText, { color: isActive ? "#fff" : colors.muted }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 分隔 */}
        <View style={[filterStyles.divider, { backgroundColor: colors.border }]} />

        {/* 排序 */}
        <View style={filterStyles.filterGroup}>
          {[
            { label: "热度", value: "hot" as OrderBy },
            { label: "最新", value: "latest" as OrderBy },
            { label: "收益率", value: "return" as OrderBy },
          ].map((item) => {
            const isActive = orderBy === item.value;
            return (
              <TouchableOpacity
                key={item.label}
                onPress={() => setOrderBy(item.value)}
                style={[
                  filterStyles.sortChip,
                  isActive && { borderBottomWidth: 2, borderBottomColor: "#D97706" },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[filterStyles.sortChipText, { color: isActive ? "#D97706" : colors.muted }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 标签筛选 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ paddingRight: 12 }}>
        {TAG_FILTERS.map((tag) => {
          const isActive = tagFilter === tag.value;
          return (
            <TouchableOpacity
              key={tag.value}
              onPress={() => setTagFilter(tag.value)}
              style={[
                filterStyles.tagChip,
                {
                  backgroundColor: isActive ? "#D9770615" : colors.surface,
                  borderColor: isActive ? "#D97706" : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[filterStyles.tagChipText, { color: isActive ? "#D97706" : colors.muted }]}>
                {tag.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ═══════════════════ 完整 Header ═══════════════════
  const renderHeader = () => (
    <View style={{ marginBottom: 8 }}>
      {renderHero()}
      {renderQuickEntries()}
      {renderFilters()}
    </View>
  );

  const renderEmpty = () => (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
      <Text style={{ fontSize: 56 }}>📊</Text>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginTop: 16 }}>暂无策略</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>策略广场正在上架中，敬请期待</Text>
      <TouchableOpacity onPress={() => setShowContactModal(true)} activeOpacity={0.8} style={{ marginTop: 24 }}>
        <LinearGradient colors={["#D97706", "#F59E0B"]} style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}>
          <Text style={{ color: "#0A0E1A", fontWeight: "700", fontSize: 14 }}>上架我的EA</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => (
    <View>
      {isLoadingMore && (
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#D97706" />
        </View>
      )}
      {!hasMore && allStrategies.length > 0 && (
        <View style={{ paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>已展示全部策略</Text>
        </View>
      )}
    </View>
  );

  if (isLoading && !initialData) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#D97706" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <SubscribeModal visible={showSubscribeModal} onClose={() => setShowSubscribeModal(false)} strategyTitle={selectedStrategyTitle} />
      <FlatList
        data={allStrategies}
        keyExtractor={(item) => item.id.toString()}
        key={numColumns}
        numColumns={numColumns}
        renderItem={({ item }) => (
          <StrategyCard
            id={item.id}
            title={item.title}
            platform={item.platform}
            totalReturn={item.totalReturn || "0.00"}
            winRate={item.winRate || "0.00"}
            price={item.price || "0.00"}
            originalPrice={item.originalPrice}
            isFree={item.isFree}
            downloadCount={item.downloadCount}
            virtualDownloads={item.virtualDownloads || 0}
            coverImage={item.coverImage}
            pairs={item.pairs}
            viewCount={item.viewCount}
            createdAt={item.createdAt}
            tags={item.tags}
            productType={item.productType}
            isFeatured={item.isFeatured}
            featuredLink={item.featuredLink}
            onPress={() => handleStrategyPress(item.id)}
            onSubscribePress={() => handleSubscribePress(item.title)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        columnWrapperStyle={{ justifyContent: "flex-start" }}
        contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#D97706" />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </ScreenContainer>
  );
}

// ═══════════════════ Hero 样式 ═══════════════════
const heroStyles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  gradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  decorLine1: {
    position: "absolute",
    top: 0,
    right: 40,
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  decorLine2: {
    position: "absolute",
    top: 0,
    right: 100,
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  decorDot1: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(251,191,36,0.4)",
  },
  decorDot2: {
    position: "absolute",
    bottom: 20,
    right: 60,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(96,165,250,0.3)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  brandText: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  brandDivider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 10,
  },
  brandSub: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
  },
  title: {
    color: "#F1F5F9",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 6,
  },
  tagline: {
    color: "rgba(251,191,36,0.85)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 0,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginHorizontal: 3,
  },
  statNum: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
});

// ═══════════════════ 快捷入口样式 - 3列横排 ═══════════════════
const qeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  entryWrap: {
    flex: 1,
  },
  entryTouchable: {
    position: "relative",
  },
  entryGlow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: -2,
    borderRadius: 16,
  },
  entryCard: {
    borderRadius: 14,
    padding: 12,
    minHeight: 110,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  entryShine: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 8,
  },
  entryIcon: {
    fontSize: 18,
  },
  entryTitle: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  entrySubtitle: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  arrowWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  arrowText: {
    fontSize: 12,
    fontWeight: "700",
  },
});

// ═══════════════════ 筛选区样式 ═══════════════════
const filterStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleAccent: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#D97706",
    marginRight: 8,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  titleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadBtn: {
    borderRadius: 20,
    overflow: "hidden",
  },
  uploadBtnInner: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  uploadBtnText: {
    color: "#0A0E1A",
    fontSize: 12,
    fontWeight: "700",
  },
  searchBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  filterGroup: {
    flexDirection: "row",
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: 16,
    marginHorizontal: 10,
  },
  sortChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
