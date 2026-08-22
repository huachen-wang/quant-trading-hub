import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CoreStrategy } from "@/shared/v2/contracts";
import { formatMoney, formatPct, riskLabel } from "./format";
import { StatusBadge } from "./status-badge";
import { V2 } from "./tokens";

type StrategyCardProps = {
  strategy: CoreStrategy;
  selected?: boolean;
  onPress: (strategyId: string) => void;
  onToggle?: (strategyId: string) => void;
};

function StrategyCardBase({
  strategy,
  selected = false,
  onPress,
  onToggle,
}: StrategyCardProps) {
  const unavailable = strategy.source.freshness === "OFFLINE";

  return (
    <View
      style={[
        styles.card,
        { borderTopColor: strategy.accent },
        selected && styles.cardSelected,
      ]}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`查看 ${strategy.name} 详情`}
        onPress={() => onPress(strategy.id)}
        style={({ pressed }) => [styles.detailLink, pressed && styles.pressed]}
      >
        <View style={styles.imageWrap}>
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
          <View style={styles.sourceBadge}>
            <StatusBadge
              compact
              dataMode={strategy.source.dataMode}
              freshness={strategy.source.freshness}
            />
          </View>
        </View>
      </Pressable>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title} numberOfLines={1}>
              {strategy.name}
            </Text>
            <Text style={styles.tagline} numberOfLines={1}>
              {strategy.tagline}
            </Text>
          </View>
          <Text style={styles.version} numberOfLines={1}>
            {strategy.version}
          </Text>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {strategy.description}
        </Text>

        <View style={styles.metrics}>
          <Metric
            label="90 日"
            value={formatPct(strategy.metrics.return90dPct, true)}
            color={strategy.accent}
          />
          <Metric
            label="回撤"
            value={formatPct(strategy.metrics.maxDrawdownPct)}
          />
          <Metric label="风险" value={riskLabel(strategy.riskLevel)} />
          <Metric
            label="资金门槛"
            value={formatMoney(strategy.minimumCapital, "USD", true)}
          />
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`查看 ${strategy.name} 的运行详情`}
            onPress={() => onPress(strategy.id)}
            style={({ pressed }) => [
              styles.textAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.textActionLabel}>运行详情</Text>
            <MaterialIcons
              name="arrow-forward"
              size={15}
              color={V2.textMuted}
            />
          </Pressable>

          {onToggle ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: unavailable }}
              accessibilityLabel={`${selected ? "移出" : "加入"} ${strategy.shortName} 量化方案`}
              disabled={unavailable}
              onPress={() => onToggle(strategy.id)}
              style={({ pressed }) => [
                styles.selectButton,
                selected && styles.selectButtonActive,
                unavailable && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name={selected ? "check" : unavailable ? "cloud-off" : "add"}
                size={16}
                color={selected ? V2.background : V2.text}
              />
              <Text
                style={[
                  styles.selectLabel,
                  selected && styles.selectLabelActive,
                ]}
              >
                {selected ? "已加入" : unavailable ? "暂不可选" : "加入方案"}
              </Text>
            </Pressable>
          ) : null}
        </View>
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
    borderColor: "rgba(216,188,131,0.72)",
    backgroundColor: "#121C2B",
  },
  detailLink: { width: "100%" },
  imageWrap: {
    width: "100%",
    aspectRatio: 3.8,
    position: "relative",
    backgroundColor: V2.surfaceMuted,
  },
  image: { width: "100%", height: "100%" },
  slotMarker: {
    position: "absolute",
    top: 9,
    left: 9,
    width: 30,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(7,11,18,0.82)",
  },
  slotText: { color: V2.text, fontSize: 10, fontWeight: "900" },
  sourceBadge: { position: "absolute", top: 8, right: 8 },
  body: { padding: 10, gap: 6 },
  titleRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  titleCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: V2.text, fontSize: 15, lineHeight: 19, fontWeight: "900" },
  tagline: { color: V2.textMuted, fontSize: 10, lineHeight: 14 },
  version: {
    maxWidth: 108,
    color: V2.gold,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  description: {
    minHeight: 27,
    color: V2.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  metrics: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
    paddingRight: 5,
  },
  metricLabel: { color: V2.textDim, fontSize: 8, lineHeight: 11 },
  metricValue: {
    color: V2.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },
  footer: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  textAction: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  textActionLabel: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  selectButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  selectButtonActive: { borderColor: V2.gold, backgroundColor: V2.gold },
  selectLabel: { color: V2.text, fontSize: 10, fontWeight: "900" },
  selectLabelActive: { color: V2.background },
  disabled: { opacity: 0.46 },
  pressed: { opacity: 0.72 },
});
