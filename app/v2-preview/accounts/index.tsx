import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { AccountCard } from "@/components/v2/account-card";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { trpc } from "@/lib/trpc";

type Filter = "ALL" | "MANAGED_CONTRACT" | "SELF_ALLOCATED";

export default function AccountsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 740;
  const [filter, setFilter] = useState<Filter>("ALL");
  const query = trpc.v2.accounts.list.useQuery(undefined, { staleTime: 15_000 });
  const accounts = useMemo(
    () => query.data?.filter((account) => filter === "ALL" || account.serviceMode === filter) ?? [],
    [filter, query.data],
  );

  if (query.isLoading) return <V2LoadingState label="正在同步账户投影" />;
  if (!query.data) {
    return <V2ErrorState detail={query.error?.message || "账户接口没有返回数据。"} onRetry={() => query.refetch()} />;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ACCOUNT OBSERVATORY</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>账户观察</Text>
            <Text style={styles.subtitle}>签约管理账户与自主分仓账户使用不同的权限边界，但共享可追溯的数据状态、净值、持仓和交易记录。</Text>
          </View>
          <View style={styles.demoState}>
            <View style={styles.demoDot} />
            <Text style={styles.demoText}>DEMO ACCOUNTS</Text>
          </View>
        </View>

        <View style={styles.modeExplanations}>
          <ModeExplanation
            icon="description"
            color={V2.gold}
            title="签约管理"
            detail="技术方负责配置，客户查看合同状态、权益、净值、持仓和风险事件；账户保持只读。"
          />
          <ModeExplanation
            icon="account-tree"
            color={V2.blue}
            title="自主分仓"
            detail="客户查看当前生效配方、平台连接、策略贡献和风险预算；任何调整先形成独立草稿。"
          />
        </View>

        <View style={styles.toolbar}>
          <View style={styles.filters}>
            {([
              ["ALL", "全部"],
              ["MANAGED_CONTRACT", "签约管理"],
              ["SELF_ALLOCATED", "自主分仓"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === value }}
                onPress={() => setFilter(value)}
                style={[styles.filter, filter === value && styles.filterActive]}
              >
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.count}>{accounts.length} 个账户</Text>
        </View>

        <View style={styles.grid}>
          {accounts.map((account) => (
            <View key={account.id} style={{ width: isMobile ? "100%" : "49.25%" }}>
              <AccountCard
                account={account}
                onPress={() => router.push(`/v2-preview/accounts/${account.id}` as never)}
              />
            </View>
          ))}
        </View>

        {!accounts.length ? (
          <View style={styles.empty}>
            <MaterialIcons name="account-balance-wallet" size={28} color={V2.textDim} />
            <Text style={styles.emptyTitle}>当前模式没有账户</Text>
            <Text style={styles.emptyDetail}>切换上方筛选查看其他账户类型。</Text>
          </View>
        ) : null}

        <View style={styles.notice}>
          <MaterialIcons name="lock-outline" size={20} color={V2.green} />
          <Text style={styles.noticeText}>EAXAU 只读取获授权的账户投影，不保存交易密码或提供方原始令牌。真实数据模式下，未登录或未授权请求会被服务端拒绝。</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function ModeExplanation({ icon, color, title, detail }: { icon: "description" | "account-tree"; color: string; title: string; detail: string }) {
  return (
    <View style={styles.modeExplanation}>
      <MaterialIcons name={icon} size={22} color={color} />
      <View style={styles.modeCopy}><Text style={styles.modeTitle}>{title}</Text><Text style={styles.modeDetail}>{detail}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 58 },
  page: { width: "100%", maxWidth: V2_LAYOUT.maxWidth, alignSelf: "center", paddingHorizontal: V2_LAYOUT.pagePaddingDesktop, paddingTop: 26, gap: 28 },
  pageMobile: { paddingHorizontal: V2_LAYOUT.pagePaddingMobile, paddingTop: 18 },
  header: { minHeight: 122, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: V2.border, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 20 },
  headerMobile: { alignItems: "flex-start", flexDirection: "column" },
  headerCopy: { flex: 1, minWidth: 0, gap: 6 },
  eyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  title: { color: V2.text, fontSize: 34, lineHeight: 42, fontWeight: "900", letterSpacing: 0 },
  titleMobile: { fontSize: 29, lineHeight: 36 },
  subtitle: { color: V2.textMuted, fontSize: 12, lineHeight: 19, maxWidth: 760 },
  demoState: { minHeight: 34, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(231,183,95,0.36)", borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 7 },
  demoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: V2.amber },
  demoText: { color: V2.amber, fontSize: 9, fontWeight: "900" },
  modeExplanations: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  modeExplanation: { flex: 1, minWidth: 270, minHeight: 94, padding: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: V2.border, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  modeCopy: { flex: 1, gap: 5 },
  modeTitle: { color: V2.text, fontSize: 13, fontWeight: "900" },
  modeDetail: { color: V2.textMuted, fontSize: 10, lineHeight: 16 },
  toolbar: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  filters: { minHeight: 40, padding: 3, flexDirection: "row", gap: 2, borderWidth: 1, borderColor: V2.border, borderRadius: 4, backgroundColor: V2.surfaceMuted },
  filter: { minHeight: 32, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 2 },
  filterActive: { backgroundColor: V2.surface },
  filterText: { color: V2.textMuted, fontSize: 10, fontWeight: "700" },
  filterTextActive: { color: V2.gold, fontWeight: "900" },
  count: { color: V2.textDim, fontSize: 9 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  empty: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 7, borderTopWidth: 1, borderBottomWidth: 1, borderColor: V2.border },
  emptyTitle: { color: V2.text, fontSize: 14, fontWeight: "900" },
  emptyDetail: { color: V2.textMuted, fontSize: 10 },
  notice: { paddingTop: 18, borderTopWidth: 1, borderTopColor: V2.border, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noticeText: { flex: 1, color: V2.textMuted, fontSize: 10, lineHeight: 17 },
});
