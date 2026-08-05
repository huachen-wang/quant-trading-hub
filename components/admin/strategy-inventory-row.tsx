import { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { strategyInventoryStyles as styles } from "./strategy-inventory-styles";
import {
  getStrategyStatusLabel,
  type AdminStrategy,
} from "./strategy-inventory-types";

type InventoryColors = {
  border: string;
  error: string;
  foreground: string;
  muted: string;
  primary: string;
  success: string;
  surface: string;
  warning: string;
};

type StrategyInventoryRowProps = {
  colors: InventoryColors;
  isDesktop: boolean;
  item: AdminStrategy;
  onBacktest: (item: AdminStrategy) => void;
  onDelete: (id: number, title: string) => void;
  onEdit: (id: number) => void;
};

type StrategyActionsProps = StrategyInventoryRowProps;

function StrategyActions({
  colors,
  isDesktop,
  item,
  onBacktest,
  onDelete,
  onEdit,
}: StrategyActionsProps) {
  return (
    <View style={[styles.actions, isDesktop && styles.actionsDesktop]}>
      <TouchableOpacity
        onPress={() => onEdit(item.id)}
        style={[styles.actionButton, styles.editButton]}
        activeOpacity={0.72}
        accessibilityLabel={`编辑 ${item.title}`}
      >
        <Ionicons name="create-outline" size={15} color="#D8BC83" />
        <Text style={styles.editButtonText}>编辑</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onBacktest(item)}
        style={[styles.actionButton, styles.backtestButton]}
        activeOpacity={0.72}
        accessibilityLabel={`管理 ${item.title} 回测数据`}
      >
        <Ionicons name="stats-chart-outline" size={14} color={colors.success} />
        <Text style={[styles.actionButtonText, { color: colors.success }]}>
          回测
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onDelete(item.id, item.title)}
        style={[styles.actionButton, styles.deleteButton]}
        activeOpacity={0.72}
        accessibilityLabel={`删除 ${item.title}`}
      >
        <Ionicons name="trash-outline" size={14} color={colors.error} />
        <Text style={[styles.actionButtonText, { color: colors.error }]}>
          删除
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const StrategyInventoryRow = memo(function StrategyInventoryRow({
  colors,
  isDesktop,
  item,
  onBacktest,
  onDelete,
  onEdit,
}: StrategyInventoryRowProps) {
  const statusColor =
    item.status === "published"
      ? colors.success
      : item.status === "draft"
        ? colors.warning
        : colors.muted;
  const details = [item.pairs, item.timeframe, item.tags]
    .filter(Boolean)
    .join(" · ");
  const actions = (
    <StrategyActions
      colors={colors}
      isDesktop={isDesktop}
      item={item}
      onBacktest={onBacktest}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  );

  if (!isDesktop) {
    return (
      <View
        style={[
          styles.mobileCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.mobileTopRow}>
          <TouchableOpacity
            style={styles.mobileTitleButton}
            onPress={() => onEdit(item.id)}
          >
            <Text style={[styles.itemId, { color: colors.muted }]}>
              #{item.id}
            </Text>
            <Text
              style={[styles.mobileTitle, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusColor}18` },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStrategyStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <Text
          style={[styles.detailText, { color: colors.muted }]}
          numberOfLines={1}
        >
          {details || item.description || "未设置策略摘要"}
        </Text>
        <View style={styles.mobileMetaRow}>
          <Text style={[styles.platformText, { color: colors.primary }]}>
            {item.platform || "--"}
          </Text>
          <Text style={[styles.metricInline, { color: colors.muted }]}>
            收益 {item.totalReturn || "0.00"}%
          </Text>
          <Text style={[styles.metricInline, { color: colors.muted }]}>
            胜率 {item.winRate || "0.00"}%
          </Text>
        </View>
        {actions}
      </View>
    );
  }

  return (
    <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
      <View style={styles.strategyColumn}>
        <TouchableOpacity
          style={styles.titleButton}
          onPress={() => onEdit(item.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.itemId, { color: colors.muted }]}>
            #{item.id}
          </Text>
          <Text
            style={[styles.itemTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.detailText, { color: colors.muted }]}
          numberOfLines={1}
        >
          {details || item.description || "未设置策略摘要"}
        </Text>
      </View>

      <View style={styles.platformColumn}>
        <Text style={[styles.platformText, { color: colors.primary }]}>
          {item.platform || "--"}
        </Text>
      </View>

      <View style={styles.statusColumn}>
        <View
          style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>
            {getStrategyStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.metricsColumn}>
        <View style={styles.metricCell}>
          <Text style={[styles.metricLabel, { color: colors.muted }]}>
            收益
          </Text>
          <Text style={[styles.metricValue, { color: colors.foreground }]}>
            {item.totalReturn || "0.00"}%
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={[styles.metricLabel, { color: colors.muted }]}>
            胜率
          </Text>
          <Text style={[styles.metricValue, { color: colors.foreground }]}>
            {item.winRate || "0.00"}%
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={[styles.metricLabel, { color: colors.muted }]}>
            下载
          </Text>
          <Text style={[styles.metricValue, { color: colors.foreground }]}>
            {(item.downloadCount || 0) + (item.virtualDownloads || 0)}
          </Text>
        </View>
      </View>

      {actions}
    </View>
  );
});

export function StrategyInventoryTableHeader({
  colors,
}: {
  colors: InventoryColors;
}) {
  return (
    <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
      <Text
        style={[
          styles.strategyColumn,
          styles.columnLabel,
          { color: colors.muted },
        ]}
      >
        策略
      </Text>
      <Text
        style={[
          styles.platformColumn,
          styles.columnLabel,
          { color: colors.muted },
        ]}
      >
        平台
      </Text>
      <Text
        style={[
          styles.statusColumn,
          styles.columnLabel,
          { color: colors.muted },
        ]}
      >
        状态
      </Text>
      <Text
        style={[
          styles.metricsColumn,
          styles.columnLabel,
          { color: colors.muted },
        ]}
      >
        数据
      </Text>
      <Text
        style={[
          styles.actionsDesktop,
          styles.columnLabel,
          { color: colors.muted },
        ]}
      >
        操作
      </Text>
    </View>
  );
}

export function StrategyInventoryEmpty({
  colors,
}: {
  colors: InventoryColors;
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={28} color={colors.muted} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        没有找到匹配策略
      </Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>
        换一个关键词或清除状态筛选
      </Text>
    </View>
  );
}
