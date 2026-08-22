import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { EquityChart } from "@/components/v2/equity-chart";
import { formatDateTime, formatMoney, formatPct } from "@/components/v2/format";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { SectionHeading } from "@/components/v2/section-heading";
import { StatusBadge } from "@/components/v2/status-badge";
import { StrategyCard } from "@/components/v2/strategy-card";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { trpc } from "@/lib/trpc";

type Mode = "MANAGED_CONTRACT" | "SELF_ALLOCATED";

export default function V2HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isTablet = width >= 700 && width < 1060;
  const isNarrow = width < 1000;
  const [mode, setMode] = useState<Mode>("SELF_ALLOCATED");
  const openStrategy = useCallback(
    (strategyId: string) =>
      router.push(`/v2-preview/strategies/${strategyId}` as never),
    [router],
  );
  const overview = trpc.v2.overview.useQuery(undefined, {
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  if (overview.isLoading) return <V2LoadingState label="正在汇总六策略" />;
  if (!overview.data) {
    return (
      <V2ErrorState
        detail={overview.error?.message || "六策略聚合接口没有返回可用数据。"}
        onRetry={() => overview.refetch()}
      />
    );
  }

  const data = overview.data;
  const cardWidth = isMobile ? "100%" : isTablet ? "48.9%" : "32.35%";

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <View style={styles.dataNotice}>
          <View style={styles.dataNoticeMain}>
            <StatusBadge dataMode={data.source.dataMode} freshness={data.source.freshness} />
            <Text style={styles.dataNoticeText}>
              当前用于产品评审，所有金额、收益、平台条款均为确定性模拟数据。
            </Text>
          </View>
          <Text style={styles.syncText}>更新 {formatDateTime(data.source.observedAt)}</Text>
        </View>

        <View style={[styles.hero, isMobile && styles.heroMobile]}>
          <View style={styles.heroCopy}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowRule} />
              <Text style={styles.eyebrow}>AI QUANT PORTFOLIO</Text>
            </View>
            <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
              {data.headline}
            </Text>
            <Text style={styles.heroSubtitle}>{data.subheadline}</Text>

            <View style={[styles.heroMetrics, isMobile && styles.heroMetricsMobile]}>
              <HeroMetric
                label="组合权益"
                value={formatMoney(data.portfolio.equity, "USD", true)}
                accent={V2.text}
              />
              <HeroMetric
                label="近 90 日"
                value={formatPct(data.portfolio.return90dPct, true)}
                accent={V2.green}
              />
              <HeroMetric
                label="最大回撤"
                value={formatPct(data.portfolio.maxDrawdownPct)}
                accent={V2.amber}
              />
              <HeroMetric
                label="运行策略"
                value={`${data.portfolio.activeStrategies} / 6`}
                accent={V2.blue}
              />
            </View>
          </View>

          <View style={styles.heroChart}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartLabel}>组合净值 · 60D</Text>
                <Text style={styles.chartValue}>
                  {formatMoney(data.portfolio.equity, "USD")}
                </Text>
              </View>
              <View style={styles.todayPnl}>
                <MaterialIcons name="north-east" size={14} color={V2.green} />
                <Text style={styles.todayPnlText}>
                  今日 {formatPct(data.portfolio.todayPnlPct, true)}
                </Text>
              </View>
            </View>
            <EquityChart
              points={data.portfolio.equitySeries}
              color={V2.green}
              height={isMobile ? 174 : 220}
              showAxis
            />
            <View style={styles.chartFooter}>
              <Text style={styles.chartFooterText}>60 日前</Text>
              <Text style={styles.chartFooterText}>当前</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            eyebrow="CORE STRATEGIES"
            title="六个核心策略"
            detail="每个席位有独立的数据状态、风险边界与平台兼容性；点击进入完整说明和交易证据区。"
          />
          <View style={styles.strategyGrid}>
            {data.strategies.map((strategy) => (
              <View key={strategy.id} style={{ width: cardWidth }}>
                <StrategyCard
                  strategy={strategy}
                  onPress={openStrategy}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            eyebrow="SERVICE MODE"
            title="选择参与方式"
            detail="服务模式决定谁负责配置；推荐方案只是自主分仓的一种起点。"
          />
          <View style={styles.segmented}>
            <ModeButton
              active={mode === "SELF_ALLOCATED"}
              label="自主分仓"
              icon="account-tree"
              onPress={() => setMode("SELF_ALLOCATED")}
            />
            <ModeButton
              active={mode === "MANAGED_CONTRACT"}
              label="签约管理"
              icon="description"
              onPress={() => setMode("MANAGED_CONTRACT")}
            />
          </View>
          <View style={[styles.modePanel, isMobile && styles.modePanelMobile]}>
            <View style={styles.modeCopy}>
              <Text style={styles.modeTitle}>
                {mode === "SELF_ALLOCATED" ? "自己选择平台、策略和风险配比" : "由技术方配置，客户只读观察"}
              </Text>
              <Text style={styles.modeDetail}>
                {mode === "SELF_ALLOCATED"
                  ? "最多建立三个平台资金桶。系统检查权重、兼容性、资金门槛、集中度和风险预算，第一阶段只生成确认方案。"
                  : "客户与指定主体完成合同后查看权益、净值、持仓、交易和合同状态；页面不会提供直接控制技术方仓位的按钮。"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  mode === "SELF_ALLOCATED"
                    ? ("/v2-preview/allocate" as never)
                    : ("/v2-preview/accounts" as never),
                )
              }
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>
                {mode === "SELF_ALLOCATED" ? "开始配置" : "查看账户"}
              </Text>
              <MaterialIcons name="arrow-forward" size={18} color={V2.background} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            eyebrow="PLATFORM COMPARISON"
            title="三个平台维度"
            detail="点差、返佣和出金速度必须连同版本、样本与更新时间一起判断。"
          />
          <View style={styles.platformGrid}>
            {data.platforms.map((platform) => (
              <View key={platform.id} style={[styles.platformRow, isNarrow && styles.platformRowMobile]}>
                <View style={styles.platformIdentity}>
                  <View style={styles.platformCode}>
                    <Text style={styles.platformCodeText}>{platform.code}</Text>
                  </View>
                  <View style={styles.platformNameWrap}>
                    <Text style={styles.platformName}>{platform.name}</Text>
                    <Text style={styles.platformSummary}>{platform.summary}</Text>
                  </View>
                </View>
                <PlatformMetric label="账户" value={platform.accountType} />
                <PlatformMetric label="成本样本" value={platform.commercialTerms.spreadLabel} />
                <PlatformMetric
                  label="出金样本"
                  value={`P50 ${platform.commercialTerms.withdrawalP50Hours ?? "--"}h / P95 ${platform.commercialTerms.withdrawalP95Hours ?? "--"}h`}
                />
                <View style={styles.platformStatus}>
                  <StatusBadge
                    compact
                    dataMode={platform.source.dataMode}
                    freshness={platform.source.freshness}
                  />
                  <Text style={styles.termsVersion}>{platform.commercialTerms.version}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.riskNotice}>
          <MaterialIcons name="verified-user" size={22} color={V2.amber} />
          <View style={styles.riskCopy}>
            <Text style={styles.riskTitle}>数据与风险边界</Text>
            <Text style={styles.riskText}>
              历史收益、胜率和模型回撤不代表未来结果。预览环境不执行交易、不保管资金；正式上线必须完成数据源、平台实体、账户权限与合同责任核验。
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function HeroMetric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroMetricLabel}>{label}</Text>
      <Text style={[styles.heroMetricValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function ModeButton({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: "account-tree" | "description";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}
    >
      <MaterialIcons name={icon} size={18} color={active ? V2.gold : V2.textMuted} />
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PlatformMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.platformMetric}>
      <Text style={styles.platformMetricLabel}>{label}</Text>
      <Text style={styles.platformMetricValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 56 },
  page: {
    width: "100%",
    maxWidth: V2_LAYOUT.maxWidth,
    alignSelf: "center",
    paddingHorizontal: V2_LAYOUT.pagePaddingDesktop,
    paddingTop: 18,
    gap: 48,
  },
  pageMobile: { paddingHorizontal: V2_LAYOUT.pagePaddingMobile, paddingTop: 12, gap: 38 },
  dataNotice: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
  },
  dataNoticeMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  dataNoticeText: { color: V2.textMuted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  syncText: { color: V2.textDim, fontSize: 11, flexShrink: 0 },
  hero: { minHeight: 400, flexDirection: "row", gap: 42, alignItems: "stretch" },
  heroMobile: { minHeight: 0, flexDirection: "column", gap: 28 },
  heroCopy: { flex: 1.05, justifyContent: "center", minWidth: 0 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  eyebrowRule: { width: 26, height: 2, backgroundColor: V2.gold },
  eyebrow: { color: V2.gold, fontSize: 11, fontWeight: "900", letterSpacing: 0 },
  heroTitle: { color: V2.text, fontSize: 46, lineHeight: 56, fontWeight: "900", letterSpacing: 0 },
  heroTitleMobile: { fontSize: 34, lineHeight: 42 },
  heroSubtitle: { marginTop: 12, color: V2.textMuted, fontSize: 15, lineHeight: 24, maxWidth: 620 },
  heroMetrics: { marginTop: 36, flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: V2.border },
  heroMetricsMobile: { flexWrap: "wrap" },
  heroMetric: { minWidth: 112, flex: 1, paddingVertical: 15, paddingRight: 10, gap: 5 },
  heroMetricLabel: { color: V2.textDim, fontSize: 10, lineHeight: 13 },
  heroMetricValue: { fontSize: 19, lineHeight: 24, fontWeight: "900", letterSpacing: 0 },
  heroChart: {
    flex: 0.95,
    minWidth: 0,
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
  },
  chartHeader: { minHeight: 54, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  chartLabel: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  chartValue: { marginTop: 5, color: V2.text, fontSize: 22, fontWeight: "900" },
  todayPnl: { flexDirection: "row", alignItems: "center", gap: 5 },
  todayPnlText: { color: V2.green, fontSize: 11, fontWeight: "800" },
  chartFooter: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
  chartFooterText: { color: V2.textDim, fontSize: 10 },
  section: { gap: 22 },
  strategyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "stretch" },
  segmented: {
    alignSelf: "flex-start",
    minHeight: 44,
    padding: 3,
    flexDirection: "row",
    gap: 3,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    backgroundColor: V2.surfaceMuted,
  },
  modeButton: { minHeight: 36, minWidth: 126, paddingHorizontal: 14, borderRadius: 3, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  modeButtonActive: { backgroundColor: V2.surface },
  modeButtonText: { color: V2.textMuted, fontSize: 13, fontWeight: "700" },
  modeButtonTextActive: { color: V2.text },
  modePanel: { minHeight: 152, paddingVertical: 25, borderTopWidth: 1, borderBottomWidth: 1, borderColor: V2.border, flexDirection: "row", alignItems: "center", gap: 28 },
  modePanelMobile: { flexDirection: "column", alignItems: "stretch", gap: 20 },
  modeCopy: { flex: 1, minWidth: 0, gap: 8 },
  modeTitle: { color: V2.text, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  modeDetail: { color: V2.textMuted, fontSize: 13, lineHeight: 21, maxWidth: 830 },
  primaryButton: { minHeight: 44, paddingHorizontal: 17, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: V2.background, fontSize: 13, fontWeight: "900" },
  platformGrid: { borderTopWidth: 1, borderTopColor: V2.border },
  platformRow: { minHeight: 118, paddingVertical: 18, flexDirection: "row", alignItems: "center", gap: 22, borderBottomWidth: 1, borderBottomColor: V2.border },
  platformRowMobile: { alignItems: "flex-start", flexWrap: "wrap", gap: 14 },
  platformIdentity: { width: 270, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  platformCode: { width: 48, height: 48, borderWidth: 1, borderColor: "rgba(216,188,131,0.42)", borderRadius: 5, backgroundColor: "rgba(216,188,131,0.08)", alignItems: "center", justifyContent: "center" },
  platformCodeText: { color: V2.gold, fontSize: 12, fontWeight: "900" },
  platformNameWrap: { flex: 1, minWidth: 0, gap: 4 },
  platformName: { color: V2.text, fontSize: 15, fontWeight: "900" },
  platformSummary: { color: V2.textMuted, fontSize: 11, lineHeight: 16 },
  platformMetric: { flex: 1, minWidth: 138, gap: 5 },
  platformMetricLabel: { color: V2.textDim, fontSize: 10, fontWeight: "800" },
  platformMetricValue: { color: V2.text, fontSize: 12, lineHeight: 18 },
  platformStatus: { width: 132, alignItems: "flex-end", gap: 6 },
  termsVersion: { color: V2.textDim, fontSize: 10 },
  riskNotice: { paddingTop: 22, borderTopWidth: 1, borderTopColor: V2.border, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  riskCopy: { flex: 1, gap: 5 },
  riskTitle: { color: V2.text, fontSize: 13, fontWeight: "900" },
  riskText: { color: V2.textMuted, fontSize: 12, lineHeight: 19 },
  pressed: { opacity: 0.76 },
});
