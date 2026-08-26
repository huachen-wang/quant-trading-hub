import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CoreStrategy } from "@/shared/v2/contracts";
import { useLanguage } from "@/lib/language";
import {
  formatAnnualizedReturn,
  formatMoney,
  formatPct,
  riskLabel,
} from "./format";
import { StrategySparkline } from "./strategy-sparkline";
import { V2 } from "./tokens";

type StrategyCardProps = {
  strategy: CoreStrategy;
  selected?: boolean;
  compact?: boolean;
  mobile?: boolean;
  onPress: (strategyId: string) => void;
  onToggle?: (strategyId: string) => void;
};

function sourceColor(strategy: CoreStrategy) {
  if (strategy.source.freshness === "OFFLINE") return V2.red;
  if (strategy.source.freshness === "STALE") return V2.amber;
  if (strategy.source.dataMode === "DEMO") return V2.amber;
  return V2.green;
}

function StrategyCardBase({
  strategy,
  selected = false,
  compact = false,
  mobile = false,
  onPress,
  onToggle,
}: StrategyCardProps) {
  const { language, locale, text } = useLanguage();
  const unavailable = strategy.source.freshness === "OFFLINE";
  const selectable = Boolean(onToggle);
  const toggleLabel = selected
    ? text("移出组合", "Remove from portfolio", "إزالة من المحفظة")
    : text("加入组合", "Add to portfolio", "إضافة إلى المحفظة");
  const runtimeState =
    strategy.source.freshness === "OFFLINE"
      ? text("离线", "Offline", "غير متصل")
      : strategy.source.freshness === "STALE"
        ? text("延迟", "Delayed", "متأخر")
        : strategy.source.dataMode === "DEMO"
          ? text("模拟", "Demo", "تجريبي")
          : strategy.source.dataMode === "CUSTOM"
            ? text("自定义", "Custom", "مخصص")
            : text("实盘", "Live", "مباشر");

  return (
    <View
      style={[
        styles.card,
        { borderTopColor: strategy.accent },
        selected && styles.cardSelected,
        unavailable && styles.cardUnavailable,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.surfaceHighlight,
          selected && styles.surfaceHighlightSelected,
        ]}
      />
      <Pressable
        accessibilityRole={selectable ? "checkbox" : "link"}
        accessibilityState={
          selectable ? { checked: selected, disabled: unavailable } : undefined
        }
        accessibilityLabel={
          selectable
            ? `${toggleLabel} ${strategy.shortName}`
            : text(
                `查看 ${strategy.name} 详情`,
                `View ${strategy.name} details`,
                `عرض تفاصيل ${strategy.name}`,
              )
        }
        disabled={selectable && unavailable}
        onPress={() =>
          selectable ? onToggle?.(strategy.id) : onPress(strategy.id)
        }
        style={({ pressed }) => [
          styles.selector,
          compact && styles.selectorCompact,
          mobile && styles.selectorMobile,
          pressed && styles.selectorPressed,
        ]}
      >
        <View style={[styles.primaryRow, mobile && styles.primaryRowMobile]}>
          <View
            style={[
              styles.imageWrap,
              compact && styles.imageWrapCompact,
              mobile && styles.imageWrapMobile,
            ]}
          >
            <Image
              accessibilityLabel={text(
                `${strategy.shortName} 策略视觉图`,
                `${strategy.shortName} strategy artwork`,
                `صورة استراتيجية ${strategy.shortName}`,
              )}
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
          </View>

          <View
            style={[styles.primaryCopy, mobile && styles.primaryCopyMobile]}
          >
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  compact && styles.titleCompact,
                  mobile && styles.titleMobile,
                ]}
                numberOfLines={1}
              >
                {compact ? strategy.shortName : strategy.name}
              </Text>
              <View
                style={[
                  styles.selectionControl,
                  selected && styles.selectionControlSelected,
                  unavailable && styles.selectionControlUnavailable,
                ]}
              >
                <MaterialIcons
                  name={selected ? "done" : unavailable ? "block" : "add"}
                  size={compact ? 14 : 15}
                  color={selected ? V2.background : V2.textDim}
                />
              </View>
            </View>
            <Text style={styles.tagline} numberOfLines={1}>
              {strategy.tagline}
            </Text>
            <View style={styles.identityRow}>
              <Text style={styles.version} numberOfLines={1}>
                {strategy.version}
              </Text>
              {mobile ? (
                <>
                  <Text style={styles.identityDivider}>·</Text>
                  <Text style={styles.equity} numberOfLines={1}>
                    {text("起配", "Minimum", "الحد الأدنى")}{" "}
                    {formatMoney(strategy.minimumCapital, "USD", true, locale)}
                  </Text>
                </>
              ) : !compact ? (
                <>
                  <Text style={styles.identityDivider}>·</Text>
                  <Text style={styles.equity} numberOfLines={1}>
                    {text("权益", "Equity", "حقوق الملكية")}{" "}
                    {formatMoney(strategy.metrics.equity, "USD", true, locale)}
                  </Text>
                </>
              ) : null}
            </View>
            {mobile ? (
              <View style={styles.mobilePerformance}>
                <View style={styles.mobilePerformanceMain}>
                  <Text style={styles.mobilePerformanceLabel}>
                    {text("年化估算", "Annualized", "العائد السنوي")}
                  </Text>
                  <Text
                    style={[
                      styles.mobilePerformanceValue,
                      { color: strategy.accent },
                    ]}
                    numberOfLines={1}
                  >
                    {formatAnnualizedReturn(strategy.metrics.return90dPct)}
                  </Text>
                  <Text style={styles.mobilePerformanceBasis}>
                    {text(
                      "按近 90 日复合",
                      "90-day compound basis",
                      "مركب على أساس 90 يوما",
                    )}
                  </Text>
                </View>
                <View style={styles.mobileRiskMetric}>
                  <Text style={styles.mobileRiskLabel}>
                    {text("最大回撤", "Max drawdown", "أقصى تراجع")}
                  </Text>
                  <Text style={styles.mobileRiskValue} numberOfLines={1}>
                    {formatPct(strategy.metrics.maxDrawdownPct)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {mobile ? null : compact ? (
          <View style={styles.compactMetrics}>
            <Metric
              label={text("年化估算", "Annualized", "العائد السنوي")}
              value={formatAnnualizedReturn(strategy.metrics.return90dPct)}
              color={strategy.accent}
            />
            <Metric
              label={text("近 90 日", "90 days", "90 يوما")}
              value={formatPct(strategy.metrics.return90dPct, true)}
              color={V2.green}
            />
            <Metric
              label={text("回撤", "Drawdown", "التراجع")}
              value={formatPct(strategy.metrics.maxDrawdownPct)}
            />
            <Metric
              label={text("起配", "Minimum", "الحد الأدنى")}
              value={formatMoney(strategy.minimumCapital, "USD", true, locale)}
            />
          </View>
        ) : (
          <View style={styles.dataRow}>
            <View style={styles.chartColumn}>
              <View style={styles.chartHeading}>
                <Text style={styles.chartLabel}>
                  {text("近 90 日", "90 days", "90 يوما")}{" "}
                  {formatPct(strategy.metrics.return90dPct, true)}
                </Text>
                <Text
                  style={[
                    styles.todayValue,
                    {
                      color:
                        strategy.metrics.todayPnlPct !== null &&
                        strategy.metrics.todayPnlPct < 0
                          ? V2.red
                          : V2.green,
                    },
                  ]}
                >
                  {text("今日", "Today", "اليوم")}{" "}
                  {formatPct(strategy.metrics.todayPnlPct, true)}
                </Text>
              </View>
              <StrategySparkline
                points={strategy.equity}
                color={strategy.accent}
                height={34}
              />
            </View>
            <View style={styles.metricRail}>
              <Metric
                label={text("年化估算", "Annualized", "العائد السنوي")}
                value={formatAnnualizedReturn(strategy.metrics.return90dPct)}
                color={strategy.accent}
              />
              <Metric
                label={text("回撤", "Drawdown", "التراجع")}
                value={formatPct(strategy.metrics.maxDrawdownPct)}
              />
              <Metric
                label={text("风险", "Risk", "المخاطر")}
                value={riskLabel(strategy.riskLevel, language)}
              />
              <Metric
                label={text("起配", "Minimum", "الحد الأدنى")}
                value={formatMoney(
                  strategy.minimumCapital,
                  "USD",
                  true,
                  locale,
                )}
              />
            </View>
          </View>
        )}
      </Pressable>

      <View style={[styles.footer, mobile && styles.footerMobile]}>
        <View style={styles.runtimeState}>
          <View
            style={[
              styles.runtimeDot,
              { backgroundColor: sourceColor(strategy) },
            ]}
          />
          <Text style={styles.runtimeText}>{runtimeState}</Text>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.selectionState,
            selected && styles.selectionStateActive,
          ]}
          numberOfLines={1}
        >
          {unavailable
            ? selected
              ? text(
                  "DRAFT 中 · 不可激活",
                  "In draft · Cannot activate",
                  "ضمن المسودة · لا يمكن التفعيل",
                )
              : text("暂不可选", "Unavailable", "غير متاح")
            : selected
              ? text("组合中", "Selected", "ضمن الخطة")
              : text("点选加入", "Select to add", "اختر للإضافة")}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={text(
            `查看 ${strategy.name} 的运行详情`,
            `View ${strategy.name} performance details`,
            `عرض تفاصيل أداء ${strategy.name}`,
          )}
          onPress={() => onPress(strategy.id)}
          style={({ pressed }) => [
            styles.detailButton,
            pressed && styles.pressed,
          ]}
        >
          {!compact ? (
            <Text style={styles.detailText}>
              {text("详情", "Details", "التفاصيل")}
            </Text>
          ) : null}
          <MaterialIcons name="arrow-forward" size={14} color={V2.textMuted} />
        </Pressable>
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
    borderColor: "rgba(216,188,131,0.78)",
    backgroundColor: "#121C2B",
    shadowColor: V2.gold,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  cardUnavailable: { opacity: 0.7 },
  surfaceHighlight: {
    position: "absolute",
    top: 0,
    left: 1,
    right: 1,
    height: 1,
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  surfaceHighlightSelected: { backgroundColor: "rgba(246,220,165,0.7)" },
  selector: { padding: 8, gap: 8 },
  selectorCompact: { padding: 6, gap: 6 },
  selectorMobile: { padding: 9, gap: 8 },
  selectorPressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
  primaryRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 9,
  },
  primaryRowMobile: { minHeight: 92, alignItems: "center", gap: 11 },
  imageWrap: {
    width: 92,
    height: 66,
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: V2.surfaceMuted,
  },
  imageWrapCompact: { width: 58, height: 58 },
  imageWrapMobile: {
    width: 84,
    height: 92,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  image: { width: "100%", height: "100%" },
  slotMarker: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 24,
    height: 19,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(7,11,18,0.82)",
  },
  slotText: { color: V2.text, fontSize: 8, fontWeight: "900" },
  primaryCopy: { flex: 1, minWidth: 0, justifyContent: "center", gap: 4 },
  primaryCopyMobile: { alignSelf: "stretch", gap: 5 },
  titleRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: V2.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  titleCompact: { fontSize: 11, lineHeight: 15 },
  titleMobile: { fontSize: 14, lineHeight: 19 },
  selectionControl: {
    width: 22,
    height: 22,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,11,18,0.34)",
  },
  selectionControlSelected: {
    borderColor: V2.gold,
    backgroundColor: V2.gold,
  },
  selectionControlUnavailable: { opacity: 0.55 },
  tagline: { color: V2.textMuted, fontSize: 9, lineHeight: 13 },
  identityRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  version: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  identityDivider: { color: V2.textDim, fontSize: 8 },
  equity: { flex: 1, minWidth: 0, color: V2.textMuted, fontSize: 8 },
  mobilePerformance: {
    marginTop: 2,
    minHeight: 45,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "center",
  },
  mobilePerformanceMain: { flex: 1, minWidth: 0 },
  mobilePerformanceLabel: {
    color: V2.textMuted,
    fontSize: 8,
    fontWeight: "800",
  },
  mobilePerformanceValue: {
    marginTop: 1,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "900",
  },
  mobilePerformanceBasis: { color: V2.textDim, fontSize: 7 },
  mobileRiskMetric: {
    width: 72,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: V2.border,
    gap: 3,
  },
  mobileRiskLabel: { color: V2.textDim, fontSize: 8 },
  mobileRiskValue: { color: V2.text, fontSize: 11, fontWeight: "900" },
  dataRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: V2.border,
  },
  chartColumn: { flex: 1, minWidth: 0, paddingTop: 4, paddingRight: 8 },
  chartHeading: {
    minHeight: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  chartLabel: { color: V2.textDim, fontSize: 7 },
  todayValue: { fontSize: 8, fontWeight: "900" },
  metricRail: {
    width: 176,
    flexDirection: "row",
    flexWrap: "wrap",
    borderLeftWidth: 1,
    borderLeftColor: V2.border,
  },
  compactMetrics: {
    minHeight: 53,
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: V2.border,
  },
  metric: {
    width: "50%",
    minWidth: 0,
    justifyContent: "center",
    gap: 1,
    paddingLeft: 7,
    paddingVertical: 3,
  },
  metricLabel: { color: V2.textDim, fontSize: 7, lineHeight: 10 },
  metricValue: {
    color: V2.text,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
  },
  footer: {
    minHeight: 32,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  footerMobile: { minHeight: 30, paddingHorizontal: 9 },
  runtimeState: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  runtimeDot: { width: 6, height: 6, borderRadius: 3 },
  runtimeText: { color: V2.textDim, fontSize: 8 },
  selectionState: {
    flex: 1,
    minWidth: 0,
    color: V2.textDim,
    fontSize: 8,
    fontWeight: "800",
    textAlign: "right",
  },
  selectionStateActive: { color: V2.gold },
  detailButton: {
    minWidth: 27,
    minHeight: 27,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  detailText: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  pressed: { opacity: 0.68 },
});
