import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import type { ListRenderItem } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { ContactModal } from "@/components/contact-modal";
import { SubscribeModal } from "@/components/subscribe-modal";
import { CustomEABanner } from "@/components/home/custom-ea-banner";
import { HomeHero } from "@/components/home/home-hero";
import { StrategyFilters, type OrderBy, type PlatformFilter, type SaleModeFilter } from "@/components/home/strategy-filters";
import { StrategyListItem } from "@/components/home/strategy-list-item";
import { StrategyListEmpty, StrategyListFooter } from "@/components/home/strategy-list-states";
import type { HomeStrategy } from "@/components/home/types";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 12;
const PRODUCT_TYPE_OPTIONS = [
  { name: "EA", slug: "ea", icon: "🤖", parentId: null },
  { name: "指标", slug: "indicator", icon: "📈", parentId: null },
  { name: "工具", slug: "tool", icon: "🧰", parentId: null },
];
const PRODUCT_TYPE_SLUGS = new Set(PRODUCT_TYPE_OPTIONS.map((item) => item.slug));

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns } = useResponsive();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(undefined);
  const [orderBy, setOrderBy] = useState<OrderBy>("hot");
  const [tagFilter, setTagFilter] = useState("");
  const [saleModeFilter, setSaleModeFilter] = useState<SaleModeFilter>("all");
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
  const activeSaleMode = saleModeFilter === "all" ? undefined : saleModeFilter;

  const categoriesForFilters = useMemo(() => {
    const productTypeCategories = ((categoriesData || []) as any[])
      .filter((category) => PRODUCT_TYPE_SLUGS.has(category.slug))
      .map((category) => ({ ...category, parentId: null }));
    return productTypeCategories.length > 0 ? productTypeCategories : PRODUCT_TYPE_OPTIONS;
  }, [categoriesData]);

  const dynamicTags = useMemo(() => {
    const tagCountMap = new Map<string, number>();
    allStrategies.forEach((strategy) => {
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
  }, [allStrategies]);

  const listFilters = useMemo(() => ({
    platform: platformFilter,
    orderBy,
    tag: tagFilter || undefined,
    productType: productTypeFilter,
    saleMode: activeSaleMode,
  }), [activeSaleMode, orderBy, platformFilter, productTypeFilter, tagFilter]);

  const { data: initialData, isLoading, refetch, isRefetching } = trpc.strategies.list.useQuery({
    ...listFilters,
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
    setSaleModeFilter("all");
    setCategoryFilter(undefined);
    setTagFilter("");
    setOrderBy("hot");
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) return;
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
  }, [hasMore, isLoadingMore, isLoading, refetchLoadMore]);

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
    router.push(`/strategy/${id}` as any);
  }, [router]);

  const renderHeader = useCallback(() => (
    <View style={{ marginBottom: 4 }}>
      <HomeHero />
      <CustomEABanner onPress={openContactModal} />
      <StrategyFilters
        colors={colors}
        platformFilter={platformFilter}
        orderBy={orderBy}
        tagFilter={tagFilter}
        saleModeFilter={saleModeFilter}
        categoryFilter={categoryFilter}
        showAdvancedFilters={showAdvancedFilters}
        categories={categoriesForFilters}
        dynamicTags={dynamicTags}
        onPlatformChange={setPlatformFilter}
        onOrderByChange={setOrderBy}
        onTagChange={setTagFilter}
        onSaleModeChange={setSaleModeFilter}
        onCategoryChange={setCategoryFilter}
        onToggleAdvancedFilters={toggleAdvancedFilters}
        onClearAll={clearAllFilters}
        onUploadPress={openContactModal}
        onSearchPress={openSearch}
      />
    </View>
  ), [categoryFilter, categoriesForFilters, clearAllFilters, colors, dynamicTags, openContactModal, openSearch, orderBy, platformFilter, saleModeFilter, showAdvancedFilters, tagFilter, toggleAdvancedFilters]);

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
      hasMore={hasMore}
      itemCount={allStrategies.length}
    />
  ), [allStrategies.length, colors, hasMore, isLoadingMore]);

  const renderStrategyItem = useCallback<ListRenderItem<HomeStrategy>>(({ item }) => (
    <StrategyListItem
      item={item}
      onStrategyPress={handleStrategyPress}
      onSubscribePress={handleSubscribePress}
    />
  ), [handleStrategyPress, handleSubscribePress]);

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
        data={allStrategies}
        keyExtractor={keyExtractor}
        key={numColumns}
        numColumns={numColumns}
        renderItem={renderStrategyItem}
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
