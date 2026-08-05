import { memo } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { strategyInventoryStyles as styles } from "./strategy-inventory-styles";
import {
  STRATEGY_STATUS_OPTIONS,
  type StrategyCounts,
  type StrategyStatus,
} from "./strategy-inventory-types";

type InventoryColors = {
  border: string;
  foreground: string;
  muted: string;
  primary: string;
  surface: string;
};

type StrategyInventoryToolbarProps = {
  colors: InventoryColors;
  counts: StrategyCounts;
  deferredSearchQuery: string;
  isDesktop: boolean;
  onAdd: () => void;
  onChangeSearch: (value: string) => void;
  onChangeStatus: (value: StrategyStatus | undefined) => void;
  searchQuery: string;
  statusFilter: StrategyStatus | undefined;
  visibleCount: number;
};

export const StrategyInventoryToolbar = memo(function StrategyInventoryToolbar({
  colors,
  counts,
  deferredSearchQuery,
  isDesktop,
  onAdd,
  onChangeSearch,
  onChangeStatus,
  searchQuery,
  statusFilter,
  visibleCount,
}: StrategyInventoryToolbarProps) {
  return (
    <View style={[styles.controlPanel, { borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.headingBlock}>
          <Text style={styles.kicker}>STRATEGY INVENTORY</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            策略列表
          </Text>
        </View>
        <TouchableOpacity
          onPress={onAdd}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
          accessibilityLabel="添加策略"
        >
          <Ionicons name="add" size={18} color="#07101D" />
          <Text style={styles.addButtonText}>添加策略</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.toolbar, isDesktop && styles.toolbarDesktop]}>
        <View
          style={[
            styles.searchBox,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={onChangeSearch}
            placeholder="搜索名称、ID、平台、标签或交易品种"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.foreground }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="搜索策略"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => onChangeSearch("")}
              style={styles.clearSearchButton}
              accessibilityLabel="清空搜索"
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {STRATEGY_STATUS_OPTIONS.map((option) => {
            const active = statusFilter === option.value;
            const count = option.value ? counts[option.value] : counts.total;
            return (
              <TouchableOpacity
                key={option.label}
                onPress={() => onChangeStatus(option.value)}
                style={[
                  styles.filterButton,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? `${colors.primary}18`
                      : colors.surface,
                  },
                ]}
                activeOpacity={0.72}
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    { color: active ? colors.primary : colors.muted },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.filterCount,
                    { color: active ? colors.primary : colors.foreground },
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.resultRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.resultText, { color: colors.muted }]}>
          当前显示
        </Text>
        <Text style={[styles.resultCount, { color: colors.foreground }]}>
          {visibleCount}
        </Text>
        <Text style={[styles.resultText, { color: colors.muted }]}>条策略</Text>
        {searchQuery !== deferredSearchQuery ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}
      </View>
    </View>
  );
});
