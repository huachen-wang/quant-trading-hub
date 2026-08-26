import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ContentBlocks } from "@/components/v2/content-blocks";
import { EquityChart } from "@/components/v2/equity-chart";
import {
  formatAnnualizedReturn,
  formatDateTime,
  formatMoney,
  formatPct,
  riskLabel,
} from "@/components/v2/format";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { StatusBadge } from "@/components/v2/status-badge";
import {
  AccountSnapshotRow,
  DetailMetric,
  DetailTabButton,
  StrategyFitItem,
  StrategyTradeTable,
} from "@/components/v2/strategy-detail/detail-parts";
import { detailStyles as styles } from "@/components/v2/strategy-detail/styles";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import { localizePlatform, localizeStrategy } from "@/lib/v2/localized-content";

type Range = 7 | 30 | 60;
type DetailTab = "overview" | "materials" | "positions" | "trades";

export default function CoreStrategyDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const isNarrow = width < 1040;
  const { language, locale, text } = useLanguage();
  const [range, setRange] = useState<Range>(30);
  const [tab, setTab] = useState<DetailTab>("overview");
  const query = trpc.v2.strategies.byId.useQuery(
    { id: String(id || "") },
    { enabled: Boolean(id), staleTime: 20_000 },
  );
  const platforms = trpc.v2.platforms.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  const chartPoints = useMemo(
    () => query.data?.equity.slice(-range) ?? [],
    [query.data?.equity, range],
  );

  if (query.isLoading) {
    return (
      <V2LoadingState
        label={text(
          "正在读取策略档案",
          "Loading strategy profile",
          "جارٍ تحميل ملف الاستراتيجية",
        )}
      />
    );
  }
  if (!query.data) {
    return (
      <V2ErrorState
        title={text(
          "没有找到这个核心策略",
          "Core strategy not found",
          "لم يتم العثور على الاستراتيجية الأساسية",
        )}
        detail={
          query.error?.message ||
          text(
            "策略可能已从六个核心席位中移除。",
            "The strategy may have been removed from the six core slots.",
            "ربما تمت إزالة الاستراتيجية من المواقع الأساسية الستة.",
          )
        }
        onRetry={() => query.refetch()}
      />
    );
  }

  const strategy = localizeStrategy(query.data, language);
  const compatiblePlatforms =
    platforms.data
      ?.filter((platform) =>
        strategy.compatiblePlatformIds.includes(platform.id),
      )
      .map((platform) => localizePlatform(platform, language).name) ??
    strategy.compatiblePlatformIds;
  const overviewBlocks = strategy.contentBlocks.filter((block) =>
    ["rich_text", "evidence", "risk_notice"].includes(block.type),
  );
  const materialBlocks = strategy.contentBlocks.filter((block) =>
    ["media_gallery", "timeline", "faq"].includes(block.type),
  );
  const sourceNotice =
    strategy.source.dataMode === "DEMO"
      ? text(
          "当前详情使用模拟数据验证展示链路，不构成收益承诺或投资建议。",
          "This profile uses demo data to validate the display flow and is not a return promise or investment advice.",
          "يستخدم هذا الملف بيانات تجريبية للتحقق من العرض ولا يمثل وعدا بالعائد أو نصيحة استثمارية.",
        )
      : strategy.source.dataMode === "CUSTOM"
        ? text(
            "当前详情使用后台自定义历史，请结合说明与证据核对数据口径。",
            "This profile uses admin-maintained history. Review the methodology and evidence.",
            "يستخدم هذا الملف سجلا تديره لوحة التحكم. راجع المنهجية والأدلة.",
          )
        : strategy.source.dataMode === "LIVE"
          ? text(
              "当前详情读取已连接实盘数据，同步延迟和账户授权仍可能影响展示。",
              "This profile reads a connected live source. Sync delays and account permissions may affect the display.",
              "يقرأ هذا الملف مصدرا حيا متصلا وقد يؤثر تأخر المزامنة وصلاحيات الحساب على العرض.",
            )
          : text(
              "接管线之前为自定义历史，之后为实盘同步，两段来源分别保留。",
              "Admin history is retained before the handover point and live sync continues after it.",
              "يتم الاحتفاظ بالسجل الإداري قبل نقطة الربط وتستمر المزامنة الحية بعدها.",
            );

  const chooseStrategy = () => {
    router.push({
      pathname: "/",
      params: { configure: "1", strategyId: strategy.id },
    } as never);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <View style={styles.topline}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="arrow-back" size={18} color={V2.textMuted} />
            <Text style={styles.backText}>
              {text(
                "六款核心策略",
                "Six core strategies",
                "الاستراتيجيات الست",
              )}
            </Text>
          </Pressable>
          <Text style={styles.formula}>
            {text(
              "资金 × 风控 × 策略 × 平台 × 模式",
              "Capital × Risk × Strategy × Platform × Mode",
              "رأس المال × المخاطر × الاستراتيجية × المنصة × النمط",
            )}
          </Text>
        </View>

        <View style={[styles.hero, isNarrow && styles.heroNarrow]}>
          <View style={styles.artworkWrap}>
            <Image
              accessibilityLabel={text(
                `${strategy.shortName} 策略视觉图`,
                `${strategy.shortName} strategy artwork`,
                `صورة استراتيجية ${strategy.shortName}`,
              )}
              source={{ uri: strategy.artwork }}
              style={styles.artwork}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
            <View
              style={[styles.artworkRail, { backgroundColor: strategy.accent }]}
            />
            <View style={styles.artworkStatus}>
              <StatusBadge
                dataMode={strategy.source.dataMode}
                freshness={strategy.source.freshness}
              />
            </View>
          </View>

          <View style={styles.heroCopy}>
            <View style={styles.identity}>
              <View style={styles.identityCopy}>
                <Text style={styles.slotLabel}>
                  {text("核心策略", "CORE STRATEGY", "استراتيجية أساسية")}{" "}
                  {String(strategy.homeSlot).padStart(2, "0")}
                </Text>
                <Text style={[styles.title, isMobile && styles.titleMobile]}>
                  {strategy.name}
                </Text>
                <Text style={styles.version}>{strategy.version}</Text>
              </View>
              <Text style={styles.updatedAt}>
                {text("同步", "Synced", "تمت المزامنة")}{" "}
                {formatDateTime(strategy.source.observedAt, locale)}
              </Text>
            </View>

            <Text style={styles.tagline}>{strategy.tagline}</Text>
            <Text style={styles.description}>{strategy.description}</Text>

            <View style={styles.metrics}>
              <DetailMetric
                label={text("年化估算", "Annualized", "العائد السنوي")}
                value={formatAnnualizedReturn(strategy.metrics.return90dPct)}
                color={strategy.accent}
              />
              <DetailMetric
                label={text("近 90 日", "Last 90 days", "آخر 90 يوما")}
                value={formatPct(strategy.metrics.return90dPct, true)}
                color={strategy.accent}
              />
              <DetailMetric
                label={text("最大回撤", "Max drawdown", "أقصى تراجع")}
                value={formatPct(strategy.metrics.maxDrawdownPct)}
                color={V2.amber}
              />
              <DetailMetric
                label={text("胜率", "Win rate", "نسبة الفوز")}
                value={formatPct(strategy.metrics.winRatePct)}
              />
              <DetailMetric
                label={text("交易次数", "Trades", "الصفقات")}
                value={String(strategy.metrics.tradeCount)}
              />
              <DetailMetric
                label={text(
                  "建议资金",
                  "Suggested capital",
                  "رأس المال المقترح",
                )}
                value={formatMoney(
                  strategy.minimumCapital,
                  "USD",
                  true,
                  locale,
                )}
              />
            </View>

            <View style={[styles.actions, isMobile && styles.actionsMobile]}>
              <Pressable
                accessibilityRole="button"
                onPress={chooseStrategy}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="add-chart"
                  size={18}
                  color={V2.background}
                />
                <Text style={styles.primaryButtonText}>
                  {text(
                    "选择此策略并开始选配",
                    "Select and configure",
                    "اختر وابدأ الإعداد",
                  )}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/v2-preview/accounts" as never)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="monitor-heart" size={17} color={V2.text} />
                <Text style={styles.secondaryButtonText}>
                  {text(
                    "查看实盘账户",
                    "View live accounts",
                    "عرض الحسابات الحية",
                  )}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.fitBar}>
          <StrategyFitItem
            label={text("策略逻辑", "Strategy logic", "منطق الاستراتيجية")}
            value={strategy.style}
          />
          <StrategyFitItem
            label={text("交易品种", "Instruments", "الأصول")}
            value={strategy.instruments.join(" / ")}
          />
          <StrategyFitItem
            label={text("兼容终端", "Terminals", "المنصات التقنية")}
            value={strategy.terminals.join(" / ")}
          />
          <StrategyFitItem
            label={text("风险级别", "Risk level", "مستوى المخاطر")}
            value={riskLabel(strategy.riskLevel, language)}
          />
          <StrategyFitItem
            label={text(
              "适配平台",
              "Compatible platforms",
              "المنصات المتوافقة",
            )}
            value={
              compatiblePlatforms.join(" / ") ||
              text("待核验", "Pending verification", "قيد التحقق")
            }
            wide
          />
        </View>

        <View
          style={[styles.performance, isNarrow && styles.performanceNarrow]}
        >
          <View style={styles.chartPanel}>
            <View
              style={[
                styles.chartHeading,
                isMobile && styles.chartHeadingMobile,
              ]}
            >
              <View>
                <Text style={styles.sectionEyebrow}>
                  {text("收益曲线", "PERFORMANCE CURVE", "منحنى الأداء")}
                </Text>
                <Text style={styles.sectionTitle}>
                  {text("净值运行", "Equity performance", "أداء حقوق الحساب")}
                </Text>
              </View>
              <View style={styles.rangeControl}>
                {([7, 30, 60] as Range[]).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: range === value }}
                    onPress={() => setRange(value)}
                    style={[
                      styles.rangeButton,
                      range === value && styles.rangeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rangeText,
                        range === value && styles.rangeTextActive,
                      ]}
                    >
                      {value}D
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.chartTopline}>
              <View>
                <Text style={styles.chartMeta}>
                  {text("当前权益", "Current equity", "حقوق الحساب الحالية")}
                </Text>
                <Text style={styles.chartEquity}>
                  {formatMoney(strategy.metrics.equity, "USD", false, locale)}
                </Text>
              </View>
              <Text style={styles.chartMeta}>
                {text("今日", "Today", "اليوم")}{" "}
                {formatPct(strategy.metrics.todayPnlPct, true)}
              </Text>
            </View>
            <EquityChart
              points={
                strategy.source.freshness === "OFFLINE" ? [] : chartPoints
              }
              color={strategy.accent}
              height={isMobile ? 190 : 240}
              showAxis
              emptyLabel={text(
                "数据连接中断，保留最后一次指标快照",
                "Data feed disconnected; the last metric snapshot is retained",
                "انقطع مصدر البيانات وتم الاحتفاظ بآخر لقطة للمؤشرات",
              )}
            />
          </View>

          <View style={styles.snapshot}>
            <View>
              <Text style={styles.sectionEyebrow}>
                {text("账户快照", "ACCOUNT SNAPSHOT", "لقطة الحساب")}
              </Text>
              <Text style={styles.snapshotTitle}>
                {text("运行快照", "Runtime snapshot", "لقطة التشغيل")}
              </Text>
            </View>
            <View style={styles.snapshotRows}>
              <AccountSnapshotRow
                label={text("余额", "Balance", "الرصيد")}
                value={formatMoney(
                  strategy.metrics.balance,
                  "USD",
                  false,
                  locale,
                )}
              />
              <AccountSnapshotRow
                label={text(
                  "浮动盈亏",
                  "Floating P&L",
                  "الربح والخسارة العائمة",
                )}
                value={formatMoney(
                  strategy.metrics.floatingPnl,
                  "USD",
                  false,
                  locale,
                )}
                color={
                  (strategy.metrics.floatingPnl ?? 0) >= 0 ? V2.green : V2.red
                }
              />
              <AccountSnapshotRow
                label={text("平均持仓", "Average hold", "متوسط الاحتفاظ")}
                value={
                  strategy.metrics.avgHoldingMinutes == null
                    ? "--"
                    : `${strategy.metrics.avgHoldingMinutes} ${text("分钟", "min", "دقيقة")}`
                }
              />
              <AccountSnapshotRow
                label={text("当前持仓", "Open positions", "المراكز المفتوحة")}
                value={`${strategy.positions.length} ${text("笔", "positions", "مراكز")}`}
              />
              <AccountSnapshotRow
                label={text("数据状态", "Data status", "حالة البيانات")}
                value={
                  strategy.source.freshness === "FRESH"
                    ? text("同步正常", "Synced", "متزامن")
                    : strategy.source.freshness === "STALE"
                      ? text("存在延迟", "Delayed", "متأخر")
                      : text("连接中断", "Disconnected", "غير متصل")
                }
              />
            </View>
            <Text style={styles.snapshotHint}>
              {text(
                "该策略只是量化方案中的一个模块，仍需与资金门槛、风险预算、兼容平台及管理模式共同确定。",
                "This strategy is one module in a quant plan and must be combined with capital minimums, risk budget, compatible platforms and a management mode.",
                "هذه الاستراتيجية جزء واحد من الخطة الكمية ويجب دمجها مع الحد الأدنى لرأس المال وميزانية المخاطر والمنصات المتوافقة ونمط الإدارة.",
              )}
            </Text>
          </View>
        </View>

        <View style={styles.activitySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            <DetailTabButton
              label={text("策略摘要", "Overview", "نظرة عامة")}
              active={tab === "overview"}
              onPress={() => setTab("overview")}
            />
            <DetailTabButton
              label={text("图文资料", "Materials", "المواد")}
              active={tab === "materials"}
              onPress={() => setTab("materials")}
            />
            <DetailTabButton
              label={text(
                `当前持仓 ${strategy.positions.length}`,
                `Positions ${strategy.positions.length}`,
                `المراكز ${strategy.positions.length}`,
              )}
              active={tab === "positions"}
              onPress={() => setTab("positions")}
            />
            <DetailTabButton
              label={text(
                `最近交易 ${strategy.recentTrades.length}`,
                `Recent trades ${strategy.recentTrades.length}`,
                `الصفقات الأخيرة ${strategy.recentTrades.length}`,
              )}
              active={tab === "trades"}
              onPress={() => setTab("trades")}
            />
          </ScrollView>

          {tab === "overview" ? (
            <ContentBlocks blocks={overviewBlocks} />
          ) : null}
          {tab === "materials" ? (
            <ContentBlocks blocks={materialBlocks} />
          ) : null}
          {tab === "positions" ? (
            <StrategyTradeTable
              rows={strategy.positions.map((position) => ({
                id: position.id,
                symbol: position.symbol,
                side: position.side,
                volume: position.volume.toFixed(2),
                price: `${position.openPrice} → ${position.currentPrice}`,
                pnl: position.floatingPnl,
                time: position.openedAt,
              }))}
              empty={text(
                "当前没有公开持仓",
                "No public positions",
                "لا توجد مراكز عامة",
              )}
              isMobile={isMobile}
            />
          ) : null}
          {tab === "trades" ? (
            <StrategyTradeTable
              rows={strategy.recentTrades.map((trade) => ({
                id: trade.id,
                symbol: trade.symbol,
                side: trade.side,
                volume: trade.volume.toFixed(2),
                price: `${trade.openPrice} → ${trade.closePrice}`,
                pnl: trade.pnl,
                time: trade.closedAt,
              }))}
              empty={text(
                "暂无可展示交易",
                "No trades to display",
                "لا توجد صفقات للعرض",
              )}
              isMobile={isMobile}
            />
          ) : null}
        </View>

        <View style={styles.bottomNotice}>
          <MaterialIcons name="info-outline" size={18} color={V2.blue} />
          <Text style={styles.bottomNoticeText}>
            {sourceNotice}{" "}
            {text(
              "年化按近 90 日收益复合折算，历史表现不代表未来结果。",
              "Annualized return is compounded from the last 90 days. Historical performance does not predict future results.",
              "يتم احتساب العائد السنوي مركبا من آخر 90 يوما. الأداء التاريخي لا يتنبأ بالنتائج المستقبلية.",
            )}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
