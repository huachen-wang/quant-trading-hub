import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import { formatUsdt } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
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
  const offlineStrategies = strategies.filter(
    (strategy) => strategy.source.freshness === "OFFLINE",
  );
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
          <Text style={styles.summaryEyebrow}>方案预览</Text>
          <Text style={styles.summaryTitle}>AI量化联盟资管</Text>
        </View>
        <View style={styles.completion}>
          <Text style={styles.completionValue}>{completionCount}/5</Text>
          <Text style={styles.completionLabel}>资料完整</Text>
        </View>
      </View>

      <View style={[styles.fundPath, styles.fundPathManaged]}>
        <MaterialIcons name="account-balance" size={22} color={V2.gold} />
        <View style={styles.fundPathCopy}>
          <Text style={styles.fundPathTitle}>{fundingPathLabel(fundingPath)}</Text>
          <Text style={styles.fundPathDetail}>
            {fundingPath === "BROKER_DIRECT"
              ? "USDT 从客户钱包直接进入客户本人券商账户。"
              : "USDT 进入该笔代收单的专属企业地址，核对后再转入客户本人券商账户。"}
            项目方只获得约定交易权限，无提款权。
          </Text>
        </View>
      </View>

      <View style={styles.summaryRows}>
        <SummaryRow label="计划资金" value={formatUsdt(numericCapital)} />
        <SummaryRow
          label="风险预算"
          value={`${riskOption.title} · 最大回撤 ${riskOption.drawdown}%`}
        />
        <SummaryRow label="策略组合" value={`已选 ${strategies.length} / 6 款`} />
        <SummaryRow
          label="可选券商"
          value={brokers.map((broker) => broker.name).join(" / ")}
        />
        <SummaryRow
          label="接入方式"
          value={onboardingModeLabel(onboardingMode)}
        />
        <SummaryRow label="入金路线" value={fundingPathLabel(fundingPath)} />
      </View>

      <View style={styles.generated}>
        <View style={styles.generatedTopline}>
          <Text style={styles.generatedTitle}>两类 USDT 结算严格分账</Text>
          <Text style={styles.generatedStatus}>
            {fundingPath === "BROKER_DIRECT" ? "BROKER DIRECT" : "COLLECTION"}
          </Text>
        </View>
        <Text style={styles.generatedMeta}>
          EA 销售款、券商直充与资管代收使用独立订单、地址与 txHash 对账，
          三账隔离，不共用收款或核对记录。
        </Text>
      </View>

      {offlineStrategies.length ? (
        <View style={styles.issue}>
          <MaterialIcons name="cloud-off" size={18} color={V2.amber} />
          <Text style={styles.issueText}>
            {offlineStrategies.map((item) => item.shortName).join("、")}
            当前离线。可保留在方案中，但在数据与执行连接恢复前不可启用交易。
          </Text>
        </View>
      ) : (
        <View style={styles.ready}>
          <MaterialIcons name="check-circle" size={18} color={V2.green} />
          <Text style={styles.readyText}>已选 {strategies.length} 款策略，下一步可设置权重</Text>
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
          {generated ? "方案预览已更新" : "生成资管方案预览"}
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
          <Text style={styles.advancedText}>继续开户、授权与券商入金</Text>
          <MaterialIcons name="arrow-forward" size={16} color={V2.text} />
        </Pressable>
      ) : null}

      <Text style={styles.disclaimer}>
        当前仅生成可审阅方案，不代表开户完成、交易权限已授予、USDT 已入账或自动交易已接通。历史数据不代表未来结果。
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
