import { Text, View } from "react-native";
import { formatMoney } from "@/components/v2/format";
import { styles } from "./styles";
import type { RiskOption, ServicePath } from "./types";

export function ConfiguratorHeading({ isMobile }: { isMobile: boolean }) {
  return (
    <View
      style={[styles.sectionHeading, isMobile && styles.sectionHeadingMobile]}
    >
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>QUANT CONFIGURATOR</Text>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>
          像选配汽车一样组合量化方案
        </Text>
        <Text style={styles.subtitle}>
          不是购买单个 EA。资金、风险、策略、平台和管理模式共同决定最终方案。
        </Text>
      </View>
      <View style={styles.formulaBadge}>
        <Text style={styles.formulaLabel}>量化方案</Text>
        <Text style={styles.formulaText}>资金 × 风控 × 策略 × 平台 × 模式</Text>
      </View>
    </View>
  );
}

export function ConfiguratorFormula({
  capital,
  riskOption,
  strategyCount,
  platformCount,
  servicePath,
}: {
  capital: number;
  riskOption: RiskOption;
  strategyCount: number;
  platformCount: number;
  servicePath: ServicePath;
}) {
  return (
    <View style={styles.formulaRail}>
      <FormulaStep
        index="01"
        label="资金"
        value={formatMoney(capital, "USD", true)}
      />
      <FormulaStep
        index="02"
        label="风控"
        value={`${riskOption.title} · ${riskOption.drawdown}%`}
      />
      <FormulaStep index="03" label="策略" value={`${strategyCount} / 6`} />
      <FormulaStep index="04" label="平台" value={`${platformCount} / 3`} />
      <FormulaStep
        index="05"
        label="模式"
        value={servicePath === "BROKER" ? "券商模式" : "资管模式"}
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
