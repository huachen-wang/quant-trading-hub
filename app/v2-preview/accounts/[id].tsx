import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
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
import { StatusBadge } from "@/components/v2/status-badge";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import {
  localizeAccount,
  localizePlatform,
  localizeStrategy,
} from "@/lib/v2/localized-content";

type Tab = "positions" | "trades";

const CONNECTION_STATE = {
  CONNECTED: { color: V2.green, icon: "check-circle" },
  DEGRADED: { color: V2.amber, icon: "schedule" },
  DISCONNECTED: { color: V2.red, icon: "link-off" },
  PENDING: { color: V2.amber, icon: "schedule" },
} as const;

export default function AccountDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 820;
  const { language, locale, text } = useLanguage();
  const [tab, setTab] = useState<Tab>("positions");
  const accountQuery = trpc.v2.accounts.byId.useQuery(
    { id: String(id || "") },
    { enabled: Boolean(id), staleTime: 10_000 },
  );
  const platformQuery = trpc.v2.platforms.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const strategyQuery = trpc.v2.strategies.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  if (accountQuery.isLoading) {
    return (
      <V2LoadingState
        label={text(
          "正在同步账户详情",
          "Syncing account details",
          "جارٍ مزامنة تفاصيل الحساب",
        )}
      />
    );
  }
  if (!accountQuery.data) {
    return (
      <V2ErrorState
        title={text("账户不可用", "Account unavailable", "الحساب غير متاح")}
        detail={
          accountQuery.error?.message ||
          text(
            "账户不存在或尚未授权。",
            "The account does not exist or has not been authorized.",
            "الحساب غير موجود أو لم يتم تفويضه.",
          )
        }
        onRetry={() => accountQuery.refetch()}
      />
    );
  }

  const account = localizeAccount(accountQuery.data, language);
  const managed = account.serviceMode === "MANAGED_CONTRACT";
  const accent = managed ? V2.gold : V2.blue;
  const platformName = (platformId: string) => {
    const platform = platformQuery.data?.find((item) => item.id === platformId);
    return platform ? localizePlatform(platform, language).name : platformId;
  };
  const strategyName = (strategyId: string) => {
    const strategy = strategyQuery.data?.find((item) => item.id === strategyId);
    return strategy
      ? localizeStrategy(strategy, language).shortName
      : strategyId;
  };
  const connectionLabel =
    account.connectionStatus === "CONNECTED"
      ? text("连接正常", "Connected", "متصل")
      : account.connectionStatus === "DEGRADED"
        ? text("部分数据延迟", "Partially delayed", "تأخير جزئي")
        : account.connectionStatus === "DISCONNECTED"
          ? text("连接中断", "Disconnected", "غير متصل")
          : text("等待连接", "Pending", "قيد الاتصال");

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <MaterialIcons name="arrow-back" size={18} color={V2.textMuted} />
          <Text style={styles.backText}>
            {text("返回账户列表", "Back to accounts", "العودة إلى الحسابات")}
          </Text>
        </Pressable>

        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View
            style={[
              styles.modeIcon,
              { borderColor: `${accent}55`, backgroundColor: `${accent}12` },
            ]}
          >
            <MaterialIcons
              name={managed ? "description" : "account-tree"}
              size={29}
              color={accent}
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.mode, { color: accent }]}>
              {managed
                ? text(
                    "AI量化联盟 · 资管账户",
                    "AI Quant Alliance · Managed account",
                    "تحالف EAXAU الكمي · حساب مُدار",
                  )
                : text(
                    "AI量化联盟 · 券商账户投影",
                    "AI Quant Alliance · Broker account view",
                    "تحالف EAXAU الكمي · عرض حساب الوسيط",
                  )}
            </Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              {account.name}
            </Text>
            <Text style={styles.subtitle}>
              {managed
                ? text(
                    "客户本人持有账户 · 项目方仅获约定交易权",
                    "Client-owned account · Provider receives agreed trading permission only",
                    "الحساب مملوك للعميل · المزود يملك صلاحية التداول المتفق عليها فقط",
                  )
                : text(
                    "USDT 入金逐笔核对 · 项目方无提款权",
                    "Every USDT deposit is reconciled · No provider withdrawal rights",
                    "تتم مطابقة كل إيداع USDT · لا يملك المزود حق السحب",
                  )}
            </Text>
          </View>
          <View style={styles.headerStatus}>
            <StatusBadge
              dataMode={account.source.dataMode}
              freshness={account.source.freshness}
            />
            <Text style={styles.updated}>
              {text("更新", "Updated", "آخر تحديث")}{" "}
              {formatDateTime(account.source.observedAt, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <Metric
            label={text("当前权益", "Current equity", "حقوق الحساب الحالية")}
            value={formatMoney(account.equity, account.currency, false, locale)}
            color={V2.text}
          />
          <Metric
            label={text("账户余额", "Balance", "الرصيد")}
            value={formatMoney(
              account.balance,
              account.currency,
              false,
              locale,
            )}
          />
          <Metric
            label={text("浮动盈亏", "Floating P&L", "الربح والخسارة العائمة")}
            value={formatMoney(
              account.floatingPnl,
              account.currency,
              false,
              locale,
            )}
            color={(account.floatingPnl ?? 0) >= 0 ? V2.green : V2.red}
          />
          <Metric
            label={text("今日盈亏", "Today P&L", "ربح وخسارة اليوم")}
            value={formatMoney(
              account.todayPnl,
              account.currency,
              false,
              locale,
            )}
            color={(account.todayPnl ?? 0) >= 0 ? V2.green : V2.red}
          />
          <Metric
            label={text("累计收益", "Total return", "العائد الإجمالي")}
            value={formatPct(account.totalPnlPct, true)}
            color={(account.totalPnlPct ?? 0) >= 0 ? V2.green : V2.red}
          />
          <Metric
            label={text("最大回撤", "Max drawdown", "أقصى تراجع")}
            value={formatPct(account.maxDrawdownPct)}
            color={V2.amber}
          />
        </View>

        <View style={styles.chartPanel}>
          <View style={styles.chartHeading}>
            <View>
              <Text style={styles.eyebrow}>
                {text("权益历史", "EQUITY HISTORY", "سجل حقوق الحساب")}
              </Text>
              <Text style={styles.sectionTitle}>
                {text("账户净值", "Account equity", "حقوق الحساب")}
              </Text>
            </View>
            <View style={styles.connection}>
              <View
                style={[
                  styles.connectionDot,
                  {
                    backgroundColor:
                      CONNECTION_STATE[account.connectionStatus].color,
                  },
                ]}
              />
              <Text style={styles.connectionText}>{connectionLabel}</Text>
            </View>
          </View>
          <EquityChart
            points={account.equitySeries}
            color={accent}
            height={isMobile ? 230 : 320}
            showAxis
          />
        </View>

        <View style={[styles.detailGrid, isMobile && styles.detailGridMobile]}>
          <View style={styles.modePanel}>
            <Text style={styles.panelEyebrow}>
              {managed
                ? text("合同视图", "CONTRACT VIEW", "عرض العقد")
                : text("当前方案", "CURRENT PLAN", "الخطة الحالية")}
            </Text>
            <Text style={styles.panelTitle}>
              {managed
                ? text(
                    "资管合同与权限边界",
                    "Managed contract and permissions",
                    "عقد الإدارة وحدود الصلاحيات",
                  )
                : text(
                    "当前券商执行槽",
                    "Current broker execution slots",
                    "حسابات التنفيذ الحالية لدى الوسطاء",
                  )}
            </Text>
            {managed ? (
              <View style={styles.detailRows}>
                <DetailRow
                  label={text("合同状态", "Contract status", "حالة العقد")}
                  value={
                    account.contractStatus === "ACTIVE"
                      ? text("服务中（模拟）", "Active (demo)", "نشط (تجريبي)")
                      : text(
                          "等待确认",
                          "Pending confirmation",
                          "بانتظار التأكيد",
                        )
                  }
                />
                <DetailRow
                  label={text(
                    "交易责任",
                    "Trading responsibility",
                    "مسؤولية التداول",
                  )}
                  value={text(
                    "指定技术方",
                    "Designated provider",
                    "المزود المحدد",
                  )}
                />
                <DetailRow
                  label={text(
                    "客户权限",
                    "Client permissions",
                    "صلاحيات العميل",
                  )}
                  value={text(
                    "查看、申请退出与出金",
                    "View, request exit and withdraw",
                    "العرض وطلب الخروج والسحب",
                  )}
                />
                <DetailRow
                  label={text(
                    "技术方权限",
                    "Provider permissions",
                    "صلاحيات المزود",
                  )}
                  value={text(
                    "开平仓与风控；不含出金",
                    "Open/close positions and risk control; no withdrawals",
                    "فتح وإغلاق المراكز وضبط المخاطر؛ دون سحب",
                  )}
                />
                <View style={styles.readOnlyNotice}>
                  <MaterialIcons name="visibility" size={18} color={V2.gold} />
                  <Text style={styles.readOnlyText}>
                    {text(
                      "客户可按合同申请终止资管；已有仓位的处理以双方合同与实际风控指令为准。",
                      "The client may request termination under the contract. Existing positions follow the agreement and current risk instructions.",
                      "يمكن للعميل طلب إنهاء الإدارة وفقا للعقد. تخضع المراكز القائمة للاتفاق وتعليمات المخاطر الحالية.",
                    )}
                  </Text>
                </View>
              </View>
            ) : account.allocation ? (
              <View style={styles.buckets}>
                {account.allocation.platformBuckets.map((bucket) => (
                  <View key={bucket.platformId} style={styles.bucket}>
                    <View style={styles.bucketHeading}>
                      <Text style={styles.bucketName}>
                        {platformName(bucket.platformId)}
                      </Text>
                      <Text style={styles.bucketWeight}>
                        {bucket.capitalWeightPct}%
                      </Text>
                    </View>
                    {bucket.strategies.map((item) => (
                      <View key={item.strategyId} style={styles.strategyLine}>
                        <Text style={styles.strategyLabel}>
                          {strategyName(item.strategyId)}
                        </Text>
                        <Text style={styles.strategyValue}>
                          {item.weightPct}% · {item.riskMultiplier}x
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
                <View style={styles.recipeMeta}>
                  <Text style={styles.recipeMetaText}>
                    {text("版本", "Version", "الإصدار")}{" "}
                    {account.allocation.version}
                  </Text>
                  <Text style={styles.recipeMetaText}>
                    {text("风险预算", "Risk budget", "ميزانية المخاطر")}{" "}
                    {account.allocation.riskBudget.maxDrawdownPct}%
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.platformPanel}>
            <Text style={styles.panelEyebrow}>
              {text("数据连接", "DATA CONNECTION", "اتصال البيانات")}
            </Text>
            <Text style={styles.panelTitle}>
              {text(
                "券商执行槽",
                "Broker execution slots",
                "حسابات تنفيذ الوسطاء",
              )}
            </Text>
            <View style={styles.connectionRows}>
              {account.platformIds.map((platformId, index) => (
                <View key={platformId} style={styles.connectionRow}>
                  <View style={styles.connectionIndex}>
                    <Text style={styles.connectionIndexText}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                  </View>
                  <View style={styles.connectionCopy}>
                    <Text style={styles.connectionName}>
                      {platformName(platformId)}
                    </Text>
                    <Text style={styles.connectionMeta}>
                      {text(
                        "账户映射已脱敏",
                        "Account mapping masked",
                        "تم إخفاء معرف الحساب",
                      )}{" "}
                      · {account.currency} · {connectionLabel}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={CONNECTION_STATE[account.connectionStatus].icon}
                    size={19}
                    color={CONNECTION_STATE[account.connectionStatus].color}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.activity}>
          <View style={styles.tabs}>
            <TabButton
              label={text(
                `当前持仓 ${account.positions.length}`,
                `Positions ${account.positions.length}`,
                `المراكز ${account.positions.length}`,
              )}
              active={tab === "positions"}
              onPress={() => setTab("positions")}
            />
            <TabButton
              label={text(
                `最近交易 ${account.recentTrades.length}`,
                `Recent trades ${account.recentTrades.length}`,
                `الصفقات الأخيرة ${account.recentTrades.length}`,
              )}
              active={tab === "trades"}
              onPress={() => setTab("trades")}
            />
          </View>
          <View style={styles.activityRows}>
            {(tab === "positions"
              ? account.positions
              : account.recentTrades
            ).map((item) => {
              const isPosition = "currentPrice" in item;
              const pnl = isPosition ? item.floatingPnl : item.pnl;
              const time = isPosition ? item.openedAt : item.closedAt;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.activityRow,
                    isMobile && styles.activityRowMobile,
                  ]}
                >
                  <View style={styles.symbol}>
                    <Text style={styles.symbolText}>{item.symbol}</Text>
                    <Text
                      style={[
                        styles.side,
                        { color: item.side === "BUY" ? V2.green : V2.red },
                      ]}
                    >
                      {item.side}
                    </Text>
                  </View>
                  <Text style={styles.activityCell}>
                    {item.volume.toFixed(2)} {text("手", "lots", "لوت")}
                  </Text>
                  <Text style={styles.activityCell}>
                    {item.openPrice} →{" "}
                    {isPosition ? item.currentPrice : item.closePrice}
                  </Text>
                  <Text
                    style={[
                      styles.activityCell,
                      styles.activityPnl,
                      { color: pnl >= 0 ? V2.green : V2.red },
                    ]}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toFixed(2)} USD
                  </Text>
                  <Text style={styles.activityTime}>
                    {formatDateTime(time, locale)}
                  </Text>
                </View>
              );
            })}
            {(tab === "positions" ? account.positions : account.recentTrades)
              .length === 0 ? (
              <Text style={styles.empty}>
                {text(
                  "暂无可展示数据",
                  "No data to display",
                  "لا توجد بيانات للعرض",
                )}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.notice}>
          <MaterialIcons name="shield" size={20} color={V2.blue} />
          <Text style={styles.noticeText}>
            {text(
              "账户页是经过脱敏的只读投影。模拟金额不代表真实资产；真实执行必须通过身份、资管授权、券商交易权与数据新鲜度校验，提款权始终与交易权分离。",
              "This is a masked, read-only account view. Demo amounts are not real assets. Live execution requires identity, managed authorization, broker trading permission and data-freshness checks. Withdrawal rights always remain separate from trading permission.",
              "هذه واجهة حساب للقراءة فقط مع إخفاء الهوية. المبالغ التجريبية ليست أصولا حقيقية. يتطلب التنفيذ الحي التحقق من الهوية وتفويض الإدارة وصلاحية التداول وحداثة البيانات، وتبقى صلاحية السحب منفصلة دائما عن التداول.",
            )}
          </Text>
        </View>
      </View>
    </ScrollView>
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
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 58 },
  page: {
    width: "100%",
    maxWidth: V2_LAYOUT.maxWidth,
    alignSelf: "center",
    paddingHorizontal: V2_LAYOUT.pagePaddingDesktop,
    paddingTop: 18,
    gap: 30,
  },
  pageMobile: {
    paddingHorizontal: V2_LAYOUT.pagePaddingMobile,
    paddingTop: 12,
  },
  back: {
    alignSelf: "flex-start",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  backText: { color: V2.textMuted, fontSize: 12, fontWeight: "700" },
  header: {
    minHeight: 130,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerMobile: { alignItems: "flex-start", flexWrap: "wrap" },
  modeIcon: {
    width: 58,
    height: 58,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 210, gap: 4 },
  mode: { fontSize: 10, fontWeight: "900" },
  title: {
    color: V2.text,
    fontSize: 31,
    lineHeight: 39,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleMobile: { fontSize: 25, lineHeight: 32 },
  subtitle: { color: V2.textMuted, fontSize: 12 },
  headerStatus: { alignItems: "flex-end", gap: 6 },
  updated: { color: V2.textDim, fontSize: 10 },
  metrics: {
    minHeight: 82,
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  metric: {
    minWidth: 145,
    flex: 1,
    paddingVertical: 14,
    paddingRight: 12,
    justifyContent: "center",
    gap: 5,
  },
  metricLabel: { color: V2.textDim, fontSize: 10 },
  metricValue: { fontSize: 15, lineHeight: 20, fontWeight: "900" },
  chartPanel: {
    padding: 17,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
  },
  chartHeading: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  sectionTitle: {
    marginTop: 3,
    color: V2.text,
    fontSize: 20,
    fontWeight: "900",
  },
  connection: { flexDirection: "row", alignItems: "center", gap: 6 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: V2.textMuted, fontSize: 10 },
  detailGrid: { flexDirection: "row", alignItems: "stretch", gap: 14 },
  detailGridMobile: { flexDirection: "column" },
  modePanel: {
    flex: 1.2,
    minWidth: 0,
    padding: 16,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
  },
  platformPanel: {
    flex: 0.8,
    minWidth: 0,
    padding: 16,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
  },
  panelEyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  panelTitle: {
    marginTop: 4,
    marginBottom: 15,
    color: V2.text,
    fontSize: 17,
    fontWeight: "900",
  },
  detailRows: { borderTopWidth: 1, borderTopColor: V2.border },
  detailRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
  },
  detailLabel: { color: V2.textMuted, fontSize: 11 },
  detailValue: {
    color: V2.text,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  readOnlyNotice: {
    marginTop: 13,
    padding: 11,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.3)",
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  readOnlyText: { flex: 1, color: V2.textMuted, fontSize: 11, lineHeight: 16 },
  buckets: { gap: 10 },
  bucket: {
    padding: 11,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    backgroundColor: V2.surfaceMuted,
    gap: 8,
  },
  bucketHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  bucketName: { color: V2.text, fontSize: 11, fontWeight: "900" },
  bucketWeight: { color: V2.gold, fontSize: 12, fontWeight: "900" },
  strategyLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  strategyLabel: { color: V2.textMuted, fontSize: 10 },
  strategyValue: { color: V2.text, fontSize: 10, fontWeight: "800" },
  recipeMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  recipeMetaText: { color: V2.textDim, fontSize: 10 },
  connectionRows: { borderTopWidth: 1, borderTopColor: V2.border },
  connectionRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
  },
  connectionIndex: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionIndexText: { color: V2.textMuted, fontSize: 10, fontWeight: "900" },
  connectionCopy: { flex: 1, minWidth: 0, gap: 3 },
  connectionName: { color: V2.text, fontSize: 12, fontWeight: "800" },
  connectionMeta: { color: V2.textDim, fontSize: 10 },
  activity: {},
  tabs: {
    minHeight: 46,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
  },
  tab: {
    minHeight: 46,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: V2.gold },
  tabText: { color: V2.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: V2.text, fontWeight: "900" },
  activityRows: { borderTopWidth: 1, borderTopColor: V2.border },
  activityRow: {
    minHeight: 58,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
  },
  activityRowMobile: {
    paddingVertical: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  symbol: { width: 115, gap: 2 },
  symbolText: { color: V2.text, fontSize: 12, fontWeight: "900" },
  side: { fontSize: 10, fontWeight: "900" },
  activityCell: { flex: 1, minWidth: 95, color: V2.textMuted, fontSize: 11 },
  activityPnl: { fontWeight: "900" },
  activityTime: { width: 110, color: V2.textDim, fontSize: 10 },
  empty: {
    paddingVertical: 40,
    color: V2.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  notice: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeText: { flex: 1, color: V2.textMuted, fontSize: 11, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
