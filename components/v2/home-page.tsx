import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { formatMoney, formatPct } from "@/components/v2/format";
import {
  LiveFeedStrip,
  type LiveFeedItem,
} from "@/components/v2/live-feed-strip";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { SolutionConfigurator } from "@/components/v2/solution-configurator";
import { StrategyCard } from "@/components/v2/strategy-card";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { trpc } from "@/lib/trpc";

const DEFAULT_SELECTION = ["jingge-v51", "quantum-queen"];
const LIVE_PULSE_ACCENTS = [
  V2.green,
  V2.gold,
  V2.cyan,
  V2.blue,
  V2.amber,
  "#A995FF",
];

export default function V2HomePage() {
  const router = useRouter();
  const { configure, strategyId } = useLocalSearchParams<{
    configure?: string;
    strategyId?: string;
  }>();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isTablet = width >= 700 && width < 1060;
  const scrollRef = useRef<ScrollView>(null);
  const preferredApplied = useRef(false);
  const builderScrolled = useRef(false);
  const [builderY, setBuilderY] = useState(0);
  const [selectedStrategyIds, setSelectedStrategyIds] =
    useState<string[]>(DEFAULT_SELECTION);
  const overview = trpc.v2.overview.useQuery(undefined, {
    staleTime: 4_000,
    refetchInterval: 10_000,
  });
  const livePulse = trpc.v2.livePulse.useQuery(undefined, {
    staleTime: 4_000,
    refetchInterval: 10_000,
    retry: 1,
  });

  const openStrategy = useCallback(
    (id: string) => router.push(`/v2-preview/strategies/${id}` as never),
    [router],
  );
  const openFeedItem = useCallback(
    (item: LiveFeedItem) => {
      if (item.href) {
        void Linking.openURL(item.href);
        return;
      }
      openStrategy(item.id);
    },
    [openStrategy],
  );

  useEffect(() => {
    if (!overview.data) return;
    if (
      strategyId &&
      !preferredApplied.current &&
      overview.data.strategies.some((strategy) => strategy.id === strategyId)
    ) {
      preferredApplied.current = true;
      setSelectedStrategyIds((current) =>
        current.includes(strategyId) ? current : [...current, strategyId],
      );
    }
  }, [overview.data, strategyId]);

  useEffect(() => {
    if (configure !== "1") {
      builderScrolled.current = false;
      return;
    }
    if (builderY <= 0 || builderScrolled.current) return;
    builderScrolled.current = true;
    const timer = setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          y: Math.max(0, builderY - 16),
          animated: true,
        }),
      140,
    );
    return () => clearTimeout(timer);
  }, [builderY, configure]);

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
  const hasPublicPulse = Boolean(livePulse.data?.items.length);
  const feedItems: LiveFeedItem[] = hasPublicPulse
    ? livePulse.data!.items.map((item, index) => ({
        id: `niubang-${item.slug}`,
        name: item.name,
        accent: LIVE_PULSE_ACCENTS[index % LIVE_PULSE_ACCENTS.length],
        changePct: item.monthlyReturnPct,
        changeLabel: "月度",
        equity: item.equity,
        equityLabel: "账户权益",
        href: item.url,
      }))
    : data.strategies.map((strategy) => ({
        id: strategy.id,
        name: strategy.shortName,
        accent: strategy.accent,
        changePct: strategy.metrics.todayPnlPct,
        changeLabel: "今日",
        equity: strategy.metrics.equity,
        equityLabel: "权益",
      }));
  const feedSource = hasPublicPulse ? livePulse.data!.source : data.source;
  const cardWidth = isMobile ? "100%" : isTablet ? "49.1%" : "32.55%";
  const selectedStrategies = data.strategies.filter((strategy) =>
    selectedStrategyIds.includes(strategy.id),
  );
  const dataNoticeCopy = {
    DEMO: "当前使用模拟账户数据验证展示与选配流程，不代表真实收益。",
    CUSTOM: "当前使用后台维护数据，可继续补充时间口径与证据。",
    LIVE: "当前指标来自已连接数据源，请同时查看同步时间和风险边界。",
    HYBRID: "历史段由后台维护，接管线后由实盘数据源持续更新。",
  }[data.source.dataMode];

  const toggleStrategy = (id: string) => {
    const strategy = data.strategies.find((item) => item.id === id);
    if (!strategy || strategy.source.freshness === "OFFLINE") return;
    setSelectedStrategyIds((current) =>
      current.includes(id)
        ? current.filter((strategyId) => strategyId !== id)
        : [...current, id],
    );
  };

  const scrollToBuilder = () => {
    router.setParams({ configure: "1" });
    scrollRef.current?.scrollTo({
      y: Math.max(0, builderY - 16),
      animated: true,
    });
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <LiveFeedStrip
          items={feedItems}
          source={feedSource}
          isFetching={
            hasPublicPulse ? livePulse.isFetching : overview.isFetching
          }
          refreshKey={
            hasPublicPulse ? livePulse.dataUpdatedAt : overview.dataUpdatedAt
          }
          isMobile={isMobile || isTablet}
          onOpen={openFeedItem}
        />

        <View style={styles.strategyStage}>
          <View
            style={[
              styles.stageHeader,
              (isMobile || isTablet) && styles.stageHeaderMobile,
            ]}
          >
            <View style={styles.stageCopy}>
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowRule} />
                <Text style={styles.eyebrow}>SIX CORE STRATEGIES</Text>
              </View>
              <Text
                style={[styles.stageTitle, isMobile && styles.stageTitleMobile]}
              >
                六策略实时矩阵
              </Text>
              <Text style={styles.stageSubtitle}>{dataNoticeCopy}</Text>
            </View>

            <View
              style={[
                styles.portfolioMetrics,
                (isMobile || isTablet) && styles.portfolioMetricsMobile,
              ]}
            >
              <OverviewMetric
                label="组合权益"
                value={formatMoney(data.portfolio.equity, "USD", true)}
              />
              <OverviewMetric
                label="近 90 日"
                value={formatPct(data.portfolio.return90dPct, true)}
                color={V2.green}
              />
              <OverviewMetric
                label="最大回撤"
                value={formatPct(data.portfolio.maxDrawdownPct)}
                color={V2.amber}
              />
              <OverviewMetric
                label="运行中"
                value={`${data.portfolio.activeStrategies} / 6`}
                color={V2.blue}
              />
            </View>
          </View>

          <View style={styles.strategyGrid}>
            {data.strategies.map((strategy) => (
              <View key={strategy.id} style={{ width: cardWidth }}>
                <StrategyCard
                  strategy={strategy}
                  selected={selectedStrategyIds.includes(strategy.id)}
                  onPress={openStrategy}
                  onToggle={toggleStrategy}
                />
              </View>
            ))}
          </View>

          <View
            style={[styles.selectionBar, isMobile && styles.selectionBarMobile]}
          >
            <View style={styles.selectionCopy}>
              <View style={styles.selectionCount}>
                <MaterialIcons name="check-circle" size={18} color={V2.green} />
                <Text style={styles.selectionCountText}>
                  已选 {selectedStrategies.length} / 6
                </Text>
              </View>
              <Text style={styles.selectionNames} numberOfLines={1}>
                {selectedStrategies.length
                  ? selectedStrategies
                      .map((strategy) => strategy.shortName)
                      .join(" · ")
                  : "选择至少一款策略开始配置"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={scrollToBuilder}
              style={({ pressed }) => [
                styles.continueButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.continueText}>继续完成量化选配</Text>
              <MaterialIcons name="south" size={17} color={V2.background} />
            </Pressable>
          </View>
        </View>

        <View
          onLayout={(event) => setBuilderY(event.nativeEvent.layout.y)}
          style={styles.builderAnchor}
        >
          <SolutionConfigurator
            strategies={data.strategies}
            platforms={data.platforms}
            selectedStrategyIds={selectedStrategyIds}
            onToggleStrategy={toggleStrategy}
          />
        </View>

        <View style={styles.riskNotice}>
          <MaterialIcons name="verified-user" size={20} color={V2.amber} />
          <Text style={styles.riskText}>
            历史收益、胜率和模型回撤不代表未来结果。正式启用前仍需核验数据源、券商实体、账户权限、合同责任和当前平台条款。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function OverviewMetric({
  label,
  value,
  color = V2.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.overviewMetric}>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={[styles.overviewValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 48 },
  page: {
    width: "100%",
    maxWidth: V2_LAYOUT.maxWidth,
    alignSelf: "center",
    paddingHorizontal: V2_LAYOUT.pagePaddingDesktop,
    paddingTop: 8,
    gap: 20,
  },
  pageMobile: {
    paddingHorizontal: V2_LAYOUT.pagePaddingMobile,
    paddingTop: 8,
    gap: 18,
  },
  strategyStage: { gap: 10 },
  stageHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
  },
  stageHeaderMobile: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: 10,
  },
  stageCopy: { flex: 1, minWidth: 0 },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 3,
  },
  eyebrowRule: { width: 22, height: 2, backgroundColor: V2.gold },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  stageTitle: {
    color: V2.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  stageTitleMobile: { fontSize: 23, lineHeight: 28 },
  stageSubtitle: {
    marginTop: 2,
    color: V2.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },
  portfolioMetrics: {
    width: 520,
    minHeight: 52,
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  portfolioMetricsMobile: { width: "100%", flexWrap: "wrap" },
  overviewMetric: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 10,
  },
  overviewLabel: { color: V2.textDim, fontSize: 8 },
  overviewValue: {
    color: V2.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  strategyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    alignItems: "stretch",
  },
  selectionBar: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    backgroundColor: V2.backgroundRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  selectionBarMobile: {
    paddingVertical: 11,
    alignItems: "stretch",
    flexDirection: "column",
  },
  selectionCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectionCount: { flexDirection: "row", alignItems: "center", gap: 6 },
  selectionCountText: { color: V2.text, fontSize: 11, fontWeight: "900" },
  selectionNames: { flex: 1, color: V2.textMuted, fontSize: 10 },
  continueButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  continueText: { color: V2.background, fontSize: 10, fontWeight: "900" },
  builderAnchor: { paddingTop: 0 },
  riskNotice: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  riskText: { flex: 1, color: V2.textMuted, fontSize: 10, lineHeight: 16 },
  pressed: { opacity: 0.72 },
});
