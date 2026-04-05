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
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

type PlatformFilter = "MT4" | "MT5" | undefined;
type OrderBy = "latest" | "return" | "hot";

const PAGE_SIZE = 12;

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

// 固定快捷入口配置
const QUICK_ENTRIES = [
  {
    id: "ddxau",
    title: "点金DDXAU",
    subtitle: "四维共振·订单流",
    icon: "🏆",
    gradient: ["#92400E", "#D97706"] as readonly [string, string, ...string[]],
    type: "link" as const,
    target: "https://ddxau.com",
  },
  {
    id: "cooperation",
    title: "工作室合作",
    subtitle: "策略观摩·源头扶持",
    icon: "🤝",
    gradient: ["#1E3A8A", "#3B82F6"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/cooperation",
  },
  {
    id: "promo",
    title: "全网EA提货",
    subtitle: "源头直供·限时特惠",
    icon: "⚡",
    gradient: ["#7F1D1D", "#DC2626"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/promo",
  },
  {
    id: "groupbuy",
    title: "EA合购",
    subtitle: "拼团低至1/10",
    icon: "🛒",
    gradient: ["#064E3B", "#10B981"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/group-buy",
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

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
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

  const renderQuickEntries = () => (
    <View style={qeStyles.container}>
      {QUICK_ENTRIES.map((entry) => (
        <TouchableOpacity
          key={entry.id}
          style={qeStyles.entryWrap}
          onPress={() => handleEntryPress(entry)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={entry.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={qeStyles.entryCard}
          >
            <Text style={qeStyles.entryIcon}>{entry.icon}</Text>
            <Text style={qeStyles.entryTitle}>{entry.title}</Text>
            <Text style={qeStyles.entrySubtitle}>{entry.subtitle}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderHeader = () => (
    <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }} className="mb-3">
      {/* 固定快捷入口 */}
      {renderQuickEntries()}

      {/* 快捷导航入口 */}
      <View style={quickNavStyles.container}>
        {[
          { icon: "pricetags", label: "源头提货", route: "/promo", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
          { icon: "people", label: "策略合作", route: "/cooperation", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
          { icon: "cart", label: "EA合购", route: "/group-buy", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
          { icon: "newspaper", label: "行业动态", route: "/moments", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
        ].map((item, i) => (
          <TouchableOpacity
            key={i}
            style={quickNavStyles.item}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={[quickNavStyles.iconWrap, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>
            <Text style={[quickNavStyles.label, { color: colors.foreground }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
        <TouchableOpacity onPress={() => setPlatformFilter(undefined)} className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${!platformFilter ? "bg-primary" : "bg-surface"}`} activeOpacity={0.7}>
          <Text className={`text-sm font-medium ${!platformFilter ? "text-background" : "text-foreground"}`}>全部</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPlatformFilter("MT4")} className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${platformFilter === "MT4" ? "bg-primary" : "bg-surface"}`} activeOpacity={0.7}>
          <Text className={`text-sm font-medium ${platformFilter === "MT4" ? "text-background" : "text-foreground"}`}>MT4</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPlatformFilter("MT5")} className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${platformFilter === "MT5" ? "bg-primary" : "bg-surface"}`} activeOpacity={0.7}>
          <Text className={`text-sm font-medium ${platformFilter === "MT5" ? "text-background" : "text-foreground"}`}>MT5</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOrderBy("latest")} className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${orderBy === "latest" ? "bg-surface border border-primary" : "bg-surface"}`} activeOpacity={0.7}>
          <Text className={`text-sm ${orderBy === "latest" ? "text-primary font-semibold" : "text-muted"}`}>最新</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOrderBy("return")} className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${orderBy === "return" ? "bg-surface border border-primary" : "bg-surface"}`} activeOpacity={0.7}>
          <Text className={`text-sm ${orderBy === "return" ? "text-primary font-semibold" : "text-muted"}`}>收益率</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOrderBy("hot")} className={`px-3 py-1.5 rounded-full mb-2 ${orderBy === "hot" ? "bg-surface border border-primary" : "bg-surface"}`} activeOpacity={0.7}>
          <Text className={`text-sm ${orderBy === "hot" ? "text-primary font-semibold" : "text-muted"}`}>热度</Text>
        </TouchableOpacity>
      </View>

      {/* 标签筛选行 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ paddingRight: 12 }}>
        {TAG_FILTERS.map((tag) => (
          <TouchableOpacity
            key={tag.value}
            onPress={() => setTagFilter(tag.value)}
            style={[tagStyles.chip, { backgroundColor: tagFilter === tag.value ? colors.primary + "20" : colors.surface, borderColor: tagFilter === tag.value ? colors.primary : colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={[tagStyles.chipText, { color: tagFilter === tag.value ? colors.primary : colors.muted }]}>{tag.label}</Text>
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
      <TouchableOpacity onPress={() => setShowContactModal(true)} className="mt-6 bg-primary px-6 py-3 rounded-full" activeOpacity={0.8}>
        <Text className="text-background font-semibold">上架我的EA</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => (
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
    </View>
  );

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
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.primary} />}
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

// 快捷入口样式
const qeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  entryWrap: {
    width: "48.5%",
    flexGrow: 1,
  },
  entryCard: {
    borderRadius: 14,
    padding: 14,
    minHeight: 88,
    justifyContent: "center",
  },
  entryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  entryTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  entrySubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "500",
  },
});

const tagStyles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginRight: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "600" },
});
