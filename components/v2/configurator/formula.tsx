import { Text, View } from "react-native";
import { formatUsdt } from "@/components/v2/format";
import { styles } from "./styles";
import type {
  AllianceBroker,
  FundingPath,
  OnboardingMode,
  RiskOption,
} from "./types";
import { fundingPathLabel, onboardingModeLabel } from "./types";

export function ConfiguratorHeading({
  isMobile,
  selectedStrategyCount,
}: {
  isMobile: boolean;
  selectedStrategyCount: number;
}) {
  return (
    <View
      style={[styles.sectionHeading, isMobile && styles.sectionHeadingMobile]}
    >
      <View style={styles.headingCopy}>
        <View style={styles.headingMarker}>
          <Text style={styles.headingIndex}>02</Text>
          <View style={styles.headingRule} />
          <Text style={styles.eyebrow}>资管接入方案</Text>
        </View>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>
          配置 AI量化联盟资管方案
        </Text>
        <Text style={styles.subtitle}>
          从 6 款可选策略中已选 {selectedStrategyCount} 款；设置权重、券商与接入方式后，
          USDT 由客户直接存入本人券商账户。
        </Text>
      </View>
      <View style={styles.formulaBadge}>
        <Text style={styles.formulaLabel}>方案结构</Text>
        <Text style={styles.formulaText}>
          USDT 计划资金 × 风控 × 所选策略 × 券商 × 接入方式
        </Text>
      </View>
    </View>
  );
}

export function ConfiguratorFormula({
  capital,
  riskOption,
  strategyCount,
  brokers,
  onboardingMode,
  fundingPath,
}: {
  capital: number;
  riskOption: RiskOption;
  strategyCount: number;
  brokers: AllianceBroker[];
  onboardingMode: OnboardingMode;
  fundingPath: FundingPath;
}) {
  return (
    <View style={styles.formulaRail}>
      <FormulaStep
        index="01"
        label="计划资金"
        value={formatUsdt(capital, true)}
      />
      <FormulaStep
        index="02"
        label="风控"
        value={`${riskOption.title} · ${riskOption.drawdown}%`}
      />
      <FormulaStep index="03" label="策略" value={`${strategyCount} / 6`} />
      <FormulaStep
        index="04"
        label="可选券商"
        value={brokers.map((broker) => broker.name).join(" / ")}
      />
      <FormulaStep
        index="05"
        label="接入方式"
        value={onboardingModeLabel(onboardingMode)}
      />
      <FormulaStep index="06" label="入金路线" value={fundingPathLabel(fundingPath)} />
    </View>
  );
}

function FormulaStep({
  index,
  label,
  value,
}: {
  index: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.formulaStep}>
      <Text style={styles.formulaIndex}>{index}</Text>
      <View style={styles.formulaStepCopy}>
        <Text style={styles.formulaStepLabel}>{label}</Text>
        <Text style={styles.formulaStepValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}
