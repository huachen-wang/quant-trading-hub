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
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import { localizeAccount } from "@/lib/v2/localized-content";

type Filter = "ALL" | "MANAGED_CONTRACT" | "SELF_ALLOCATED";

export default function AccountsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 740;
  const { language, text } = useLanguage();
  const [filter, setFilter] = useState<Filter>("ALL");
  const openAccount = useCallback(
    (accountId: string) =>
      router.push(`/v2-preview/accounts/${accountId}` as never),
    [router],
  );
  const query = trpc.v2.accounts.list.useQuery(undefined, {
    staleTime: 15_000,
  });
  const accounts = useMemo(
    () =>
      query.data
        ?.filter(
          (account) => filter === "ALL" || account.serviceMode === filter,
        )
        .map((account) => localizeAccount(account, language)) ?? [],
    [filter, language, query.data],
  );

  if (query.isLoading) {
    return (
      <V2LoadingState
        label={text(
          "正在同步账户投影",
          "Syncing account projections",
          "جارٍ مزامنة بيانات الحسابات",
        )}
      />
    );
  }
  if (!query.data) {
    return (
      <V2ErrorState
        detail={
          query.error?.message ||
          text(
            "账户接口没有返回数据。",
            "The account service returned no data.",
            "لم تُرجع خدمة الحسابات أي بيانات.",
          )
        }
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
            <Text style={styles.eyebrow}>
              {text("账户总览", "ACCOUNT OVERVIEW", "نظرة على الحسابات")}
            </Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              {text("账户观察", "Account monitoring", "مراقبة الحسابات")}
            </Text>
            <Text style={styles.subtitle}>
              {text(
                "资管模式由技术方按合同管理；券商模式的资金保留在用户本人券商账户。两种模式都提供可追溯的净值、持仓与风险记录。",
                "In managed mode, the provider operates under contract. In broker mode, funds stay in the user's own broker account. Both provide traceable equity, position and risk records.",
                "في نمط الإدارة المفوضة يعمل المزود بموجب عقد، وفي نمط الوسيط تبقى الأموال في حساب المستخدم. يوفر النمطان سجلات قابلة للتتبع لحقوق الحساب والمراكز والمخاطر.",
              )}
            </Text>
          </View>
          <View style={styles.demoState}>
            <View style={styles.demoDot} />
            <Text style={styles.demoText}>
              {text("模拟账户", "DEMO ACCOUNTS", "حسابات تجريبية")}
            </Text>
          </View>
        </View>

        <View style={styles.modeExplanations}>
          <ModeExplanation
            icon="description"
            color={V2.gold}
            title={text("资管模式", "Managed mode", "الإدارة المفوضة")}
            detail={text(
              "技术方按合同负责策略部署、交易执行和风险管理；客户查看合同状态、权益、持仓与风险事件。",
              "The provider handles deployment, execution and risk under contract; the client views contract status, equity, positions and risk events.",
              "يتولى المزود النشر والتنفيذ والمخاطر بموجب عقد، ويتابع العميل حالة العقد وحقوق الحساب والمراكز وأحداث المخاطر.",
            )}
          />
          <ModeExplanation
            icon="account-tree"
            color={V2.blue}
            title={text("券商模式", "Broker mode", "نمط الوسيط")}
            detail={text(
              "资金留在客户本人券商账户，客户掌握入出金；系统展示平台连接、策略贡献和风险预算。",
              "Funds remain in the client's broker account and the client controls deposits and withdrawals. The system shows platform connections, strategy contribution and risk budget.",
              "تبقى الأموال في حساب الوسيط الخاص بالعميل ويتحكم في الإيداع والسحب، بينما يعرض النظام اتصالات المنصات ومساهمة الاستراتيجيات وميزانية المخاطر.",
            )}
          />
        </View>

        <View style={styles.toolbar}>
          <View style={styles.filters}>
            {(
              [
                ["ALL", text("全部", "All", "الكل")],
                [
                  "MANAGED_CONTRACT",
                  text("资管模式", "Managed", "إدارة مفوضة"),
                ],
                ["SELF_ALLOCATED", text("券商模式", "Broker", "وسيط")],
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
          <Text style={styles.count}>
            {text(
              `${accounts.length} 个账户`,
              `${accounts.length} accounts`,
              `${accounts.length} حسابات`,
            )}
          </Text>
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
            <Text style={styles.emptyTitle}>
              {text(
                "当前模式没有账户",
                "No accounts in this mode",
                "لا توجد حسابات في هذا النمط",
              )}
            </Text>
            <Text style={styles.emptyDetail}>
              {text(
                "切换上方筛选查看其他账户类型。",
                "Use the filters above to view other account types.",
                "استخدم عوامل التصفية أعلاه لعرض أنواع حسابات أخرى.",
              )}
            </Text>
          </View>
        ) : null}

        <View style={styles.notice}>
          <MaterialIcons name="lock-outline" size={20} color={V2.green} />
          <Text style={styles.noticeText}>
            {text(
              "EAXAU 只读取获授权的账户投影，不保存交易密码或提供方原始令牌。真实数据模式下，未完成身份验证或数据授权的请求会被服务端拒绝。",
              "EAXAU reads authorized account projections only. It does not store trading passwords or raw provider tokens. In live mode, the server rejects requests without identity verification and data authorization.",
              "تقرأ EAXAU بيانات الحساب المصرح بها فقط ولا تحفظ كلمات مرور التداول أو رموز المزود الأصلية. في الوضع الحي يرفض الخادم الطلبات التي لم تستكمل التحقق من الهوية وتفويض البيانات.",
            )}
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
