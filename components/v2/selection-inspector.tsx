import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { CoreStrategy, PlatformProfile } from "@/shared/v2/contracts";
import { useLanguage } from "@/lib/language";
import { formatMoney, formatPct, riskLabel } from "./format";
import { StatusBadge } from "./status-badge";
import { V2 } from "./tokens";

export type SelectionInspectorItem =
  | { kind: "strategy"; strategy: CoreStrategy }
  | { kind: "platform"; platform: PlatformProfile; strategies: CoreStrategy[] };

export function SelectionInspector({
  item,
  onClose,
  onSelect,
  onOpenStrategy,
  selectLabel,
  selectDisabled = false,
}: {
  item: SelectionInspectorItem | null;
  onClose: () => void;
  onSelect?: () => void;
  onOpenStrategy?: (strategyId: string) => void;
  selectLabel?: string;
  selectDisabled?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const { text } = useLanguage();

  return (
    <Modal
      visible={!!item}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={[styles.panel, isMobile && styles.panelMobile]}
        >
          {item ? (
            <>
              <View style={styles.topbar}>
                <Text style={styles.eyebrow}>
                  {item.kind === "strategy" ? "STRATEGY SPEC" : "PLATFORM SPEC"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text(
                    "关闭详情",
                    "Close details",
                    "إغلاق التفاصيل",
                  )}
                  onPress={onClose}
                  style={styles.iconButton}
                >
                  <MaterialIcons name="close" size={20} color={V2.text} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
              >
                {item.kind === "strategy" ? (
                  <StrategySpec strategy={item.strategy} />
                ) : (
                  <PlatformSpec
                    platform={item.platform}
                    strategies={item.strategies}
                    onOpenStrategy={onOpenStrategy}
                  />
                )}
              </ScrollView>
              <View style={styles.footer}>
                {item.kind === "strategy" && onOpenStrategy ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onOpenStrategy(item.strategy.id)}
                    style={styles.secondaryButton}
                  >
                    <MaterialIcons
                      name="open-in-new"
                      size={17}
                      color={V2.text}
                    />
                    <Text style={styles.secondaryText}>
                      {text("完整资料", "Full profile", "الملف الكامل")}
                    </Text>
                  </Pressable>
                ) : null}
                {onSelect ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={selectDisabled}
                    onPress={onSelect}
                    style={[
                      styles.primaryButton,
                      selectDisabled && styles.disabled,
                    ]}
                  >
                    <MaterialIcons
                      name={selectDisabled ? "check" : "add"}
                      size={18}
                      color={V2.background}
                    />
                    <Text style={styles.primaryText}>
                      {selectLabel ??
                        (selectDisabled
                          ? text("已选择", "Selected", "تم الاختيار")
                          : text("加入方案", "Add to plan", "إضافة إلى الخطة"))}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StrategySpec({ strategy }: { strategy: CoreStrategy }) {
  const { language, locale, text } = useLanguage();
  return (
    <View style={styles.spec}>
      <View style={styles.heroImageWrap}>
        <Image
          accessibilityLabel={text(
            `${strategy.shortName} 策略视觉图`,
            `${strategy.shortName} strategy artwork`,
            `صورة استراتيجية ${strategy.shortName}`,
          )}
          source={{ uri: strategy.artwork }}
          style={styles.heroImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={styles.versionBadge}>
          <Text style={styles.heroLabel}>{strategy.version}</Text>
        </View>
      </View>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.specTitle}>{strategy.name}</Text>
          <Text style={styles.tagline}>{strategy.tagline}</Text>
          <Text style={styles.description}>{strategy.description}</Text>
        </View>
        <StatusBadge
          dataMode={strategy.source.dataMode}
          freshness={strategy.source.freshness}
        />
      </View>
      <View style={styles.metricGrid}>
        <Metric
          label={text("近 90 日", "Last 90 days", "آخر 90 يوما")}
          value={formatPct(strategy.metrics.return90dPct, true)}
          accent={strategy.accent}
        />
        <Metric
          label={text("最大回撤", "Max drawdown", "أقصى تراجع")}
          value={formatPct(strategy.metrics.maxDrawdownPct)}
        />
        <Metric
          label={text("胜率", "Win rate", "نسبة الفوز")}
          value={formatPct(strategy.metrics.winRatePct)}
        />
        <Metric
          label={text("风险", "Risk", "المخاطر")}
          value={riskLabel(strategy.riskLevel, language)}
        />
      </View>
      <View style={styles.factRows}>
        <Fact
          label={text("交易风格", "Trading style", "أسلوب التداول")}
          value={strategy.style}
        />
        <Fact
          label={text("观察品种", "Instruments", "الأصول")}
          value={strategy.instruments.join(" / ")}
        />
        <Fact
          label={text("运行终端", "Terminals", "المنصات التقنية")}
          value={strategy.terminals.join(" / ")}
        />
        <Fact
          label={text("建议资金", "Suggested capital", "رأس المال المقترح")}
          value={formatMoney(strategy.minimumCapital, "USD", false, locale)}
        />
      </View>
    </View>
  );
}

function PlatformSpec({
  platform,
  strategies,
  onOpenStrategy,
}: {
  platform: PlatformProfile;
  strategies: CoreStrategy[];
  onOpenStrategy?: (strategyId: string) => void;
}) {
  const { locale, text } = useLanguage();
  const supported = strategies.filter((strategy) =>
    platform.supportedStrategyIds.includes(strategy.id),
  );
  return (
    <View style={styles.spec}>
      <View style={styles.platformHero}>
        <View style={styles.platformCode}>
          <Text style={styles.platformCodeText}>{platform.code}</Text>
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.platformName}>{platform.name}</Text>
          <Text style={styles.description}>{platform.summary}</Text>
        </View>
        <StatusBadge
          dataMode={platform.source.dataMode}
          freshness={platform.source.freshness}
        />
      </View>
      <View style={styles.metricGrid}>
        <Metric
          label={text("账户类型", "Account type", "نوع الحساب")}
          value={platform.accountType}
        />
        <Metric
          label={text("最低资金", "Minimum capital", "الحد الأدنى لرأس المال")}
          value={formatMoney(platform.minimumCapital, "USD", true, locale)}
        />
        <Metric
          label={text("出金样本 P50", "Withdrawal P50", "السحب P50")}
          value={
            platform.commercialTerms.withdrawalP50Hours == null
              ? text("待核验", "Pending", "قيد التحقق")
              : `${platform.commercialTerms.withdrawalP50Hours}h`
          }
        />
        <Metric
          label={text("执行延迟", "Execution latency", "زمن التنفيذ")}
          value={
            platform.commercialTerms.executionLatencyMs == null
              ? text("待核验", "Pending", "قيد التحقق")
              : `${platform.commercialTerms.executionLatencyMs}ms`
          }
        />
      </View>
      <View style={styles.factRows}>
        <Fact
          label={text("点差样本", "Spread sample", "عينة الفارق")}
          value={platform.commercialTerms.spreadLabel}
        />
        <Fact
          label={text("佣金样本", "Commission sample", "عينة العمولة")}
          value={platform.commercialTerms.commissionLabel}
        />
        <Fact
          label={text("返佣条件", "Rebate terms", "شروط الخصم")}
          value={platform.commercialTerms.rebateEligibility}
        />
        <Fact
          label={text("适用地区", "Regions", "المناطق")}
          value={platform.regionLabel}
        />
      </View>
      <View style={styles.supportedSection}>
        <Text style={styles.sectionLabel}>
          {text("兼容策略", "Compatible strategies", "الاستراتيجيات المتوافقة")}
        </Text>
        <View style={styles.supportedGrid}>
          {supported.map((strategy) => (
            <Pressable
              key={strategy.id}
              accessibilityRole="button"
              accessibilityLabel={text(
                `查看 ${strategy.shortName} 完整资料`,
                `View full profile for ${strategy.shortName}`,
                `عرض الملف الكامل لـ ${strategy.shortName}`,
              )}
              disabled={!onOpenStrategy}
              onPress={() => onOpenStrategy?.(strategy.id)}
              style={styles.supportedItem}
            >
              <Image
                accessibilityLabel={text(
                  `${strategy.shortName} 策略缩略图`,
                  `${strategy.shortName} strategy thumbnail`,
                  `صورة مصغرة لاستراتيجية ${strategy.shortName}`,
                )}
                source={{ uri: strategy.artwork }}
                style={styles.supportedImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <View style={styles.supportedCopy}>
                <Text style={styles.supportedName} numberOfLines={1}>
                  {strategy.shortName}
                </Text>
                <Text style={styles.supportedMeta} numberOfLines={1}>
                  {strategy.style}
                </Text>
              </View>
              <MaterialIcons
                name="arrow-forward"
                size={15}
                color={V2.textDim}
                style={styles.supportedArrow}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function Metric({
  label,
  value,
  accent = V2.text,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: accent }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    padding: 22,
    backgroundColor: "rgba(2,5,10,0.88)",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  panel: {
    width: 620,
    maxWidth: "94%",
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: V2.backgroundRaised,
  },
  panelMobile: {
    width: "100%",
    maxWidth: "100%",
    maxHeight: "94%",
    alignSelf: "center",
  },
  topbar: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  iconButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { minHeight: 0 },
  bodyContent: { padding: 16 },
  spec: { gap: 16 },
  heroImageWrap: {
    width: "100%",
    aspectRatio: 2.1,
    position: "relative",
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: V2.surfaceMuted,
  },
  heroImage: { width: "100%", height: "100%" },
  versionBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    minHeight: 25,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 3,
    backgroundColor: "rgba(5,8,14,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titleCopy: { flex: 1, minWidth: 0, gap: 5 },
  specTitle: {
    color: V2.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  tagline: { color: V2.gold, fontSize: 10, lineHeight: 15, fontWeight: "800" },
  description: { color: V2.textMuted, fontSize: 11, lineHeight: 18 },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  metric: {
    width: "25%",
    minWidth: 110,
    minHeight: 68,
    paddingVertical: 12,
    paddingRight: 8,
    justifyContent: "center",
    gap: 4,
  },
  metricLabel: { color: V2.textDim, fontSize: 9, fontWeight: "800" },
  metricValue: {
    color: V2.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  factRows: { borderTopWidth: 1, borderTopColor: V2.border },
  factRow: {
    minHeight: 42,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  factLabel: { width: 92, color: V2.textDim, fontSize: 10, fontWeight: "800" },
  factValue: { flex: 1, color: V2.text, fontSize: 11, lineHeight: 17 },
  platformHero: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  platformCode: {
    width: 62,
    height: 62,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.46)",
    borderRadius: 5,
    backgroundColor: "rgba(216,188,131,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  platformCodeText: { color: V2.gold, fontSize: 15, fontWeight: "900" },
  platformName: {
    color: V2.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  supportedSection: { gap: 9 },
  sectionLabel: { color: V2.textDim, fontSize: 10, fontWeight: "900" },
  supportedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  supportedItem: {
    width: "48.8%",
    minHeight: 58,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    flexDirection: "row",
    backgroundColor: V2.surfaceMuted,
  },
  supportedImage: { width: 76, height: 58 },
  supportedCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    justifyContent: "center",
    gap: 3,
  },
  supportedArrow: { marginRight: 8, alignSelf: "center" },
  supportedName: { color: V2.text, fontSize: 10, fontWeight: "900" },
  supportedMeta: { color: V2.textMuted, fontSize: 8 },
  footer: {
    minHeight: 62,
    padding: 11,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryText: { color: V2.text, fontSize: 11, fontWeight: "800" },
  primaryButton: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryText: { color: V2.background, fontSize: 11, fontWeight: "900" },
  disabled: { opacity: 0.45 },
});
