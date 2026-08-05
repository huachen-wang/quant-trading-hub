import { StyleSheet, Text, View } from "react-native";
import type { AppColors, StrategyDetailData } from "./types";

type StrategyMetricsProps = {
  strategy: StrategyDetailData;
  colors: AppColors;
  isPositive: boolean;
};

export function StrategyMetrics({ strategy, colors, isPositive }: StrategyMetricsProps) {
  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.standaloneSectionTitle, { color: colors.foreground }]}>策略画像</Text>
        <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>总收益率</Text>
              <Text style={[styles.statValue, { color: isPositive ? colors.success : colors.error }]}>
                {isPositive ? "+" : ""}{strategy.totalReturn}%
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>胜率</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{strategy.winRate}%</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>最大回撤</Text>
              <Text style={[styles.statValue, { color: colors.error }]}>{strategy.maxDrawdown}%</Text>
            </View>
          </View>
          <Text style={[styles.statusNote, { color: colors.muted }]}>
            页面数据用于快速比较策略定位，不构成收益承诺；具体版本、参数与适用环境请联系确认。
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.standaloneSectionTitle, { color: colors.foreground }]}>交易信息</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>交易对</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{strategy.pairs || "—"}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>时间周期</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{strategy.timeframe || "—"}</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  standaloneSectionTitle: {
    marginBottom: 10,
  },
  statsCard: {
    borderRadius: 8,
    padding: 14,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusNote: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  infoCard: {
    borderRadius: 8,
    padding: 14,
  },
  infoRow: {
    flexDirection: "row",
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
  },
});
