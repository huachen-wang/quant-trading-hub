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
import { useLanguage, type AppLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import { localizeAccount } from "@/lib/v2/localized-content";

export default function AccountsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 740;
  const { language, locale, text } = useLanguage();
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
    return (
      <V2LoadingState
        label={text(
          "正在同步资管账户投影",
          "Syncing managed account views",
          "جارٍ مزامنة عروض الحسابات المُدارة",
        )}
      />
    );
  if (!accountsQuery.data) {
    return (
      <V2ErrorState
        detail={
          accountsQuery.error?.message ||
          text(
            "账户接口没有返回数据。",
            "The account service returned no data.",
            "لم تُرجع خدمة الحسابات أي بيانات.",
          )
        }
        onRetry={() => accountsQuery.refetch()}
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
              {text(
                "AI量化联盟 · 账户总览",
                "AI QUANT ALLIANCE · ACCOUNTS",
                "تحالف EAXAU الكمي · الحسابات",
              )}
            </Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              {text(
                "资管方案与账户投影",
                "Managed plans and account views",
                "الخطط المُدارة وعروض الحسابات",
              )}
            </Text>
            <Text style={styles.subtitle}>
              {text(
                "六策略可分配到 1–3 家可选券商。客户本人持有券商账户；项目方只在授权后执行约定交易与风控，不拥有提款权。",
                "Allocate the six strategies across 1–3 brokers. The client owns each broker account; the provider executes agreed trading and risk controls only after authorization and has no withdrawal rights.",
                "يمكن توزيع الاستراتيجيات الست على 1 إلى 3 وسطاء. يملك العميل حسابات الوسطاء، ولا ينفذ المزود التداول وضبط المخاطر المتفق عليهما إلا بعد التفويض ولا يملك حق السحب.",
              )}
            </Text>
          </View>
          <View style={styles.demoState}>
            <View style={styles.demoDot} />
            <Text style={styles.demoText}>
              {text(
                "账户数据以证据标签为准",
                "Account data follows its evidence label",
                "تتبع بيانات الحساب وسم الدليل",
              )}
            </Text>
          </View>
        </View>

        <View
          style={[styles.boundaryGrid, isMobile && styles.boundaryGridMobile]}
        >
          <BoundaryCard
            icon="account-balance"
            title={text(
              "U 直达本人券商",
              "USDT direct to your broker",
              "USDT مباشرة إلى حساب الوسيط",
            )}
            detail={text(
              "客户从券商客户门户取得当次网络、地址与标签，转账后提交 txHash，最终以券商实际入账为准。",
              "The client retrieves the current network, address and tag from the broker portal, then submits the txHash. Completion requires actual broker credit.",
              "يحصل العميل على الشبكة والعنوان والوسم الحالي من بوابة الوسيط ثم يرسل txHash. لا تكتمل العملية إلا بعد القيد الفعلي لدى الوسيط.",
            )}
          />
          <BoundaryCard
            icon="receipt-long"
            title={text(
              "平台专属地址代收",
              "Dedicated collection address",
              "عنوان تحصيل مخصص",
            )}
            detail={text(
              "仅在书面通道批准后使用单笔专属代收单；客户侧只显示确认中、转入券商中、已到账或异常。",
              "A single-use collection order is available only on a route with written approval. Clients see pending, forwarding, credited or exception states.",
              "يتاح طلب التحصيل أحادي الاستخدام فقط لمسار حاصل على موافقة مكتوبة. يرى العميل حالات التأكيد أو التحويل أو القيد أو الاستثناء.",
            )}
          />
          <BoundaryCard
            icon="lock-outline"
            title={text("权限隔离", "Permission separation", "فصل الصلاحيات")}
            detail={text(
              "交易权不含提款、转账或修改入金地址权限；私钥、助记词与券商密码不进入平台。",
              "Trading permission excludes withdrawals, transfers and deposit-address changes. Private keys, seed phrases and broker passwords never enter the platform.",
              "لا تشمل صلاحية التداول السحب أو التحويل أو تغيير عنوان الإيداع. لا تدخل المفاتيح الخاصة أو العبارات السرية أو كلمات مرور الوسيط إلى المنصة.",
            )}
          />
        </View>

        {plansQuery.data?.length ? (
          <View style={styles.planSection}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.eyebrow}>MY ASSET MANAGEMENT PLANS</Text>
                <Text style={styles.sectionTitle}>
                  {text(
                    "已保存资管方案",
                    "Saved managed plans",
                    "الخطط المُدارة المحفوظة",
                  )}
                </Text>
              </View>
              <Text style={styles.count}>
                {text(
                  `${plansQuery.data.length} 个方案`,
                  `${plansQuery.data.length} plans`,
                  `${plansQuery.data.length} خطط`,
                )}
              </Text>
            </View>
            <View style={styles.planGrid}>
              {plansQuery.data.map((plan) => (
                <View key={plan.sessionNo} style={styles.planCard}>
                  <View style={styles.planTopline}>
                    <Text style={styles.planStatus}>
                      {planStatusLabel(plan.status, language)}
                    </Text>
                    <Text style={styles.planBrokerCount}>
                      {text(
                        `${plan.executionSlots.length} 家券商`,
                        `${plan.executionSlots.length} brokers`,
                        `${plan.executionSlots.length} وسطاء`,
                      )}
                    </Text>
                  </View>
                  <Text style={styles.planNo}>{plan.sessionNo}</Text>
                  <Text style={styles.planCapital}>
                    {formatUsdt(Number(plan.targetCapital), false, locale)}
                  </Text>
                  <Text style={styles.planMeta}>
                    {text(
                      `已选 ${plan.strategies.length} / 6 款策略`,
                      `${plan.strategies.length} / 6 strategies selected`,
                      `تم اختيار ${plan.strategies.length} / 6 استراتيجيات`,
                    )}{" "}
                    · {onboardingModeLabel(plan.onboardingMode, language)} ·{" "}
                    {fundingPathLabel(plan.fundsRoute, language)}
                  </Text>
                  <View style={styles.permissionLine}>
                    <MaterialIcons name="shield" size={15} color={V2.green} />
                    <Text style={styles.permissionText}>
                      {text("交易授权", "Trading permission", "تفويض التداول")}{" "}
                      {permissionLabel(plan.tradeAuthorizationStatus, language)}{" "}
                      ·{" "}
                      {text(
                        "提款权 无",
                        "Withdrawals: none",
                        "السحب: غير مسموح",
                      )}{" "}
                      · {text("执行", "Execution", "التنفيذ")}{" "}
                      {plan.executionEnabled ? "ON" : "OFF"}
                    </Text>
                  </View>
                  {plan.readiness.unavailableStrategyIds.length ? (
                    <Text style={styles.warningText}>
                      {text(
                        `${plan.readiness.unavailableStrategyIds.length} 款策略当前离线，不能启用交易。`,
                        `${plan.readiness.unavailableStrategyIds.length} strategies are offline and cannot be activated.`,
                        `${plan.readiness.unavailableStrategyIds.length} استراتيجيات غير متصلة ولا يمكن تفعيلها.`,
                      )}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : isAuthenticated ? (
          <View style={styles.emptyPlan}>
            <MaterialIcons name="assignment" size={24} color={V2.textDim} />
            <Text style={styles.emptyTitle}>
              {text(
                "尚未保存资管方案",
                "No managed plan saved",
                "لا توجد خطة مُدارة محفوظة",
              )}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/?configure=1" as never)}
              style={styles.configureLink}
            >
              <Text style={styles.configureLinkText}>
                {text(
                  "开始配置六策略方案",
                  "Configure a six-strategy plan",
                  "إعداد خطة الاستراتيجيات الست",
                )}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>READ-ONLY ACCOUNT PROJECTION</Text>
            <Text style={styles.sectionTitle}>
              {text("账户数据视图", "Account data views", "عروض بيانات الحساب")}
            </Text>
          </View>
          <Text style={styles.count}>
            {text(
              `${accountsQuery.data.length} 个账户`,
              `${accountsQuery.data.length} accounts`,
              `${accountsQuery.data.length} حسابات`,
            )}
          </Text>
        </View>
        <View style={styles.accountGrid}>
          {accountsQuery.data.map((account) => (
            <View
              key={account.id}
              style={{ width: isMobile ? "100%" : "49.25%" }}
            >
              <AccountCard
                account={localizeAccount(account, language)}
                onPress={openAccount}
              />
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <MaterialIcons name="info-outline" size={20} color={V2.blue} />
          <Text style={styles.noticeText}>
            {text(
              "当前账户视图可能包含模拟或后台维护数据，请以各卡片的数据模式与同步时间为准。草案、txHash 申报、链上确认和券商到账是独立状态；页面不会据此声称真实券商 API 或自动交易已经接通。",
              "Account views may contain demo or admin-maintained data; follow each card's data mode and sync time. Draft, txHash declaration, on-chain confirmation and broker credit are separate states and do not prove that a live broker API or automated trading is connected.",
              "قد تتضمن عروض الحساب بيانات تجريبية أو بيانات تديرها لوحة التحكم؛ اتبع نمط البيانات ووقت المزامنة لكل بطاقة. المسودة وإقرار txHash والتأكيد على السلسلة والقيد لدى الوسيط حالات مستقلة ولا تثبت اتصال API حقيقي أو تداول آلي.",
            )}
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

function permissionLabel(value: string, language: AppLanguage) {
  return value === "GRANTED"
    ? language === "ar"
      ? "ممنوح"
      : language === "en"
        ? "Granted"
        : "已授予"
    : value === "PENDING"
      ? language === "ar"
        ? "قيد التأكيد"
        : language === "en"
          ? "Pending"
          : "待确认"
      : value === "REVOKED"
        ? language === "ar"
          ? "ملغى"
          : language === "en"
            ? "Revoked"
            : "已撤销"
        : language === "ar"
          ? "غير مطلوب"
          : language === "en"
            ? "Not requested"
            : "未申请";
}

function planStatusLabel(value: string, language: AppLanguage) {
  const labels: Record<string, { zh: string; en: string; ar: string }> = {
    DRAFT: { zh: "方案草案", en: "Draft", ar: "مسودة" },
    PENDING_REVIEW: { zh: "审核中", en: "In review", ar: "قيد المراجعة" },
    READY_FOR_AUTHORIZATION: {
      zh: "待交易授权",
      en: "Awaiting authorization",
      ar: "بانتظار التفويض",
    },
    ACTIVE: { zh: "运行中", en: "Active", ar: "نشط" },
    EXIT_REQUESTED: { zh: "退出处理中", en: "Exit requested", ar: "طلب خروج" },
    COMPLETED: { zh: "已结束", en: "Completed", ar: "مكتمل" },
    CANCELLED: { zh: "已取消", en: "Cancelled", ar: "ملغى" },
    REJECTED: { zh: "未通过", en: "Rejected", ar: "مرفوض" },
  };
  return labels[value]?.[language] ?? value;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 58 },
  page: {
    width: "100%",
    maxWidth: V2_LAYOUT.maxWidth,
    alignSelf: "center",
    paddingHorizontal: V2_LAYOUT.pagePaddingDesktop,
    paddingTop: 24,
    gap: 26,
  },
  pageMobile: {
    paddingHorizontal: V2_LAYOUT.pagePaddingMobile,
    paddingTop: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
  },
  headerMobile: { flexDirection: "column" },
  headerCopy: { flex: 1, maxWidth: 780, gap: 5 },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  title: { color: V2.text, fontSize: 29, lineHeight: 36, fontWeight: "900" },
  titleMobile: { fontSize: 23, lineHeight: 29 },
  subtitle: { color: V2.textMuted, fontSize: 11, lineHeight: 18 },
  demoState: {
    paddingHorizontal: 10,
    minHeight: 32,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  demoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: V2.amber },
  demoText: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  boundaryGrid: { flexDirection: "row", gap: 10 },
  boundaryGridMobile: { flexDirection: "column" },
  boundaryCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    backgroundColor: V2.backgroundRaised,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  boundaryCopy: { flex: 1, gap: 4 },
  boundaryTitle: { color: V2.text, fontSize: 12, fontWeight: "900" },
  boundaryDetail: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  planSection: { gap: 11 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    marginTop: 4,
    color: V2.text,
    fontSize: 18,
    fontWeight: "900",
  },
  count: { color: V2.textDim, fontSize: 9 },
  planGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  planCard: {
    flex: 1,
    minWidth: 285,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.34)",
    borderRadius: 6,
    backgroundColor: "rgba(216,188,131,0.04)",
    gap: 6,
  },
  planTopline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
  },
  planStatus: { color: V2.green, fontSize: 9, fontWeight: "900" },
  planBrokerCount: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  planNo: { color: V2.text, fontSize: 13, fontWeight: "900" },
  planCapital: { color: V2.text, fontSize: 20, fontWeight: "900" },
  planMeta: { color: V2.textMuted, fontSize: 9, lineHeight: 14 },
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
  warningText: { color: V2.amber, fontSize: 8, lineHeight: 13 },
  emptyPlan: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  emptyTitle: { color: V2.text, fontSize: 12, fontWeight: "900" },
  configureLink: { paddingVertical: 5 },
  configureLinkText: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  accountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  notice: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeText: { flex: 1, color: V2.textMuted, fontSize: 10, lineHeight: 17 },
});
