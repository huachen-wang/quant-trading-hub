import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import { formatUsdt } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import type { CoreStrategy } from "@/shared/v2/contracts";
import { styles } from "./styles";
import type {
  AllianceBroker,
  FundingPath,
  OnboardingMode,
  RiskOption,
} from "./types";
import { fundingPathLabel, onboardingModeLabel } from "./types";

export function SolutionSummary({
  isNarrow,
  numericCapital,
  riskOption,
  strategies,
  brokers,
  onboardingMode,
  fundingPath,
  generated,
  canGenerate,
  onGenerate,
  onContinue,
}: {
  isNarrow: boolean;
  numericCapital: number;
  riskOption: RiskOption;
  strategies: CoreStrategy[];
  brokers: AllianceBroker[];
  onboardingMode: OnboardingMode;
  fundingPath: FundingPath;
  generated: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onContinue: () => void;
}) {
  const { language, locale, text } = useLanguage();
  const offlineStrategies = strategies.filter(
    (strategy) => strategy.source.freshness === "OFFLINE",
  );
  const offlineNames = offlineStrategies
    .map((item) => item.shortName)
    .join(language === "zh" ? "、" : language === "ar" ? "، " : ", ");
  const completionCount = [
    numericCapital > 0,
    strategies.length > 0,
    brokers.length > 0,
    Boolean(onboardingMode),
    Boolean(fundingPath),
  ].filter(Boolean).length;

  return (
    <View style={[styles.summary, isNarrow && styles.summaryNarrow]}>
      <View style={styles.summaryHeader}>
        <View>
          <Text style={styles.summaryEyebrow}>
            {text("方案预览", "PLAN PREVIEW", "معاينة الخطة")}
          </Text>
          <Text style={styles.summaryTitle}>
            {text(
              "AI量化联盟资管",
              "AI Quant Alliance plan",
              "خطة تحالف EAXAU الكمي",
            )}
          </Text>
        </View>
        <View style={styles.completion}>
          <Text style={styles.completionValue}>{completionCount}/5</Text>
          <Text style={styles.completionLabel}>
            {text("资料完整", "COMPLETE", "مكتمل")}
          </Text>
        </View>
      </View>

      <View style={[styles.fundPath, styles.fundPathManaged]}>
        <MaterialIcons name="account-balance" size={22} color={V2.gold} />
        <View style={styles.fundPathCopy}>
          <Text style={styles.fundPathTitle}>
            {fundingPathLabel(fundingPath, language)}
          </Text>
          <Text style={styles.fundPathDetail}>
            {fundingPath === "BROKER_DIRECT"
              ? text(
                  "USDT 从客户钱包直接进入客户本人券商账户。项目方只获得约定交易权限，无提款权。",
                  "USDT moves directly from the client wallet to the client's own broker account. The provider receives agreed trading permission only, never withdrawal rights.",
                  "تنتقل USDT مباشرة من محفظة العميل إلى حسابه الشخصي لدى الوسيط. يحصل المزود على صلاحية التداول المتفق عليها فقط دون حق السحب.",
                )
              : text(
                  "USDT 进入该笔代收单的专属企业地址，核对后再转入客户本人券商账户。项目方只获得约定交易权限，无提款权。",
                  "USDT enters the collection order's dedicated company address, then moves to the client's own broker account after reconciliation. The provider receives agreed trading permission only, never withdrawal rights.",
                  "تدخل USDT إلى عنوان الشركة المخصص لطلب التحصيل، ثم تُحوّل إلى حساب العميل الشخصي لدى الوسيط بعد المطابقة. يحصل المزود على صلاحية التداول فقط دون حق السحب.",
                )}
          </Text>
        </View>
      </View>

      <View style={styles.summaryRows}>
        <SummaryRow
          label={text("计划资金", "Planned capital", "رأس المال المخطط")}
          value={formatUsdt(numericCapital, false, locale)}
        />
        <SummaryRow
          label={text("风险预算", "Risk budget", "ميزانية المخاطر")}
          value={`${riskOption.title} · ${text("最大回撤", "Max drawdown", "أقصى تراجع")} ${riskOption.drawdown}%`}
        />
        <SummaryRow
          label={text("策略组合", "Strategy mix", "مزيج الاستراتيجيات")}
          value={text(
            `已选 ${strategies.length} / 6 款`,
            `${strategies.length} / 6 selected`,
            `تم اختيار ${strategies.length} / 6`,
          )}
        />
        <SummaryRow
          label={text("可选券商", "Brokers", "الوسطاء")}
          value={brokers.map((broker) => broker.name).join(" / ")}
        />
        <SummaryRow
          label={text("接入方式", "Onboarding", "طريقة الربط")}
          value={onboardingModeLabel(onboardingMode, language)}
        />
        <SummaryRow
          label={text("入金路线", "Funding route", "مسار الإيداع")}
          value={fundingPathLabel(fundingPath, language)}
        />
      </View>

      <View style={styles.generated}>
        <View style={styles.generatedTopline}>
          <Text style={styles.generatedTitle}>
            {text(
              "两类 USDT 结算严格分账",
              "USDT settlement routes stay separated",
              "فصل مسارات تسوية USDT",
            )}
          </Text>
          <Text style={styles.generatedStatus}>
            {fundingPath === "BROKER_DIRECT" ? "BROKER DIRECT" : "COLLECTION"}
          </Text>
        </View>
        <Text style={styles.generatedMeta}>
          {text(
            "EA 销售款、券商直充与资管代收使用独立订单、地址与 txHash 对账，三账隔离，不共用收款或核对记录。",
            "EA sales, direct broker funding and managed collection use separate orders, addresses and txHash reconciliation. Payment and verification records are never shared.",
            "تستخدم مبيعات EA والإيداع المباشر والتحصيل المُدار طلبات وعناوين وسجلات txHash منفصلة، ولا تتشارك سجلات الدفع أو المطابقة.",
          )}
        </Text>
      </View>

      {offlineStrategies.length ? (
        <View style={styles.issue}>
          <MaterialIcons name="cloud-off" size={18} color={V2.amber} />
          <Text style={styles.issueText}>
            {offlineNames}
            {text(
              "当前离线。可保留在方案中，但在数据与执行连接恢复前不可启用交易。",
              " are offline. They may remain in the plan but cannot be activated until data and execution links recover.",
              " غير متصلة. يمكن إبقاؤها في الخطة ولا يمكن تفعيلها حتى عودة اتصال البيانات والتنفيذ.",
            )}
          </Text>
        </View>
      ) : (
        <View style={styles.ready}>
          <MaterialIcons name="check-circle" size={18} color={V2.green} />
          <Text style={styles.readyText}>
            {text(
              `已选 ${strategies.length} 款策略，下一步可设置权重`,
              `${strategies.length} strategies selected. Set weights next.`,
              `تم اختيار ${strategies.length} استراتيجيات. حدّد الأوزان في الخطوة التالية.`,
            )}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canGenerate }}
        disabled={!canGenerate}
        onPress={onGenerate}
        style={({ pressed }) => [
          styles.generateButton,
          !canGenerate && styles.generateButtonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="auto-awesome" size={18} color={V2.background} />
        <Text style={styles.generateText}>
          {generated
            ? text(
                "方案预览已更新",
                "Plan preview updated",
                "تم تحديث معاينة الخطة",
              )
            : text(
                "生成资管方案预览",
                "Generate plan preview",
                "إنشاء معاينة الخطة",
              )}
        </Text>
      </Pressable>

      {generated ? (
        <Pressable
          accessibilityRole="link"
          onPress={onContinue}
          style={({ pressed }) => [
            styles.advancedButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.advancedText}>
            {text(
              "继续开户、授权与券商入金",
              "Continue to onboarding, authorization and funding",
              "متابعة فتح الحساب والتفويض والإيداع",
            )}
          </Text>
          <MaterialIcons name="arrow-forward" size={16} color={V2.text} />
        </Pressable>
      ) : null}

      <Text style={styles.disclaimer}>
        {text(
          "当前仅生成可审阅方案，不代表开户完成、交易权限已授予、USDT 已入账或自动交易已接通。历史数据不代表未来结果。",
          "This creates a reviewable plan only. It does not mean onboarding is complete, trading permission is granted, USDT is credited or automated trading is connected. Historical data does not predict future results.",
          "تنشئ هذه الخطوة خطة قابلة للمراجعة فقط، ولا تعني اكتمال فتح الحساب أو منح صلاحية التداول أو قيد USDT أو اتصال التداول الآلي. الأداء التاريخي لا يتنبأ بالنتائج المستقبلية.",
        )}
      </Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}
