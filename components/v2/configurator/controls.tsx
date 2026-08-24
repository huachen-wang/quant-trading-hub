import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { formatAnnualizedReturn, formatPct } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import type { CoreStrategy } from "@/shared/v2/contracts";
import { styles } from "./styles";
import {
  ALLIANCE_BROKERS,
  CAPITAL_PRESETS,
  FUNDING_PATH_OPTIONS,
  ONBOARDING_OPTIONS,
  RISK_OPTIONS,
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

  return (
    <View style={styles.controls}>
      <ConfiguratorStep
        index="01"
        icon="account-balance-wallet"
        title="计划投入资金"
        detail="用于测算组合门槛与风险预算；此处不收款，也不会生成平台收款地址。"
      >
        <View style={[styles.capitalRow, isMobile && styles.stackRow]}>
          <View
            style={[
              styles.moneyInput,
              capitalFocused && styles.moneyInputFocused,
            ]}
          >
            <TextInput
              accessibilityLabel="计划投入 USDT"
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
                  {amount >= 10_000 ? `${amount / 10_000} 万 U` : `${amount} U`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="02"
        icon="verified-user"
        title="账户风控"
        detail="先设最大回撤预算，再进入开户、授权与入金流程。"
      >
        <View style={[styles.riskOptions, isMobile && styles.stackRow]}>
          {RISK_OPTIONS.map((option) => {
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
        title={`已选策略组合（${strategies.length} / 6）`}
        detail="平台固定提供 6 款可选策略，单个方案可选 1–6 款；权重在下一步设置。离线或模拟数据保留准确标签。"
      >
        <View style={styles.strategyOptions}>
          {!strategies.length ? (
            <Text style={styles.modeDetail}>请先在上方六款策略中至少选择 1 款。</Text>
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
                    年化 {formatAnnualizedReturn(strategy.metrics.return90dPct)} ·
                    回撤 {formatPct(strategy.metrics.maxDrawdownPct)}
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
        title="选择券商接入通道"
        detail="当前可选 Exness、IC Markets 与 Blueberry Markets；不代表券商官方背书，具体实体、地区与入金能力须在开户时核验。"
      >
        <View style={styles.platformOptions}>
          {ALLIANCE_BROKERS.map((broker) => {
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
                    <Text style={styles.platformAccount}>客户本人账户</Text>
                  </View>
                  <MaterialIcons
                    name={
                      active ? "check-box" : "check-box-outline-blank"
                    }
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
                    <Text style={styles.brokerLinkText}>官方开户 · 官方站点</Text>
                    <MaterialIcons name="open-in-new" size={13} color={V2.gold} />
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
                        资管通道说明/申请 · 官方站点
                      </Text>
                      <MaterialIcons name="open-in-new" size={13} color={V2.gold} />
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
        title="选择接入方式"
        detail="两种方式只改变开户与授权协助范围，不改变资金路径。"
      >
        <View style={[styles.modeOptions, isMobile && styles.stackRow]}>
          {ONBOARDING_OPTIONS.map((option) => {
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
        title="选择 USDT 入金路线"
        detail="入金路线不改变资管服务本身；平台专属地址代收仅用于平台协助接入的单笔代收单。"
        last
      >
        <View style={[styles.modeOptions, isMobile && styles.stackRow]}>
          {FUNDING_PATH_OPTIONS.map((option) => {
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
                          ? "需平台协助"
                          : "合规复核中"
                        : option.badge}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modeDetail}>{option.detail}</Text>
                {assistedOnly ? (
                  <Text style={styles.preparingNote}>
                    {allSelectedCollectionApproved
                      ? "该券商代收通道已获书面放行；每笔仍需生成专属代收单并完成动态验证与独立对账。"
                      : "平台企业钱包待配置 / 通道书面确认、动态验证或企业钱包服务尚未就绪，当前不可生成代收地址。"}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.permissionBoundary, { marginTop: 10 }]}>
          <MaterialIcons name="shield" size={19} color={V2.green} />
          <View style={styles.permissionCopy}>
            <Text style={styles.permissionTitle}>资金与权限边界</Text>
            <Text style={styles.permissionDetail}>
              直充时，客户钱包 → 客户本人券商账户；代收时仅使用该笔订单的专属地址，
              核对后再转入客户本人券商账户。项目方只申请约定交易权限，无提款权；
              平台不展示全局共用地址，私钥不进入业务系统。
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
