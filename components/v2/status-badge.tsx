import { StyleSheet, Text, View } from "react-native";
import { useLanguage } from "@/lib/language";
import type { DataMode, Freshness } from "@/shared/v2/contracts";
import { V2 } from "./tokens";

type StatusBadgeProps = {
  dataMode?: DataMode;
  freshness?: Freshness;
  compact?: boolean;
};

export function StatusBadge({
  dataMode,
  freshness,
  compact = false,
}: StatusBadgeProps) {
  const { text } = useLanguage();
  const state = freshness ?? "FRESH";
  const mode = dataMode ?? "LIVE";
  const freshnessLabel: Record<Freshness, string> = {
    FRESH: text("同步正常", "Synced", "متزامن"),
    STALE: text("数据延迟", "Delayed", "متأخر"),
    OFFLINE: text("连接中断", "Disconnected", "غير متصل"),
  };
  const modeLabel = {
    DEMO: text("模拟数据", "Demo data", "بيانات تجريبية"),
    CUSTOM: text("自定义历史", "Custom history", "سجل مخصص"),
    LIVE: text("实盘同步", "Live sync", "مزامنة حية"),
    HYBRID: text("历史 + 实盘", "History + live", "سجل + مباشر"),
  }[mode];
  const modeColor = {
    DEMO: V2.amber,
    CUSTOM: V2.blue,
    LIVE: V2.green,
    HYBRID: V2.gold,
  }[mode];
  const color =
    state === "OFFLINE" ? V2.red : state === "STALE" ? V2.amber : modeColor;
  const label =
    state === "FRESH" ? modeLabel : `${modeLabel} · ${freshnessLabel[state]}`;

  return (
    <View
      accessibilityLabel={`${label}, ${freshnessLabel[state]}`}
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
