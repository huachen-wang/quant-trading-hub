import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
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
import {
  fundingPathLabel,
  onboardingModeLabel,
} from "@/components/v2/configurator/types";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function AccountsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 740;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const accountsQuery = trpc.v2.accounts.list.useQuery(undefined, {
    staleTime: 15_000,
  });
  const plansQuery = trpc.v2.managedSessions.list.useQuery(undefined, {
    enabled: isAuthenticated && !authLoading,
    staleTime: 10_000,
  });
  const openAccount = useCallback(
    (accountId: string) =>
      router.push(`/v2-preview/accounts/${accountId}` as never),
    [router],
  );

  if (accountsQuery.isLoading)
    return <V2LoadingState label="正在同步资管账户投影" />;
  if (!accountsQuery.data) {
    return (
      <V2ErrorState
        detail={accountsQuery.error?.message || "账户接口没有返回数据。"}
        onRetry={() => accountsQuery.refetch()}
      />
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>AI量化联盟 · 账户总览</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              资管方案与账户投影
            </Text>
            <Text style={styles.subtitle}>
              六策略可分配到 1–3 家可选券商。客户本人持有券商账户；项目方只在授权后执行约定交易与风控，不拥有提款权。
            </Text>
          </View>
          <View style={styles.demoState}>
            <View style={styles.demoDot} />
            <Text style={styles.demoText}>账户数据以证据标签为准</Text>
          </View>
        </View>

        <View style={[styles.boundaryGrid, isMobile && styles.boundaryGridMobile]}>
          <BoundaryCard
            icon="account-balance"
            title="U 直达本人券商"
            detail="客户从券商客户门户取得当次网络、地址与标签，转账后提交 txHash，最终以券商实际入账为准。"
          />
          <BoundaryCard
            icon="receipt-long"
            title="平台专属地址代收"
            detail="仅在书面通道批准后使用单笔专属代收单；客户侧只显示确认中、转入券商中、已到账或异常。"
          />
          <BoundaryCard
            icon="lock-outline"
            title="权限隔离"
            detail="交易权不含提款、转账或修改入金地址权限；私钥、助记词与券商密码不进入平台。"
          />
        </View>

        {plansQuery.data?.length ? (
          <View style={styles.planSection}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.eyebrow}>MY ASSET MANAGEMENT PLANS</Text>
                <Text style={styles.sectionTitle}>已保存资管方案</Text>
              </View>
              <Text style={styles.count}>{plansQuery.data.length} 个方案</Text>
            </View>
            <View style={styles.planGrid}>
              {plansQuery.data.map((plan) => (
                <View key={plan.sessionNo} style={styles.planCard}>
                  <View style={styles.planTopline}>
                    <Text style={styles.planStatus}>{planStatusLabel(plan.status)}</Text>
                    <Text style={styles.planBrokerCount}>
                      {plan.executionSlots.length} 家券商
                    </Text>
                  </View>
                  <Text style={styles.planNo}>{plan.sessionNo}</Text>
                  <Text style={styles.planCapital}>
                    {formatUsdt(Number(plan.targetCapital))}
                  </Text>
                  <Text style={styles.planMeta}>
                    已选 {plan.strategies.length} / 6 款策略 · {onboardingModeLabel(plan.onboardingMode)} · {" "}
                    {fundingPathLabel(plan.fundsRoute)}
                  </Text>
                  <View style={styles.permissionLine}>
                    <MaterialIcons name="shield" size={15} color={V2.green} />
                    <Text style={styles.permissionText}>
                      交易授权 {permissionLabel(plan.tradeAuthorizationStatus)} · 提款权 无 ·
                      执行 {plan.executionEnabled ? "ON" : "OFF"}
                    </Text>
                  </View>
                  {plan.readiness.unavailableStrategyIds.length ? (
                    <Text style={styles.warningText}>
                      {plan.readiness.unavailableStrategyIds.length} 款策略当前离线，不能启用交易。
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : isAuthenticated ? (
          <View style={styles.emptyPlan}>
            <MaterialIcons name="assignment" size={24} color={V2.textDim} />
            <Text style={styles.emptyTitle}>尚未保存资管方案</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/?configure=1" as never)}
              style={styles.configureLink}
            >
              <Text style={styles.configureLinkText}>开始配置六策略方案</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>READ-ONLY ACCOUNT PROJECTION</Text>
            <Text style={styles.sectionTitle}>账户数据视图</Text>
          </View>
          <Text style={styles.count}>{accountsQuery.data.length} 个账户</Text>
        </View>
        <View style={styles.accountGrid}>
          {accountsQuery.data.map((account) => (
            <View key={account.id} style={{ width: isMobile ? "100%" : "49.25%" }}>
              <AccountCard account={account} onPress={openAccount} />
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <MaterialIcons name="info-outline" size={20} color={V2.blue} />
          <Text style={styles.noticeText}>
            当前账户视图可能包含模拟或后台维护数据，请以各卡片的数据模式与同步时间为准。
            草案、txHash 申报、链上确认和券商到账是独立状态；页面不会据此声称真实券商 API 或自动交易已经接通。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function BoundaryCard({
  icon,
  title,
  detail,
}: {
  icon: "account-balance" | "receipt-long" | "lock-outline";
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.boundaryCard}>
      <MaterialIcons name={icon} size={21} color={V2.gold} />
      <View style={styles.boundaryCopy}>
        <Text style={styles.boundaryTitle}>{title}</Text>
        <Text style={styles.boundaryDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function permissionLabel(value: string) {
  return value === "GRANTED"
    ? "已授予"
    : value === "PENDING"
      ? "待确认"
      : value === "REVOKED"
        ? "已撤销"
        : "未申请";
}

function planStatusLabel(value: string) {
  const labels: Record<string, string> = {
    DRAFT: "方案草案",
    PENDING_REVIEW: "审核中",
    READY_FOR_AUTHORIZATION: "待交易授权",
    ACTIVE: "运行中",
    EXIT_REQUESTED: "退出处理中",
    COMPLETED: "已结束",
    CANCELLED: "已取消",
    REJECTED: "未通过",
  };
  return labels[value] ?? value;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 58 },
  page: { width: "100%", maxWidth: V2_LAYOUT.maxWidth, alignSelf: "center", paddingHorizontal: V2_LAYOUT.pagePaddingDesktop, paddingTop: 24, gap: 26 },
  pageMobile: { paddingHorizontal: V2_LAYOUT.pagePaddingMobile, paddingTop: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 18 },
  headerMobile: { flexDirection: "column" },
  headerCopy: { flex: 1, maxWidth: 780, gap: 5 },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  title: { color: V2.text, fontSize: 29, lineHeight: 36, fontWeight: "900" },
  titleMobile: { fontSize: 23, lineHeight: 29 },
  subtitle: { color: V2.textMuted, fontSize: 11, lineHeight: 18 },
  demoState: { paddingHorizontal: 10, minHeight: 32, borderWidth: 1, borderColor: V2.border, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 7 },
  demoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: V2.amber },
  demoText: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  boundaryGrid: { flexDirection: "row", gap: 10 },
  boundaryGridMobile: { flexDirection: "column" },
  boundaryCard: { flex: 1, padding: 14, borderWidth: 1, borderColor: V2.border, borderRadius: 5, backgroundColor: V2.backgroundRaised, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  boundaryCopy: { flex: 1, gap: 4 },
  boundaryTitle: { color: V2.text, fontSize: 12, fontWeight: "900" },
  boundaryDetail: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  planSection: { gap: 11 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionTitle: { marginTop: 4, color: V2.text, fontSize: 18, fontWeight: "900" },
  count: { color: V2.textDim, fontSize: 9 },
  planGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  planCard: { flex: 1, minWidth: 285, padding: 14, borderWidth: 1, borderColor: "rgba(216,188,131,0.34)", borderRadius: 6, backgroundColor: "rgba(216,188,131,0.04)", gap: 6 },
  planTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9 },
  planStatus: { color: V2.green, fontSize: 9, fontWeight: "900" },
  planBrokerCount: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  planNo: { color: V2.text, fontSize: 13, fontWeight: "900" },
  planCapital: { color: V2.text, fontSize: 20, fontWeight: "900" },
  planMeta: { color: V2.textMuted, fontSize: 9, lineHeight: 14 },
  permissionLine: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: V2.border, flexDirection: "row", alignItems: "center", gap: 6 },
  permissionText: { flex: 1, color: V2.textMuted, fontSize: 8, lineHeight: 13 },
  warningText: { color: V2.amber, fontSize: 8, lineHeight: 13 },
  emptyPlan: { minHeight: 130, borderWidth: 1, borderColor: V2.border, borderRadius: 5, alignItems: "center", justifyContent: "center", gap: 7 },
  emptyTitle: { color: V2.text, fontSize: 12, fontWeight: "900" },
  configureLink: { paddingVertical: 5 },
  configureLinkText: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  accountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  notice: { paddingTop: 18, borderTopWidth: 1, borderTopColor: V2.border, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noticeText: { flex: 1, color: V2.textMuted, fontSize: 10, lineHeight: 17 },
});
