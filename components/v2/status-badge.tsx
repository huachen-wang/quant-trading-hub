import { StyleSheet, Text, View } from "react-native";
import type { DataMode, Freshness } from "@/shared/v2/contracts";
import { V2 } from "./tokens";

type StatusBadgeProps = {
  dataMode?: DataMode;
  freshness?: Freshness;
  compact?: boolean;
};

const FRESHNESS_LABEL: Record<Freshness, string> = {
  FRESH: "同步正常",
  STALE: "数据延迟",
  OFFLINE: "连接中断",
};

export function StatusBadge({
  dataMode,
  freshness,
  compact = false,
}: StatusBadgeProps) {
  const state = freshness ?? "FRESH";
  const mode = dataMode ?? "LIVE";
  const modeLabel = {
    DEMO: "模拟数据",
    CUSTOM: "自定义历史",
    LIVE: "实盘同步",
    HYBRID: "历史 + 实盘",
  }[mode];
  const modeColor = {
    DEMO: V2.amber,
    CUSTOM: V2.blue,
    LIVE: V2.green,
    HYBRID: V2.gold,
  }[mode];
  const color = state === "OFFLINE" ? V2.red : state === "STALE" ? V2.amber : modeColor;
  const label = state === "FRESH" ? modeLabel : `${modeLabel} · ${FRESHNESS_LABEL[state]}`;

  return (
    <View
      accessibilityLabel={`${label}，${FRESHNESS_LABEL[state]}`}
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { borderColor: `${color}66`, backgroundColor: `${color}12` },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, compact && styles.labelCompact, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 26,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeCompact: {
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  labelCompact: { fontSize: 10, lineHeight: 12 },
});
