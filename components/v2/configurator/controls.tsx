import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { formatAnnualizedReturn, formatPct } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import type { CoreStrategy, PlatformProfile } from "@/shared/v2/contracts";
import { styles } from "./styles";
import {
  CAPITAL_PRESETS,
  EXIT_MODE_OPTIONS,
  FUNDING_ROUTE_OPTIONS,
  RISK_OPTIONS,
  SESSION_DURATION_OPTIONS,
  type ExitMode,
  type FundingRoute,
  type ManagedSessionDuration,
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
  selectedStrategyIds,
  onToggleStrategy,
  platforms,
  selectedPlatformIds,
  onTogglePlatform,
  durationDays,
  onDurationDaysChange,
  exitMode,
  onExitModeChange,
  fundingRoutes,
  onToggleFundingRoute,
  vaultActivationEnabled,
}: {
  isMobile: boolean;
  capital: string;
  numericCapital: number;
  onCapitalChange: (value: string) => void;
  riskProfile: RiskProfile;
  onRiskProfileChange: (value: RiskProfile) => void;
  strategies: CoreStrategy[];
  selectedStrategyIds: string[];
  onToggleStrategy: (strategyId: string) => void;
  platforms: PlatformProfile[];
  selectedPlatformIds: string[];
  onTogglePlatform: (platformId: string) => void;
  durationDays: ManagedSessionDuration;
  onDurationDaysChange: (value: ManagedSessionDuration) => void;
  exitMode: ExitMode;
  onExitModeChange: (value: ExitMode) => void;
  fundingRoutes: FundingRoute[];
  onToggleFundingRoute: (value: FundingRoute) => void;
  vaultActivationEnabled: boolean;
}) {
  const [capitalFocused, setCapitalFocused] = useState(false);

  return (
    <View style={styles.controls}>
      <ConfiguratorStep
        index="01"
        icon="account-balance-wallet"
        title="USDT 名义资金"
        detail="用于生成资管会话草案，并检查策略门槛、券商门槛与集中度。"
      >
        <View style={[styles.capitalRow, isMobile && styles.stackRow]}>
          <View
            style={[
              styles.moneyInput,
              capitalFocused && styles.moneyInputFocused,
            ]}
          >
            <Text style={styles.moneyPrefix}>$</Text>
            <TextInput
              accessibilityLabel="方案资金规模"
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
                  {amount >= 10_000 ? `${amount / 10_000} 万` : amount}
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
        detail="先设最大回撤预算，再决定策略风险倍率。"
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
        title="六策略资管组合"
        detail={`已纳入 ${selectedStrategyIds.length} / 6 款。离线策略可保留在 DRAFT，但会阻断激活。`}
      >
        <View style={styles.strategyOptions}>
          {strategies.map((strategy) => {
            const active = selectedStrategyIds.includes(strategy.id);
            const disabled = strategy.source.freshness === "OFFLINE";
            return (
              <Pressable
                key={strategy.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active, disabled }}
                disabled={disabled}
                onPress={() => onToggleStrategy(strategy.id)}
                style={[
                  styles.strategyOption,
                  active && styles.optionActive,
                  disabled && styles.disabled,
                ]}
              >
                <View
                  style={[
                    styles.strategyRail,
                    { backgroundColor: strategy.accent },
                  ]}
                />
                <View style={styles.strategyOptionCopy}>
                  <Text
                    style={[
                      styles.strategyName,
                      active && styles.optionTitleActive,
                    ]}
                  >
                    {strategy.shortName}
                  </Text>
                  <Text style={styles.strategyMeta} numberOfLines={1}>
                    年化 {formatAnnualizedReturn(strategy.metrics.return90dPct)}{" "}
                    · 回撤 {formatPct(strategy.metrics.maxDrawdownPct)}
                  </Text>
                </View>
                <MaterialIcons
                  name={
                    active
                      ? "check-circle"
                      : disabled
                        ? "cloud-off"
                        : "add-circle-outline"
                  }
                  size={19}
                  color={active ? V2.gold : V2.textDim}
                />
              </Pressable>
            );
          })}
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="04"
        icon="account-balance"
        title="券商执行槽"
        detail="选择 1–2 个券商执行槽；同一会话聚合展示净值与风险。"
      >
        <View style={styles.platformOptions}>
          {platforms.map((platform) => {
            const active = selectedPlatformIds.includes(platform.id);
            return (
              <Pressable
                key={platform.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                onPress={() => onTogglePlatform(platform.id)}
                style={[styles.platformOption, active && styles.optionActive]}
              >
                <View style={styles.platformTopline}>
                  <View style={styles.platformCode}>
                    <Text style={styles.platformCodeText}>{platform.code}</Text>
                  </View>
                  <View style={styles.platformTitleCopy}>
                    <Text
                      style={[
                        styles.platformName,
                        active && styles.optionTitleActive,
                      ]}
                    >
                      {platform.name}
                    </Text>
                    <Text style={styles.platformAccount}>
                      {platform.accountType}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={active ? "check-circle" : "add-circle-outline"}
                    size={19}
                    color={active ? V2.gold : V2.textDim}
                  />
                </View>
                <View style={styles.platformFacts}>
                  <Text style={styles.platformFact} numberOfLines={1}>
                    {platform.commercialTerms.spreadLabel}
                  </Text>
                  <Text style={styles.platformFact} numberOfLines={1}>
                    {platform.commercialTerms.commissionLabel}
                  </Text>
                  <Text style={styles.platformFact}>
                    出金样本 P50{" "}
                    {platform.commercialTerms.withdrawalP50Hours ?? "--"}h
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="05"
        icon="schedule"
        title="限时资管会话"
        detail="资管权限按期限生效；可随时申请结束，并按预选方式处理持仓。"
      >
        <View style={styles.sessionGroup}>
          <View style={[styles.durationOptions, isMobile && styles.stackRow]}>
            {SESSION_DURATION_OPTIONS.map((option) => (
              <ChoiceOption
                key={option.id}
                active={durationDays === option.id}
                title={option.title}
                detail={option.detail}
                onPress={() => onDurationDaysChange(option.id)}
              />
            ))}
          </View>
          <View style={styles.permissionBoundary}>
            <MaterialIcons name="vpn-key" size={19} color={V2.green} />
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>交易权限不含出金</Text>
              <Text style={styles.permissionDetail}>
                项目方可按合同执行开仓、平仓与风控；不获得出金、转账或修改收款地址权限。
              </Text>
            </View>
          </View>
          <View style={styles.exitBlock}>
            <Text style={styles.subsectionLabel}>结束会话时</Text>
            <View style={[styles.modeOptions, isMobile && styles.stackRow]}>
              {EXIT_MODE_OPTIONS.map((option) => (
                <ChoiceOption
                  key={option.id}
                  active={exitMode === option.id}
                  title={option.title}
                  detail={option.detail}
                  onPress={() => onExitModeChange(option.id)}
                />
              ))}
            </View>
          </View>
        </View>
      </ConfiguratorStep>

      <ConfiguratorStep
        index="06"
        icon="currency-exchange"
        title="USDT 资金路由"
        detail="直达券商与 Managed Vault 属于同一资管会话；可单选，也可混合。"
        last
      >
        <View style={[styles.modeOptions, isMobile && styles.stackRow]}>
          {FUNDING_ROUTE_OPTIONS.map((option) => (
            <FundingRouteOption
              key={option.id}
              active={fundingRoutes.includes(option.id)}
              title={option.title}
              badge={
                option.id === "MANAGED_VAULT" && vaultActivationEnabled
                  ? "能力已开启"
                  : option.badge
              }
              status={
                option.id === "MANAGED_VAULT" && vaultActivationEnabled
                  ? "ACTIVE"
                  : option.status
              }
              detail={option.detail}
              preparingNote={option.id === "MANAGED_VAULT"}
              onPress={() => onToggleFundingRoute(option.id)}
            />
          ))}
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

function ChoiceOption({
  active,
  title,
  detail,
  onPress,
}: {
  active: boolean;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.choiceOption, active && styles.optionActive]}
    >
      <View style={styles.choiceTopline}>
        <MaterialIcons
          name={active ? "radio-button-checked" : "radio-button-unchecked"}
          size={17}
          color={active ? V2.gold : V2.textDim}
        />
        <Text style={[styles.choiceTitle, active && styles.optionTitleActive]}>
          {title}
        </Text>
      </View>
      <Text style={styles.choiceDetail}>{detail}</Text>
    </Pressable>
  );
}

function FundingRouteOption({
  active,
  title,
  badge,
  status,
  detail,
  preparingNote,
  onPress,
}: {
  active: boolean;
  title: string;
  badge: string;
  status: "ACTIVE" | "PREPARING";
  detail: string;
  preparingNote: boolean;
  onPress: () => void;
}) {
  const accent = status === "ACTIVE" ? V2.green : V2.amber;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.modeOption, active && styles.optionActive]}
    >
      <View style={styles.modeTopline}>
        <MaterialIcons
          name={active ? "check-box" : "check-box-outline-blank"}
          size={20}
          color={active ? V2.gold : V2.textMuted}
        />
        <Text style={[styles.modeTitle, active && styles.optionTitleActive]}>
          {title}
        </Text>
        <View style={[styles.modeBadge, { borderColor: `${accent}66` }]}>
          <Text style={[styles.modeBadgeText, { color: accent }]}>{badge}</Text>
        </View>
      </View>
      <Text style={styles.modeDetail}>{detail}</Text>
      {preparingNote ? (
        <Text style={styles.preparingNote}>
          {status === "ACTIVE"
            ? "能力开关已开启；每个执行槽仍需逐一完成钱包、托管、合约与授权核验。"
            : "可纳入混合方案；未配置钱包与合约前只作路由预留，不会执行入金。"}
        </Text>
      ) : null}
    </Pressable>
  );
}
