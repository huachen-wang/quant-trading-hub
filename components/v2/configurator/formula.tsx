import { Text, View } from "react-native";
import { formatUsdt } from "@/components/v2/format";
import { useLanguage } from "@/lib/language";
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
            {text("资管接入方案", "MANAGED ONBOARDING", "إعداد الإدارة الكمية")}
          </Text>
        </View>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>
          {text(
            "配置 AI量化联盟资管方案",
            "Configure an AI Quant Alliance plan",
            "إعداد خطة تحالف EAXAU الكمي",
          )}
        </Text>
        <Text style={styles.subtitle}>
          {text(
            `从 6 款可选策略中已选 ${selectedStrategyCount} 款；设置权重、券商与接入方式后，USDT 由客户直接存入本人券商账户。`,
            `${selectedStrategyCount} of 6 strategies selected. Set weights, brokers and onboarding; USDT is deposited into the client's own broker account.`,
            `تم اختيار ${selectedStrategyCount} من 6 استراتيجيات. حدّد الأوزان والوسطاء وطريقة الربط؛ وتودع USDT في حساب العميل الشخصي لدى الوسيط.`,
          )}
        </Text>
      </View>
      <View style={styles.formulaBadge}>
        <Text style={styles.formulaLabel}>
          {text("方案结构", "PLAN STRUCTURE", "هيكل الخطة")}
        </Text>
        <Text style={styles.formulaText}>
          {text(
            "USDT 计划资金 × 风控 × 所选策略 × 券商 × 接入方式",
            "USDT capital × Risk × Strategies × Brokers × Onboarding",
            "رأس مال USDT × المخاطر × الاستراتيجيات × الوسطاء × الربط",
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
  const { language, locale, text } = useLanguage();
  return (
    <View style={styles.formulaRail}>
      <FormulaStep
        index="01"
        label={text("计划资金", "Planned capital", "رأس المال المخطط")}
        value={formatUsdt(capital, true, locale)}
      />
      <FormulaStep
        index="02"
        label={text("风控", "Risk", "المخاطر")}
        value={`${riskOption.title} · ${riskOption.drawdown}%`}
      />
      <FormulaStep
        index="03"
        label={text("策略", "Strategies", "الاستراتيجيات")}
        value={`${strategyCount} / 6`}
      />
      <FormulaStep
        index="04"
        label={text("可选券商", "Brokers", "الوسطاء")}
        value={brokers.map((broker) => broker.name).join(" / ")}
      />
      <FormulaStep
        index="05"
        label={text("接入方式", "Onboarding", "طريقة الربط")}
        value={onboardingModeLabel(onboardingMode, language)}
      />
      <FormulaStep
        index="06"
        label={text("入金路线", "Funding route", "مسار الإيداع")}
        value={fundingPathLabel(fundingPath, language)}
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
