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

const PLATFORM_OPTIONS: { label: string; value: PlatformFilter }[] = [
  { label: "全部", value: undefined },
  { label: "MT4", value: "MT4" },
  { label: "MT5", value: "MT5" },
];

const ORDER_OPTIONS: { label: string; value: OrderBy }[] = [
  { label: "热度", value: "hot" },
  { label: "最新", value: "latest" },
  { label: "收益率", value: "return" },
];

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
        label: orderBy === "latest" ? "最新" : "收益率",
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
  ]);

  const platformControls = PLATFORM_OPTIONS.map((item) => {
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

  const orderControls = ORDER_OPTIONS.map((item) => {
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
        {showAdvancedFilters ? "收起筛选" : "高级筛选"}
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
            策略广场
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

        <View style={styles.titleRight}>
          <TouchableOpacity
            onPress={onUploadPress}
            style={styles.uploadBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadBtnText}>上架 EA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="搜索策略"
            onPress={onSearchPress}
            style={[styles.searchBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
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
            已选：
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
            <Text style={styles.clearAllText}>清空全部</Text>
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
                分类
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
                    全部分类
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
                标签
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
                    全部
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
    marginBottom: 6,
  },
  titleRowDesktop: {
    marginBottom: 0,
    gap: 16,
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
    width: 30,
    height: 30,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
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
