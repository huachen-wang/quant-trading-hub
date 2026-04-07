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

// ─── 快捷入口（文字已修改） ───
const QUICK_ENTRIES = [
  {
    id: "cooperation",
    title: "工作室扶持合作",
    subtitle: "深度扶持 · 源头直供",
    icon: "🤝",
    gradient: ["#0F172A", "#1E3A8A", "#2563EB"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/cooperation",
    accentColor: "#60A5FA",
    glowColor: "rgba(96,165,250,0.15)",
  },
  {
    id: "promo",
    title: "EA限时促销",
    subtitle: "源头价 · 限时特惠",
    icon: "⚡",
    gradient: ["#1A0000", "#7F1D1D", "#DC2626"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/promo",
    accentColor: "#F87171",
    glowColor: "rgba(248,113,113,0.15)",
  },
  {
    id: "ddxau",
    title: "订单流独家策略",
    subtitle: "四维共振 · 独家研发",
    icon: "🏆",
    gradient: ["#1A0E00", "#78350F", "#D97706"] as readonly [string, string, ...string[]],
    type: "link" as const,
    target: "https://ddxau.com",
    accentColor: "#FBBF24",
    glowColor: "rgba(251,191,36,0.15)",
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
  const entryAnims = useRef(QUICK_ENTRIES.map(() => new Animated.Value(0))).current;
  const entrySlides = useRef(QUICK_ENTRIES.map(() => new Animated.Value(30))).current;
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
    // 入口卡片依次入场
    QUICK_ENTRIES.forEach((_, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(entryAnims[i], { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
          Animated.spring(entrySlides[i], { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        ]).start();
      }, 300 + i * 150);
    });
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

  const handleEntryPress = (entry: typeof QUICK_ENTRIES[0]) => {
    if (entry.type === "link") {
      Linking.openURL(entry.target);
    } else {
      router.push(entry.target as any);
    }
  };

  // ═══════════════════ 炫酷 Hero 区域 ═══════════════════
  const renderHero = () => (
    <Animated.View style={[heroStyles.container, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}>
      <LinearGradient
        colors={["#050810", "#0A0E1A", "#0D1525", "#0A0E1A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={heroStyles.gradient}
      >
        {/* ─── 装饰网格线 ─── */}
        {[...Array(5)].map((_, i) => (
          <View key={`vl${i}`} style={[heroStyles.gridLineV, { right: 30 + i * 60, opacity: 0.03 - i * 0.004 }]} />
        ))}
        {[...Array(3)].map((_, i) => (
          <View key={`hl${i}`} style={[heroStyles.gridLineH, { top: 20 + i * 40, opacity: 0.03 - i * 0.005 }]} />
        ))}

        {/* ─── 脉冲光环 ─── */}
        <Animated.View style={[heroStyles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />

        {/* ─── 装饰粒子 ─── */}
        <View style={[heroStyles.particle, { top: 15, right: 25, width: 3, height: 3, backgroundColor: "rgba(251,191,36,0.5)" }]} />
        <View style={[heroStyles.particle, { top: 45, right: 80, width: 2, height: 2, backgroundColor: "rgba(96,165,250,0.4)" }]} />
        <View style={[heroStyles.particle, { bottom: 30, right: 40, width: 2, height: 2, backgroundColor: "rgba(52,211,153,0.4)" }]} />
        <View style={[heroStyles.particle, { top: 60, right: 140, width: 2, height: 2, backgroundColor: "rgba(251,191,36,0.3)" }]} />
        <View style={[heroStyles.particle, { bottom: 50, left: 30, width: 2, height: 2, backgroundColor: "rgba(248,113,113,0.3)" }]} />

        {/* ─── 品牌标识 ─── */}
        <View style={heroStyles.brandRow}>
          <View style={heroStyles.liveDotOuter}>
            <View style={heroStyles.liveDot} />
          </View>
          <Text style={heroStyles.brandText}>量化军火库</Text>
          <View style={heroStyles.brandDivider} />
          <Text style={heroStyles.brandSub}>eaxau.com</Text>
        </View>

        {/* ─── 主标题 ─── */}
        <Text style={heroStyles.title}>全网EA源头提货</Text>
        <Text style={heroStyles.tagline}>
          200+源码库 · 100%破解能力 · 独家调优
        </Text>

        {/* ─── 数据指标（带计数动画） ─── */}
        <View style={heroStyles.statsRow}>
          {[
            { num: `${displayCount.ea}+`, label: "EA源码", color: "#FBBF24", bgColor: "rgba(251,191,36,0.08)" },
            { num: `${displayCount.studio}+`, label: "合作工作室", color: "#60A5FA", bgColor: "rgba(96,165,250,0.08)" },
            { num: `${displayCount.exclusive}+`, label: "独家版", color: "#34D399", bgColor: "rgba(52,211,153,0.08)" },
          ].map((stat, i) => (
            <View key={i} style={[heroStyles.statItem, { backgroundColor: stat.bgColor }]}>
              <Text style={[heroStyles.statNum, { color: stat.color }]}>{stat.num}</Text>
              <Text style={heroStyles.statLabel}>{stat.label}</Text>
              {/* 底部强调线 */}
              <View style={[heroStyles.statAccent, { backgroundColor: stat.color + "30" }]} />
            </View>
          ))}
        </View>

        {/* ─── 底部装饰渐变线 ─── */}
        <LinearGradient
          colors={["transparent", "rgba(251,191,36,0.15)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={heroStyles.bottomLine}
        />
      </LinearGradient>
    </Animated.View>
  );

  // ═══════════════════ 快捷入口 ═══════════════════
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
            <View style={[qeStyles.entryGlow, { backgroundColor: entry.glowColor }]} />
            <LinearGradient
              colors={entry.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={qeStyles.entryCard}
            >
              {/* 装饰光线 */}
              <View style={[qeStyles.entryShine, { backgroundColor: entry.accentColor + "10" }]} />
              {/* 角落装饰 */}
              <View style={[qeStyles.cornerDecor, { borderColor: entry.accentColor + "20" }]} />
              {/* 图标 */}
              <View style={[qeStyles.iconWrap, { backgroundColor: entry.accentColor + "20", borderColor: entry.accentColor + "30" }]}>
                <Text style={qeStyles.entryIcon}>{entry.icon}</Text>
              </View>
              {/* 文字 */}
              <Text style={qeStyles.entryTitle} numberOfLines={1}>{entry.title}</Text>
              <Text style={[qeStyles.entrySubtitle, { color: entry.accentColor + "BB" }]} numberOfLines={1}>{entry.subtitle}</Text>
              {/* 箭头 */}
              <View style={[qeStyles.arrowWrap, { backgroundColor: entry.accentColor + "18", borderColor: entry.accentColor + "25" }]}>
                <Text style={[qeStyles.arrowText, { color: entry.accentColor }]}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
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

      {/* 标签筛选（动态提取，无标签时不显示） */}
      {dynamicTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ paddingRight: 12 }}>
          {/* “全部”按钮 */}
          <TouchableOpacity
            onPress={() => setTagFilter("")}
            style={[
              filterStyles.tagChip,
              {
                backgroundColor: tagFilter === "" ? "#D9770615" : colors.surface,
                borderColor: tagFilter === "" ? "#D97706" : colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[filterStyles.tagChipText, { color: tagFilter === "" ? "#D97706" : colors.muted }]}>全部</Text>
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
      )}
    </View>
  );

  // ═══════════════════ 完整 Header ═══════════════════
  // ═══════════════════ 定制EA横幅 ═══════════════════
  const renderCustomEABanner = () => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setShowContactModal(true)}
      style={customBannerStyles.outer}
    >
      <LinearGradient
        colors={["#0F172A", "#1E1B4B", "#312E81"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={customBannerStyles.container}
      >
        {/* 装饰元素 */}
        <View style={customBannerStyles.glowOrb} />
        <View style={customBannerStyles.glowOrb2} />
        <View style={customBannerStyles.gridLine1} />
        <View style={customBannerStyles.gridLine2} />

        {/* 左侧图标 */}
        <View style={customBannerStyles.iconWrap}>
          <LinearGradient colors={["#D97706", "#F59E0B"]} style={customBannerStyles.iconGradient}>
            <Text style={{ fontSize: 18 }}>🛠️</Text>
          </LinearGradient>
        </View>

        {/* 右侧内容 */}
        <View style={customBannerStyles.content}>
          <View style={customBannerStyles.tagRow}>
            <View style={customBannerStyles.tag}>
              <Text style={customBannerStyles.tagText}>核心服务</Text>
            </View>
            <View style={customBannerStyles.tagHot}>
              <Text style={customBannerStyles.tagHotText}>热门</Text>
            </View>
          </View>
          <Text style={customBannerStyles.title}>军火库 · 专属EA定制</Text>
          <Text style={customBannerStyles.desc} numberOfLines={2}>
            源头低价拿货 · 无限授权 · 专属品牌定制
          </Text>
        </View>

        {/* 右侧箭头 */}
        <View style={customBannerStyles.arrow}>
          <Text style={{ color: "#D97706", fontSize: 18, fontWeight: "900" }}>›</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={{ marginBottom: 4 }}>
      {renderHero()}
      {renderQuickEntries()}
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
      {/* 底部常驻快捷导航 */}
      <QuickNav />
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
    marginBottom: 6,
  },
  gradient: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  // 网格线
  gridLineV: {
    position: "absolute",
    top: 0,
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255,255,255,1)",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,1)",
  },
  // 脉冲光环
  pulseRing: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.06)",
    backgroundColor: "rgba(251,191,36,0.02)",
  },
  // 粒子
  particle: {
    position: "absolute",
    borderRadius: 10,
  },
  // 品牌
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  liveDotOuter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(16,185,129,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  brandText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  brandDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 10,
  },
  brandSub: {
    color: "rgba(251,191,36,0.7)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // 标题
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  tagline: {
    color: "rgba(251,191,36,0.85)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  // 数据
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    position: "relative",
    overflow: "hidden",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
  statAccent: {
    position: "absolute",
    bottom: 0,
    left: "20%",
    right: "20%",
    height: 2,
    borderRadius: 1,
  },
  // 底部装饰线
  bottomLine: {
    position: "absolute",
    bottom: 0,
    left: 20,
    right: 20,
    height: 1,
  },
});

// ═══════════════════ 快捷入口样式 ═══════════════════
const qeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 8,
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
    bottom: -3,
    borderRadius: 18,
  },
  entryCard: {
    borderRadius: 14,
    padding: 10,
    height: 110,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  entryShine: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cornerDecor: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderTopRightRadius: 4,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },
  entryIcon: {
    fontSize: 15,
  },
  entryTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  entrySubtitle: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  arrowWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    borderWidth: 1,
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

// ═══════════════════ 定制EA横幅样式 ═══════════════════
const customBannerStyles = StyleSheet.create({
  outer: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    position: "relative",
    overflow: "hidden",
  },
  // 装饰元素
  glowOrb: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  glowOrb2: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(217,119,6,0.06)",
  },
  gridLine1: {
    position: "absolute",
    top: 0,
    left: "30%",
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  gridLine2: {
    position: "absolute",
    top: "50%",
    left: 0,
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  // 图标
  iconWrap: {
    marginRight: 14,
  },
  iconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  // 内容
  content: {
    flex: 1,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  tag: {
    backgroundColor: "rgba(139,92,246,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  tagText: {
    color: "#A78BFA",
    fontSize: 10,
    fontWeight: "700",
  },
  tagHot: {
    backgroundColor: "rgba(239,68,68,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  tagHotText: {
    color: "#F87171",
    fontSize: 10,
    fontWeight: "700",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  desc: {
    color: "#E2E8F0",
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 4,
  },
  features: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  featureDot: {
    color: "#D97706",
    fontSize: 6,
  },
  featureText: {
    color: "#CBD5E1",
    fontSize: 10,
    fontWeight: "600",
  },
  // 箭头
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(217,119,6,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
});
