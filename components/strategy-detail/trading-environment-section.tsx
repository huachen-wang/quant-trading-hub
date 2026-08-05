import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AppColors } from "./types";

type TradingEnvironmentSectionProps = {
  colors: AppColors;
  onOpenBroker: () => void;
  onOpenVps: () => void;
};

export function TradingEnvironmentSection({
  colors,
  onOpenBroker,
  onOpenVps,
}: TradingEnvironmentSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>推荐交易环境</Text>
      <View style={styles.recommendRow}>
        <TouchableOpacity
          onPress={onOpenBroker}
          style={[styles.recommendCard, { backgroundColor: colors.surface }]}
          activeOpacity={0.8}
        >
          <Text style={styles.recommendCode}>BROKER</Text>
          <Text style={[styles.recommendTitle, { color: colors.foreground }]}>Blueberry Markets</Text>
          <Text style={[styles.recommendDesc, { color: colors.muted }]}>推荐经纪商 · 低点差</Text>
          <View style={[styles.recommendBadge, { backgroundColor: colors.success + "15" }]}>
            <Text style={[styles.recommendBadgeText, { color: colors.success }]}>官方合作</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onOpenVps}
          style={[styles.recommendCard, { backgroundColor: colors.surface }]}
          activeOpacity={0.8}
        >
          <Text style={styles.recommendCode}>VPS</Text>
          <Text style={[styles.recommendTitle, { color: colors.foreground }]}>VPS 服务器</Text>
          <Text style={[styles.recommendDesc, { color: colors.muted }]}>推荐可靠 VPS · 专属方案</Text>
          <View style={[styles.recommendBadge, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[styles.recommendBadgeText, { color: colors.primary }]}>稳定可靠</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
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
    marginBottom: 10,
  },
  recommendRow: {
    flexDirection: "row",
    gap: 10,
  },
  recommendCard: {
    flex: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  recommendCode: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 8,
  },
  recommendTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  recommendDesc: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 8,
  },
  recommendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  recommendBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
