import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Animated, StyleSheet, Linking, Platform, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { ContactModal } from "@/components/contact-modal";
import { SubscribeModal } from "@/components/subscribe-modal";
import { QuickNav } from "@/components/quick-nav";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

type PlatformFilter = "MT4" | "MT5" | undefined;
type OrderBy = "latest" | "return" | "hot";

const PAGE_SIZE = 12;
const { width: SW } = Dimensions.get("window");

// 标签从策略数据中自动提取，无需手动维护


export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(undefined);
  const [orderBy, setOrderBy] = useState<OrderBy>("hot");
  const [tagFilter, setTagFilter] = useState("");
  const [saleModeFilter, setSaleModeFilter] = useState<"all" | "direct" | "inquiry">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 是否有任何筛选生效（用于显示"清空全部"和面包屑）
  const hasAnyFilter = !!platformFilter || saleModeFilter !== "all" || !!categoryFilter || !!tagFilter || orderBy !== "hot";
  const clearAllFilters = () => {
    setPlatformFilter(undefined);
    setSaleModeFilter("all");
    setCategoryFilter(undefined);
    setTagFilter("");
    setOrderBy("hot");
  };
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedStrategyTitle, setSelectedStrategyTitle] = useState("");

  const [allStrategies, setAllStrategies] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 动态提取标签：从已加载的策略数据中自动生成筛选项（使用 useMemo 避免每次渲染重新计算）
  const dynamicTags = useMemo(() => {
    const tagCountMap = new Map<string, number>();
    allStrategies.forEach((s) => {
      if (s.tags) {
        s.tags.split(",").map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => {
          tagCountMap.set(t, (tagCountMap.get(t) || 0) + 1);
        });
      }
    });
    // 按出现次数排序，取前10个
    return Array.from(tagCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => ({ label: tag, value: tag }));
  }, [allStrategies]);

  // ─── 动画 ───
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;
  // 脉冲动画
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // 数据计数动画
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayCount, setDisplayCount] = useState({ ea: 0, studio: 0, exclusive: 0 });

  useEffect(() => {
    // Hero 动画
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
    // 脉冲光环
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    // 数字递增动画
    Animated.timing(countAnim, { toValue: 1, duration: 1500, useNativeDriver: false }).start();
    const listener = countAnim.addListener(({ value }) => {
      setDisplayCount({
        ea: Math.round(200 * value),
        studio: Math.round(30 * value),
        exclusive: Math.round(50 * value),
      });
    });
    return () => countAnim.removeListener(listener);
  }, []);

  const { data: categoriesData } = trpc.categories.list.useQuery();
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
    } catch {
      // Load more failed silently
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

  // ═══════════════════ Hero（极简版）═══════════════════
  const renderHero = () => (
    <Animated.View
      style={[
        heroStyles.container,
        { opacity: heroFade, transform: [{ translateY: heroSlide }] },
      ]}
    >
      {/* 主标题 */}
      <Text style={heroStyles.title}>全网 EA 源头提货</Text>

      {/* 副标题 + 数字 一行胶囊（合并） */}
      <View style={heroStyles.metaRow}>
        <Text style={heroStyles.tagline}>实盘可查 · 独家调优</Text>
        <View style={heroStyles.statDot} />
        <View style={heroStyles.statChip}>
          <Text style={heroStyles.statNumGold}>{displayCount.ea}+</Text>
          <Text style={heroStyles.statLabel}> EA</Text>
        </View>
        <View style={heroStyles.statDot} />
        <View style={heroStyles.statChip}>
          <Text style={heroStyles.statNumBlue}>{displayCount.studio}+</Text>
          <Text style={heroStyles.statLabel}> 工作室</Text>
        </View>
        <View style={heroStyles.statDot} />
        <View style={heroStyles.statChip}>
          <Text style={heroStyles.statNumGreen}>{displayCount.exclusive}+</Text>
          <Text style={heroStyles.statLabel}> 独家</Text>
        </View>
      </View>
    </Animated.View>
  );

  // ═══════════════════ 筛选区域 ═══════════════════
  // 已选中的筛选标签（面包屑）
  const activeFilterChips = (() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (platformFilter) chips.push({ label: platformFilter, clear: () => setPlatformFilter(undefined) });
    if (saleModeFilter === "direct") chips.push({ label: "💰 直购", clear: () => setSaleModeFilter("all") });
    if (saleModeFilter === "inquiry") chips.push({ label: "🤝 商务授权", clear: () => setSaleModeFilter("all") });
    if (categoryFilter) {
      const cat = (categoriesData || []).find((c: any) => c.slug === categoryFilter);
      if (cat) chips.push({ label: `${cat.icon || ""}${cat.name}`.trim(), clear: () => setCategoryFilter(undefined) });
    }
    if (tagFilter) {
      const tag = dynamicTags.find((t: any) => t.value === tagFilter);
      chips.push({ label: tag?.label || tagFilter, clear: () => setTagFilter("") });
    }
    if (orderBy !== "hot") {
      chips.push({ label: orderBy === "latest" ? "最新" : "收益率", clear: () => setOrderBy("hot") });
    }
    return chips;
  })();

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
            <LinearGradient colors={["#A8895A", "#C9A96E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={filterStyles.uploadBtnInner}>
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

      {/* 行 1：平台 + 排序（最常用，常驻）*/}
      <View style={filterStyles.filterRow}>
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
                    ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[filterStyles.filterChipText, { color: isActive ? "#0A1628" : colors.muted }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[filterStyles.divider, { backgroundColor: colors.border }]} />

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
                  isActive && { borderBottomWidth: 2, borderBottomColor: "#C9A96E" },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[filterStyles.sortChipText, { color: isActive ? "#C9A96E" : colors.muted }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 行 2：销售模式 + 高级筛选按钮 */}
      <View style={[filterStyles.filterRow, { marginTop: 8, justifyContent: "space-between" }]}>
        <View style={filterStyles.filterGroup}>
          {([
            { label: "全部", value: "all" },
            { label: "💰 直购", value: "direct" },
            { label: "🤝 商务授权", value: "inquiry" },
          ] as const).map((item) => {
            const isActive = saleModeFilter === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => setSaleModeFilter(item.value)}
                style={[
                  filterStyles.filterChip,
                  isActive
                    ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[filterStyles.filterChipText, { color: isActive ? "#0A1628" : colors.muted }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 高级筛选切换 */}
        <TouchableOpacity
          onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
          style={[
            filterStyles.advancedToggle,
            showAdvancedFilters
              ? { backgroundColor: "rgba(201,169,110,0.12)", borderColor: "#C9A96E" }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <Text style={[filterStyles.advancedToggleText, { color: showAdvancedFilters ? "#C9A96E" : colors.muted }]}>
            {showAdvancedFilters ? "▲ 收起" : "▾ 筛选"}
          </Text>
          {(categoryFilter || tagFilter) && !showAdvancedFilters && (
            <View style={filterStyles.advancedDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* 行 3（条件）：已选筛选面包屑 + 清空按钮 */}
      {hasAnyFilter && (
        <View style={[filterStyles.filterRow, { marginTop: 10, alignItems: "center", flexWrap: "wrap" }]}>
          <Text style={[filterStyles.activeLabel, { color: colors.muted }]}>已选：</Text>
          {activeFilterChips.map((chip, i) => (
            <TouchableOpacity
              key={i}
              onPress={chip.clear}
              style={filterStyles.activeChip}
              activeOpacity={0.7}
            >
              <Text style={filterStyles.activeChipText}>{chip.label}</Text>
              <Text style={filterStyles.activeChipX}>✕</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={clearAllFilters}
            style={filterStyles.clearAllBtn}
            activeOpacity={0.7}
          >
            <Text style={filterStyles.clearAllText}>清空全部</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 折叠抽屉：高级筛选（分类 + 标签）*/}
      {showAdvancedFilters && (
        <View style={[filterStyles.advancedPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* 分类 */}
          {(categoriesData || []).length > 0 && (
            <>
              <Text style={[filterStyles.advancedSectionTitle, { color: colors.muted }]}>分类</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4, gap: 6 }}>
                <TouchableOpacity onPress={() => setCategoryFilter(undefined)} style={[filterStyles.filterChip, !categoryFilter ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" } : { backgroundColor: colors.background, borderColor: colors.border }]} activeOpacity={0.7}>
                  <Text style={[filterStyles.filterChipText, { color: !categoryFilter ? "#0A1628" : colors.muted }]}>全部分类</Text>
                </TouchableOpacity>
                {(categoriesData || []).filter((c: any) => c.parentId === null).map((c: any) => {
                  const isActive = categoryFilter === c.slug;
                  return (
                    <TouchableOpacity key={c.slug} onPress={() => setCategoryFilter(c.slug)} style={[filterStyles.filterChip, isActive ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" } : { backgroundColor: colors.background, borderColor: colors.border }]} activeOpacity={0.7}>
                      <Text style={[filterStyles.filterChipText, { color: isActive ? "#0A1628" : colors.muted }]}>{c.icon ? `${c.icon} ` : ""}{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* 标签 */}
          {dynamicTags.length > 0 && (
            <>
              <Text style={[filterStyles.advancedSectionTitle, { color: colors.muted, marginTop: 14 }]}>标签</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setTagFilter("")}
                  style={[
                    filterStyles.tagChip,
                    {
                      backgroundColor: tagFilter === "" ? "rgba(201,169,110,0.12)" : colors.background,
                      borderColor: tagFilter === "" ? "#C9A96E" : colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[filterStyles.tagChipText, { color: tagFilter === "" ? "#C9A96E" : colors.muted }]}>全部</Text>
                </TouchableOpacity>
                {dynamicTags.map((tag) => {
                  const isActive = tagFilter === tag.value;
                  return (
                    <TouchableOpacity
                      key={tag.value}
                      onPress={() => setTagFilter(tag.value)}
                      style={[
                        filterStyles.tagChip,
                        {
                          backgroundColor: isActive ? "rgba(201,169,110,0.12)" : colors.background,
                          borderColor: isActive ? "#C9A96E" : colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={[filterStyles.tagChipText, { color: isActive ? "#C9A96E" : colors.muted }]}>
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      )}
    </View>
  );

  // ═══════════════════ 完整 Header ═══════════════════
  // ═══════════════════ EA 破解网入口 ═══════════════════
  const renderCustomEABanner = () => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setShowContactModal(true)}
      style={crackBannerStyles.outer}
    >
      <View style={crackBannerStyles.container}>
        {/* emoji 裸图标，不加框 */}
        <Text style={crackBannerStyles.icon}>🔓</Text>

        {/* 中间内容 */}
        <View style={crackBannerStyles.content}>
          <Text style={crackBannerStyles.title}>EA 破解网 · 专属 EA 破解</Text>
          <Text style={crackBannerStyles.desc}>联系定制 · 专业团队</Text>
        </View>

        <Text style={crackBannerStyles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={{ marginBottom: 4 }}>
      {renderHero()}
      {renderCustomEABanner()}
      {renderFilters()}
    </View>
  );

  const renderEmpty = () => (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
      <Text style={{ fontSize: 56 }}>📊</Text>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginTop: 16 }}>暂无策略</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>策略广场正在上架中，敬请期待</Text>
      <TouchableOpacity onPress={() => setShowContactModal(true)} activeOpacity={0.8} style={{ marginTop: 24 }}>
        <LinearGradient colors={["#A8895A", "#C9A96E"]} style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}>
          <Text style={{ color: "#0A0E1A", fontWeight: "700", fontSize: 14 }}>上架我的EA</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => (
    <View>
      {isLoadingMore && (
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#A8895A" />
        </View>
      )}
      {!hasMore && allStrategies.length > 0 && (
        <View style={{ paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>已展示全部策略</Text>
        </View>
      )}
      {/* 底部常驻快捷导航 */}
      <QuickNav />
    </View>
  );

  if (isLoading && !initialData) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#A8895A" />
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#A8895A" />}
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

// ═══════════════════ Hero 样式（极简）═══════════════════
const heroStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 22,
  },
  title: {
    color: "#F4F6FB",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.5,
    lineHeight: 36,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 12,
  },
  tagline: {
    color: "#A8B3C7",
    fontSize: 12,
    fontWeight: "500",
    marginRight: 4,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(168,179,199,0.4)",
    marginHorizontal: 6,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statNumGold: {
    color: "#C9A96E",
    fontSize: 13,
    fontWeight: "700",
  },
  statNumBlue: {
    color: "#60A5FA",
    fontSize: 13,
    fontWeight: "700",
  },
  statNumGreen: {
    color: "#34D399",
    fontSize: 13,
    fontWeight: "700",
  },
  statLabel: {
    color: "#A8B3C7",
    fontSize: 12,
    fontWeight: "500",
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
    marginBottom: 6,
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleAccent: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#A8895A",
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

  // ===== v2 新增：高级筛选切换按钮 =====
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  advancedToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  advancedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C9A96E",
    marginLeft: 6,
  },

  // ===== v2 新增：已选面包屑 =====
  activeLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 8,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(201,169,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(201,169,110,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 4,
  },
  activeChipText: {
    color: "#C9A96E",
    fontSize: 11,
    fontWeight: "600",
  },
  activeChipX: {
    color: "#C9A96E",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  clearAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 4,
  },
  clearAllText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // ===== v2 新增：折叠抽屉面板 =====
  advancedPanel: {
    marginTop: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  advancedSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
});

// ═══════════════════ EA 破解网入口样式（古金、无框）═══════════════════
const crackBannerStyles = StyleSheet.create({
  outer: {
    marginHorizontal: 14,
    marginBottom: 12,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "rgba(201,169,110,0.05)",
    borderWidth: 1,
    borderColor: "rgba(201,169,110,0.28)",
  },
  icon: {
    fontSize: 28,
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    color: "#F4F6FB",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 19,
  },
  desc: {
    color: "#A8B3C7",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 13,
  },
  arrow: {
    color: "#C9A96E",
    fontSize: 22,
    fontWeight: "900",
    marginLeft: 8,
  },
});
