import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { formatMoney } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
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
          <Text style={styles.summaryEyebrow}>LIVE CONFIGURATION</Text>
          <Text style={styles.summaryTitle}>当前方案</Text>
        </View>
        <View style={styles.completion}>
          <Text style={styles.completionValue}>{completionCount}/4</Text>
          <Text style={styles.completionLabel}>配置完整</Text>
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
              ? "资金不经过技术方"
              : "技术方按合同代操管理"}
          </Text>
          <Text style={styles.fundPathDetail}>
            {servicePath === "BROKER"
              ? "资金保留在本人券商账户，用户掌握入出金权限。"
              : "资金与交易执行按双方合同约定，由技术方负责日常管理。"}
          </Text>
        </View>
      </View>

      <View style={styles.summaryRows}>
        <SummaryRow
          label="资金规模"
          value={formatMoney(numericCapital, "USD")}
        />
        <SummaryRow
          label="风险预算"
          value={`${riskOption.title} · 最大回撤 ${riskOption.drawdown}%`}
        />
        <SummaryRow
          label="策略组合"
          value={
            selectedStrategies.length
              ? selectedStrategies.map((item) => item.shortName).join(" / ")
              : "尚未选择"
          }
        />
        <SummaryRow
          label="交易平台"
          value={
            selectedPlatforms.length
              ? selectedPlatforms.map((item) => item.name).join(" / ")
              : "尚未选择"
          }
        />
        <SummaryRow
          label="管理模式"
          value={servicePath === "BROKER" ? "券商模式" : "资管模式"}
        />
      </View>

      {missingCompatibility.length || unusedSelectedPlatforms.length ? (
        <View style={styles.issue}>
          <MaterialIcons name="warning-amber" size={18} color={V2.amber} />
          <Text style={styles.issueText}>
            {missingCompatibility.length
              ? `当前平台无法覆盖：${missingCompatibility
                  .map((item) => item.shortName)
                  .join("、")}`
              : `没有所选策略适配：${unusedSelectedPlatforms
                  .map((item) => item.name)
                  .join("、")}`}
          </Text>
        </View>
      ) : selectedStrategies.length && selectedPlatforms.length ? (
        <View style={styles.ready}>
          <MaterialIcons name="check-circle" size={18} color={V2.green} />
          <Text style={styles.readyText}>策略与平台兼容性检查通过</Text>
        </View>
      ) : null}

      {generatedIsCurrent ? (
        <View style={styles.generated}>
          <View style={styles.generatedTopline}>
            <Text style={styles.generatedTitle}>方案已生成</Text>
            <Text style={styles.generatedStatus}>
              {isValidating
                ? "规则校验中"
                : generatedErrorCount
                  ? `${generatedErrorCount} 项需调整`
                  : "基础规则通过"}
            </Text>
          </View>
          <SummaryRow
            label="模型组合回撤"
            value={
              isValidating ||
              validationData?.estimated.modeledDrawdownPct == null
                ? "校验中"
                : `${validationData.estimated.modeledDrawdownPct}%`
            }
          />
          <SummaryRow
            label="平台分仓"
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
            {generatedWarningCount} 项提醒 ·
            规则会继续检查资金门槛、集中度与风险预算
          </Text>
        </View>
      ) : generatedDraft ? (
        <Text style={styles.staleText}>配置已经变化，请重新生成方案。</Text>
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
          {servicePath === "BROKER" ? "生成券商配置方案" : "生成资管需求方案"}
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
          <Text style={styles.advancedText}>精细调整平台与策略权重</Text>
          <MaterialIcons name="arrow-forward" size={16} color={V2.text} />
        </Pressable>
      ) : null}

      <Text style={styles.disclaimer}>
        当前仅生成配置与风险说明，不执行开户、入金或交易。历史数据不代表未来结果。
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
