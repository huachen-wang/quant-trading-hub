import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { formatUsdt } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import type {
  AllocationDraft,
  AllocationValidation,
  CoreStrategy,
  PlatformProfile,
} from "@/shared/v2/contracts";
import { styles } from "./styles";
import {
  exitModeLabel,
  fundingRouteLabel,
  type ExitMode,
  type FundingRoute,
  type ManagedSessionDuration,
  type RiskOption,
} from "./types";

export function SolutionSummary({
  isNarrow,
  numericCapital,
  riskOption,
  selectedStrategies,
  selectedPlatforms,
  allPlatforms,
  selectedOfflineStrategies,
  durationDays,
  exitMode,
  fundingRoutes,
  vaultActivationEnabled,
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
  selectedOfflineStrategies: CoreStrategy[];
  durationDays: ManagedSessionDuration;
  exitMode: ExitMode;
  fundingRoutes: FundingRoute[];
  vaultActivationEnabled: boolean;
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
    selectedStrategies.length === 6,
    selectedPlatforms.length > 0,
    compatibilityReady,
    durationDays > 0,
    fundingRoutes.length > 0,
  ].filter(Boolean).length;
  const includesDirect = fundingRoutes.includes("DIRECT_BROKER");
  const includesVault = fundingRoutes.includes("MANAGED_VAULT");
  const fundingDetail =
    includesDirect && includesVault
      ? "U 可先直达合作券商；Vault 完成接入后，可在同一会话中执行统一调度。"
      : includesVault
        ? vaultActivationEnabled
          ? "Vault 能力开关已开启；实际启用仍需逐槽完成钱包、托管、合约和授权核验。"
          : "Vault 路由已纳入方案，但当前为接入准备状态，未完成配置前不执行入金。"
        : "客户将 USDT 直接存入支持稳定币的合作券商账户。";

  return (
    <View style={[styles.summary, isNarrow && styles.summaryNarrow]}>
      <View style={styles.summaryHeader}>
        <View>
          <Text style={styles.summaryEyebrow}>实时方案</Text>
          <Text style={styles.summaryTitle}>当前方案</Text>
        </View>
        <View style={styles.completion}>
          <Text style={styles.completionValue}>{completionCount}/6</Text>
          <Text style={styles.completionLabel}>配置完整</Text>
        </View>
      </View>

      <View style={[styles.fundPath, styles.fundPathManaged]}>
        <MaterialIcons name="supervisor-account" size={22} color={V2.gold} />
        <View style={styles.fundPathCopy}>
          <Text style={styles.fundPathTitle}>Managed Session · 限时资管</Text>
          <Text style={styles.fundPathDetail}>
            {durationDays}{" "}
            天交易管理权限；项目方可执行交易与风控，不获得出金、转账或修改收款地址权限。
          </Text>
        </View>
      </View>

      <View style={styles.summaryRows}>
        <SummaryRow label="USDT 资金" value={formatUsdt(numericCapital)} />
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
          label="执行槽"
          value={
            selectedPlatforms.length
              ? selectedPlatforms.map((item) => item.name).join(" / ")
              : "尚未选择"
          }
        />
        <SummaryRow label="会话期限" value={`${durationDays} 天`} />
        <SummaryRow label="退出方式" value={exitModeLabel(exitMode)} />
        <SummaryRow
          label="USDT 路由"
          value={fundingRouteLabel(fundingRoutes)}
        />
      </View>

      <View style={styles.generated}>
        <View style={styles.generatedTopline}>
          <Text style={styles.generatedTitle}>USDT 结算摘要</Text>
          <Text style={styles.generatedStatus}>
            {includesVault
              ? vaultActivationEnabled
                ? "VAULT 能力已开启"
                : "VAULT 接入准备中"
              : "DIRECT 路由"}
          </Text>
        </View>
        <Text style={styles.generatedMeta}>{fundingDetail}</Text>
        <Text style={styles.generatedMeta}>
          费用与业绩结算以 USDT 订单、合同和最终对账记录为准。
        </Text>
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

      {selectedOfflineStrategies.length ? (
        <View style={styles.issue}>
          <MaterialIcons name="cloud-off" size={18} color={V2.amber} />
          <Text style={styles.issueText}>
            {selectedOfflineStrategies.map((item) => item.shortName).join("、")}
            当前离线：仍会进入六策略
            DRAFT，但在数据与执行连接恢复前不能激活交易。
          </Text>
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
        <Text style={styles.generateText}>生成 Managed Session 草案</Text>
      </Pressable>

      {generatedIsCurrent ? (
        <Pressable
          accessibilityRole="link"
          onPress={onAdvanced}
          style={({ pressed }) => [
            styles.advancedButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.advancedText}>精细调整 1–2 个券商执行槽</Text>
          <MaterialIcons name="arrow-forward" size={16} color={V2.text} />
        </Pressable>
      ) : null}

      <Text style={styles.disclaimer}>
        当前按数据源状态生成可审阅草案；提交授权、入金和启用交易是后续独立步骤。历史数据不代表未来结果。
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
