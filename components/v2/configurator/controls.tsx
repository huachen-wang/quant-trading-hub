import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import {
  formatAnnualizedReturn,
  formatPct,
  formatUsdt,
} from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import type { CoreStrategy } from "@/shared/v2/contracts";
import { styles } from "./styles";
import {
  CAPITAL_PRESETS,
  getAllianceBrokers,
  getFundingPathOptions,
  getOnboardingOptions,
  getRiskOptions,
  type AllianceBrokerId,
  type FundingPath,
  type OnboardingMode,
  type RiskProfile,
} from "./types";

export function ConfiguratorControls({
  isMobile,
  capital,
  numericCapital,
  onCapitalChange,
  riskProfile,
  onRiskProfileChange,
  strategies,
  brokerIds,
  onToggleBroker,
  onboardingMode,
  onOnboardingModeChange,
  fundingPath,
  onFundingPathChange,
  collectionApprovals,
}: {
  isMobile: boolean;
  capital: string;
  numericCapital: number;
  onCapitalChange: (value: string) => void;
  riskProfile: RiskProfile;
  onRiskProfileChange: (value: RiskProfile) => void;
  strategies: CoreStrategy[];
  brokerIds: AllianceBrokerId[];
  onToggleBroker: (value: AllianceBrokerId) => void;
  onboardingMode: OnboardingMode;
  onOnboardingModeChange: (value: OnboardingMode) => void;
  fundingPath: FundingPath;
  onFundingPathChange: (value: FundingPath) => void;
  collectionApprovals: Record<
    AllianceBrokerId,
    "NOT_APPROVED" | "PENDING" | "APPROVED" | "SUSPENDED"
  >;
}) {
  const [capitalFocused, setCapitalFocused] = useState(false);
  const { language, locale, text } = useLanguage();
  const riskOptions = getRiskOptions(language);
  const allianceBrokers = getAllianceBrokers(language);
  const onboardingOptions = getOnboardingOptions(language);
  const fundingPathOptions = getFundingPathOptions(language);

  return (
    <View style={styles.controls}>
      <ConfiguratorStep
        index="01"
        icon="account-balance-wallet"
        title={text("计划投入资金", "Planned capital", "رأس المال المخطط")}
        detail={text(
          "用于测算组合门槛与风险预算；此处不收款，也不会生成平台收款地址。",
          "Used to model portfolio minimums and risk budgets. No payment is collected and no platform address is generated here.",
          "يُستخدم لحساب حدود المحفظة وميزانية المخاطر. لا يتم تحصيل أموال أو إنشاء عنوان للمنصة هنا.",
        )}
      >
        <View style={[styles.capitalRow, isMobile && styles.stackRow]}>
          <View
            style={[
              styles.moneyInput,
              capitalFocused && styles.moneyInputFocused,
            ]}
          >
            <TextInput
              accessibilityLabel={text(
                "计划投入 USDT",
                "Planned USDT capital",
                "رأس مال USDT المخطط",
              )}
              value={capital}
              onFocus={() => setCapitalFocused(true)}
              onBlur={() => setCapitalFocused(false)}
              onChangeText={(value) => {
                const clean = value.replace(/[^0-9.]/g, "");
                if (!/^\d*(?:\.\d{0,2})?$/.test(clean)) return;
                onCapitalChange(clean);
              }}
              keyboardType="decimal-pad"
              placeholder="50000"
              placeholderTextColor={V2.textDim}
              style={styles.input}
            />
            <Text style={styles.currency}>USDT</Text>
          </View>
          <View style={styles.presetRow}>
            {CAPITAL_PRESETS.map((amount) => (
              <Pressable
                key={amount}
                accessibilityRole="button"
                onPress={() => onCapitalChange(String(amount))}
                style={[
                  styles.presetButton,
                  numericCapital === amount && styles.presetButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    numericCapital === amount && styles.presetTextActive,
                  ]}
                >
                  {language === "zh"
                    ? amount >= 10_000
                      ? `${amount / 10_000} 万 U`
                      : `${amount} U`
                    : formatUsdt(amount, true, locale)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="02"
        icon="verified-user"
        title={text("账户风控", "Account risk", "مخاطر الحساب")}
        detail={text(
          "先设最大回撤预算，再进入开户、授权与入金流程。",
          "Set the maximum drawdown budget before onboarding, authorization and funding.",
          "حدّد ميزانية أقصى تراجع قبل فتح الحساب والتفويض والإيداع.",
        )}
      >
        <View style={[styles.riskOptions, isMobile && styles.stackRow]}>
          {riskOptions.map((option) => {
            const active = option.id === riskProfile;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => onRiskProfileChange(option.id)}
                style={[styles.riskOption, active && styles.optionActive]}
              >
                <View style={styles.optionTitleRow}>
                  <MaterialIcons
                    name={
                      active ? "radio-button-checked" : "radio-button-unchecked"
                    }
                    size={17}
                    color={active ? V2.gold : V2.textDim}
                  />
                  <Text
                    style={[
                      styles.optionTitle,
                      active && styles.optionTitleActive,
                    ]}
                  >
                    {option.title}
                  </Text>
                  <Text style={styles.optionValue}>{option.drawdown}%</Text>
                </View>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </Pressable>
            );
          })}
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="03"
        icon="hub"
        title={text(
          `已选策略组合（${strategies.length} / 6）`,
          `Selected strategies (${strategies.length} / 6)`,
          `الاستراتيجيات المختارة (${strategies.length} / 6)`,
        )}
        detail={text(
          "平台固定提供 6 款可选策略，单个方案可选 1–6 款；权重在下一步设置。离线或模拟数据保留准确标签。",
          "Choose 1–6 from the six available strategies. Weights are set in the next step, and offline or demo data keeps its exact label.",
          "اختر من 1 إلى 6 من الاستراتيجيات الست. تُحدد الأوزان في الخطوة التالية وتبقى بيانات العرض أو عدم الاتصال موسومة بدقة.",
        )}
      >
        <View style={styles.strategyOptions}>
          {!strategies.length ? (
            <Text style={styles.modeDetail}>
              {text(
                "请先在上方六款策略中至少选择 1 款。",
                "Select at least one of the six strategies above.",
                "اختر استراتيجية واحدة على الأقل من الست أعلاه.",
              )}
            </Text>
          ) : null}
          {strategies.map((strategy) => {
            const offline = strategy.source.freshness === "OFFLINE";
            return (
              <View
                key={strategy.id}
                style={[styles.strategyOption, styles.optionActive]}
              >
                <View
                  style={[
                    styles.strategyRail,
                    { backgroundColor: strategy.accent },
                  ]}
                />
                <View style={styles.strategyOptionCopy}>
                  <Text style={[styles.strategyName, styles.optionTitleActive]}>
                    {strategy.shortName}
                  </Text>
                  <Text style={styles.strategyMeta} numberOfLines={1}>
                    {text("年化", "Annualized", "سنوي")}{" "}
                    {formatAnnualizedReturn(strategy.metrics.return90dPct)} ·{" "}
                    {text("回撤", "Drawdown", "التراجع")}{" "}
                    {formatPct(strategy.metrics.maxDrawdownPct)}
                  </Text>
                </View>
                <MaterialIcons
                  name={offline ? "cloud-off" : "check-circle"}
                  size={19}
                  color={offline ? V2.amber : V2.gold}
                />
              </View>
            );
          })}
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="04"
        icon="account-balance"
        title={text(
          "选择券商接入通道",
          "Choose broker channels",
          "اختر قنوات الوسطاء",
        )}
        detail={text(
          "当前可选 Exness、IC Markets 与 Blueberry Markets；不代表券商官方背书，具体实体、地区与入金能力须在开户时核验。",
          "Available options are Exness, IC Markets and Blueberry Markets. This is not broker endorsement; verify the entity, region and funding capability during onboarding.",
          "الخيارات الحالية هي Exness وIC Markets وBlueberry Markets. لا يمثل ذلك اعتمادا رسميا؛ تحقق من الكيان والمنطقة وإمكانية الإيداع عند فتح الحساب.",
        )}
      >
        <View style={styles.platformOptions}>
          {allianceBrokers.map((broker) => {
            const active = brokerIds.includes(broker.id);
            return (
              <Pressable
                key={broker.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                onPress={() => onToggleBroker(broker.id)}
                style={[styles.platformOption, active && styles.optionActive]}
              >
                <View style={styles.platformTopline}>
                  <View style={styles.platformCode}>
                    <Text style={styles.platformCodeText}>{broker.code}</Text>
                  </View>
                  <View style={styles.platformTitleCopy}>
                    <Text
                      style={[
                        styles.platformName,
                        active && styles.optionTitleActive,
                      ]}
                    >
                      {broker.name}
                    </Text>
                    <Text style={styles.platformAccount}>
                      {text(
                        "客户本人账户",
                        "Client-owned account",
                        "حساب مملوك للعميل",
                      )}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={active ? "check-box" : "check-box-outline-blank"}
                    size={19}
                    color={active ? V2.gold : V2.textDim}
                  />
                </View>
                <Text style={styles.modeDetail}>{broker.detail}</Text>
                <View style={styles.brokerLinks}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={(event) => {
                      event.stopPropagation();
                      void Linking.openURL(broker.signupUrl);
                    }}
                    style={styles.brokerLink}
                  >
                    <Text style={styles.brokerLinkText}>
                      {text(
                        "官方开户 · 官方站点",
                        "Official onboarding · Broker site",
                        "فتح رسمي · موقع الوسيط",
                      )}
                    </Text>
                    <MaterialIcons
                      name="open-in-new"
                      size={13}
                      color={V2.gold}
                    />
                  </Pressable>
                  {onboardingMode === "PLATFORM_ASSISTED" ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={(event) => {
                        event.stopPropagation();
                        void Linking.openURL(broker.managementUrl);
                      }}
                      style={styles.brokerLink}
                    >
                      <Text style={styles.brokerLinkText}>
                        {text(
                          "资管通道说明/申请 · 官方站点",
                          "Managed channel guide/application · Official site",
                          "دليل/طلب قناة الإدارة · الموقع الرسمي",
                        )}
                      </Text>
                      <MaterialIcons
                        name="open-in-new"
                        size={13}
                        color={V2.gold}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="05"
        icon="link"
        title={text(
          "选择接入方式",
          "Choose onboarding mode",
          "اختر طريقة الربط",
        )}
        detail={text(
          "两种方式只改变开户与授权协助范围，不改变资金路径。",
          "The two modes change the scope of onboarding and authorization support, not ownership of funds.",
          "يغيّر النمطان نطاق المساعدة في فتح الحساب والتفويض، ولا يغيران ملكية الأموال.",
        )}
      >
        <View style={[styles.modeOptions, isMobile && styles.stackRow]}>
          {onboardingOptions.map((option) => {
            const active = option.id === onboardingMode;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => onOnboardingModeChange(option.id)}
                style={[styles.modeOption, active && styles.optionActive]}
              >
                <View style={styles.modeTopline}>
                  <MaterialIcons
                    name={
                      active ? "radio-button-checked" : "radio-button-unchecked"
                    }
                    size={20}
                    color={active ? V2.gold : V2.textMuted}
                  />
                  <Text
                    style={[
                      styles.modeTitle,
                      active && styles.optionTitleActive,
                    ]}
                  >
                    {option.title}
                  </Text>
                  <View style={styles.modeBadge}>
                    <Text style={styles.modeBadgeText}>{option.badge}</Text>
                  </View>
                </View>
                <Text style={styles.modeDetail}>{option.detail}</Text>
              </Pressable>
            );
          })}
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="06"
        icon="currency-exchange"
        title={text(
          "选择 USDT 入金路线",
          "Choose a USDT funding route",
          "اختر مسار إيداع USDT",
        )}
        detail={text(
          "入金路线不改变资管服务本身；平台专属地址代收仅用于平台协助接入的单笔代收单。",
          "The funding route does not change the managed service. A platform collection address is used only for a single assisted collection order.",
          "لا يغير مسار الإيداع خدمة الإدارة. يُستخدم عنوان تحصيل المنصة فقط لطلب تحصيل واحد ضمن الربط المساعد.",
        )}
        last
      >
        <View style={[styles.modeOptions, isMobile && styles.stackRow]}>
          {fundingPathOptions.map((option) => {
            const assistedOnly = option.id === "PLATFORM_COLLECTION";
            const allSelectedCollectionApproved = brokerIds.every(
              (id) => collectionApprovals[id] === "APPROVED",
            );
            const disabled =
              assistedOnly &&
              (onboardingMode !== "PLATFORM_ASSISTED" ||
                !allSelectedCollectionApproved);
            const active = option.id === fundingPath;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active, disabled }}
                disabled={disabled}
                onPress={() => onFundingPathChange(option.id)}
                style={[
                  styles.modeOption,
                  active && styles.optionActive,
                  disabled && styles.disabled,
                ]}
              >
                <View style={styles.modeTopline}>
                  <MaterialIcons
                    name={
                      active ? "radio-button-checked" : "radio-button-unchecked"
                    }
                    size={20}
                    color={active ? V2.gold : V2.textMuted}
                  />
                  <Text
                    style={[
                      styles.modeTitle,
                      active && styles.optionTitleActive,
                    ]}
                  >
                    {option.title}
                  </Text>
                  <View style={styles.modeBadge}>
                    <Text style={styles.modeBadgeText}>
                      {disabled
                        ? onboardingMode !== "PLATFORM_ASSISTED"
                          ? text(
                              "需平台协助",
                              "Assisted setup required",
                              "يتطلب ربطا مساعدا",
                            )
                          : text(
                              "合规复核中",
                              "Compliance review",
                              "قيد مراجعة الامتثال",
                            )
                        : option.badge}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modeDetail}>{option.detail}</Text>
                {assistedOnly ? (
                  <Text style={styles.preparingNote}>
                    {allSelectedCollectionApproved
                      ? text(
                          "该券商代收通道已获书面放行；每笔仍需生成专属代收单并完成动态验证与独立对账。",
                          "This broker collection route has written approval. Every transfer still requires a dedicated order, dynamic verification and separate reconciliation.",
                          "حصل مسار التحصيل لهذا الوسيط على موافقة مكتوبة. ما زالت كل عملية تتطلب طلبا مخصصا وتحققا ديناميكيا ومطابقة مستقلة.",
                        )
                      : text(
                          "平台企业钱包待配置 / 通道书面确认、动态验证或企业钱包服务尚未就绪，当前不可生成代收地址。",
                          "The company wallet or route approval is not ready. A collection address cannot be generated yet.",
                          "محفظة الشركة أو موافقة المسار غير جاهزة، لذلك لا يمكن إنشاء عنوان تحصيل حاليا.",
                        )}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.permissionBoundary, { marginTop: 10 }]}>
          <MaterialIcons name="shield" size={19} color={V2.green} />
          <View style={styles.permissionCopy}>
            <Text style={styles.permissionTitle}>
              {text(
                "资金与权限边界",
                "Funds and permission boundary",
                "حدود الأموال والصلاحيات",
              )}
            </Text>
            <Text style={styles.permissionDetail}>
              {text(
                "直充时，客户钱包 → 客户本人券商账户；代收时仅使用该笔订单的专属地址，核对后再转入客户本人券商账户。项目方只申请约定交易权限，无提款权；平台不展示全局共用地址，私钥不进入业务系统。",
                "With direct funding: client wallet → client-owned broker account. Collection uses only the order's dedicated address before forwarding to that broker account. The provider requests agreed trading permission only, never withdrawal rights. No shared global address is shown and private keys never enter the business system.",
                "في الإيداع المباشر: محفظة العميل ← حسابه الشخصي لدى الوسيط. يستخدم التحصيل عنوان الطلب المخصص فقط قبل التحويل إلى حساب الوسيط. يطلب المزود صلاحية التداول المتفق عليها فقط دون حق السحب، ولا يظهر عنوان مشترك أو تدخل المفاتيح الخاصة إلى النظام.",
              )}
            </Text>
          </View>
        </View>
      </ConfiguratorStep>
    </View>
  );
}

function ConfiguratorStep({
  index,
  icon,
  title,
  detail,
  last = false,
  children,
}: {
  index: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  detail: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.step, last && styles.stepLast]}>
      <View style={styles.stepHeading}>
        <Text style={styles.stepIndex}>{index}</Text>
        <MaterialIcons name={icon} size={18} color={V2.gold} />
        <View style={styles.stepHeadingCopy}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepDetail}>{detail}</Text>
        </View>
      </View>
      <View style={styles.stepBody}>{children}</View>
    </View>
  );
}
