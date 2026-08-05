import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  resolveStrategyEvidence,
  type StrategyEvidenceItem,
  type StrategyEvidenceTone,
} from "@/lib/strategy-evidence";
import type { AppColors, StrategyDetailData } from "./types";

type StrategyEvidenceSectionProps = {
  strategy: StrategyDetailData;
  colors: AppColors;
};

const ICONS: Record<
  StrategyEvidenceItem["id"],
  keyof typeof Ionicons.glyphMap
> = {
  source: "document-text-outline",
  performance: "analytics-outline",
  environment: "options-outline",
};

function toneColor(tone: StrategyEvidenceTone, colors: AppColors) {
  if (tone === "success") return colors.success;
  if (tone === "primary") return colors.primary;
  if (tone === "warning") return colors.warning;
  return colors.muted;
}

export function StrategyEvidenceSection({
  strategy,
  colors,
}: StrategyEvidenceSectionProps) {
  const evidence = resolveStrategyEvidence(strategy);
  const summaryColor = toneColor(evidence.tone, colors);

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            资料与证据
          </Text>
          <Text style={[styles.headingNote, { color: colors.muted }]}>
            {evidence.note}
          </Text>
        </View>
        <View
          style={[
            styles.summaryBadge,
            { backgroundColor: `${summaryColor}16` },
          ]}
        >
          <View
            style={[styles.summaryDot, { backgroundColor: summaryColor }]}
          />
          <Text style={[styles.summaryText, { color: summaryColor }]}>
            {evidence.label}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.list,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        {evidence.items.map((item, index) => {
          const statusColor = toneColor(item.tone, colors);
          return (
            <View
              key={item.id}
              style={[
                styles.row,
                index > 0 && styles.rowBorder,
                index > 0 && { borderTopColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: `${statusColor}12` },
                ]}
              >
                <Ionicons name={ICONS[item.id]} size={18} color={statusColor} />
              </View>
              <View style={styles.rowCopy}>
                <View style={styles.rowTitleLine}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.rowStatus, { color: statusColor }]}>
                    {item.status}
                  </Text>
                </View>
                <Text style={[styles.rowDetail, { color: colors.muted }]}>
                  {item.detail}
                </Text>
              </View>
              {item.url && item.actionLabel ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(item.url!)}
                  style={[styles.linkButton, { borderColor: colors.border }]}
                  activeOpacity={0.72}
                  accessibilityRole="link"
                  accessibilityLabel={`${item.title}：${item.actionLabel}`}
                >
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={[styles.linkText, { color: colors.primary }]}>
                    {item.actionLabel}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  heading: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 3,
  },
  headingNote: {
    fontSize: 11,
    lineHeight: 17,
  },
  summaryBadge: {
    minHeight: 26,
    borderRadius: 5,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryText: {
    fontSize: 11,
    fontWeight: "800",
  },
  list: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  row: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 13,
  },
  rowBorder: {
    borderTopWidth: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  rowStatus: {
    fontSize: 10,
    fontWeight: "800",
  },
  rowDetail: {
    fontSize: 11,
    lineHeight: 17,
  },
  linkButton: {
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  linkText: {
    fontSize: 10,
    fontWeight: "800",
  },
});
