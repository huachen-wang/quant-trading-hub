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
import { trpc } from "@/lib/trpc";

type Range = 7 | 30 | 60;
type DetailTab = "overview" | "materials" | "positions" | "trades";

export default function CoreStrategyDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const isNarrow = width < 1040;
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

  if (query.isLoading) return <V2LoadingState label="正在读取策略档案" />;
  if (!query.data) {
    return (
      <V2ErrorState
        title="没有找到这个核心策略"
        detail={query.error?.message || "策略可能已从六个核心席位中移除。"}
        onRetry={() => query.refetch()}
      />
    );
  }

  const strategy = query.data;
  const compatiblePlatforms =
    platforms.data
      ?.filter((platform) =>
        strategy.compatiblePlatformIds.includes(platform.id),
      )
      .map((platform) => platform.name) ?? strategy.compatiblePlatformIds;
  const overviewBlocks = strategy.contentBlocks.filter((block) =>
    ["rich_text", "evidence", "risk_notice"].includes(block.type),
  );
  const materialBlocks = strategy.contentBlocks.filter((block) =>
    ["media_gallery", "timeline", "faq"].includes(block.type),
  );
  const sourceNotice = {
    DEMO: "当前详情使用模拟数据验证展示链路，不构成收益承诺或投资建议。",
    CUSTOM: "当前详情使用后台自定义历史，请结合说明与证据核对数据口径。",
    LIVE: "当前详情读取已连接实盘数据，同步延迟和账户授权仍可能影响展示。",
    HYBRID: "接管线之前为自定义历史，之后为实盘同步，两段来源分别保留。",
  }[strategy.source.dataMode];

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
            <Text style={styles.backText}>六款核心策略</Text>
          </Pressable>
          <Text style={styles.formula}>资金 × 风控 × 策略 × 平台 × 模式</Text>
        </View>

        <View style={[styles.hero, isNarrow && styles.heroNarrow]}>
          <View style={styles.artworkWrap}>
            <Image
              accessibilityLabel={`${strategy.shortName} 策略视觉图`}
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
                  核心策略 {String(strategy.homeSlot).padStart(2, "0")}
                </Text>
                <Text style={[styles.title, isMobile && styles.titleMobile]}>
                  {strategy.name}
                </Text>
                <Text style={styles.version}>{strategy.version}</Text>
              </View>
              <Text style={styles.updatedAt}>
                同步 {formatDateTime(strategy.source.observedAt)}
              </Text>
            </View>

            <Text style={styles.tagline}>{strategy.tagline}</Text>
            <Text style={styles.description}>{strategy.description}</Text>

            <View style={styles.metrics}>
              <DetailMetric
                label="年化估算"
                value={formatAnnualizedReturn(strategy.metrics.return90dPct)}
                color={strategy.accent}
              />
              <DetailMetric
                label="近 90 日"
                value={formatPct(strategy.metrics.return90dPct, true)}
                color={strategy.accent}
              />
              <DetailMetric
                label="最大回撤"
                value={formatPct(strategy.metrics.maxDrawdownPct)}
                color={V2.amber}
              />
              <DetailMetric
                label="胜率"
                value={formatPct(strategy.metrics.winRatePct)}
              />
              <DetailMetric
                label="交易次数"
                value={String(strategy.metrics.tradeCount)}
              />
              <DetailMetric
                label="建议资金"
                value={formatMoney(strategy.minimumCapital, "USD", true)}
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
                  选择此策略并开始选配
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
                <Text style={styles.secondaryButtonText}>查看实盘账户</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.fitBar}>
          <StrategyFitItem label="策略逻辑" value={strategy.style} />
          <StrategyFitItem
            label="交易品种"
            value={strategy.instruments.join(" / ")}
          />
          <StrategyFitItem
            label="兼容终端"
            value={strategy.terminals.join(" / ")}
          />
          <StrategyFitItem
            label="风险级别"
            value={riskLabel(strategy.riskLevel)}
          />
          <StrategyFitItem
            label="适配平台"
            value={compatiblePlatforms.join(" / ") || "待核验"}
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
                <Text style={styles.sectionEyebrow}>收益曲线</Text>
                <Text style={styles.sectionTitle}>净值运行</Text>
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
                <Text style={styles.chartMeta}>当前权益</Text>
                <Text style={styles.chartEquity}>
                  {formatMoney(strategy.metrics.equity, "USD")}
                </Text>
              </View>
              <Text style={styles.chartMeta}>
                今日 {formatPct(strategy.metrics.todayPnlPct, true)}
              </Text>
            </View>
            <EquityChart
              points={
                strategy.source.freshness === "OFFLINE" ? [] : chartPoints
              }
              color={strategy.accent}
              height={isMobile ? 190 : 240}
              showAxis
              emptyLabel="数据连接中断，保留最后一次指标快照"
            />
          </View>

          <View style={styles.snapshot}>
            <View>
              <Text style={styles.sectionEyebrow}>账户快照</Text>
              <Text style={styles.snapshotTitle}>运行快照</Text>
            </View>
            <View style={styles.snapshotRows}>
              <AccountSnapshotRow
                label="余额"
                value={formatMoney(strategy.metrics.balance, "USD")}
              />
              <AccountSnapshotRow
                label="浮动盈亏"
                value={formatMoney(strategy.metrics.floatingPnl, "USD")}
                color={
                  (strategy.metrics.floatingPnl ?? 0) >= 0 ? V2.green : V2.red
                }
              />
              <AccountSnapshotRow
                label="平均持仓"
                value={
                  strategy.metrics.avgHoldingMinutes == null
                    ? "--"
                    : `${strategy.metrics.avgHoldingMinutes} 分钟`
                }
              />
              <AccountSnapshotRow
                label="当前持仓"
                value={`${strategy.positions.length} 笔`}
              />
              <AccountSnapshotRow
                label="数据状态"
                value={
                  strategy.source.freshness === "FRESH"
                    ? "同步正常"
                    : strategy.source.freshness === "STALE"
                      ? "存在延迟"
                      : "连接中断"
                }
              />
            </View>
            <Text style={styles.snapshotHint}>
              该策略只是量化方案中的一个模块，仍需与资金门槛、风险预算、兼容平台及管理模式共同确定。
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
              label="策略摘要"
              active={tab === "overview"}
              onPress={() => setTab("overview")}
            />
            <DetailTabButton
              label="图文资料"
              active={tab === "materials"}
              onPress={() => setTab("materials")}
            />
            <DetailTabButton
              label={`当前持仓 ${strategy.positions.length}`}
              active={tab === "positions"}
              onPress={() => setTab("positions")}
            />
            <DetailTabButton
              label={`最近交易 ${strategy.recentTrades.length}`}
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
              empty="当前没有公开持仓"
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
              empty="暂无可展示交易"
              isMobile={isMobile}
            />
          ) : null}
        </View>

        <View style={styles.bottomNotice}>
          <MaterialIcons name="info-outline" size={18} color={V2.blue} />
          <Text style={styles.bottomNoticeText}>
            {sourceNotice} 年化按近 90 日收益复合折算，历史表现不代表未来结果。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
