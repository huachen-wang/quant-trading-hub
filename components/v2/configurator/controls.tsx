import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { formatPct } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import type { CoreStrategy, PlatformProfile } from "@/shared/v2/contracts";
import { styles } from "./styles";
import {
  CAPITAL_PRESETS,
  RISK_OPTIONS,
  type RiskProfile,
  type ServicePath,
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
  servicePath,
  onServicePathChange,
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
  servicePath: ServicePath;
  onServicePathChange: (value: ServicePath) => void;
}) {
  const [capitalFocused, setCapitalFocused] = useState(false);

  return (
    <View style={styles.controls}>
      <ConfiguratorStep
        index="01"
        icon="account-balance-wallet"
        title="资金规模"
        detail="用于检查策略门槛、平台门槛和组合集中度。"
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
            <Text style={styles.currency}>USD</Text>
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
        title="策略组合"
        detail={`已同步 ${selectedStrategyIds.length} 款；离线策略不会进入方案。`}
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
                    90D {formatPct(strategy.metrics.return90dPct, true)} · 回撤{" "}
                    {formatPct(strategy.metrics.maxDrawdownPct)}
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
        title="交易平台"
        detail="比较点差、佣金、执行和出金样本，再确定资金放在哪里。"
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
        icon="tune"
        title="管理模式"
        detail="模式决定资金归属、交易执行和双方责任边界。"
        last
      >
        <View style={[styles.modeOptions, isMobile && styles.stackRow]}>
          <ModeOption
            active={servicePath === "BROKER"}
            icon="account-balance"
            title="券商模式"
            badge="资金在本人账户"
            detail="资金直接留在用户本人券商账户，不经过技术方；用户掌握入出金，系统负责策略接入、组合配置与风险观察。"
            onPress={() => onServicePathChange("BROKER")}
          />
          <ModeOption
            active={servicePath === "MANAGED"}
            icon="supervisor-account"
            title="资管模式"
            badge="技术方代操管理"
            detail="用户与技术方按约定签订合同，由技术方负责策略部署、交易执行和风险管理；用户在平台查看净值、持仓与回撤。"
            onPress={() => onServicePathChange("MANAGED")}
          />
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

function ModeOption({
  active,
  icon,
  title,
  badge,
  detail,
  onPress,
}: {
  active: boolean;
  icon: ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  badge: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.modeOption, active && styles.optionActive]}
    >
      <View style={styles.modeTopline}>
        <MaterialIcons
          name={icon}
          size={20}
          color={active ? V2.gold : V2.textMuted}
        />
        <Text style={[styles.modeTitle, active && styles.optionTitleActive]}>
          {title}
        </Text>
        <View style={[styles.modeBadge, active && styles.modeBadgeActive]}>
          <Text
            style={[styles.modeBadgeText, active && styles.modeBadgeTextActive]}
          >
            {badge}
          </Text>
        </View>
      </View>
      <Text style={styles.modeDetail}>{detail}</Text>
    </Pressable>
  );
}
