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

// 标签筛选选项
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

  // 分页状态
  const [allStrategies, setAllStrategies] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Banner 自动轮播
  const bannerScrollRef = useRef<ScrollView>(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const screenWidth = Dimensions.get("window").width;
  const bannerWidth = Math.min(screenWidth - 24, 800); // 减去 padding

  const banners = [
    {
      id: "ddxau",
      title: "点金 DDXAU",
      subtitle: "四维共振 × 订单流 × AI量化",
      description: "$280,000+ 实盘验证，4年+ 稳定盈利",
      gradient: ["#92400E", "#D97706", "#FCD34D"] as readonly [string, string, ...string[]],
      emoji: "🏆",
      link: "https://ddxau.com",
    },
    {
      id: "cooperation",
      title: "工作室合作",
      subtitle: "策略观摩 · 工作室扶持 · 定制服务",
      description: "全方位合作方案，助力工作室快速起步",
      gradient: ["#1E40AF", "#3B82F6", "#93C5FD"] as readonly [string, string, ...string[]],
      emoji: "🤝",
      link: "",
      route: "/cooperation",
    },
    {
      id: "promo",
      title: "限时特惠",
      subtitle: "EA跳蚤市场 · 低价抢购",
      description: "精选EA策略限时折扣，先到先得",
      gradient: ["#7C2D12", "#DC2626", "#FCA5A5"] as readonly [string, string, ...string[]],
      emoji: "⚡",
      link: "",
      route: "/promo",
    },
    {
      id: "groupbuy",
      title: "EA合购专区",
      subtitle: "拼团购买，低价获取正版EA",
      description: "多人合购，人均低至原价1/10",
      gradient: ["#065F46", "#10B981", "#6EE7B7"] as readonly [string, string, ...string[]],
      emoji: "🛒",
      link: "",
      route: "/group-buy",
    },
  ];

  // Banner 自动轮播
  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex((prev) => {
        const next = (prev + 1) % banners.length;
        bannerScrollRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [bannerWidth]);

  // Header入场动画
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // 首次加载
  const { data: initialData, isLoading, refetch, isRefetching } = trpc.strategies.list.useQuery({
    platform: platformFilter,
    orderBy,
    tag: tagFilter || undefined,
    limit: PAGE_SIZE,
    offset: 0,
  });

  // 当筛选条件或首次数据变化时，重置分页状态
  useEffect(() => {
    if (initialData) {
      setAllStrategies(initialData);
      setOffset(initialData.length);
      setHasMore(initialData.length >= PAGE_SIZE);
    }
  }, [initialData]);

  // 加载更多的 query（手动触发）
  const loadMoreQuery = trpc.strategies.list.useQuery(
    {
      platform: platformFilter,
      orderBy,
      tag: tagFilter || undefined,
      limit: PAGE_SIZE,
      offset: offset,
    },
    {
      enabled: false, // 不自动执行，手动调用 refetch
    }
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) return;

    setIsLoadingMore(true);
    try {
      const result = await loadMoreQuery.refetch();
      if (result.data && result.data.length > 0) {
        setAllStrategies((prev) => {
          // 去重：防止并发请求导致重复数据
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

  // 下拉刷新时重置分页
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

  const handleBannerPress = (banner: typeof banners[0]) => {
    if (banner.link) {
      Linking.openURL(banner.link);
    } else if (banner.route) {
      router.push(banner.route as any);
    }
  };

  const renderBanner = () => (
    <View style={bannerStyles.container}>
      <ScrollView
        ref={bannerScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / bannerWidth);
          setBannerIndex(idx);
        }}
        style={{ width: bannerWidth }}
      >
        {banners.map((banner) => (
          <TouchableOpacity
            key={banner.id}
            onPress={() => handleBannerPress(banner)}
            activeOpacity={0.9}
            style={{ width: bannerWidth }}
          >
            <LinearGradient
              colors={banner.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={bannerStyles.bannerCard}
            >
              <View style={bannerStyles.bannerContent}>
                <View style={bannerStyles.bannerTextArea}>
                  <Text style={bannerStyles.bannerTitle}>{banner.title}</Text>
                  <Text style={bannerStyles.bannerSubtitle}>{banner.subtitle}</Text>
                  <Text style={bannerStyles.bannerDesc}>{banner.description}</Text>
                  {banner.link ? (
                    <View style={bannerStyles.bannerCta}>
                      <Text style={bannerStyles.bannerCtaText}>立即了解 →</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={bannerStyles.bannerEmoji}>{banner.emoji}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* 指示器 */}
      <View style={bannerStyles.indicatorRow}>
        {banners.map((_, i) => (
          <View
            key={i}
            style={[
              bannerStyles.indicator,
              {
                backgroundColor: i === bannerIndex ? colors.primary : colors.muted + "40",
                width: i === bannerIndex ? 20 : 6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderHeader = () => (
    <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }} className="mb-3">
      {/* Banner 轮播 */}
      {renderBanner()}

      {/* 标题栏 */}
      <View className="flex-row items-center justify-between mb-3 mt-4">
        <Text className="text-3xl font-bold text-foreground">📊 策略广场</Text>
        <View className="flex-row">
          <TouchableOpacity
            onPress={() => setShowContactModal(true)}
            className="mr-2 px-4 py-2 bg-primary rounded-full flex-row items-center"
            activeOpacity={0.8}
          >
            <IconSymbol name="paperplane.fill" size={16} color={colors.background} />
            <Text className="text-background font-semibold text-sm ml-1">上架EA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/search" as any)}
            className="w-10 h-10 items-center justify-center rounded-full bg-surface"
            activeOpacity={0.7}
          >
            <IconSymbol name="magnifyingglass" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 平台 + 排序筛选 */}
      <View className="flex-row flex-wrap">
        <TouchableOpacity
          onPress={() => setPlatformFilter(undefined)}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${!platformFilter ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm font-medium ${!platformFilter ? "text-background" : "text-foreground"}`}>全部</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPlatformFilter("MT4")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${platformFilter === "MT4" ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm font-medium ${platformFilter === "MT4" ? "text-background" : "text-foreground"}`}>MT4</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPlatformFilter("MT5")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${platformFilter === "MT5" ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm font-medium ${platformFilter === "MT5" ? "text-background" : "text-foreground"}`}>MT5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("latest")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${orderBy === "latest" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "latest" ? "text-primary font-semibold" : "text-muted"}`}>最新</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("return")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${orderBy === "return" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "return" ? "text-primary font-semibold" : "text-muted"}`}>收益率</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("hot")}
          className={`px-3 py-1.5 rounded-full mb-2 ${orderBy === "hot" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "hot" ? "text-primary font-semibold" : "text-muted"}`}>热度</Text>
        </TouchableOpacity>
      </View>

      {/* 标签筛选行 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 8 }}
        contentContainerStyle={{ paddingRight: 12 }}
      >
        {TAG_FILTERS.map((tag) => (
          <TouchableOpacity
            key={tag.value}
            onPress={() => setTagFilter(tag.value)}
            style={[
              tagStyles.chip,
              {
                backgroundColor: tagFilter === tag.value ? colors.primary + "20" : colors.surface,
                borderColor: tagFilter === tag.value ? colors.primary : colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                tagStyles.chipText,
                { color: tagFilter === tag.value ? colors.primary : colors.muted },
              ]}
            >
              {tag.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderEmpty = () => (
    <View className="items-center justify-center py-16">
      <Text style={{ fontSize: 56 }}>📊</Text>
      <Text className="text-foreground text-lg font-bold mt-4">暂无策略</Text>
      <Text className="text-muted text-sm mt-2">策略广场正在上架中，敬请期待</Text>
      <TouchableOpacity
        onPress={() => setShowContactModal(true)}
        className="mt-6 bg-primary px-6 py-3 rounded-full"
        activeOpacity={0.8}
      >
        <Text className="text-background font-semibold">上架我的EA</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    return (
      <View>
        {isLoadingMore && (
          <View style={{ paddingVertical: 16, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        {!hasMore && allStrategies.length > 0 && (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>已展示全部策略</Text>
          </View>
        )}
        {/* 合作引导横幅 - 策略列表底部 */}
        {allStrategies.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/moments" as any)}
            activeOpacity={0.85}
            style={footerStyles.bannerWrapper}
          >
            <LinearGradient
              colors={[colors.primary + "12", colors.primary + "06"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[footerStyles.banner, { borderColor: colors.primary + "20" }]}
            >
              <View style={footerStyles.bannerContent}>
                <Text style={footerStyles.bannerEmoji}>🎯</Text>
                <View style={footerStyles.bannerTextBox}>
                  <Text style={[footerStyles.bannerTitle, { color: colors.foreground }]}>选好策略，还差一步</Text>
                  <Text style={[footerStyles.bannerDesc, { color: colors.muted }]}>
                    量化军火库帮你匹配合规交易环境，让好策略发挥最大价值
                  </Text>
                </View>
                <Text style={[footerStyles.bannerArrow, { color: colors.primary }]}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (isLoading && !initialData) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <SubscribeModal
        visible={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        strategyTitle={selectedStrategyTitle}
      />
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
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.primary} />}
        // 分页加载
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        // FlatList 虚拟化优化
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </ScreenContainer>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  bannerCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 0,
    minHeight: 130,
    justifyContent: "center",
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerTextArea: {
    flex: 1,
    paddingRight: 16,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  bannerDesc: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    lineHeight: 17,
  },
  bannerCta: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  bannerCtaText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  bannerEmoji: {
    fontSize: 52,
  },
  indicatorRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    gap: 4,
  },
  indicator: {
    height: 4,
    borderRadius: 2,
  },
});

const tagStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

const footerStyles = StyleSheet.create({
  bannerWrapper: {
    marginTop: 8,
    marginBottom: 8,
  },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannerEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  bannerTextBox: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  bannerDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  bannerArrow: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
});
