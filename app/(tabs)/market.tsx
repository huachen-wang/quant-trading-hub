import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ListRenderItem } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { ContactModal } from "@/components/contact-modal";
import { SubscribeModal } from "@/components/subscribe-modal";
import { CustomEABanner } from "@/components/home/custom-ea-banner";
import { HomeHero } from "@/components/home/home-hero";
import {
  StrategyFilters,
  type OrderBy,
  type PlatformFilter,
} from "@/components/home/strategy-filters";
import { StrategyListItem } from "@/components/home/strategy-list-item";
import {
  StrategyListEmpty,
  StrategyListFooter,
} from "@/components/home/strategy-list-states";
import { LOCAL_PREVIEW_STRATEGIES } from "@/components/home/preview-strategies";
import type { HomeStrategy } from "@/components/home/types";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 12;
const PRODUCT_TYPE_OPTIONS = [
  { name: "EA", slug: "ea", icon: null, parentId: null },
  { name: "指标", slug: "indicator", icon: null, parentId: null },
  { name: "工具", slug: "tool", icon: null, parentId: null },
];
const PRODUCT_TYPE_SLUGS = new Set(
  PRODUCT_TYPE_OPTIONS.map((item) => item.slug),
);

type EaLibraryScreenProps = {
  variant?: "legacy" | "v2";
};

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const pathname = usePathname();
  if (!isFocused || pathname !== "/market") return null;
  return <EaLibraryScreen />;
}

export function EaLibraryScreen({ variant = "legacy" }: EaLibraryScreenProps) {
  const colors = useColors();
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const [platformFilter, setPlatformFilter] =
    useState<PlatformFilter>(undefined);
  const [orderBy, setOrderBy] = useState<OrderBy>("hot");
  const [tagFilter, setTagFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
    undefined,
  );
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedStrategyTitle, setSelectedStrategyTitle] = useState("");
  const [allStrategies, setAllStrategies] = useState<HomeStrategy[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data: categoriesData } = trpc.categories.list.useQuery();
  const productTypeFilter =
    categoryFilter && PRODUCT_TYPE_SLUGS.has(categoryFilter)
      ? categoryFilter
      : undefined;

  const categoriesForFilters = useMemo(() => {
    const productTypeCategories = ((categoriesData || []) as any[])
      .filter((category) => PRODUCT_TYPE_SLUGS.has(category.slug))
      .map((category) => ({ ...category, parentId: null }));
    return productTypeCategories.length > 0
      ? productTypeCategories
      : PRODUCT_TYPE_OPTIONS;
  }, [categoriesData]);

  const listFilters = useMemo(
    () => ({
      platform: platformFilter,
      orderBy,
      tag: tagFilter || undefined,
      productType: productTypeFilter,
    }),
    [orderBy, platformFilter, productTypeFilter, tagFilter],
  );

  const {
    data: initialData,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.strategies.list.useQuery({
    ...listFilters,
    limit: PAGE_SIZE,
    offset: 0,
  });

  const isLocalPreview = useMemo(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return false;
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(
      window.location.hostname,
    );
  }, []);

  const displayStrategies = useMemo(() => {
    if (allStrategies.length > 0) return allStrategies;
    if (isLocalPreview && !isLoading) return LOCAL_PREVIEW_STRATEGIES;
    return allStrategies;
  }, [allStrategies, isLoading, isLocalPreview]);

  const isShowingPreviewCatalog =
    isLocalPreview &&
    allStrategies.length === 0 &&
    displayStrategies.length > 0;

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
  const closeSubscribeModal = useCallback(
    () => setShowSubscribeModal(false),
    [],
  );
  const toggleAdvancedFilters = useCallback(
    () => setShowAdvancedFilters((value) => !value),
    [],
  );
  const openSearch = useCallback(() => router.push("/search" as any), [router]);

  const clearAllFilters = useCallback(() => {
    setPlatformFilter(undefined);
    setCategoryFilter(undefined);
    setTagFilter("");
    setOrderBy("hot");
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (isShowingPreviewCatalog || !hasMore || isLoadingMore || isLoading)
      return;
    setIsLoadingMore(true);
    try {
      const result = await refetchLoadMore();
      if (result.data && result.data.length > 0) {
        setAllStrategies((prev) => {
          const existingIds = new Set(prev.map((strategy) => strategy.id));
          const newItems = result.data.filter(
            (strategy: HomeStrategy) => !existingIds.has(strategy.id),
          );
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
  }, [
    hasMore,
    isLoadingMore,
    isLoading,
    isShowingPreviewCatalog,
    refetchLoadMore,
  ]);

  const handleRefresh = useCallback(async () => {
    setOffset(0);
    setHasMore(true);
    await refetch();
  }, [refetch]);

  const handleSubscribePress = useCallback((title: string) => {
    setSelectedStrategyTitle(title);
    setShowSubscribeModal(true);
  }, []);

  const handleStrategyPress = useCallback(
    (id: number) => {
      if (id < 0) {
        openContactModal();
        return;
      }
      router.push(`/strategy/${id}` as any);
    },
    [openContactModal, router],
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.headerBlock}>
        {variant === "legacy" ? (
          <>
            <HomeHero />
            <CustomEABanner onPress={openContactModal} />
          </>
        ) : (
          <V2LibraryHeader
            isDesktop={isDesktop}
            onContactPress={openContactModal}
            onSearchPress={openSearch}
          />
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
    ),
    [
      categoryFilter,
      categoriesForFilters,
      clearAllFilters,
      colors,
      dynamicTags,
      isDesktop,
      isShowingPreviewCatalog,
      openContactModal,
      openSearch,
      orderBy,
      platformFilter,
      showAdvancedFilters,
      tagFilter,
      toggleAdvancedFilters,
      variant,
    ],
  );

  const renderEmpty = useCallback(
    () => (
      <StrategyListEmpty colors={colors} onUploadPress={openContactModal} />
    ),
    [colors, openContactModal],
  );

  const renderFooter = useCallback(
    () => (
      <StrategyListFooter
        colors={colors}
        isLoadingMore={isLoadingMore}
        hasMore={isShowingPreviewCatalog ? false : hasMore}
        itemCount={displayStrategies.length}
      />
    ),
    [
      colors,
      displayStrategies.length,
      hasMore,
      isLoadingMore,
      isShowingPreviewCatalog,
    ],
  );

  const renderStrategyItem = useCallback<ListRenderItem<HomeStrategy>>(
    ({ item, index }) => (
      <StrategyListItem
        item={item}
        imagePriority={index < (isDesktop ? 8 : 4) ? "high" : "low"}
        onStrategyPress={handleStrategyPress}
        onSubscribePress={handleSubscribePress}
      />
    ),
    [handleStrategyPress, handleSubscribePress, isDesktop],
  );

  const keyExtractor = useCallback(
    (item: HomeStrategy) => item.id.toString(),
    [],
  );

  if (isLoading && !initialData) {
    return (
      <ScreenContainer edges={variant === "v2" ? [] : undefined}>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#A8895A" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={variant === "v2" ? [] : undefined}>
      <ContactModal visible={showContactModal} onClose={closeContactModal} />
      <SubscribeModal
        visible={showSubscribeModal}
        onClose={closeSubscribeModal}
        strategyTitle={selectedStrategyTitle}
      />
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
        contentContainerStyle={[
          styles.listContent,
          isDesktop && styles.listContentDesktop,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor="#A8895A"
          />
        }
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

function V2LibraryHeader({
  isDesktop,
  onContactPress,
  onSearchPress,
}: {
  isDesktop: boolean;
  onContactPress: () => void;
  onSearchPress: () => void;
}) {
  const { text } = useLanguage();
  return (
    <View
      style={[
        styles.v2LibraryHeader,
        !isDesktop && styles.v2LibraryHeaderMobile,
      ]}
    >
      <View style={styles.v2LibraryCopy}>
        <Text style={styles.v2LibraryEyebrow}>EA MARKETPLACE</Text>
        <Text style={styles.v2LibraryTitle}>
          {text("EA 商城", "EA Marketplace", "سوق EA")}
        </Text>
        <Text style={styles.v2LibraryDetail}>
          {text(
            "浏览 MT4 / MT5 的 EA、指标与交易工具。商品页明确区分直接购买与咨询授权，付款前可先确认版本、授权范围和部署环境。",
            "Browse MT4 / MT5 EAs, indicators and trading tools. Product pages distinguish direct purchase from licensing enquiries, with version, licence and deployment confirmation before payment.",
            "تصفح أنظمة EA والمؤشرات وأدوات التداول لمنصتي MT4 وMT5. تميّز صفحات المنتجات بين الشراء المباشر واستفسارات الترخيص، مع تأكيد الإصدار والترخيص والنشر قبل الدفع.",
          )}
        </Text>
        <View style={styles.v2LibraryTypes}>
          {[
            "EA",
            text("指标", "Indicators", "مؤشرات"),
            text("工具", "Tools", "أدوات"),
          ].map((label) => (
            <View key={label} style={styles.v2LibraryType}>
              <Text style={styles.v2LibraryTypeText}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.v2CommerceFlow}>
          <Text style={styles.v2CommerceFlowLabel}>
            {text("选品到交付", "FROM SELECTION TO DELIVERY", "من الاختيار إلى التسليم")}
          </Text>
          <Text style={styles.v2CommerceFlowText}>
            {text(
              "看商品资料 → 购买或咨询授权 → 确认版本与部署 → 获取文件及后续服务",
              "Review details → Buy or ask about licensing → Confirm version and deployment → Receive files and support",
              "راجع التفاصيل ← اشتر أو استفسر عن الترخيص ← أكد الإصدار والنشر ← استلم الملفات والدعم",
            )}
          </Text>
        </View>
        <View style={styles.v2ServiceLinks}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={text(
              "打开 niubang.ai 跟单与带单排行",
              "Open niubang.ai copy trading and provider rankings",
              "افتح niubang.ai لنسخ التداول وتصنيفات المزودين",
            )}
            onPress={() => Linking.openURL("https://niubang.ai")}
            style={({ pressed }) => [styles.v2ServiceLink, pressed && styles.pressed]}
          >
            <Text style={styles.v2ServiceLinkBrand}>niubang.ai</Text>
            <Text style={styles.v2ServiceLinkText}>
              {text("跟单与带单排行", "Copy trading & rankings", "نسخ التداول والتصنيفات")}
            </Text>
            <MaterialIcons name="open-in-new" size={13} color="#D8BC83" />
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={text(
              "打开 fanyong.ai 多 broker 权益与社区",
              "Open fanyong.ai broker benefits and community",
              "افتح fanyong.ai لمزايا الوسطاء والمجتمع",
            )}
            onPress={() => Linking.openURL("https://fanyong.ai")}
            style={({ pressed }) => [styles.v2ServiceLink, pressed && styles.pressed]}
          >
            <Text style={styles.v2ServiceLinkBrand}>fanyong.ai</Text>
            <Text style={styles.v2ServiceLinkText}>
              {text("多 broker 权益与社区", "Broker benefits & community", "مزايا الوسطاء والمجتمع")}
            </Text>
            <MaterialIcons name="open-in-new" size={13} color="#D8BC83" />
          </Pressable>
        </View>
      </View>
      <View
        style={[
          styles.v2LibraryActions,
          !isDesktop && styles.v2LibraryActionsMobile,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onSearchPress}
          style={({ pressed }) => [
            styles.v2LibrarySearch,
            pressed && styles.pressed,
          ]}
        >
          <MaterialIcons name="search" size={18} color="#D8BC83" />
          <Text style={styles.v2LibrarySearchText}>
            {text("搜索 EA", "Search EAs", "بحث EA")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onContactPress}
          style={({ pressed }) => [
            styles.v2LibraryContact,
            pressed && styles.pressed,
          ]}
        >
          <MaterialIcons name="support-agent" size={18} color="#07101A" />
          <Text style={styles.v2LibraryContactText}>
            {text("联系购买与授权", "Purchase & licensing", "الشراء والترخيص")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function LocalPreviewStrip() {
  const { text } = useLanguage();
  return (
    <View style={styles.previewStrip}>
      <View style={styles.previewStripRail} />
      <Text style={styles.previewStripKicker}>LOCAL PREVIEW</Text>
      <Text style={styles.previewStripText}>
        {text(
          "本地样板策略 · 正式域名自动读取真实数据库",
          "Local sample strategies · Production reads the live database",
          "استراتيجيات محلية تجريبية · يقرأ الإنتاج قاعدة البيانات الحية",
        )}
      </Text>
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
  v2LibraryHeader: {
    minHeight: 246,
    paddingHorizontal: 12,
    paddingVertical: 28,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(100,116,139,0.45)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 18,
  },
  v2LibraryHeaderMobile: {
    minHeight: 0,
    paddingVertical: 20,
    flexDirection: "column",
    alignItems: "stretch",
  },
  v2LibraryCopy: { flex: 1, minWidth: 0, gap: 5 },
  v2LibraryEyebrow: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  v2LibraryTitle: {
    color: "#F4F7FB",
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: 0,
  },
  v2LibraryDetail: {
    color: "#9BA9BC",
    fontSize: 12,
    lineHeight: 19,
    maxWidth: 660,
  },
  v2LibraryTypes: {
    marginTop: 5,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  v2LibraryType: {
    minHeight: 22,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.26)",
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,188,131,0.04)",
  },
  v2LibraryTypeText: {
    color: "#9BA9BC",
    fontSize: 9,
    fontWeight: "800",
  },
  v2CommerceFlow: {
    marginTop: 9,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(100,116,139,0.26)",
    gap: 4,
  },
  v2CommerceFlowLabel: {
    color: "#D8BC83",
    fontSize: 9,
    fontWeight: "900",
  },
  v2CommerceFlowText: {
    color: "#CBD5E1",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  v2ServiceLinks: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  v2ServiceLink: {
    minHeight: 30,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.2)",
    borderRadius: 4,
    backgroundColor: "rgba(216,188,131,0.035)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  v2ServiceLinkBrand: {
    color: "#F4F7FB",
    fontSize: 10,
    fontWeight: "900",
  },
  v2ServiceLinkText: {
    color: "#9BA9BC",
    fontSize: 9,
    fontWeight: "700",
  },
  v2LibraryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  v2LibraryActionsMobile: { width: "100%" },
  v2LibrarySearch: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.48)",
    borderRadius: 4,
    backgroundColor: "rgba(216,188,131,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  v2LibrarySearchText: {
    color: "#D8BC83",
    fontSize: 11,
    fontWeight: "900",
  },
  v2LibraryContact: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 4,
    backgroundColor: "#D8BC83",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  v2LibraryContactText: {
    color: "#07101A",
    fontSize: 11,
    fontWeight: "900",
  },
  pressed: { opacity: 0.72 },
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
  columnWrapper: {
    justifyContent: "flex-start",
  },
});
