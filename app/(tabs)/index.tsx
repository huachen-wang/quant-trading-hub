import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { ListRenderItem } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { ContactModal } from "@/components/contact-modal";
import { SubscribeModal } from "@/components/subscribe-modal";
import { CustomEABanner } from "@/components/home/custom-ea-banner";
import { HomeHero } from "@/components/home/home-hero";
import { StrategyFilters, type OrderBy, type PlatformFilter } from "@/components/home/strategy-filters";
import { StrategyListItem } from "@/components/home/strategy-list-item";
import { StrategyListEmpty, StrategyListFooter } from "@/components/home/strategy-list-states";
import { LOCAL_PREVIEW_STRATEGIES } from "@/components/home/preview-strategies";
import type { HomeStrategy } from "@/components/home/types";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 12;
const PRODUCT_TYPE_OPTIONS = [
  { name: "EA", slug: "ea", icon: null, parentId: null },
  { name: "指标", slug: "indicator", icon: null, parentId: null },
  { name: "工具", slug: "tool", icon: null, parentId: null },
];
const PRODUCT_TYPE_SLUGS = new Set(PRODUCT_TYPE_OPTIONS.map((item) => item.slug));

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(undefined);
  const [orderBy, setOrderBy] = useState<OrderBy>("hot");
  const [tagFilter, setTagFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedStrategyTitle, setSelectedStrategyTitle] = useState("");
  const [allStrategies, setAllStrategies] = useState<HomeStrategy[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data: categoriesData } = trpc.categories.list.useQuery();
  const productTypeFilter = categoryFilter && PRODUCT_TYPE_SLUGS.has(categoryFilter)
    ? categoryFilter
    : undefined;

  const categoriesForFilters = useMemo(() => {
    const productTypeCategories = ((categoriesData || []) as any[])
      .filter((category) => PRODUCT_TYPE_SLUGS.has(category.slug))
      .map((category) => ({ ...category, parentId: null }));
    return productTypeCategories.length > 0 ? productTypeCategories : PRODUCT_TYPE_OPTIONS;
  }, [categoriesData]);

  const listFilters = useMemo(() => ({
    platform: platformFilter,
    orderBy,
    tag: tagFilter || undefined,
    productType: productTypeFilter,
  }), [orderBy, platformFilter, productTypeFilter, tagFilter]);

  const { data: initialData, isLoading, refetch, isRefetching } = trpc.strategies.list.useQuery({
    ...listFilters,
    limit: PAGE_SIZE,
    offset: 0,
  });

  const isLocalPreview = useMemo(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return false;
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
  }, []);

  const displayStrategies = useMemo(() => {
    if (allStrategies.length > 0) return allStrategies;
    if (isLocalPreview && !isLoading) return LOCAL_PREVIEW_STRATEGIES;
    return allStrategies;
  }, [allStrategies, isLoading, isLocalPreview]);

  const isShowingPreviewCatalog = isLocalPreview && allStrategies.length === 0 && displayStrategies.length > 0;

  const dynamicTags = useMemo(() => {
    const tagCountMap = new Map<string, number>();
    displayStrategies.forEach((strategy) => {
      if (strategy.tags) {
        strategy.tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean)
          .forEach((tag: string) => {
            tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
          });
      }
    });

    return Array.from(tagCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => ({ label: tag, value: tag }));
  }, [displayStrategies]);

  useEffect(() => {
    if (initialData) {
      setAllStrategies(initialData);
      setOffset(initialData.length);
      setHasMore(initialData.length >= PAGE_SIZE);
    }
  }, [initialData]);

  const { refetch: refetchLoadMore } = trpc.strategies.list.useQuery(
    {
      ...listFilters,
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: false },
  );

  const openContactModal = useCallback(() => setShowContactModal(true), []);
  const closeContactModal = useCallback(() => setShowContactModal(false), []);
  const closeSubscribeModal = useCallback(() => setShowSubscribeModal(false), []);
  const toggleAdvancedFilters = useCallback(() => setShowAdvancedFilters((value) => !value), []);
  const openSearch = useCallback(() => router.push("/search" as any), [router]);

  const clearAllFilters = useCallback(() => {
    setPlatformFilter(undefined);
    setCategoryFilter(undefined);
    setTagFilter("");
    setOrderBy("hot");
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (isShowingPreviewCatalog || !hasMore || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      const result = await refetchLoadMore();
      if (result.data && result.data.length > 0) {
        setAllStrategies((prev) => {
          const existingIds = new Set(prev.map((strategy) => strategy.id));
          const newItems = result.data.filter((strategy: HomeStrategy) => !existingIds.has(strategy.id));
          return [...prev, ...newItems];
        });
        setOffset((prev) => prev + result.data.length);
        setHasMore(result.data.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch {
      // Keep the current list visible if pagination fails.
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, isLoading, isShowingPreviewCatalog, refetchLoadMore]);

  const handleRefresh = useCallback(async () => {
    setOffset(0);
    setHasMore(true);
    await refetch();
  }, [refetch]);

  const handleSubscribePress = useCallback((title: string) => {
    setSelectedStrategyTitle(title);
    setShowSubscribeModal(true);
  }, []);

  const handleStrategyPress = useCallback((id: number) => {
    if (id < 0) {
      openContactModal();
      return;
    }
    router.push(`/strategy/${id}` as any);
  }, [openContactModal, router]);

  const renderHeader = useCallback(() => (
    <View style={styles.headerBlock}>
      {isDesktop ? (
        <View style={styles.desktopHeroGrid}>
          <View style={styles.desktopHeroMain}>
            <HomeHero />
          </View>
          <View style={styles.desktopHeroSide}>
            <CustomEABanner onPress={openContactModal} />
            <DesktopBriefPanel itemCount={displayStrategies.length} />
          </View>
        </View>
      ) : (
        <>
          <HomeHero />
          <CustomEABanner onPress={openContactModal} />
        </>
      )}
      <StrategyFilters
        colors={colors}
        platformFilter={platformFilter}
        orderBy={orderBy}
        tagFilter={tagFilter}
        categoryFilter={categoryFilter}
        showAdvancedFilters={showAdvancedFilters}
        categories={categoriesForFilters}
        dynamicTags={dynamicTags}
        onPlatformChange={setPlatformFilter}
        onOrderByChange={setOrderBy}
        onTagChange={setTagFilter}
        onCategoryChange={setCategoryFilter}
        onToggleAdvancedFilters={toggleAdvancedFilters}
        onClearAll={clearAllFilters}
        onUploadPress={openContactModal}
        onSearchPress={openSearch}
      />
      {isShowingPreviewCatalog ? <LocalPreviewStrip /> : null}
    </View>
  ), [categoryFilter, categoriesForFilters, clearAllFilters, colors, displayStrategies.length, dynamicTags, isDesktop, isShowingPreviewCatalog, openContactModal, openSearch, orderBy, platformFilter, showAdvancedFilters, tagFilter, toggleAdvancedFilters]);

  const renderEmpty = useCallback(() => (
    <StrategyListEmpty
      colors={colors}
      onUploadPress={openContactModal}
    />
  ), [colors, openContactModal]);

  const renderFooter = useCallback(() => (
    <StrategyListFooter
      colors={colors}
      isLoadingMore={isLoadingMore}
      hasMore={isShowingPreviewCatalog ? false : hasMore}
      itemCount={displayStrategies.length}
    />
  ), [colors, displayStrategies.length, hasMore, isLoadingMore, isShowingPreviewCatalog]);

  const renderStrategyItem = useCallback<ListRenderItem<HomeStrategy>>(({ item, index }) => (
    <StrategyListItem
      item={item}
      imagePriority={index < (isDesktop ? 8 : 4) ? "high" : "low"}
      onStrategyPress={handleStrategyPress}
      onSubscribePress={handleSubscribePress}
    />
  ), [handleStrategyPress, handleSubscribePress, isDesktop]);

  const keyExtractor = useCallback((item: HomeStrategy) => item.id.toString(), []);

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
      <ContactModal visible={showContactModal} onClose={closeContactModal} />
      <SubscribeModal visible={showSubscribeModal} onClose={closeSubscribeModal} strategyTitle={selectedStrategyTitle} />
      <FlatList
        data={displayStrategies}
        keyExtractor={keyExtractor}
        key={numColumns}
        numColumns={numColumns}
        renderItem={renderStrategyItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
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

function LocalPreviewStrip() {
  return (
    <View style={styles.previewStrip}>
      <View style={styles.previewStripRail} />
      <Text style={styles.previewStripKicker}>LOCAL PREVIEW</Text>
      <Text style={styles.previewStripText}>本地样板策略 · 正式域名自动读取真实数据库</Text>
    </View>
  );
}

function DesktopBriefPanel({ itemCount }: { itemCount: number }) {
  const rows = [
    { label: "当前已载入", value: `${itemCount}`, tone: "#D8BC83" },
    { label: "交付模式", value: "联系咨询 / 人工交付", tone: "#60A5FA" },
    { label: "源头审核", value: "MANUAL", tone: "#34D399" },
  ];

  return (
    <View style={styles.briefPanel}>
      <View style={styles.briefHeader}>
        <Text style={styles.briefKicker}>INSTITUTIONAL VIEW</Text>
        <Text style={styles.briefTime}>EAXAU</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.briefRow}>
          <Text style={styles.briefLabel}>{row.label}</Text>
          <Text style={[styles.briefValue, { color: row.tone }]}>{row.value}</Text>
        </View>
      ))}
      <View style={styles.briefDivider} />
      <View style={styles.briefGrid}>
        <View style={styles.briefMetric}>
          <Text style={styles.briefMetricValue}>MT4/MT5</Text>
          <Text style={styles.briefMetricLabel}>平台覆盖</Text>
        </View>
        <View style={styles.briefMetric}>
          <Text style={styles.briefMetricValue}>T+0</Text>
          <Text style={styles.briefMetricLabel}>咨询响应</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 24,
  },
  listContentDesktop: {
    width: "100%",
    maxWidth: 1360,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingBottom: 36,
  },
  headerBlock: {
    marginBottom: 4,
  },
  desktopHeroGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  desktopHeroMain: {
    flex: 1.72,
    minWidth: 0,
  },
  desktopHeroSide: {
    flex: 0.92,
    minWidth: 310,
    gap: 7,
  },
  previewStrip: {
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.18)",
    backgroundColor: "rgba(9,13,24,0.72)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewStripRail: {
    width: 3,
    height: 22,
    backgroundColor: "#D8BC83",
  },
  previewStripKicker: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  previewStripText: {
    color: "rgba(226,232,240,0.72)",
    fontSize: 12,
    fontWeight: "600",
  },
  briefPanel: {
    flex: 1,
    minHeight: 132,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    backgroundColor: "rgba(7,12,24,0.92)",
  },
  briefHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  briefKicker: {
    color: "rgba(216,188,131,0.78)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  briefTime: {
    color: "rgba(226,232,240,0.52)",
    fontSize: 10,
    fontWeight: "800",
  },
  briefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.08)",
  },
  briefLabel: {
    color: "rgba(226,232,240,0.68)",
    fontSize: 12,
    fontWeight: "600",
  },
  briefValue: {
    fontSize: 12,
    fontWeight: "900",
  },
  briefDivider: {
    height: 1,
    backgroundColor: "rgba(216,188,131,0.14)",
    marginTop: 9,
    marginBottom: 9,
  },
  briefGrid: {
    flexDirection: "row",
    gap: 10,
  },
  briefMetric: {
    flex: 1,
    padding: 7,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    backgroundColor: "rgba(15,23,42,0.66)",
  },
  briefMetricValue: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 3,
  },
  briefMetricLabel: {
    color: "rgba(148,163,184,0.82)",
    fontSize: 11,
    fontWeight: "600",
  },
  columnWrapper: {
    justifyContent: "flex-start",
  },
});
