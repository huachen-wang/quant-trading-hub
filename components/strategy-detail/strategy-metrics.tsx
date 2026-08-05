import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AppColors, StrategyDetailData } from "./types";

type StrategyMetricsProps = {
  strategy: StrategyDetailData;
  colors: AppColors;
  isPositive: boolean;
};

export function StrategyMetrics({ strategy, colors, isPositive }: StrategyMetricsProps) {
  const openLink = (url?: string | null) => {
    if (url && /^https:\/\//i.test(url)) Linking.openURL(url);
  };

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
          {(strategy.sourceName || strategy.sourceUrl || strategy.evidenceUrl) ? (
            <View style={[styles.sourceRow, { borderTopColor: colors.border }]}>
              <View style={styles.sourceCopy}>
                <Text style={[styles.sourceLabel, { color: colors.muted }]}>参考来源</Text>
                <Text style={[styles.sourceName, { color: colors.foreground }]} numberOfLines={1}>
                  {strategy.sourceName || "公开资料"}
                </Text>
              </View>
              <View style={styles.sourceActions}>
                {strategy.sourceUrl ? (
                  <TouchableOpacity onPress={() => openLink(strategy.sourceUrl)} style={[styles.sourceButton, { borderColor: colors.border }]}>
                    <Text style={[styles.sourceButtonText, { color: colors.primary }]}>查看来源</Text>
                  </TouchableOpacity>
                ) : null}
                {strategy.evidenceUrl && strategy.evidenceUrl !== strategy.sourceUrl ? (
                  <TouchableOpacity onPress={() => openLink(strategy.evidenceUrl)} style={[styles.sourceButton, { borderColor: colors.border }]}>
                    <Text style={[styles.sourceButtonText, { color: colors.primary }]}>验证记录</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
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
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    gap: 12,
  },
  sourceCopy: {
    flex: 1,
    minWidth: 0,
  },
  sourceLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  sourceName: {
    fontSize: 12,
    fontWeight: "700",
  },
  sourceActions: {
    flexDirection: "row",
    gap: 6,
  },
  sourceButton: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sourceButtonText: {
    fontSize: 11,
    fontWeight: "700",
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
