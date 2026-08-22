import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ContentBlocks } from "@/components/v2/content-blocks";
import { EquityChart } from "@/components/v2/equity-chart";
import { formatDateTime, formatMoney, formatPct, riskLabel } from "@/components/v2/format";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { StatusBadge } from "@/components/v2/status-badge";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { trpc } from "@/lib/trpc";

type Range = 7 | 30 | 60;
type DetailTab = "overview" | "positions" | "trades";

export default function CoreStrategyDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const [range, setRange] = useState<Range>(30);
  const [tab, setTab] = useState<DetailTab>("overview");
  const query = trpc.v2.strategies.byId.useQuery(
    { id: String(id || "") },
    { enabled: Boolean(id), staleTime: 20_000 },
  );

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
  const sourceNotice = {
    DEMO: "当前详情使用模拟数据验证展示链路，不构成收益承诺或投资建议。",
    CUSTOM: "当前详情使用后台自定义历史；请结合资料区核对数据口径、时间范围与证明材料。",
    LIVE: "当前详情读取已连接实盘数据；同步延迟、平台规则和账户授权仍可能影响展示。",
    HYBRID: "接管线之前为自定义历史，之后为实盘同步；两段来源在后台分别保留。",
  }[strategy.source.dataMode];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="arrow-back" size={18} color={V2.textMuted} />
          <Text style={styles.backText}>返回六策略</Text>
        </Pressable>

        <View style={[styles.hero, isMobile && styles.heroMobile]}>
          <View style={styles.artworkWrap}>
            <Image
              source={{ uri: strategy.artwork }}
              style={styles.artwork}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={140}
            />
            <View style={[styles.artworkRail, { backgroundColor: strategy.accent }]} />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.statusRow}>
              <StatusBadge
                dataMode={strategy.source.dataMode}
                freshness={strategy.source.freshness}
              />
              <Text style={styles.updatedAt}>
                同步 {formatDateTime(strategy.source.observedAt)}
              </Text>
              {strategy.source.historyHandoverAt ? (
                <Text style={styles.updatedAt}>接管 {formatDateTime(strategy.source.historyHandoverAt)}</Text>
              ) : null}
            </View>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>{strategy.name}</Text>
            <Text style={styles.version}>{strategy.version}</Text>
            <Text style={styles.tagline}>{strategy.tagline}</Text>
            <Text style={styles.description}>{strategy.description}</Text>
            <View style={styles.tags}>
              {strategy.instruments.map((instrument) => (
                <View key={instrument} style={styles.tag}><Text style={styles.tagText}>{instrument}</Text></View>
              ))}
              <View style={styles.tag}><Text style={styles.tagText}>{strategy.terminals.join(" / ")}</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>{riskLabel(strategy.riskLevel)}</Text></View>
            </View>
            <View style={[styles.actions, isMobile && styles.actionsMobile]}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/v2-preview/allocate",
                    params: { strategyId: strategy.id },
                  } as never)
                }
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <MaterialIcons name="add-chart" size={18} color={V2.background} />
                <Text style={styles.primaryButtonText}>加入分仓方案</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/v2-preview/accounts" as never)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <MaterialIcons name="monitor-heart" size={18} color={V2.text} />
                <Text style={styles.secondaryButtonText}>账户观察</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.metrics}>
          <Metric label="近 30 日" value={formatPct(strategy.metrics.return30dPct, true)} color={strategy.accent} />
          <Metric label="近 90 日" value={formatPct(strategy.metrics.return90dPct, true)} color={strategy.accent} />
          <Metric label="最大回撤" value={formatPct(strategy.metrics.maxDrawdownPct)} />
          <Metric label="胜率" value={formatPct(strategy.metrics.winRatePct)} />
          <Metric label="交易次数" value={String(strategy.metrics.tradeCount)} />
          <Metric label="建议资金" value={formatMoney(strategy.minimumCapital, "USD", true)} />
        </View>

        <View style={styles.chartSection}>
          <View style={[styles.chartHeading, isMobile && styles.chartHeadingMobile]}>
            <View>
              <Text style={styles.sectionEyebrow}>PERFORMANCE</Text>
              <Text style={styles.sectionTitle}>净值与余额</Text>
            </View>
            <View style={styles.rangeControl}>
              {([7, 30, 60] as Range[]).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: range === value }}
                  onPress={() => setRange(value)}
                  style={[styles.rangeButton, range === value && styles.rangeButtonActive]}
                >
                  <Text style={[styles.rangeText, range === value && styles.rangeTextActive]}>{value}D</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.chartPanel}>
            <View style={styles.chartTopline}>
              <View>
                <Text style={styles.chartMeta}>当前权益</Text>
                <Text style={styles.chartEquity}>{formatMoney(strategy.metrics.equity, "USD")}</Text>
              </View>
              <View style={styles.chartLegend}>
                <View style={[styles.legendDot, { backgroundColor: strategy.accent }]} />
                <Text style={styles.legendText}>权益</Text>
              </View>
            </View>
            <EquityChart
              points={strategy.source.freshness === "OFFLINE" ? [] : chartPoints}
              color={strategy.accent}
              height={isMobile ? 210 : 300}
              showAxis
              emptyLabel="数据连接中断，保留最后一次指标快照"
            />
          </View>
        </View>

        <View style={styles.activitySection}>
          <View style={styles.tabs}>
            <TabButton label="策略说明" active={tab === "overview"} onPress={() => setTab("overview")} />
            <TabButton label={`当前持仓 ${strategy.positions.length}`} active={tab === "positions"} onPress={() => setTab("positions")} />
            <TabButton label={`最近交易 ${strategy.recentTrades.length}`} active={tab === "trades"} onPress={() => setTab("trades")} />
          </View>

          {tab === "overview" ? <ContentBlocks blocks={strategy.contentBlocks} /> : null}
          {tab === "positions" ? (
            <TradeTable
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
            <TradeTable
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
          <MaterialIcons name="info-outline" size={20} color={V2.blue} />
          <Text style={styles.bottomNoticeText}>
            {sourceNotice} 历史表现不代表未来结果。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, color = V2.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

type TradeRow = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: string;
  price: string;
  pnl: number;
  time: string;
};

function TradeTable({ rows, empty, isMobile }: { rows: TradeRow[]; empty: string; isMobile: boolean }) {
  if (!rows.length) {
    return <View style={styles.empty}><MaterialIcons name="hourglass-empty" size={24} color={V2.textDim} /><Text style={styles.emptyText}>{empty}</Text></View>;
  }
  return (
    <View style={styles.table}>
      {!isMobile ? (
        <View style={[styles.tableRow, styles.tableHeader]}>
          <TableCell value="品种 / 方向" flex={1.1} muted />
          <TableCell value="手数" muted />
          <TableCell value="开仓 → 当前/平仓" flex={1.6} muted />
          <TableCell value="盈亏" muted />
          <TableCell value="时间" flex={1.2} muted />
        </View>
      ) : null}
      {rows.map((row) => (
        <View key={row.id} style={[styles.tableRow, isMobile && styles.tableRowMobile]}>
          <TableCell value={`${row.symbol} · ${row.side === "BUY" ? "买入" : "卖出"}`} flex={1.1} />
          <TableCell value={`${row.volume} 手`} />
          <TableCell value={row.price} flex={1.6} />
          <TableCell value={`${row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(2)} USD`} color={row.pnl >= 0 ? V2.green : V2.red} />
          <TableCell value={formatDateTime(row.time)} flex={1.2} muted />
        </View>
      ))}
    </View>
  );
}

function TableCell({ value, flex = 1, muted = false, color }: { value: string; flex?: number; muted?: boolean; color?: string }) {
  return <Text style={[styles.cell, { flex, color: color ?? (muted ? V2.textMuted : V2.text) }]} numberOfLines={2}>{value}</Text>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 58 },
  page: { width: "100%", maxWidth: V2_LAYOUT.maxWidth, alignSelf: "center", paddingHorizontal: V2_LAYOUT.pagePaddingDesktop, paddingTop: 20, gap: 36 },
  pageMobile: { paddingHorizontal: V2_LAYOUT.pagePaddingMobile, paddingTop: 12, gap: 28 },
  backButton: { alignSelf: "flex-start", minHeight: 36, flexDirection: "row", alignItems: "center", gap: 7 },
  backText: { color: V2.textMuted, fontSize: 12, fontWeight: "700" },
  hero: { minHeight: 380, flexDirection: "row", gap: 34, alignItems: "stretch" },
  heroMobile: { minHeight: 0, flexDirection: "column", gap: 24 },
  artworkWrap: { flex: 0.92, minWidth: 0, borderWidth: 1, borderColor: V2.border, borderRadius: 6, overflow: "hidden", position: "relative", backgroundColor: V2.surfaceMuted },
  artwork: { width: "100%", height: "100%", minHeight: 260 },
  artworkRail: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },
  heroCopy: { flex: 1.08, minWidth: 0, justifyContent: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  updatedAt: { color: V2.textDim, fontSize: 11 },
  title: { marginTop: 18, color: V2.text, fontSize: 38, lineHeight: 46, fontWeight: "900", letterSpacing: 0 },
  titleMobile: { fontSize: 31, lineHeight: 38 },
  version: { marginTop: 5, color: V2.gold, fontSize: 12, fontWeight: "900" },
  tagline: { marginTop: 16, color: V2.text, fontSize: 17, lineHeight: 24, fontWeight: "800" },
  description: { marginTop: 8, color: V2.textMuted, fontSize: 13, lineHeight: 21, maxWidth: 630 },
  tags: { marginTop: 17, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { minHeight: 27, paddingHorizontal: 9, borderWidth: 1, borderColor: V2.border, borderRadius: 3, justifyContent: "center", backgroundColor: V2.surfaceMuted },
  tagText: { color: V2.textMuted, fontSize: 11, fontWeight: "700" },
  actions: { marginTop: 24, flexDirection: "row", gap: 10 },
  actionsMobile: { flexWrap: "wrap" },
  primaryButton: { minHeight: 43, paddingHorizontal: 15, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: V2.background, fontSize: 13, fontWeight: "900" },
  secondaryButton: { minHeight: 43, paddingHorizontal: 15, borderRadius: 4, borderWidth: 1, borderColor: V2.borderStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryButtonText: { color: V2.text, fontSize: 13, fontWeight: "800" },
  metrics: { minHeight: 86, flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderBottomWidth: 1, borderColor: V2.border },
  metric: { minWidth: 138, flex: 1, justifyContent: "center", gap: 6, paddingVertical: 14, paddingRight: 12 },
  metricLabel: { color: V2.textDim, fontSize: 10 },
  metricValue: { fontSize: 17, lineHeight: 22, fontWeight: "900" },
  chartSection: { gap: 18 },
  chartHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 18 },
  chartHeadingMobile: { alignItems: "flex-start", flexDirection: "column" },
  sectionEyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  sectionTitle: { marginTop: 4, color: V2.text, fontSize: 23, lineHeight: 29, fontWeight: "900" },
  rangeControl: { padding: 3, flexDirection: "row", gap: 2, borderWidth: 1, borderColor: V2.border, borderRadius: 4, backgroundColor: V2.surfaceMuted },
  rangeButton: { minWidth: 48, minHeight: 32, alignItems: "center", justifyContent: "center", borderRadius: 2 },
  rangeButtonActive: { backgroundColor: V2.surface },
  rangeText: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  rangeTextActive: { color: V2.gold },
  chartPanel: { padding: 18, borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: V2.backgroundRaised },
  chartTopline: { minHeight: 52, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 },
  chartMeta: { color: V2.textDim, fontSize: 10 },
  chartEquity: { marginTop: 4, color: V2.text, fontSize: 19, fontWeight: "900" },
  chartLegend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 18, height: 2 },
  legendText: { color: V2.textMuted, fontSize: 10 },
  activitySection: { gap: 0 },
  tabs: { minHeight: 48, flexDirection: "row", gap: 2, borderBottomWidth: 1, borderBottomColor: V2.border },
  tab: { minHeight: 48, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: V2.gold },
  tabText: { color: V2.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: V2.text, fontWeight: "900" },
  table: { borderTopWidth: 1, borderTopColor: V2.border },
  tableRow: { minHeight: 58, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: V2.border },
  tableRowMobile: { minHeight: 0, paddingVertical: 14, flexWrap: "wrap", alignItems: "flex-start" },
  tableHeader: { minHeight: 42, backgroundColor: V2.surfaceMuted },
  cell: { minWidth: 74, fontSize: 12, lineHeight: 17 },
  empty: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: V2.border },
  emptyText: { color: V2.textMuted, fontSize: 12 },
  bottomNotice: { paddingTop: 20, borderTopWidth: 1, borderTopColor: V2.border, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bottomNoticeText: { flex: 1, color: V2.textMuted, fontSize: 12, lineHeight: 19 },
  pressed: { opacity: 0.75 },
});
