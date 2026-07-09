import { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { ThemeColorPalette } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";

export type PlatformFilter = "MT4" | "MT5" | undefined;
export type OrderBy = "latest" | "return" | "hot";
export type SaleModeFilter = "all" | "direct" | "inquiry";

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
  saleModeFilter: SaleModeFilter;
  categoryFilter?: string;
  showAdvancedFilters: boolean;
  categories: CategoryOption[];
  dynamicTags: DynamicTag[];
  onPlatformChange: (value: PlatformFilter) => void;
  onOrderByChange: (value: OrderBy) => void;
  onTagChange: (value: string) => void;
  onSaleModeChange: (value: SaleModeFilter) => void;
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

const SALE_MODE_OPTIONS: { label: string; value: SaleModeFilter }[] = [
  { label: "全部", value: "all" },
  { label: "直购", value: "direct" },
  { label: "商务授权", value: "inquiry" },
];

export const StrategyFilters = memo(function StrategyFilters({
  colors,
  platformFilter,
  orderBy,
  tagFilter,
  saleModeFilter,
  categoryFilter,
  showAdvancedFilters,
  categories,
  dynamicTags,
  onPlatformChange,
  onOrderByChange,
  onTagChange,
  onSaleModeChange,
  onCategoryChange,
  onToggleAdvancedFilters,
  onClearAll,
  onUploadPress,
  onSearchPress,
}: StrategyFiltersProps) {
  const { isDesktop } = useResponsive();
  const hasAnyFilter = !!platformFilter || saleModeFilter !== "all" || !!categoryFilter || !!tagFilter || orderBy !== "hot";
  const rootCategories = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];

    if (platformFilter) chips.push({ label: platformFilter, clear: () => onPlatformChange(undefined) });
    if (saleModeFilter === "direct") chips.push({ label: "直购", clear: () => onSaleModeChange("all") });
    if (saleModeFilter === "inquiry") chips.push({ label: "商务授权", clear: () => onSaleModeChange("all") });
    if (categoryFilter) {
      const cat = categories.find((category) => category.slug === categoryFilter);
      if (cat) chips.push({ label: cat.name, clear: () => onCategoryChange(undefined) });
    }
    if (tagFilter) {
      const tag = dynamicTags.find((item) => item.value === tagFilter);
      chips.push({ label: tag?.label || tagFilter, clear: () => onTagChange("") });
    }
    if (orderBy !== "hot") {
      chips.push({ label: orderBy === "latest" ? "最新" : "收益率", clear: () => onOrderByChange("hot") });
    }

    return chips;
  }, [categories, categoryFilter, dynamicTags, onCategoryChange, onOrderByChange, onPlatformChange, onSaleModeChange, onTagChange, orderBy, platformFilter, saleModeFilter, tagFilter]);

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={[styles.titleRow, isDesktop && styles.titleRowDesktop]}>
        <View style={styles.titleLeft}>
          <View style={styles.titleAccent} />
          <View>
            <Text style={[styles.titleText, isDesktop && styles.titleTextDesktop, { color: colors.foreground }]}>策略广场</Text>
            {isDesktop && <Text style={styles.titleMeta}>EA SOURCE TERMINAL</Text>}
          </View>
        </View>
        <View style={styles.titleRight}>
          <TouchableOpacity
            onPress={onUploadPress}
            style={styles.uploadBtn}
            activeOpacity={0.8}
          >
            <LinearGradient colors={["#A8895A", "#C9A96E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.uploadBtnInner}>
              <Text style={styles.uploadBtnText}>+ 上架EA</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSearchPress}
            style={[styles.searchBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.filterRow, isDesktop && styles.filterRowDesktop]}>
        <View style={styles.filterGroup}>
          {PLATFORM_OPTIONS.map((item) => {
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
                <Text style={[styles.filterChipText, { color: isActive ? "#0A1628" : colors.muted }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.filterGroup}>
          {ORDER_OPTIONS.map((item) => {
            const isActive = orderBy === item.value;
            return (
              <TouchableOpacity
                key={item.label}
                onPress={() => onOrderByChange(item.value)}
                style={[
                  styles.sortChip,
                  isActive && { borderBottomWidth: 2, borderBottomColor: "#C9A96E" },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.sortChipText, { color: isActive ? "#C9A96E" : colors.muted }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.filterRow, styles.secondFilterRow, isDesktop && styles.secondFilterRowDesktop]}>
        <View style={styles.filterGroup}>
          {SALE_MODE_OPTIONS.map((item) => {
            const isActive = saleModeFilter === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => onSaleModeChange(item.value)}
                style={[
                  styles.filterChip,
                  isActive
                    ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, { color: isActive ? "#0A1628" : colors.muted }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={onToggleAdvancedFilters}
          style={[
            styles.advancedToggle,
            showAdvancedFilters
              ? { backgroundColor: "rgba(201,169,110,0.12)", borderColor: "#C9A96E" }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <Text style={[styles.advancedToggleText, { color: showAdvancedFilters ? "#C9A96E" : colors.muted }]}>
            {showAdvancedFilters ? "▲ 收起" : "▾ 高级筛选"}
          </Text>
          {(categoryFilter || tagFilter) && !showAdvancedFilters && (
            <View style={styles.advancedDot} />
          )}
        </TouchableOpacity>
      </View>

      {hasAnyFilter && (
        <View style={[styles.filterRow, { marginTop: 10, alignItems: "center", flexWrap: "wrap" }]}>
          <Text style={[styles.activeLabel, { color: colors.muted }]}>已选：</Text>
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
        <View style={[styles.advancedPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {categories.length > 0 && (
            <>
              <Text style={[styles.advancedSectionTitle, { color: colors.muted }]}>分类</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4, gap: 6 }}>
                <TouchableOpacity onPress={() => onCategoryChange(undefined)} style={[styles.filterChip, !categoryFilter ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" } : { backgroundColor: colors.background, borderColor: colors.border }]} activeOpacity={0.7}>
                  <Text style={[styles.filterChipText, { color: !categoryFilter ? "#0A1628" : colors.muted }]}>全部分类</Text>
                </TouchableOpacity>
                {rootCategories.map((category) => {
                  const isActive = categoryFilter === category.slug;
                  const categoryLabel = category.name;
                  return (
                    <TouchableOpacity key={category.slug} onPress={() => onCategoryChange(category.slug)} style={[styles.filterChip, isActive ? { backgroundColor: "#C9A96E", borderColor: "#C9A96E" } : { backgroundColor: colors.background, borderColor: colors.border }]} activeOpacity={0.7}>
                      <Text style={[styles.filterChipText, { color: isActive ? "#0A1628" : colors.muted }]}>{categoryLabel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {dynamicTags.length > 0 && (
            <>
              <Text style={[styles.advancedSectionTitle, { color: colors.muted, marginTop: 14 }]}>标签</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => onTagChange("")}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: tagFilter === "" ? "rgba(201,169,110,0.12)" : colors.background,
                      borderColor: tagFilter === "" ? "#C9A96E" : colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tagChipText, { color: tagFilter === "" ? "#C9A96E" : colors.muted }]}>全部</Text>
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
                          backgroundColor: isActive ? "rgba(201,169,110,0.12)" : colors.background,
                          borderColor: isActive ? "#C9A96E" : colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tagChipText, { color: isActive ? "#C9A96E" : colors.muted }]}>
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
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    backgroundColor: "rgba(9,15,28,0.82)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleRowDesktop: {
    marginBottom: 8,
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
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
    fontSize: 18,
    lineHeight: 22,
  },
  titleMeta: {
    color: "rgba(148,163,184,0.72)",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0,
  },
  titleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadBtn: {
    borderRadius: 4,
    overflow: "hidden",
  },
  uploadBtnInner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  uploadBtnText: {
    color: "#0A0E1A",
    fontSize: 12,
    fontWeight: "700",
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
  filterRowDesktop: {
    marginBottom: 5,
    rowGap: 5,
  },
  secondFilterRow: {
    marginTop: 8,
    justifyContent: "space-between",
  },
  secondFilterRowDesktop: {
    marginTop: 2,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.10)",
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
