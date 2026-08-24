import { Text, View } from "react-native";
import { formatUsdt } from "@/components/v2/format";
import { styles } from "./styles";
import {
  fundingRouteLabel,
  type FundingRoute,
  type ManagedSessionDuration,
  type RiskOption,
} from "./types";

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
          <Text style={styles.eyebrow}>方案参数</Text>
        </View>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>
          开启限时资管会话
        </Text>
        <Text style={styles.subtitle}>
          已带入 {selectedStrategyCount}{" "}
          款策略；资金、风险、期限和执行槽共同组成同一份 Managed Session。
        </Text>
      </View>
      <View style={styles.formulaBadge}>
        <Text style={styles.formulaLabel}>会话结构</Text>
        <Text style={styles.formulaText}>
          资金 × 风控 × 六策略 × 执行槽 × 期限 × U 路由
        </Text>
      </View>
    </View>
  );
}

export function ConfiguratorFormula({
  capital,
  riskOption,
  strategyCount,
  platformCount,
  durationDays,
  fundingRoutes,
}: {
  capital: number;
  riskOption: RiskOption;
  strategyCount: number;
  platformCount: number;
  durationDays: ManagedSessionDuration;
  fundingRoutes: FundingRoute[];
}) {
  return (
    <View style={styles.formulaRail}>
      <FormulaStep
        index="01"
        label="USDT 名义资金"
        value={formatUsdt(capital, true)}
      />
      <FormulaStep
        index="02"
        label="风控"
        value={`${riskOption.title} · ${riskOption.drawdown}%`}
      />
      <FormulaStep index="03" label="策略" value={`${strategyCount} / 6`} />
      <FormulaStep index="04" label="执行槽" value={`${platformCount} / 2`} />
      <FormulaStep index="05" label="期限" value={`${durationDays} 天`} />
      <FormulaStep
        index="06"
        label="U 路由"
        value={fundingRouteLabel(fundingRoutes)}
      />
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
