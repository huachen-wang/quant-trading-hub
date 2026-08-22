import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { EquityChart } from "@/components/v2/equity-chart";
import { formatDateTime, formatMoney, formatPct } from "@/components/v2/format";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { StatusBadge } from "@/components/v2/status-badge";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { trpc } from "@/lib/trpc";

type Tab = "positions" | "trades";

export default function AccountDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 820;
  const [tab, setTab] = useState<Tab>("positions");
  const accountQuery = trpc.v2.accounts.byId.useQuery({ id: String(id || "") }, { enabled: Boolean(id), staleTime: 10_000 });
  const platformQuery = trpc.v2.platforms.list.useQuery(undefined, { staleTime: 30_000 });
  const strategyQuery = trpc.v2.strategies.list.useQuery(undefined, { staleTime: 30_000 });

  if (accountQuery.isLoading) return <V2LoadingState label="正在同步账户详情" />;
  if (!accountQuery.data) {
    return <V2ErrorState title="账户不可用" detail={accountQuery.error?.message || "账户不存在或尚未授权。"} onRetry={() => accountQuery.refetch()} />;
  }

  const account = accountQuery.data;
  const managed = account.serviceMode === "MANAGED_CONTRACT";
  const accent = managed ? V2.gold : V2.blue;
  const platformName = (platformId: string) => platformQuery.data?.find((item) => item.id === platformId)?.name ?? platformId;
  const strategyName = (strategyId: string) => strategyQuery.data?.find((item) => item.id === strategyId)?.shortName ?? strategyId;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <MaterialIcons name="arrow-back" size={18} color={V2.textMuted} />
          <Text style={styles.backText}>返回账户列表</Text>
        </Pressable>

        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={[styles.modeIcon, { borderColor: `${accent}55`, backgroundColor: `${accent}12` }]}>
            <MaterialIcons name={managed ? "description" : "account-tree"} size={29} color={accent} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.mode, { color: accent }]}>{managed ? "MANAGED CONTRACT" : "SELF ALLOCATED"}</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>{account.name}</Text>
            <Text style={styles.subtitle}>{managed ? "技术方配置 · 客户只读观察" : "平台与策略配方 · 调整草稿独立管理"}</Text>
          </View>
          <View style={styles.headerStatus}>
            <StatusBadge dataMode={account.source.dataMode} freshness={account.source.freshness} />
            <Text style={styles.updated}>更新 {formatDateTime(account.source.observedAt)}</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <Metric label="当前权益" value={formatMoney(account.equity, account.currency)} color={V2.text} />
          <Metric label="账户余额" value={formatMoney(account.balance, account.currency)} />
          <Metric label="浮动盈亏" value={formatMoney(account.floatingPnl, account.currency)} color={(account.floatingPnl ?? 0) >= 0 ? V2.green : V2.red} />
          <Metric label="今日盈亏" value={formatMoney(account.todayPnl, account.currency)} color={(account.todayPnl ?? 0) >= 0 ? V2.green : V2.red} />
          <Metric label="累计收益" value={formatPct(account.totalPnlPct, true)} color={(account.totalPnlPct ?? 0) >= 0 ? V2.green : V2.red} />
          <Metric label="最大回撤" value={formatPct(account.maxDrawdownPct)} color={V2.amber} />
        </View>

        <View style={styles.chartPanel}>
          <View style={styles.chartHeading}>
            <View><Text style={styles.eyebrow}>EQUITY HISTORY</Text><Text style={styles.sectionTitle}>账户净值</Text></View>
            <View style={styles.connection}><View style={[styles.connectionDot, { backgroundColor: account.connectionStatus === "CONNECTED" ? V2.green : V2.amber }]} /><Text style={styles.connectionText}>{account.connectionStatus === "CONNECTED" ? "连接正常" : "部分数据延迟"}</Text></View>
          </View>
          <EquityChart points={account.equitySeries} color={accent} height={isMobile ? 230 : 320} showAxis />
        </View>

        <View style={[styles.detailGrid, isMobile && styles.detailGridMobile]}>
          <View style={styles.modePanel}>
            <Text style={styles.panelEyebrow}>{managed ? "CONTRACT VIEW" : "ACTIVE RECIPE"}</Text>
            <Text style={styles.panelTitle}>{managed ? "签约与权限边界" : "当前生效配方"}</Text>
            {managed ? (
              <View style={styles.detailRows}>
                <DetailRow label="合同状态" value={account.contractStatus === "ACTIVE" ? "服务中（模拟）" : "等待确认"} />
                <DetailRow label="配置责任" value="指定技术方" />
                <DetailRow label="客户权限" value="权益、持仓与交易只读" />
                <DetailRow label="资金保管" value="EAXAU 不保管资金" />
                <View style={styles.readOnlyNotice}><MaterialIcons name="visibility" size={18} color={V2.gold} /><Text style={styles.readOnlyText}>该模式不提供直接修改参数、平仓或调仓操作。</Text></View>
              </View>
            ) : account.allocation ? (
              <View style={styles.buckets}>
                {account.allocation.platformBuckets.map((bucket) => (
                  <View key={bucket.platformId} style={styles.bucket}>
                    <View style={styles.bucketHeading}><Text style={styles.bucketName}>{platformName(bucket.platformId)}</Text><Text style={styles.bucketWeight}>{bucket.capitalWeightPct}%</Text></View>
                    {bucket.strategies.map((item) => (
                      <View key={item.strategyId} style={styles.strategyLine}><Text style={styles.strategyLabel}>{strategyName(item.strategyId)}</Text><Text style={styles.strategyValue}>{item.weightPct}% · {item.riskMultiplier}x</Text></View>
                    ))}
                  </View>
                ))}
                <View style={styles.recipeMeta}><Text style={styles.recipeMetaText}>版本 {account.allocation.version}</Text><Text style={styles.recipeMetaText}>风险预算 {account.allocation.riskBudget.maxDrawdownPct}%</Text></View>
              </View>
            ) : null}
          </View>

          <View style={styles.platformPanel}>
            <Text style={styles.panelEyebrow}>CONNECTIONS</Text>
            <Text style={styles.panelTitle}>平台连接</Text>
            <View style={styles.connectionRows}>
              {account.platformIds.map((platformId, index) => (
                <View key={platformId} style={styles.connectionRow}>
                  <View style={styles.connectionIndex}><Text style={styles.connectionIndexText}>{String(index + 1).padStart(2, "0")}</Text></View>
                  <View style={styles.connectionCopy}><Text style={styles.connectionName}>{platformName(platformId)}</Text><Text style={styles.connectionMeta}>账户映射已脱敏 · {account.currency}</Text></View>
                  <MaterialIcons name={account.connectionStatus === "CONNECTED" ? "check-circle" : "schedule"} size={19} color={account.connectionStatus === "CONNECTED" ? V2.green : V2.amber} />
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.activity}>
          <View style={styles.tabs}>
            <TabButton label={`当前持仓 ${account.positions.length}`} active={tab === "positions"} onPress={() => setTab("positions")} />
            <TabButton label={`最近交易 ${account.recentTrades.length}`} active={tab === "trades"} onPress={() => setTab("trades")} />
          </View>
          <View style={styles.activityRows}>
            {(tab === "positions" ? account.positions : account.recentTrades).map((item) => {
              const isPosition = "currentPrice" in item;
              const pnl = isPosition ? item.floatingPnl : item.pnl;
              const time = isPosition ? item.openedAt : item.closedAt;
              return (
                <View key={item.id} style={[styles.activityRow, isMobile && styles.activityRowMobile]}>
                  <View style={styles.symbol}><Text style={styles.symbolText}>{item.symbol}</Text><Text style={[styles.side, { color: item.side === "BUY" ? V2.green : V2.red }]}>{item.side}</Text></View>
                  <Text style={styles.activityCell}>{item.volume.toFixed(2)} 手</Text>
                  <Text style={styles.activityCell}>{item.openPrice} → {isPosition ? item.currentPrice : item.closePrice}</Text>
                  <Text style={[styles.activityCell, styles.activityPnl, { color: pnl >= 0 ? V2.green : V2.red }]}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} USD</Text>
                  <Text style={styles.activityTime}>{formatDateTime(time)}</Text>
                </View>
              );
            })}
            {(tab === "positions" ? account.positions : account.recentTrades).length === 0 ? <Text style={styles.empty}>暂无可展示数据</Text> : null}
          </View>
        </View>

        <View style={styles.notice}><MaterialIcons name="shield" size={20} color={V2.blue} /><Text style={styles.noticeText}>账户页是经过脱敏的只读投影。模拟金额不代表真实资产，真实模式必须通过登录、用户授权和数据新鲜度校验。</Text></View>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, color = V2.text }: { label: string; value: string; color?: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, { color }]}>{value}</Text></View>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 58 },
  page: { width: "100%", maxWidth: V2_LAYOUT.maxWidth, alignSelf: "center", paddingHorizontal: V2_LAYOUT.pagePaddingDesktop, paddingTop: 18, gap: 30 },
  pageMobile: { paddingHorizontal: V2_LAYOUT.pagePaddingMobile, paddingTop: 12 },
  back: { alignSelf: "flex-start", minHeight: 34, flexDirection: "row", alignItems: "center", gap: 7 },
  backText: { color: V2.textMuted, fontSize: 11, fontWeight: "700" },
  header: { minHeight: 130, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: V2.border, flexDirection: "row", alignItems: "center", gap: 16 },
  headerMobile: { alignItems: "flex-start", flexWrap: "wrap" },
  modeIcon: { width: 58, height: 58, borderWidth: 1, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 210, gap: 4 },
  mode: { fontSize: 9, fontWeight: "900" },
  title: { color: V2.text, fontSize: 31, lineHeight: 39, fontWeight: "900", letterSpacing: 0 },
  titleMobile: { fontSize: 25, lineHeight: 32 },
  subtitle: { color: V2.textMuted, fontSize: 11 },
  headerStatus: { alignItems: "flex-end", gap: 6 },
  updated: { color: V2.textDim, fontSize: 8 },
  metrics: { minHeight: 82, flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderBottomWidth: 1, borderColor: V2.border },
  metric: { minWidth: 145, flex: 1, paddingVertical: 14, paddingRight: 12, justifyContent: "center", gap: 5 },
  metricLabel: { color: V2.textDim, fontSize: 9 },
  metricValue: { fontSize: 15, lineHeight: 20, fontWeight: "900" },
  chartPanel: { padding: 17, borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: V2.backgroundRaised },
  chartHeading: { minHeight: 58, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  sectionTitle: { marginTop: 3, color: V2.text, fontSize: 20, fontWeight: "900" },
  connection: { flexDirection: "row", alignItems: "center", gap: 6 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: V2.textMuted, fontSize: 9 },
  detailGrid: { flexDirection: "row", alignItems: "stretch", gap: 14 },
  detailGridMobile: { flexDirection: "column" },
  modePanel: { flex: 1.2, minWidth: 0, padding: 16, borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: V2.backgroundRaised },
  platformPanel: { flex: 0.8, minWidth: 0, padding: 16, borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: V2.backgroundRaised },
  panelEyebrow: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  panelTitle: { marginTop: 4, marginBottom: 15, color: V2.text, fontSize: 17, fontWeight: "900" },
  detailRows: { borderTopWidth: 1, borderTopColor: V2.border },
  detailRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: V2.border },
  detailLabel: { color: V2.textMuted, fontSize: 10 },
  detailValue: { color: V2.text, fontSize: 10, fontWeight: "800", textAlign: "right" },
  readOnlyNotice: { marginTop: 13, padding: 11, borderWidth: 1, borderColor: "rgba(216,188,131,0.3)", borderRadius: 4, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  readOnlyText: { flex: 1, color: V2.textMuted, fontSize: 9, lineHeight: 14 },
  buckets: { gap: 10 },
  bucket: { padding: 11, borderWidth: 1, borderColor: V2.border, borderRadius: 4, backgroundColor: V2.surfaceMuted, gap: 8 },
  bucketHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  bucketName: { color: V2.text, fontSize: 11, fontWeight: "900" },
  bucketWeight: { color: V2.gold, fontSize: 12, fontWeight: "900" },
  strategyLine: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  strategyLabel: { color: V2.textMuted, fontSize: 9 },
  strategyValue: { color: V2.text, fontSize: 9, fontWeight: "800" },
  recipeMeta: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  recipeMetaText: { color: V2.textDim, fontSize: 8 },
  connectionRows: { borderTopWidth: 1, borderTopColor: V2.border },
  connectionRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: V2.border },
  connectionIndex: { width: 30, height: 30, borderWidth: 1, borderColor: V2.border, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  connectionIndexText: { color: V2.textMuted, fontSize: 8, fontWeight: "900" },
  connectionCopy: { flex: 1, minWidth: 0, gap: 3 },
  connectionName: { color: V2.text, fontSize: 11, fontWeight: "800" },
  connectionMeta: { color: V2.textDim, fontSize: 8 },
  activity: {},
  tabs: { minHeight: 46, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: V2.border },
  tab: { minHeight: 46, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: V2.gold },
  tabText: { color: V2.textMuted, fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: V2.text, fontWeight: "900" },
  activityRows: { borderTopWidth: 1, borderTopColor: V2.border },
  activityRow: { minHeight: 58, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderBottomColor: V2.border },
  activityRowMobile: { paddingVertical: 12, flexWrap: "wrap", alignItems: "flex-start" },
  symbol: { width: 115, gap: 2 },
  symbolText: { color: V2.text, fontSize: 11, fontWeight: "900" },
  side: { fontSize: 8, fontWeight: "900" },
  activityCell: { flex: 1, minWidth: 95, color: V2.textMuted, fontSize: 10 },
  activityPnl: { fontWeight: "900" },
  activityTime: { width: 110, color: V2.textDim, fontSize: 9 },
  empty: { paddingVertical: 40, color: V2.textMuted, fontSize: 10, textAlign: "center" },
  notice: { paddingTop: 18, borderTopWidth: 1, borderTopColor: V2.border, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noticeText: { flex: 1, color: V2.textMuted, fontSize: 10, lineHeight: 17 },
  pressed: { opacity: 0.7 },
});
