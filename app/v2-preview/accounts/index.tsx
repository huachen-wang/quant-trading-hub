import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { AccountCard } from "@/components/v2/account-card";
import { formatUsdt } from "@/components/v2/format";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Filter = "ALL" | "MANAGED_CONTRACT" | "SELF_ALLOCATED";

export default function AccountsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 740;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");
  const openAccount = useCallback(
    (accountId: string) =>
      router.push(`/v2-preview/accounts/${accountId}` as never),
    [router],
  );
  const query = trpc.v2.accounts.list.useQuery(undefined, {
    staleTime: 15_000,
  });
  const managedSessions = trpc.v2.managedSessions.list.useQuery(undefined, {
    enabled: isAuthenticated && !authLoading,
    staleTime: 10_000,
  });
  const accounts = useMemo(
    () =>
      query.data?.filter(
        (account) => filter === "ALL" || account.serviceMode === filter,
      ) ?? [],
    [filter, query.data],
  );

  if (query.isLoading) return <V2LoadingState label="正在同步账户投影" />;
  if (!query.data) {
    return (
      <V2ErrorState
        detail={query.error?.message || "账户接口没有返回数据。"}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>账户总览</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              Managed Session 账户
            </Text>
            <Text style={styles.subtitle}>
              六策略、1–2 个券商执行槽与 USDT
              资金路由统一归入一个限时资管会话；每个会话都保留可追溯的净值、持仓和风险记录。
            </Text>
          </View>
          <View style={styles.demoState}>
            <View style={styles.demoDot} />
            <Text style={styles.demoText}>模拟账户</Text>
          </View>
        </View>

        <View style={styles.modeExplanations}>
          <ModeExplanation
            icon="description"
            color={V2.gold}
            title="Managed Session"
            detail="技术方在 30/90/180 天期限内按授权执行策略和风控；交易权限不包含出金、转账或修改收款地址。"
          />
          <ModeExplanation
            icon="account-tree"
            color={V2.blue}
            title="双路 USDT 入金"
            detail="当前可使用 U 直达支持稳定币的合作券商；Managed Vault 可纳入混合方案，未完成配置时明确标记为接入准备中。"
          />
        </View>

        {managedSessions.data?.length ? (
          <View style={styles.sessionSection}>
            <View style={styles.sessionSectionHeading}>
              <View>
                <Text style={styles.eyebrow}>MY MANAGED SESSIONS</Text>
                <Text style={styles.sessionSectionTitle}>已保存资管会话</Text>
              </View>
              <Text style={styles.count}>
                {managedSessions.data.length} 个会话
              </Text>
            </View>
            <View style={styles.sessionGrid}>
              {managedSessions.data.map((session) => (
                <View key={session.sessionNo} style={styles.sessionCard}>
                  <View style={styles.sessionCardTopline}>
                    <Text style={styles.sessionStatus}>{session.status}</Text>
                    <Text style={styles.sessionTerm}>
                      {session.termDays} 天
                    </Text>
                  </View>
                  <Text style={styles.sessionNo}>{session.sessionNo}</Text>
                  <Text style={styles.sessionCapital}>
                    {formatUsdt(Number(session.targetCapital))}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    6 策略 · {session.executionSlots.length} 执行槽 ·{" "}
                    {session.capitalMode === "MIXED"
                      ? "混合 USDT 路由"
                      : session.capitalMode === "MANAGED_VAULT"
                        ? "Managed Vault"
                        : "U 直达券商"}
                  </Text>
                  <View style={styles.permissionLine}>
                    <MaterialIcons
                      name="lock-outline"
                      size={15}
                      color={V2.green}
                    />
                    <Text style={styles.permissionText}>
                      交易权{" "}
                      {session.tradeAuthorizationStatus === "NOT_REQUESTED"
                        ? "未申请"
                        : session.tradeAuthorizationStatus === "PENDING"
                          ? "待确认"
                          : session.tradeAuthorizationStatus === "GRANTED"
                            ? "已授予"
                            : "已撤销"}{" "}
                      · 出金权 无 · 执行{" "}
                      {session.executionEnabled ? "ON" : "OFF"}
                    </Text>
                  </View>
                  {session.readiness.unavailableStrategyIds.length ? (
                    <Text style={styles.sessionWarning}>
                      {session.readiness.unavailableStrategyIds.length}{" "}
                      款策略离线，当前不可激活。
                    </Text>
                  ) : session.readiness.vaultActivationBlocked ? (
                    <Text style={styles.sessionWarning}>
                      Managed Vault 尚未通过启用门槛。
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.toolbar}>
          <View style={styles.filters}>
            {(
              [
                ["ALL", "全部"],
                ["MANAGED_CONTRACT", "合同管理"],
                ["SELF_ALLOCATED", "U 直达券商"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === value }}
                onPress={() => setFilter(value)}
                style={[styles.filter, filter === value && styles.filterActive]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === value && styles.filterTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.count}>{accounts.length} 个账户</Text>
        </View>

        <View style={styles.grid}>
          {accounts.map((account) => (
            <View
              key={account.id}
              style={{ width: isMobile ? "100%" : "49.25%" }}
            >
              <AccountCard account={account} onPress={openAccount} />
            </View>
          ))}
        </View>

        {!accounts.length ? (
          <View style={styles.empty}>
            <MaterialIcons
              name="account-balance-wallet"
              size={28}
              color={V2.textDim}
            />
            <Text style={styles.emptyTitle}>当前会话类型没有账户</Text>
            <Text style={styles.emptyDetail}>
              切换上方筛选查看其他账户类型。
            </Text>
          </View>
        ) : null}

        <View style={styles.notice}>
          <MaterialIcons name="lock-outline" size={20} color={V2.green} />
          <Text style={styles.noticeText}>
            EAXAU
            只读取获授权的账户投影，不保存交易密码或提供方原始令牌。资管授权和出金权限分离；未完成身份、券商权限或数据授权的请求不得启用执行。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function ModeExplanation({
  icon,
  color,
  title,
  detail,
}: {
  icon: "description" | "account-tree";
  color: string;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.modeExplanation}>
      <MaterialIcons name={icon} size={22} color={color} />
      <View style={styles.modeCopy}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeDetail}>{detail}</Text>
      </View>
    </View>
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
    paddingTop: 26,
    gap: 28,
  },
  pageMobile: {
    paddingHorizontal: V2_LAYOUT.pagePaddingMobile,
    paddingTop: 18,
  },
  header: {
    minHeight: 122,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
  },
  headerMobile: { alignItems: "flex-start", flexDirection: "column" },
  headerCopy: { flex: 1, minWidth: 0, gap: 6 },
  eyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  title: {
    color: V2.text,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleMobile: { fontSize: 29, lineHeight: 36 },
  subtitle: {
    color: V2.textMuted,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 760,
  },
  demoState: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(231,183,95,0.36)",
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  demoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: V2.amber },
  demoText: { color: V2.amber, fontSize: 10, fontWeight: "900" },
  modeExplanations: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  modeExplanation: {
    flex: 1,
    minWidth: 270,
    minHeight: 94,
    padding: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modeCopy: { flex: 1, gap: 5 },
  modeTitle: { color: V2.text, fontSize: 13, fontWeight: "900" },
  modeDetail: { color: V2.textMuted, fontSize: 11, lineHeight: 17 },
  sessionSection: { gap: 12 },
  sessionSectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionSectionTitle: {
    marginTop: 4,
    color: V2.text,
    fontSize: 18,
    fontWeight: "900",
  },
  sessionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  sessionCard: {
    flex: 1,
    minWidth: 280,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.34)",
    borderRadius: 6,
    backgroundColor: "rgba(216,188,131,0.04)",
    gap: 6,
  },
  sessionCardTopline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sessionStatus: { color: V2.green, fontSize: 9, fontWeight: "900" },
  sessionTerm: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  sessionNo: { color: V2.text, fontSize: 13, fontWeight: "900" },
  sessionCapital: { color: V2.text, fontSize: 20, fontWeight: "900" },
  sessionMeta: { color: V2.textMuted, fontSize: 9, lineHeight: 14 },
  permissionLine: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  permissionText: { flex: 1, color: V2.textMuted, fontSize: 8, lineHeight: 13 },
  sessionWarning: { color: V2.amber, fontSize: 8, lineHeight: 13 },
  toolbar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filters: {
    minHeight: 40,
    padding: 3,
    flexDirection: "row",
    gap: 2,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    backgroundColor: V2.surfaceMuted,
  },
  filter: {
    minHeight: 32,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 2,
  },
  filterActive: { backgroundColor: V2.surface },
  filterText: { color: V2.textMuted, fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: V2.gold, fontWeight: "900" },
  count: { color: V2.textDim, fontSize: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  empty: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  emptyTitle: { color: V2.text, fontSize: 14, fontWeight: "900" },
  emptyDetail: { color: V2.textMuted, fontSize: 11 },
  notice: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeText: { flex: 1, color: V2.textMuted, fontSize: 11, lineHeight: 18 },
});
