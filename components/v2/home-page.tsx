import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  formatAnnualizedReturn,
  formatMoney,
  formatPct,
} from "@/components/v2/format";
import {
  LiveFeedStrip,
  type LiveFeedItem,
} from "@/components/v2/live-feed-strip";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { SolutionConfigurator } from "@/components/v2/solution-configurator";
import { StrategyCard } from "@/components/v2/strategy-card";
import { StrategySelectionPanel } from "@/components/v2/strategy-selection-panel";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import {
  localizePlatforms,
  localizeStrategies,
} from "@/lib/v2/localized-content";

const DEFAULT_SELECTION = ["jingge-v51", "quantum-queen", "black-aura"];
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
  const useTwoColumnCards = width >= 700 && width < 820;
  const showSelectionSidebar = width >= 1120;
  const compactCards = width < 1320;
  const { language, locale, text } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const preferredApplied = useRef(false);
  const builderScrolled = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [builderY, setBuilderY] = useState(0);
  const [selectionFeedback, setSelectionFeedback] = useState("");
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
  const localizedData = useMemo(() => {
    if (!overview.data) return undefined;
    return {
      ...overview.data,
      strategies: localizeStrategies(overview.data.strategies, language),
      platforms: localizePlatforms(overview.data.platforms, language),
    };
  }, [language, overview.data]);

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

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  if (overview.isLoading) {
    return (
      <V2LoadingState
        label={text(
          "正在汇总六策略",
          "Loading six core strategies",
          "جارٍ تجميع الاستراتيجيات الست",
        )}
      />
    );
  }
  if (!localizedData) {
    return (
      <V2ErrorState
        detail={
          overview.error?.message ||
          text(
            "六策略聚合接口没有返回可用数据。",
            "The strategy service returned no usable data.",
            "لم تُرجع خدمة الاستراتيجيات بيانات قابلة للاستخدام.",
          )
        }
        onRetry={() => overview.refetch()}
      />
    );
  }

  const data = localizedData;
  const hasPublicPulse = Boolean(livePulse.data?.items.length);
  const feedItems: LiveFeedItem[] = hasPublicPulse
    ? livePulse.data!.items.map((item, index) => ({
        id: `niubang-${item.slug}`,
        name: item.name,
        accent: LIVE_PULSE_ACCENTS[index % LIVE_PULSE_ACCENTS.length],
        changePct: item.monthlyReturnPct,
        changeLabel: text("月度", "Monthly", "شهري"),
        equity: item.equity,
        equityLabel: text("账户权益", "Account equity", "حقوق الحساب"),
        href: item.url,
      }))
    : data.strategies.map((strategy) => ({
        id: strategy.id,
        name: strategy.shortName,
        accent: strategy.accent,
        changePct: strategy.metrics.todayPnlPct,
        changeLabel: text("今日", "Today", "اليوم"),
        equity: strategy.metrics.equity,
        equityLabel: text("权益", "Equity", "حقوق الملكية"),
      }));
  const feedSource = hasPublicPulse ? livePulse.data!.source : data.source;
  const cardWidth = isMobile ? "100%" : useTwoColumnCards ? "48.7%" : "31.9%";
  const selectedStrategies = data.strategies.filter((strategy) =>
    selectedStrategyIds.includes(strategy.id),
  );
  const dataNoticeCopy =
    data.source.dataMode === "DEMO"
      ? text(
          "当前使用模拟账户数据验证展示与选配流程，不代表真实收益。",
          "Demo account data is being used to validate the experience and does not represent real returns.",
          "تُستخدم بيانات حساب تجريبي لاختبار التجربة ولا تمثل عوائد حقيقية.",
        )
      : data.source.dataMode === "CUSTOM"
        ? text(
            "当前使用后台维护数据，可继续补充时间口径与证据。",
            "Current figures are maintained in the admin console; evidence and time periods can be added.",
            "تتم إدارة الأرقام الحالية من لوحة التحكم ويمكن إضافة الأدلة والفترات الزمنية.",
          )
        : data.source.dataMode === "LIVE"
          ? text(
              "当前指标来自已连接数据源，请同时查看同步时间和风险边界。",
              "Metrics come from a connected source. Review sync time and risk limits as well.",
              "تأتي المؤشرات من مصدر متصل. راجع وقت المزامنة وحدود المخاطر أيضا.",
            )
          : text(
              "历史段由后台维护，接管线后由实盘数据源持续更新。",
              "Historical data is maintained in the admin console and live data continues after the handover point.",
              "تتم إدارة البيانات التاريخية من لوحة التحكم وتستمر البيانات الحية بعد نقطة الربط.",
            );

  const toggleStrategy = (id: string) => {
    const strategy = data.strategies.find((item) => item.id === id);
    if (!strategy) return;
    const removing = selectedStrategyIds.includes(id);
    setSelectedStrategyIds((current) =>
      removing
        ? current.filter((strategyId) => strategyId !== id)
        : [...current, id],
    );
    setSelectionFeedback(
      removing
        ? text(
            `已移出 ${strategy.shortName}`,
            `Removed ${strategy.shortName}`,
            `تمت إزالة ${strategy.shortName}`,
          )
        : text(
            `已加入 ${strategy.shortName}`,
            `Added ${strategy.shortName}`,
            `تمت إضافة ${strategy.shortName}`,
          ),
    );
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setSelectionFeedback(""), 1800);
  };

  const scrollToBuilder = () => {
    router.setParams({ configure: "1" });
    scrollRef.current?.scrollTo({
      y: Math.max(0, builderY - 16),
      animated: true,
    });
  };

  const selectAllStrategies = () => {
    setSelectedStrategyIds(data.strategies.map((strategy) => strategy.id));
    setSelectionFeedback(
      text(
        "已选择全部 6 款可选策略",
        "All six strategies selected",
        "تم اختيار الاستراتيجيات الست",
      ),
    );
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
                <Text style={styles.stageIndex}>01</Text>
                <View style={styles.eyebrowRule} />
                <Text style={styles.eyebrow}>
                  {text(
                    "AI量化联盟 · 六策略",
                    "AI QUANT ALLIANCE · SIX STRATEGIES",
                    "تحالف EAXAU الكمي · ست استراتيجيات",
                  )}
                </Text>
              </View>
              <Text
                style={[styles.stageTitle, isMobile && styles.stageTitleMobile]}
              >
                {text(
                  "六款策略 · 自由选配 1–6 款",
                  "Six strategies · Select any 1–6",
                  "ست استراتيجيات · اختر من 1 إلى 6",
                )}
              </Text>
              <Text style={styles.stageSubtitle}>{dataNoticeCopy}</Text>
            </View>

            <View
              style={[
                styles.portfolioSnapshot,
                (isMobile || isTablet) && styles.portfolioSnapshotMobile,
              ]}
            >
              <View
                style={[
                  styles.annualizedMetric,
                  isMobile && styles.annualizedMetricMobile,
                ]}
              >
                <Text style={styles.annualizedLabel}>
                  {text(
                    "年化估算",
                    "Annualized estimate",
                    "العائد السنوي التقديري",
                  )}
                </Text>
                <Text style={styles.annualizedValue} numberOfLines={1}>
                  {formatAnnualizedReturn(data.portfolio.return90dPct)}
                </Text>
                <Text style={styles.annualizedBasis}>
                  {text(
                    "按近 90 日复合折算",
                    "Compounded from the last 90 days",
                    "مركب من آخر 90 يوما",
                  )}
                </Text>
              </View>
              <View style={styles.secondaryMetrics}>
                <OverviewMetric
                  label={text("近 90 日", "Last 90 days", "آخر 90 يوما")}
                  value={formatPct(data.portfolio.return90dPct, true)}
                  color={V2.green}
                />
                <OverviewMetric
                  label={text("最大回撤", "Max drawdown", "أقصى تراجع")}
                  value={formatPct(data.portfolio.maxDrawdownPct)}
                  color={V2.amber}
                />
                <OverviewMetric
                  label={text("组合权益", "Portfolio equity", "حقوق المحفظة")}
                  value={formatMoney(
                    data.portfolio.equity,
                    "USD",
                    true,
                    locale,
                  )}
                />
                <OverviewMetric
                  label={text("运行中", "Active", "نشط")}
                  value={`${data.portfolio.activeStrategies} / 6`}
                  color={V2.blue}
                />
              </View>
            </View>
          </View>

          <View
            style={[
              styles.workbench,
              !showSelectionSidebar && styles.workbenchStack,
            ]}
          >
            <View style={styles.strategyGrid}>
              {data.strategies.map((strategy) => (
                <View key={strategy.id} style={{ width: cardWidth }}>
                  <StrategyCard
                    compact={compactCards}
                    mobile={isMobile}
                    strategy={strategy}
                    selected={selectedStrategyIds.includes(strategy.id)}
                    onPress={openStrategy}
                    onToggle={toggleStrategy}
                  />
                </View>
              ))}
            </View>
            <StrategySelectionPanel
              compact={!showSelectionSidebar}
              inline={!showSelectionSidebar && !isMobile}
              selectedStrategies={selectedStrategies}
              total={data.strategies.length}
              feedback={selectionFeedback}
              onRemove={toggleStrategy}
              onSelectAll={selectAllStrategies}
              onContinue={scrollToBuilder}
            />
          </View>
        </View>

        <View
          onLayout={(event) => setBuilderY(event.nativeEvent.layout.y)}
          style={styles.builderAnchor}
        >
          <SolutionConfigurator strategies={selectedStrategies} />
        </View>

        <View style={styles.riskNotice}>
          <MaterialIcons name="verified-user" size={20} color={V2.amber} />
          <Text style={styles.riskText}>
            {text(
              "历史收益、胜率和模型回撤不代表未来结果。正式启用前仍需核验数据源、券商实体、账户权限、合同责任和当前平台条款。资管授权只包含约定的交易与风控权限，不包含出金、转账或修改收款地址。EA 销售款、券商直充与资管代收严格分账；任何入金完成状态均以券商实际到账为准。",
              "Historical returns, win rates and modeled drawdowns do not predict future results. Verify the data source, broker entity, account permissions, contractual duties and current platform terms before activation. Managed authorization covers agreed trading and risk controls only, never withdrawals, transfers or deposit-address changes. EA sales, direct broker funding and managed collection are reconciled separately; funding is complete only when the broker actually credits the account.",
              "لا تمثل العوائد أو نسب الفوز أو التراجعات المحسوبة نتائج مستقبلية. يجب التحقق من مصدر البيانات وكيان الوسيط وصلاحيات الحساب والالتزامات التعاقدية وشروط المنصة قبل التفعيل. يشمل تفويض الإدارة التداول وضبط المخاطر المتفق عليهما فقط، ولا يشمل السحب أو التحويل أو تغيير عنوان الإيداع. تُفصل حسابات بيع EA والإيداع المباشر والتحصيل المُدار، ولا يكتمل الإيداع إلا بعد القيد الفعلي لدى الوسيط.",
            )}
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
  strategyStage: { gap: 12 },
  stageHeader: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 20,
  },
  stageHeaderMobile: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: 10,
  },
  stageCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 5,
  },
  stageIndex: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  eyebrowRule: { width: 24, height: 1, backgroundColor: V2.borderStrong },
  eyebrow: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  stageTitle: {
    color: V2.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  stageTitleMobile: { fontSize: 23, lineHeight: 28 },
  stageSubtitle: {
    marginTop: 4,
    color: V2.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },
  portfolioSnapshot: {
    width: 560,
    minHeight: 86,
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
    backgroundColor: "rgba(13,21,33,0.42)",
  },
  portfolioSnapshotMobile: { width: "100%", minHeight: 88 },
  annualizedMetric: {
    width: 180,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: V2.border,
  },
  annualizedMetricMobile: { width: "44%", paddingHorizontal: 10 },
  annualizedLabel: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  annualizedValue: {
    marginTop: 2,
    color: V2.green,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  annualizedBasis: { marginTop: 2, color: V2.textDim, fontSize: 8 },
  secondaryMetrics: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  overviewMetric: {
    width: "50%",
    minWidth: 0,
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
  },
  overviewLabel: { color: V2.textDim, fontSize: 8 },
  overviewValue: {
    color: V2.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  strategyGrid: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    alignItems: "stretch",
  },
  workbench: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  workbenchStack: { flexDirection: "column" },
  builderAnchor: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: V2.border,
  },
  riskNotice: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  riskText: { flex: 1, color: V2.textMuted, fontSize: 10, lineHeight: 16 },
});
