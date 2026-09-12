import { StyleSheet, Text, View } from "react-native";
import { resolveMetricDisplay, resolveVerifyStatus } from "@/lib/strategy-claims";
import type { AppColors, StrategyDetailData } from "./types";

type StrategyMetricsProps = {
  strategy: StrategyDetailData;
  colors: AppColors;
  isPositive: boolean;
};

export function StrategyMetrics({ strategy, colors, isPositive }: StrategyMetricsProps) {
  const status = resolveVerifyStatus(strategy.dataStatus);
  const statusColor =
    status.tone === "success" ? colors.success : status.tone === "primary" ? colors.primary : colors.warning;
  const totalReturn = resolveMetricDisplay(strategy.totalReturn, "totalReturn", strategy.dataStatus);
  const winRate = resolveMetricDisplay(strategy.winRate, "winRate", strategy.dataStatus);
  const maxDrawdown = resolveMetricDisplay(strategy.maxDrawdown, "maxDrawdown", strategy.dataStatus);
  const anySuppressed = totalReturn.suppressed || winRate.suppressed || maxDrawdown.suppressed;

  return (
    <>
      <View style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={[styles.sectionTitle, styles.standaloneSectionTitle, { color: colors.foreground }]}>策略画像</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: `${statusColor}14` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{status.label}</Text>
          </View>
        </View>
        <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>总收益率</Text>
              <Text
                style={[
                  styles.statValue,
                  { color: totalReturn.suppressed ? colors.muted : isPositive ? colors.success : colors.error },
                ]}
              >
                {totalReturn.suppressed ? totalReturn.display : `${isPositive ? "+" : ""}${totalReturn.display}`}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>胜率</Text>
              <Text style={[styles.statValue, { color: winRate.suppressed ? colors.muted : colors.primary }]}>
                {winRate.display}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>最大回撤</Text>
              <Text style={[styles.statValue, { color: maxDrawdown.suppressed ? colors.muted : colors.error }]}>
                {maxDrawdown.display}
              </Text>
            </View>
          </View>
          <Text style={[styles.statusNote, { color: colors.muted }]}>
            {status.key === "verified"
              ? "以上数据已核验，仍建议核对账户、区间与更新时间；不构成收益承诺。"
              : `以上数字来自${strategy.sourceName?.trim() || "公开资料"}，我们尚未独立核验，不作为经营自测结果；不构成收益承诺。`}
            {anySuppressed ? " 显示为「—」的指标缺少可核验材料，未以具体数值展示。" : ""}
            具体版本、参数与适用环境请联系确认。
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  statusBadge: {
    minHeight: 22,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
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
