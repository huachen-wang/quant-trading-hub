import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CoreStrategy } from "@/shared/v2/contracts";
import { formatMoney, formatPct, riskLabel } from "./format";
import { StrategySparkline } from "./strategy-sparkline";
import { V2 } from "./tokens";

type StrategyCardProps = {
  strategy: CoreStrategy;
  selected?: boolean;
  compact?: boolean;
  onPress: (strategyId: string) => void;
  onToggle?: (strategyId: string) => void;
};

function sourceState(strategy: CoreStrategy) {
  if (strategy.source.freshness === "OFFLINE") return "离线";
  if (strategy.source.freshness === "STALE") return "延迟";
  if (strategy.source.dataMode === "DEMO") return "模拟";
  if (strategy.source.dataMode === "CUSTOM") return "自定义";
  return "实盘";
}

function sourceColor(strategy: CoreStrategy) {
  if (strategy.source.freshness === "OFFLINE") return V2.red;
  if (strategy.source.freshness === "STALE") return V2.amber;
  if (strategy.source.dataMode === "DEMO") return V2.amber;
  return V2.green;
}

function StrategyCardBase({
  strategy,
  selected = false,
  compact = false,
  onPress,
  onToggle,
}: StrategyCardProps) {
  const unavailable = strategy.source.freshness === "OFFLINE";
  const selectable = Boolean(onToggle);
  const toggleLabel = selected ? "移出组合" : "加入组合";

  return (
    <View
      style={[
        styles.card,
        { borderTopColor: strategy.accent },
        selected && styles.cardSelected,
        unavailable && styles.cardUnavailable,
      ]}
    >
      <Pressable
        accessibilityRole={selectable ? "checkbox" : "link"}
        accessibilityState={
          selectable ? { checked: selected, disabled: unavailable } : undefined
        }
        accessibilityLabel={
          selectable
            ? `${toggleLabel} ${strategy.shortName}`
            : `查看 ${strategy.name} 详情`
        }
        disabled={selectable && unavailable}
        onPress={() =>
          selectable ? onToggle?.(strategy.id) : onPress(strategy.id)
        }
        style={({ pressed }) => [
          styles.selector,
          compact && styles.selectorCompact,
          pressed && styles.selectorPressed,
        ]}
      >
        <View style={styles.primaryRow}>
          <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
            <Image
              accessibilityLabel={`${strategy.shortName} 策略视觉图`}
              source={{ uri: strategy.artwork }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              recyclingKey={strategy.artwork}
              priority={strategy.homeSlot <= 3 ? "high" : "normal"}
            />
            <View style={styles.slotMarker}>
              <Text style={styles.slotText}>
                {String(strategy.homeSlot).padStart(2, "0")}
              </Text>
            </View>
          </View>

          <View style={styles.primaryCopy}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, compact && styles.titleCompact]}
                numberOfLines={1}
              >
                {compact ? strategy.shortName : strategy.name}
              </Text>
              <MaterialIcons
                name={selected ? "check-box" : "check-box-outline-blank"}
                size={compact ? 17 : 19}
                color={selected ? V2.gold : V2.textDim}
              />
            </View>
            <Text style={styles.tagline} numberOfLines={1}>
              {strategy.tagline}
            </Text>
            <View style={styles.identityRow}>
              <Text style={styles.version} numberOfLines={1}>
                {strategy.version}
              </Text>
              {!compact ? (
                <>
                  <Text style={styles.identityDivider}>·</Text>
                  <Text style={styles.equity} numberOfLines={1}>
                    权益 {formatMoney(strategy.metrics.equity, "USD", true)}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {compact ? (
          <View style={styles.compactMetrics}>
            <Metric
              label="今日"
              value={formatPct(strategy.metrics.todayPnlPct, true)}
              color={
                strategy.metrics.todayPnlPct !== null &&
                strategy.metrics.todayPnlPct < 0
                  ? V2.red
                  : V2.green
              }
            />
            <Metric
              label="90D"
              value={formatPct(strategy.metrics.return90dPct, true)}
              color={strategy.accent}
            />
            <Metric
              label="回撤"
              value={formatPct(strategy.metrics.maxDrawdownPct)}
            />
            <Metric
              label="起配"
              value={formatMoney(strategy.minimumCapital, "USD", true)}
            />
          </View>
        ) : (
          <View style={styles.dataRow}>
            <View style={styles.chartColumn}>
              <View style={styles.chartHeading}>
                <Text style={styles.chartLabel}>净值轨迹</Text>
                <Text
                  style={[
                    styles.todayValue,
                    {
                      color:
                        strategy.metrics.todayPnlPct !== null &&
                        strategy.metrics.todayPnlPct < 0
                          ? V2.red
                          : V2.green,
                    },
                  ]}
                >
                  今日 {formatPct(strategy.metrics.todayPnlPct, true)}
                </Text>
              </View>
              <StrategySparkline
                points={strategy.equity}
                color={strategy.accent}
                height={34}
              />
            </View>
            <View style={styles.metricRail}>
              <Metric
                label="90D"
                value={formatPct(strategy.metrics.return90dPct, true)}
                color={strategy.accent}
              />
              <Metric
                label="回撤"
                value={formatPct(strategy.metrics.maxDrawdownPct)}
              />
              <Metric label="风险" value={riskLabel(strategy.riskLevel)} />
              <Metric
                label="起配"
                value={formatMoney(strategy.minimumCapital, "USD", true)}
              />
            </View>
          </View>
        )}
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.runtimeState}>
          <View
            style={[
              styles.runtimeDot,
              { backgroundColor: sourceColor(strategy) },
            ]}
          />
          <Text style={styles.runtimeText}>{sourceState(strategy)}</Text>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.selectionState,
            selected && styles.selectionStateActive,
          ]}
          numberOfLines={1}
        >
          {unavailable ? "暂不可选" : selected ? "已加入组合" : "未加入"}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`查看 ${strategy.name} 的运行详情`}
          onPress={() => onPress(strategy.id)}
          style={({ pressed }) => [
            styles.detailButton,
            pressed && styles.pressed,
          ]}
        >
          {!compact ? <Text style={styles.detailText}>详情</Text> : null}
          <MaterialIcons name="arrow-forward" size={14} color={V2.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function Metric({
  label,
  value,
  color = V2.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export const StrategyCard = memo(StrategyCardBase);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderTopWidth: 2,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.surface,
  },
  cardSelected: {
    borderColor: "rgba(216,188,131,0.78)",
    backgroundColor: "#121C2B",
  },
  cardUnavailable: { opacity: 0.7 },
  selector: { padding: 8, gap: 8 },
  selectorCompact: { padding: 6, gap: 6 },
  selectorPressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
  primaryRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 9,
  },
  imageWrap: {
    width: 92,
    height: 66,
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: V2.surfaceMuted,
  },
  imageWrapCompact: { width: 58, height: 58 },
  image: { width: "100%", height: "100%" },
  slotMarker: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 24,
    height: 19,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(7,11,18,0.82)",
  },
  slotText: { color: V2.text, fontSize: 8, fontWeight: "900" },
  primaryCopy: { flex: 1, minWidth: 0, justifyContent: "center", gap: 4 },
  titleRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: V2.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  titleCompact: { fontSize: 11, lineHeight: 15 },
  tagline: { color: V2.textMuted, fontSize: 9, lineHeight: 13 },
  identityRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  version: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  identityDivider: { color: V2.textDim, fontSize: 8 },
  equity: { flex: 1, minWidth: 0, color: V2.textMuted, fontSize: 8 },
  dataRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: V2.border,
  },
  chartColumn: { flex: 1, minWidth: 0, paddingTop: 4, paddingRight: 8 },
  chartHeading: {
    minHeight: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  chartLabel: { color: V2.textDim, fontSize: 7 },
  todayValue: { fontSize: 8, fontWeight: "900" },
  metricRail: {
    width: 176,
    flexDirection: "row",
    flexWrap: "wrap",
    borderLeftWidth: 1,
    borderLeftColor: V2.border,
  },
  compactMetrics: {
    minHeight: 53,
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: V2.border,
  },
  metric: {
    width: "50%",
    minWidth: 0,
    justifyContent: "center",
    gap: 1,
    paddingLeft: 7,
    paddingVertical: 3,
  },
  metricLabel: { color: V2.textDim, fontSize: 7, lineHeight: 10 },
  metricValue: {
    color: V2.text,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
  },
  footer: {
    minHeight: 32,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  runtimeState: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  runtimeDot: { width: 6, height: 6, borderRadius: 3 },
  runtimeText: { color: V2.textDim, fontSize: 8 },
  selectionState: {
    flex: 1,
    minWidth: 0,
    color: V2.textDim,
    fontSize: 8,
    fontWeight: "800",
    textAlign: "right",
  },
  selectionStateActive: { color: V2.gold },
  detailButton: {
    minWidth: 27,
    minHeight: 27,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  detailText: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  pressed: { opacity: 0.68 },
});
