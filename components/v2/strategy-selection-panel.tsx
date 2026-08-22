import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CoreStrategy } from "@/shared/v2/contracts";
import { V2 } from "./tokens";

type StrategySelectionPanelProps = {
  selectedStrategies: CoreStrategy[];
  total: number;
  feedback?: string;
  compact?: boolean;
  inline?: boolean;
  onRemove: (strategyId: string) => void;
  onContinue: () => void;
};

export function StrategySelectionPanel({
  selectedStrategies,
  total,
  feedback,
  compact = false,
  inline = false,
  onRemove,
  onContinue,
}: StrategySelectionPanelProps) {
  const hasSelection = selectedStrategies.length > 0;
  const selectionChips = hasSelection ? (
    selectedStrategies.map((strategy) => (
      <Pressable
        key={strategy.id}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true }}
        accessibilityLabel={`移出 ${strategy.shortName}`}
        onPress={() => onRemove(strategy.id)}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <View
          style={[styles.strategyDot, { backgroundColor: strategy.accent }]}
        />
        <Text style={styles.chipText} numberOfLines={1}>
          {strategy.shortName}
        </Text>
        <MaterialIcons name="close" size={13} color={V2.textMuted} />
      </Pressable>
    ))
  ) : (
    <View style={styles.emptyState}>
      <MaterialIcons
        name="check-box-outline-blank"
        size={17}
        color={V2.textDim}
      />
      <Text style={styles.emptyText}>尚未加入策略</Text>
    </View>
  );

  if (inline) {
    return (
      <View style={styles.panelInline}>
        <View style={styles.inlineHeader}>
          <View style={styles.inlineTitleRow}>
            <Text style={styles.eyebrow}>PORTFOLIO</Text>
            <View style={styles.countInline}>
              <Text style={styles.countInlineValue}>
                {selectedStrategies.length}
              </Text>
              <Text style={styles.countTotal}>/ {total}</Text>
            </View>
          </View>
          <View style={[styles.progress, styles.progressInline]}>
            {Array.from({ length: total }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  index < selectedStrategies.length && styles.progressSegmentOn,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.chipsInline}>{selectionChips}</View>

        <View accessibilityLiveRegion="polite" style={styles.feedbackInline}>
          <MaterialIcons
            name={feedback ? "check-circle" : "sync"}
            size={15}
            color={feedback ? V2.green : V2.textDim}
          />
          <Text
            style={[styles.feedbackText, feedback && styles.feedbackTextActive]}
            numberOfLines={1}
          >
            {feedback || "已同步至方案参数"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="继续配置量化方案"
          disabled={!hasSelection}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.continueButton,
            styles.continueButtonInline,
            !hasSelection && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.continueText}>继续配置</Text>
          <MaterialIcons name="south" size={16} color={V2.background} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PORTFOLIO DRAFT</Text>
          <Text style={styles.title}>当前策略组合</Text>
        </View>
        <View style={styles.count}>
          <Text style={styles.countValue}>{selectedStrategies.length}</Text>
          <Text style={styles.countTotal}>/ {total}</Text>
        </View>
      </View>

      <View style={styles.progress}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[
              styles.progressSegment,
              index < selectedStrategies.length && styles.progressSegmentOn,
            ]}
          />
        ))}
      </View>

      <View style={[styles.chips, compact && styles.chipsCompact]}>
        {selectionChips}
      </View>

      <View
        accessibilityLiveRegion="polite"
        style={[styles.feedback, feedback && styles.feedbackActive]}
      >
        <MaterialIcons
          name={feedback ? "check-circle" : "sync"}
          size={15}
          color={feedback ? V2.green : V2.textDim}
        />
        <Text
          style={[styles.feedbackText, feedback && styles.feedbackTextActive]}
          numberOfLines={1}
        >
          {feedback || "策略状态已同步至方案参数"}
        </Text>
      </View>

      <View style={[styles.nextRow, compact && styles.nextRowCompact]}>
        <View style={styles.nextCopy}>
          <Text style={styles.nextLabel}>下一步</Text>
          <Text style={styles.nextValue} numberOfLines={1}>
            资金 · 风控 · 平台 · 模式
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="继续配置量化方案"
          disabled={!hasSelection}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.continueButton,
            !hasSelection && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.continueText}>继续配置</Text>
          <MaterialIcons name="south" size={16} color={V2.background} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 274,
    minHeight: 100,
    flexShrink: 0,
    alignSelf: "stretch",
    padding: 14,
    borderWidth: 1,
    borderTopWidth: 2,
    borderColor: V2.border,
    borderTopColor: V2.gold,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
    gap: 11,
  },
  panelCompact: { width: "100%", padding: 12, gap: 9 },
  panelInline: {
    width: "100%",
    minHeight: 70,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderTopWidth: 2,
    borderColor: V2.border,
    borderTopColor: V2.gold,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  inlineHeader: { width: 118, flexShrink: 0, gap: 7 },
  inlineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  countInline: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  countInlineValue: { color: V2.gold, fontSize: 18, fontWeight: "900" },
  progressInline: { width: "100%" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  eyebrow: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  title: { color: V2.text, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  count: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  countValue: {
    color: V2.gold,
    fontSize: 25,
    lineHeight: 27,
    fontWeight: "900",
  },
  countTotal: {
    paddingBottom: 2,
    color: V2.textDim,
    fontSize: 10,
    fontWeight: "800",
  },
  progress: { height: 3, flexDirection: "row", gap: 3 },
  progressSegment: { flex: 1, backgroundColor: V2.borderStrong },
  progressSegmentOn: { backgroundColor: V2.gold },
  chips: {
    minHeight: 68,
    alignContent: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipsCompact: { minHeight: 32 },
  chipsInline: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  chip: {
    maxWidth: "100%",
    minHeight: 27,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: V2.surfaceMuted,
  },
  strategyDot: { width: 3, height: 14 },
  chipText: {
    maxWidth: 130,
    color: V2.text,
    fontSize: 9,
    fontWeight: "800",
  },
  emptyState: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  emptyText: { color: V2.textDim, fontSize: 9 },
  feedback: {
    minHeight: 30,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  feedbackActive: {
    borderColor: "rgba(66,211,161,0.36)",
    backgroundColor: "rgba(66,211,161,0.05)",
  },
  feedbackText: {
    flex: 1,
    minWidth: 0,
    color: V2.textDim,
    fontSize: 8,
    fontWeight: "700",
  },
  feedbackTextActive: { color: V2.green },
  feedbackInline: {
    width: 145,
    minWidth: 0,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextRow: {
    marginTop: "auto",
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    gap: 10,
  },
  nextRowCompact: {
    marginTop: 0,
    paddingTop: 9,
    flexDirection: "row",
    alignItems: "center",
  },
  nextCopy: { flex: 1, minWidth: 0, gap: 2 },
  nextLabel: { color: V2.textDim, fontSize: 8 },
  nextValue: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  continueButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  continueButtonInline: { minHeight: 36, flexShrink: 0 },
  continueText: { color: V2.background, fontSize: 10, fontWeight: "900" },
  disabled: { opacity: 0.36 },
  pressed: { opacity: 0.7 },
});
