import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  AllocationDraft,
  AllocationValidation,
} from "@/shared/v2/contracts";
import { useLanguage } from "@/lib/language";
import { formatUsdt } from "../format";
import { V2 } from "../tokens";

export function AllocationSummary({
  draft,
  validation,
  isValidating,
  isCreating,
  onValidate,
  onConfirm,
}: {
  draft: AllocationDraft;
  validation?: AllocationValidation;
  isValidating: boolean;
  isCreating: boolean;
  onValidate: () => void;
  onConfirm: () => void;
}) {
  const { locale, text } = useLanguage();
  const platformTotal = draft.platformBuckets.reduce(
    (sum, bucket) => sum + bucket.capitalWeightPct,
    0,
  );
  const errors =
    validation?.issues.filter((item) => item.severity === "ERROR") ?? [];
  const warnings =
    validation?.issues.filter((item) => item.severity === "WARNING") ?? [];
  const canConfirm = Boolean(validation?.valid) && !isValidating && !isCreating;

  return (
    <View style={styles.summary}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>VALIDATION</Text>
          <Text style={styles.title}>
            {text("方案校验", "Plan validation", "التحقق من الخطة")}
          </Text>
        </View>
        {isValidating ? (
          <ActivityIndicator size="small" color={V2.gold} />
        ) : null}
      </View>

      <View style={styles.summaryMetrics}>
        <SummaryMetric
          label={text("USDT 名义资金", "Notional USDT", "قيمة USDT الاسمية")}
          value={formatUsdt(Number(draft.capital.amount), true, locale)}
        />
        <SummaryMetric
          label={text("平台权重", "Platform weight", "وزن المنصة")}
          value={`${platformTotal}%`}
          color={Math.abs(platformTotal - 100) < 0.05 ? V2.green : V2.red}
        />
        <SummaryMetric
          label={text("执行槽数量", "Execution slots", "حسابات التنفيذ")}
          value={`${draft.platformBuckets.length} / 2`}
        />
        <SummaryMetric
          label={text("模型回撤", "Modeled drawdown", "التراجع المحسوب")}
          value={
            validation
              ? `${validation.estimated.modeledDrawdownPct ?? "--"}%`
              : "--"
          }
          color={V2.amber}
        />
      </View>

      <View style={styles.ruleLine}>
        <Text style={styles.ruleLabel}>
          {text("风险预算", "Risk budget", "ميزانية المخاطر")}
        </Text>
        <Text style={styles.ruleValue}>
          {draft.riskBudget.maxDrawdownPct ?? "--"}%
        </Text>
      </View>
      <View style={styles.ruleLine}>
        <Text style={styles.ruleLabel}>
          {text(
            "已知成本估算",
            "Known cost estimate",
            "تقدير التكلفة المعروفة",
          )}
        </Text>
        <Text style={styles.ruleValue}>
          {validation?.estimated.annualizedKnownCosts
            ? formatUsdt(
                Number(validation.estimated.annualizedKnownCosts.amount),
                false,
                locale,
              )
            : "--"}
        </Text>
      </View>
      <View style={styles.ruleLine}>
        <Text style={styles.ruleLabel}>
          {text("规则版本", "Rule version", "إصدار القواعد")}
        </Text>
        <Text style={styles.ruleValue}>
          {validation?.ruleSetVersion ??
            text("等待校验", "Pending validation", "بانتظار التحقق")}
        </Text>
      </View>

      <View style={styles.issueHeader}>
        <Text style={styles.issueHeaderText}>
          {text("检查结果", "Validation results", "نتائج التحقق")}
        </Text>
        <Text style={styles.issueCount}>
          {text(
            `${errors.length} 错误 · ${warnings.length} 警告`,
            `${errors.length} errors · ${warnings.length} warnings`,
            `${errors.length} أخطاء · ${warnings.length} تحذيرات`,
          )}
        </Text>
      </View>
      <View style={styles.issues}>
        {validation?.issues.length ? (
          validation.issues.map((item, index) => {
            const color =
              item.severity === "ERROR"
                ? V2.red
                : item.severity === "WARNING"
                  ? V2.amber
                  : V2.blue;
            const icon =
              item.severity === "ERROR"
                ? "error-outline"
                : item.severity === "WARNING"
                  ? "warning-amber"
                  : "info-outline";
            return (
              <View
                key={`${item.code}-${item.path}-${index}`}
                style={styles.issue}
              >
                <MaterialIcons name={icon} size={17} color={color} />
                <View style={styles.issueCopy}>
                  <Text style={[styles.issueSeverity, { color }]}>
                    {item.severity}
                  </Text>
                  <Text style={styles.issueMessage}>{item.message}</Text>
                  {item.remediation ? (
                    <Text style={styles.issueRemediation}>
                      {item.remediation}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.noIssues}>
            {isValidating
              ? text(
                  "正在执行规则检查…",
                  "Running rule checks…",
                  "جارٍ فحص القواعد…",
                )
              : text(
                  "修改方案后点击重新校验。",
                  "After editing the plan, validate again.",
                  "بعد تعديل الخطة، أعد التحقق.",
                )}
          </Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onValidate}
        disabled={isValidating}
        style={({ pressed }) => [
          styles.validateButton,
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="rule" size={18} color={V2.text} />
        <Text style={styles.validateText}>
          {text("重新校验", "Validate again", "إعادة التحقق")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canConfirm }}
        onPress={onConfirm}
        disabled={!canConfirm}
        style={({ pressed }) => [
          styles.confirmButton,
          !canConfirm && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {isCreating ? (
          <ActivityIndicator size="small" color={V2.background} />
        ) : (
          <MaterialIcons name="check-circle" size={18} color={V2.background} />
        )}
        <Text style={styles.confirmText}>
          {isCreating
            ? text("正在创建草案", "Creating draft", "جارٍ إنشاء المسودة")
            : text(
                "创建资管方案草案",
                "Create managed plan draft",
                "إنشاء مسودة خطة الإدارة",
              )}
        </Text>
      </Pressable>
      <Text style={styles.disclaimer}>
        {text(
          "草案只生成可审阅摘要；授权、入金与执行是后续独立步骤。",
          "A draft creates a reviewable summary only. Authorization, funding and execution are separate later steps.",
          "تنشئ المسودة ملخصا قابلا للمراجعة فقط. التفويض والإيداع والتنفيذ خطوات مستقلة لاحقة.",
        )}
      </Text>
    </View>
  );
}

function SummaryMetric({
  label,
  value,
  color = V2.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
      <Text style={[styles.summaryMetricValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
    padding: 16,
    gap: 13,
  },
  heading: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  eyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  title: {
    marginTop: 3,
    color: V2.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  summaryMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: V2.border,
  },
  summaryMetric: {
    width: "50%",
    minHeight: 66,
    padding: 10,
    justifyContent: "center",
    gap: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  summaryMetricLabel: { color: V2.textDim, fontSize: 10 },
  summaryMetricValue: { fontSize: 14, fontWeight: "900" },
  ruleLine: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  ruleLabel: { color: V2.textMuted, fontSize: 11 },
  ruleValue: {
    color: V2.text,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
    flexShrink: 1,
  },
  issueHeader: {
    marginTop: 3,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  issueHeaderText: { color: V2.text, fontSize: 12, fontWeight: "900" },
  issueCount: { color: V2.textDim, fontSize: 10 },
  issues: { maxHeight: 340, gap: 0 },
  issue: {
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
  },
  issueCopy: { flex: 1, minWidth: 0, gap: 3 },
  issueSeverity: { fontSize: 10, fontWeight: "900" },
  issueMessage: { color: V2.text, fontSize: 11, lineHeight: 16 },
  issueRemediation: { color: V2.textMuted, fontSize: 10, lineHeight: 15 },
  noIssues: {
    paddingVertical: 16,
    color: V2.textMuted,
    fontSize: 11,
    textAlign: "center",
  },
  validateButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  validateText: { color: V2.text, fontSize: 12, fontWeight: "800" },
  confirmButton: {
    minHeight: 42,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  confirmText: { color: V2.background, fontSize: 12, fontWeight: "900" },
  disclaimer: {
    color: V2.textDim,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.72 },
});
