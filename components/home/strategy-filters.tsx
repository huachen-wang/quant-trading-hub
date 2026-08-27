import { memo, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { ThemeColorPalette } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";
import { useLanguage } from "@/lib/language";

export type PlatformFilter = "MT4" | "MT5" | undefined;
export type OrderBy = "latest" | "return" | "hot";

type CategoryOption = {
  name: string;
  slug: string;
  icon?: string | null;
  parentId?: number | null;
};

type DynamicTag = {
  label: string;
  value: string;
};

type StrategyFiltersProps = {
  colors: ThemeColorPalette;
  platformFilter: PlatformFilter;
  orderBy: OrderBy;
  tagFilter: string;
  categoryFilter?: string;
  showAdvancedFilters: boolean;
  categories: CategoryOption[];
  dynamicTags: DynamicTag[];
  onPlatformChange: (value: PlatformFilter) => void;
  onOrderByChange: (value: OrderBy) => void;
  onTagChange: (value: string) => void;
  onCategoryChange: (value: string | undefined) => void;
  onToggleAdvancedFilters: () => void;
  onClearAll: () => void;
  onUploadPress: () => void;
  onSearchPress: () => void;
};

export const StrategyFilters = memo(function StrategyFilters({
  colors,
  platformFilter,
  orderBy,
  tagFilter,
  categoryFilter,
  showAdvancedFilters,
  categories,
  dynamicTags,
  onPlatformChange,
  onOrderByChange,
  onTagChange,
  onCategoryChange,
  onToggleAdvancedFilters,
  onClearAll,
  onUploadPress,
  onSearchPress,
}: StrategyFiltersProps) {
  const { isDesktop } = useResponsive();
  const { text } = useLanguage();
  const platformOptions: { label: string; value: PlatformFilter }[] = [
    { label: text("全部", "All", "الكل"), value: undefined },
    { label: "MT4", value: "MT4" },
    { label: "MT5", value: "MT5" },
  ];
  const orderOptions: { label: string; value: OrderBy }[] = [
    { label: text("热度", "Popular", "الأكثر شعبية"), value: "hot" },
    { label: text("最新", "Latest", "الأحدث"), value: "latest" },
    { label: text("收益率", "Return", "العائد"), value: "return" },
  ];
  const hasAnyFilter =
    !!platformFilter || !!categoryFilter || !!tagFilter || orderBy !== "hot";
  const rootCategories = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];

    if (platformFilter)
      chips.push({
        label: platformFilter,
        clear: () => onPlatformChange(undefined),
      });
    if (categoryFilter) {
      const cat = categories.find(
        (category) => category.slug === categoryFilter,
      );
      if (cat)
        chips.push({
          label: cat.name,
          clear: () => onCategoryChange(undefined),
        });
    }
    if (tagFilter) {
      const tag = dynamicTags.find((item) => item.value === tagFilter);
      chips.push({
        label: tag?.label || tagFilter,
        clear: () => onTagChange(""),
      });
    }
    if (orderBy !== "hot") {
      chips.push({
        label:
          orderBy === "latest"
            ? text("最新", "Latest", "الأحدث")
            : text("收益率", "Return", "العائد"),
        clear: () => onOrderByChange("hot"),
      });
    }

    return chips;
  }, [
    categories,
    categoryFilter,
    dynamicTags,
    onCategoryChange,
    onOrderByChange,
    onPlatformChange,
    onTagChange,
    orderBy,
    platformFilter,
    tagFilter,
    text,
  ]);

  const platformControls = platformOptions.map((item) => {
    const isActive = platformFilter === item.value;
    return (
      <TouchableOpacity
        key={item.label}
        onPress={() => onPlatformChange(item.value)}
        style={[
          styles.filterChip,
          isActive
            ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" }
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: isActive ? "#0A1628" : colors.muted },
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  });

  const orderControls = orderOptions.map((item) => {
    const isActive = orderBy === item.value;
    return (
      <TouchableOpacity
        key={item.label}
        onPress={() => onOrderByChange(item.value)}
        style={[styles.sortChip, isActive && styles.sortChipActive]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.sortChipText,
            { color: isActive ? "#C9A96E" : colors.muted },
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  });

  const advancedToggle = (
    <TouchableOpacity
      onPress={onToggleAdvancedFilters}
      style={[
        styles.advancedToggle,
        showAdvancedFilters
          ? {
              backgroundColor: "rgba(201,169,110,0.12)",
              borderColor: "#C9A96E",
            }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.advancedToggleText,
          { color: showAdvancedFilters ? "#C9A96E" : colors.muted },
        ]}
      >
        {showAdvancedFilters
          ? text("收起筛选", "Hide filters", "إخفاء التصفية")
          : text("高级筛选", "More filters", "المزيد من التصفية")}
      </Text>
      {!!(categoryFilter || tagFilter) && !showAdvancedFilters && (
        <View style={styles.advancedDot} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={[styles.titleRow, isDesktop && styles.titleRowDesktop]}>
        <View style={styles.titleLeft}>
          <View style={styles.titleAccent} />
          <Text
            style={[
              styles.titleText,
              isDesktop && styles.titleTextDesktop,
              { color: colors.foreground },
            ]}
          >
            {text("商城目录", "Marketplace catalog", "دليل السوق")}
          </Text>
        </View>

        {isDesktop && (
          <View style={styles.desktopToolbar}>
            <View style={styles.filterGroup}>{platformControls}</View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <View style={styles.filterGroup}>{orderControls}</View>
            {advancedToggle}
          </View>
        )}

        <View
          style={[styles.titleRight, !isDesktop && styles.titleRightMobile]}
        >
          <TouchableOpacity
            onPress={onUploadPress}
            style={styles.uploadBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadBtnText}>
              {text("提交上架", "List an EA", "إدراج EA")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={text(
              "搜索策略",
              "Search strategies",
              "البحث في الاستراتيجيات",
            )}
            onPress={onSearchPress}
            style={[styles.searchBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
            <Text style={[styles.searchBtnText, { color: colors.muted }]}>
              {text("搜索", "Search", "بحث")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isDesktop && (
        <>
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>{platformControls}</View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <View style={styles.filterGroup}>{orderControls}</View>
          </View>
          <View style={[styles.filterRow, styles.secondFilterRow]}>
            {advancedToggle}
          </View>
        </>
      )}

      {hasAnyFilter && (
        <View
          style={[
            styles.filterRow,
            { marginTop: 10, alignItems: "center", flexWrap: "wrap" },
          ]}
        >
          <Text style={[styles.activeLabel, { color: colors.muted }]}>
            {text("已选：", "Selected:", "المحدد:")}
          </Text>
          {activeFilterChips.map((chip, i) => (
            <TouchableOpacity
              key={`${chip.label}-${i}`}
              onPress={chip.clear}
              style={styles.activeChip}
              activeOpacity={0.7}
            >
              <Text style={styles.activeChipText}>{chip.label}</Text>
              <Text style={styles.activeChipX}>✕</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={onClearAll}
            style={styles.clearAllBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.clearAllText}>
              {text("清空全部", "Clear all", "مسح الكل")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showAdvancedFilters && (
        <View
          style={[
            styles.advancedPanel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {categories.length > 0 && (
            <>
              <Text
                style={[styles.advancedSectionTitle, { color: colors.muted }]}
              >
                {text("分类", "Category", "الفئة")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: 6 }}
              >
                <TouchableOpacity
                  onPress={() => onCategoryChange(undefined)}
                  style={[
                    styles.filterChip,
                    !categoryFilter
                      ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" }
                      : {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: !categoryFilter ? "#0A1628" : colors.muted },
                    ]}
                  >
                    {text("全部分类", "All categories", "كل الفئات")}
                  </Text>
                </TouchableOpacity>
                {rootCategories.map((category) => {
                  const isActive = categoryFilter === category.slug;
                  const categoryLabel = category.name;
                  return (
                    <TouchableOpacity
                      key={category.slug}
                      onPress={() => onCategoryChange(category.slug)}
                      style={[
                        styles.filterChip,
                        isActive
                          ? {
                              backgroundColor: "#C9A96E",
                              borderColor: "#C9A96E",
                            }
                          : {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                            },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: isActive ? "#0A1628" : colors.muted },
                        ]}
                      >
                        {categoryLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {dynamicTags.length > 0 && (
            <>
              <Text
                style={[
                  styles.advancedSectionTitle,
                  { color: colors.muted, marginTop: 14 },
                ]}
              >
                {text("标签", "Tags", "الوسوم")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 12, gap: 8 }}
              >
                <TouchableOpacity
                  onPress={() => onTagChange("")}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor:
                        tagFilter === ""
                          ? "rgba(201,169,110,0.12)"
                          : colors.background,
                      borderColor: tagFilter === "" ? "#C9A96E" : colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      { color: tagFilter === "" ? "#C9A96E" : colors.muted },
                    ]}
                  >
                    {text("全部", "All", "الكل")}
                  </Text>
                </TouchableOpacity>
                {dynamicTags.map((tag) => {
                  const isActive = tagFilter === tag.value;
                  return (
                    <TouchableOpacity
                      key={tag.value}
                      onPress={() => onTagChange(tag.value)}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: isActive
                            ? "rgba(201,169,110,0.12)"
                            : colors.background,
                          borderColor: isActive ? "#C9A96E" : colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.tagChipText,
                          { color: isActive ? "#C9A96E" : colors.muted },
                        ]}
                      >
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
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  containerDesktop: {
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.14)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: 8,
    marginBottom: 6,
  },
  titleRowDesktop: {
    marginBottom: 0,
    gap: 16,
    flexWrap: "nowrap",
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  titleAccent: {
    width: 3,
    height: 18,
    borderRadius: 1,
    backgroundColor: "#A8895A",
    marginRight: 8,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleTextDesktop: {
    fontSize: 17,
    lineHeight: 22,
  },
  desktopToolbar: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  titleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  titleRightMobile: {
    width: "100%",
    justifyContent: "flex-end",
  },
  uploadBtn: {
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.48)",
    backgroundColor: "rgba(216,188,131,0.08)",
  },
  uploadBtnText: {
    color: "#D8BC83",
    fontSize: 12,
    fontWeight: "800",
  },
  searchBtn: {
    minWidth: 64,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  searchBtnText: { fontSize: 11, fontWeight: "800" },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
    rowGap: 6,
  },
  secondFilterRow: {
    marginTop: 8,
    justifyContent: "space-between",
  },
  filterGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
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
  sortChipActive: {
    borderBottomColor: "#C9A96E",
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 5,
    marginRight: 8,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
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
    borderRadius: 5,
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
  advancedPanel: {
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
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
