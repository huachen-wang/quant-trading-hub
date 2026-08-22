import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CoreStrategy } from "@/shared/v2/contracts";
import { EquityChart } from "./equity-chart";
import { formatPct, riskLabel } from "./format";
import { StatusBadge } from "./status-badge";
import { V2 } from "./tokens";

function StrategyCardBase({
  strategy,
  onPress,
}: {
  strategy: CoreStrategy;
  onPress: () => void;
}) {
  const unavailable = strategy.source.freshness === "OFFLINE";

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`查看 ${strategy.name} 详情`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderTopColor: strategy.accent },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: strategy.artwork }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={140}
          recyclingKey={strategy.artwork}
          priority="low"
        />
        <View style={styles.slotMarker}>
          <Text style={styles.slotText}>{String(strategy.homeSlot).padStart(2, "0")}</Text>
        </View>
      </View>

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
          <StatusBadge
            compact
            dataMode={strategy.source.dataMode}
            freshness={strategy.source.freshness}
          />
        </View>

        <View style={styles.chart}>
          <EquityChart
            points={unavailable ? [] : strategy.equity.slice(-30)}
            color={strategy.accent}
            height={68}
            emptyLabel="等待数据恢复"
          />
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>近 90 日</Text>
            <Text style={[styles.metricValue, { color: strategy.accent }]}>
              {formatPct(strategy.metrics.return90dPct, true)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>最大回撤</Text>
            <Text style={styles.metricValue}>
              {formatPct(strategy.metrics.maxDrawdownPct)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>风险</Text>
            <Text style={styles.metricValue}>{riskLabel(strategy.riskLevel)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.version} numberOfLines={1}>{strategy.version}</Text>
          <View style={styles.detailAction}>
            <Text style={styles.detailActionText}>查看数据</Text>
            <MaterialIcons name="arrow-forward" size={15} color={V2.text} />
          </View>
        </View>
      </View>
    </Pressable>
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
  pressed: { opacity: 0.82, transform: [{ translateY: 1 }] },
  imageWrap: { width: "100%", aspectRatio: 2.25, position: "relative", backgroundColor: V2.surfaceMuted },
  image: { width: "100%", height: "100%" },
  slotMarker: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 30,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(7,11,18,0.78)",
  },
  slotText: { color: V2.text, fontSize: 10, fontWeight: "900" },
  body: { padding: 15, gap: 13 },
  titleRow: { minHeight: 45, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titleCopy: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: V2.text, fontSize: 17, lineHeight: 22, fontWeight: "900", letterSpacing: 0 },
  tagline: { color: V2.textMuted, fontSize: 11, lineHeight: 16 },
  chart: { height: 68 },
  metrics: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  metric: { flex: 1, minWidth: 0, justifyContent: "center", gap: 3, paddingVertical: 8 },
  metricLabel: { color: V2.textDim, fontSize: 10, lineHeight: 12 },
  metricValue: { color: V2.text, fontSize: 13, lineHeight: 17, fontWeight: "800" },
  footer: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  version: { color: V2.textMuted, fontSize: 11, flex: 1 },
  detailAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailActionText: { color: V2.text, fontSize: 11, fontWeight: "800" },
});
