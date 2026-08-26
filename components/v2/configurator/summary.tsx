import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { formatMoney } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import type {
  AllocationDraft,
  AllocationValidation,
  CoreStrategy,
  PlatformProfile,
} from "@/shared/v2/contracts";
import { styles } from "./styles";
import type { RiskOption, ServicePath } from "./types";

export function SolutionSummary({
  isNarrow,
  numericCapital,
  riskOption,
  selectedStrategies,
  selectedPlatforms,
  allPlatforms,
  servicePath,
  missingCompatibility,
  unusedSelectedPlatforms,
  generatedIsCurrent,
  generatedDraft,
  validationData,
  isValidating,
  generatedErrorCount,
  generatedWarningCount,
  canGenerate,
  isGenerating,
  onGenerate,
  onAdvanced,
}: {
  isNarrow: boolean;
  numericCapital: number;
  riskOption: RiskOption;
  selectedStrategies: CoreStrategy[];
  selectedPlatforms: PlatformProfile[];
  allPlatforms: PlatformProfile[];
  servicePath: ServicePath;
  missingCompatibility: CoreStrategy[];
  unusedSelectedPlatforms: PlatformProfile[];
  generatedIsCurrent: boolean;
  generatedDraft?: AllocationDraft;
  validationData?: AllocationValidation;
  isValidating: boolean;
  generatedErrorCount: number;
  generatedWarningCount: number;
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onAdvanced: () => void;
}) {
  const { locale, text } = useLanguage();
  const compatibilityReady =
    missingCompatibility.length === 0 && unusedSelectedPlatforms.length === 0;
  const completionCount = [
    numericCapital > 0,
    selectedStrategies.length > 0,
    selectedPlatforms.length > 0,
    compatibilityReady,
  ].filter(Boolean).length;

  return (
    <View style={[styles.summary, isNarrow && styles.summaryNarrow]}>
      <View style={styles.summaryHeader}>
        <View>
          <Text style={styles.summaryEyebrow}>
            {text("实时方案", "LIVE PLAN", "الخطة المباشرة")}
          </Text>
          <Text style={styles.summaryTitle}>
            {text("当前方案", "Current plan", "الخطة الحالية")}
          </Text>
        </View>
        <View style={styles.completion}>
          <Text style={styles.completionValue}>{completionCount}/4</Text>
          <Text style={styles.completionLabel}>
            {text("配置完整", "COMPLETE", "مكتمل")}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.fundPath,
          servicePath === "MANAGED" && styles.fundPathManaged,
        ]}
      >
        <MaterialIcons
          name={
            servicePath === "BROKER" ? "account-balance" : "supervisor-account"
          }
          size={22}
          color={servicePath === "BROKER" ? V2.green : V2.gold}
        />
        <View style={styles.fundPathCopy}>
          <Text style={styles.fundPathTitle}>
            {servicePath === "BROKER"
              ? text(
                  "资金不经过技术方",
                  "Funds never pass through the provider",
                  "الأموال لا تمر عبر المزود",
                )
              : text(
                  "技术方按合同代操管理",
                  "Provider manages under contract",
                  "المزود يدير الحساب بموجب عقد",
                )}
          </Text>
          <Text style={styles.fundPathDetail}>
            {servicePath === "BROKER"
              ? text(
                  "资金保留在本人券商账户，用户掌握入出金权限。",
                  "Funds remain in the user's broker account, with deposits and withdrawals controlled by the user.",
                  "تبقى الأموال في حساب الوسيط الخاص بالمستخدم مع تحكمه في الإيداع والسحب.",
                )
              : text(
                  "资金与交易执行按双方合同约定，由技术方负责日常管理。",
                  "Custody and execution follow the agreement, with daily management handled by the provider.",
                  "تخضع إدارة الأموال والتنفيذ للاتفاقية ويتولى المزود الإدارة اليومية.",
                )}
          </Text>
        </View>
      </View>

      <View style={styles.summaryRows}>
        <SummaryRow
          label={text("资金规模", "Capital", "رأس المال")}
          value={formatMoney(numericCapital, "USD", false, locale)}
        />
        <SummaryRow
          label={text("风险预算", "Risk budget", "ميزانية المخاطر")}
          value={`${riskOption.title} · ${text("最大回撤", "Max drawdown", "أقصى تراجع")} ${riskOption.drawdown}%`}
        />
        <SummaryRow
          label={text("策略组合", "Strategy mix", "مزيج الاستراتيجيات")}
          value={
            selectedStrategies.length
              ? selectedStrategies.map((item) => item.shortName).join(" / ")
              : text("尚未选择", "Not selected", "لم يتم الاختيار")
          }
        />
        <SummaryRow
          label={text("交易平台", "Platforms", "المنصات")}
          value={
            selectedPlatforms.length
              ? selectedPlatforms.map((item) => item.name).join(" / ")
              : text("尚未选择", "Not selected", "لم يتم الاختيار")
          }
        />
        <SummaryRow
          label={text("管理模式", "Management mode", "نمط الإدارة")}
          value={
            servicePath === "BROKER"
              ? text("券商模式", "Broker mode", "نمط الوسيط")
              : text("资管模式", "Managed mode", "الإدارة المفوضة")
          }
        />
      </View>

      {missingCompatibility.length || unusedSelectedPlatforms.length ? (
        <View style={styles.issue}>
          <MaterialIcons name="warning-amber" size={18} color={V2.amber} />
          <Text style={styles.issueText}>
            {missingCompatibility.length
              ? text(
                  `当前平台无法覆盖：${missingCompatibility.map((item) => item.shortName).join("、")}`,
                  `No selected platform supports: ${missingCompatibility.map((item) => item.shortName).join(", ")}`,
                  `لا تدعم المنصات المحددة: ${missingCompatibility.map((item) => item.shortName).join("، ")}`,
                )
              : text(
                  `没有所选策略适配：${unusedSelectedPlatforms.map((item) => item.name).join("、")}`,
                  `No selected strategy fits: ${unusedSelectedPlatforms.map((item) => item.name).join(", ")}`,
                  `لا توجد استراتيجية مناسبة لـ: ${unusedSelectedPlatforms.map((item) => item.name).join("، ")}`,
                )}
          </Text>
        </View>
      ) : selectedStrategies.length && selectedPlatforms.length ? (
        <View style={styles.ready}>
          <MaterialIcons name="check-circle" size={18} color={V2.green} />
          <Text style={styles.readyText}>
            {text(
              "策略与平台兼容性检查通过",
              "Strategy and platform compatibility passed",
              "تم اجتياز فحص توافق الاستراتيجيات والمنصات",
            )}
          </Text>
        </View>
      ) : null}

      {generatedIsCurrent ? (
        <View style={styles.generated}>
          <View style={styles.generatedTopline}>
            <Text style={styles.generatedTitle}>
              {text("方案已生成", "Plan generated", "تم إنشاء الخطة")}
            </Text>
            <Text style={styles.generatedStatus}>
              {isValidating
                ? text("规则校验中", "Validating", "جارٍ التحقق")
                : generatedErrorCount
                  ? text(
                      `${generatedErrorCount} 项需调整`,
                      `${generatedErrorCount} items need attention`,
                      `${generatedErrorCount} عناصر تحتاج إلى تعديل`,
                    )
                  : text(
                      "基础规则通过",
                      "Core rules passed",
                      "تم اجتياز القواعد الأساسية",
                    )}
            </Text>
          </View>
          <SummaryRow
            label={text("模型组合回撤", "Modeled drawdown", "التراجع النموذجي")}
            value={
              isValidating ||
              validationData?.estimated.modeledDrawdownPct == null
                ? text("校验中", "Validating", "جارٍ التحقق")
                : `${validationData.estimated.modeledDrawdownPct}%`
            }
          />
          <SummaryRow
            label={text("平台分仓", "Platform allocation", "توزيع المنصات")}
            value={
              generatedDraft?.platformBuckets
                .map((bucket) => {
                  const platform = allPlatforms.find(
                    (item) => item.id === bucket.platformId,
                  );
                  return `${platform?.code ?? bucket.platformId} ${bucket.capitalWeightPct}%`;
                })
                .join(" / ") ?? "--"
            }
          />
          <Text style={styles.generatedMeta}>
            {text(
              `${generatedWarningCount} 项提醒 · 规则会继续检查资金门槛、集中度与风险预算`,
              `${generatedWarningCount} notices · Rules continue checking minimum capital, concentration and risk budget`,
              `${generatedWarningCount} تنبيهات · تستمر القواعد في فحص الحد الأدنى لرأس المال والتركيز وميزانية المخاطر`,
            )}
          </Text>
        </View>
      ) : generatedDraft ? (
        <Text style={styles.staleText}>
          {text(
            "配置已经变化，请重新生成方案。",
            "The configuration changed. Generate the plan again.",
            "تغيرت الإعدادات. أنشئ الخطة من جديد.",
          )}
        </Text>
      ) : null}

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
        {isGenerating ? (
          <ActivityIndicator size="small" color={V2.background} />
        ) : (
          <MaterialIcons name="auto-awesome" size={18} color={V2.background} />
        )}
        <Text style={styles.generateText}>
          {servicePath === "BROKER"
            ? text(
                "生成券商配置方案",
                "Generate broker plan",
                "إنشاء خطة الوسيط",
              )
            : text(
                "生成资管需求方案",
                "Generate managed mandate",
                "إنشاء تفويض الإدارة",
              )}
        </Text>
      </Pressable>

      {generatedIsCurrent && servicePath === "BROKER" ? (
        <Pressable
          accessibilityRole="link"
          onPress={onAdvanced}
          style={({ pressed }) => [
            styles.advancedButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.advancedText}>
            {text(
              "精细调整平台与策略权重",
              "Fine-tune platform and strategy weights",
              "ضبط أوزان المنصات والاستراتيجيات",
            )}
          </Text>
          <MaterialIcons name="arrow-forward" size={16} color={V2.text} />
        </Pressable>
      ) : null}

      <Text style={styles.disclaimer}>
        {text(
          "当前仅生成配置与风险说明，不执行开户、入金或交易。历史数据不代表未来结果。",
          "This creates configuration and risk notes only. It does not open accounts, deposit funds or execute trades. Historical data does not predict future results.",
          "تنشئ هذه الأداة إعدادات وملاحظات للمخاطر فقط ولا تفتح حسابات أو تودع أموالا أو تنفذ صفقات. البيانات التاريخية لا تتنبأ بالنتائج المستقبلية.",
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
