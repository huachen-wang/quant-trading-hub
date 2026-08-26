import { Text, View } from "react-native";
import { formatMoney } from "@/components/v2/format";
import { useLanguage } from "@/lib/language";
import { styles } from "./styles";
import type { RiskOption, ServicePath } from "./types";

export function ConfiguratorHeading({
  isMobile,
  selectedStrategyCount,
}: {
  isMobile: boolean;
  selectedStrategyCount: number;
}) {
  const { text } = useLanguage();
  return (
    <View
      style={[styles.sectionHeading, isMobile && styles.sectionHeadingMobile]}
    >
      <View style={styles.headingCopy}>
        <View style={styles.headingMarker}>
          <Text style={styles.headingIndex}>02</Text>
          <View style={styles.headingRule} />
          <Text style={styles.eyebrow}>
            {text("方案参数", "PLAN PARAMETERS", "معايير الخطة")}
          </Text>
        </View>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>
          {text(
            "配置资金、风控与执行",
            "Configure capital, risk and execution",
            "إعداد رأس المال والمخاطر والتنفيذ",
          )}
        </Text>
        <Text style={styles.subtitle}>
          {text(
            `已带入 ${selectedStrategyCount} 款策略，所有参数共同组成同一份量化方案。`,
            `${selectedStrategyCount} strategies selected. Every parameter contributes to one quant plan.`,
            `تم اختيار ${selectedStrategyCount} استراتيجيات. جميع المعايير تشكل خطة كمية واحدة.`,
          )}
        </Text>
      </View>
      <View style={styles.formulaBadge}>
        <Text style={styles.formulaLabel}>
          {text("方案结构", "PLAN FORMULA", "معادلة الخطة")}
        </Text>
        <Text style={styles.formulaText}>
          {text(
            "资金 × 风控 × 策略 × 平台 × 模式",
            "Capital × Risk × Strategy × Platform × Mode",
            "رأس المال × المخاطر × الاستراتيجية × المنصة × النمط",
          )}
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
  servicePath,
}: {
  capital: number;
  riskOption: RiskOption;
  strategyCount: number;
  platformCount: number;
  servicePath: ServicePath;
}) {
  const { locale, text } = useLanguage();
  return (
    <View style={styles.formulaRail}>
      <FormulaStep
        index="01"
        label={text("资金", "Capital", "رأس المال")}
        value={formatMoney(capital, "USD", true, locale)}
      />
      <FormulaStep
        index="02"
        label={text("风控", "Risk", "المخاطر")}
        value={`${riskOption.title} · ${riskOption.drawdown}%`}
      />
      <FormulaStep
        index="03"
        label={text("策略", "Strategy", "الاستراتيجية")}
        value={`${strategyCount} / 6`}
      />
      <FormulaStep
        index="04"
        label={text("平台", "Platform", "المنصة")}
        value={`${platformCount} / 3`}
      />
      <FormulaStep
        index="05"
        label={text("模式", "Mode", "النمط")}
        value={
          servicePath === "BROKER"
            ? text("券商模式", "Broker", "الوسيط")
            : text("资管模式", "Managed", "إدارة مفوضة")
        }
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
