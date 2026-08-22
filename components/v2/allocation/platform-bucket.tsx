import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { CoreStrategy, PlatformProfile } from "@/shared/v2/contracts";
import type { AllocationBucket } from "@/lib/v2/allocation-types";
import { appendStrategyToBucket, clamp, rebalanceBucket } from "@/lib/v2/allocation";
import { formatMoney } from "../format";
import { StatusBadge } from "../status-badge";
import { V2 } from "../tokens";
import { Stepper } from "./stepper";

export type BucketDropStatus = {
  tone: "valid" | "invalid" | "success" | "reject";
  message: string;
};

const DROP_TONE = {
  valid: { color: V2.green, icon: "add-circle-outline" },
  invalid: { color: V2.red, icon: "block" },
  success: { color: V2.green, icon: "check-circle" },
  reject: { color: V2.red, icon: "error-outline" },
} as const;

export function PlatformBucketEditor({
  bucket,
  platform,
  strategies,
  totalCapital,
  currency,
  dropStatus = null,
  onChange,
  onRemove,
}: {
  bucket: AllocationBucket;
  platform: PlatformProfile;
  strategies: CoreStrategy[];
  totalCapital: number;
  currency: string;
  dropStatus?: BucketDropStatus | null;
  onChange: (next: AllocationBucket) => void;
  onRemove: () => void;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const selectedIds = new Set(bucket.strategies.map((item) => item.strategyId));
  const available = strategies.filter(
    (strategy) =>
      platform.supportedStrategyIds.includes(strategy.id) &&
      !selectedIds.has(strategy.id) &&
      strategy.source.freshness !== "OFFLINE",
  );
  const bucketCapital = (totalCapital * bucket.capitalWeightPct) / 100;

  const updateStrategy = (
    strategyId: string,
    updater: (current: AllocationBucket["strategies"][number]) => AllocationBucket["strategies"][number],
  ) => {
    onChange({
      ...bucket,
      strategies: bucket.strategies.map((item) =>
        item.strategyId === strategyId ? updater(item) : item,
      ),
    });
  };

  const addStrategy = (strategyId: string) => {
    onChange(appendStrategyToBucket(bucket, strategyId));
  };

  const removeStrategy = (strategyId: string) => {
    if (bucket.strategies.length <= 1) return;
    onChange(
      rebalanceBucket({
        ...bucket,
        strategies: bucket.strategies.filter(
          (item) => item.strategyId !== strategyId,
        ),
      }),
    );
  };

  const dropTone = dropStatus ? DROP_TONE[dropStatus.tone] : null;

  return (
    <View style={[styles.bucket, dropTone && { borderColor: `${dropTone.color}88` }]}>
      {dropStatus && dropTone ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.dropBanner, { backgroundColor: `${dropTone.color}10` }]}
        >
          <MaterialIcons name={dropTone.icon} size={15} color={dropTone.color} />
          <Text style={[styles.dropBannerText, { color: dropTone.color }]}>
            {dropStatus.message}
          </Text>
        </View>
      ) : null}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.identity}>
          <View style={styles.code}><Text style={styles.codeText}>{platform.code}</Text></View>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{platform.name}</Text>
            <Text style={styles.meta}>{platform.accountType} · {platform.terminals.join("/")}</Text>
          </View>
          <StatusBadge compact dataMode={platform.source.dataMode} freshness={platform.source.freshness} />
        </View>
        <View style={styles.headerControls}>
          <Stepper
            compact
            label="平台资金权重"
            value={bucket.capitalWeightPct}
            onDecrease={() => onChange({ ...bucket, capitalWeightPct: clamp(bucket.capitalWeightPct - 5, 5, 100) })}
            onIncrease={() => onChange({ ...bucket, capitalWeightPct: clamp(bucket.capitalWeightPct + 5, 5, 100) })}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`移除 ${platform.name}`}
            onPress={onRemove}
            style={({ pressed }) => [styles.removeBucket, pressed && styles.pressed]}
          >
            <MaterialIcons name="delete-outline" size={19} color={V2.red} />
          </Pressable>
        </View>
      </View>

      <View style={styles.capitalLine}>
        <Text style={styles.capitalLabel}>模拟分配资金</Text>
        <Text style={styles.capitalValue}>{formatMoney(bucketCapital, currency)}</Text>
        <Text style={styles.capitalMeta}>平台门槛 {formatMoney(platform.minimumCapital, currency, true)}</Text>
      </View>

      <View style={styles.strategyRows}>
        {bucket.strategies.map((allocation) => {
          const strategy = strategies.find((item) => item.id === allocation.strategyId);
          if (!strategy) return null;
          return (
            <View key={allocation.strategyId} style={[styles.strategyRow, isMobile && styles.strategyRowMobile]}>
              <View style={styles.strategyIdentity}>
                <View style={[styles.strategyRail, { backgroundColor: strategy.accent }]} />
                <View style={styles.strategyCopy}>
                  <Text style={styles.strategyName}>{strategy.shortName}</Text>
                  <Text style={styles.strategyMeta}>{strategy.style} · {strategy.riskLevel === "LOW" ? "低" : strategy.riskLevel === "MEDIUM" ? "中" : "高"}风险</Text>
                </View>
              </View>
              <View style={styles.strategyControls}>
                <Stepper
                  compact
                  label="桶内权重"
                  value={allocation.weightPct}
                  onDecrease={() => updateStrategy(allocation.strategyId, (current) => ({ ...current, weightPct: clamp(current.weightPct - 5, 0, 100) }))}
                  onIncrease={() => updateStrategy(allocation.strategyId, (current) => ({ ...current, weightPct: clamp(current.weightPct + 5, 0, 100) }))}
                />
                <Stepper
                  compact
                  label="风险倍率"
                  value={allocation.riskMultiplier}
                  suffix="x"
                  onDecrease={() => updateStrategy(allocation.strategyId, (current) => ({ ...current, riskMultiplier: clamp(Number((current.riskMultiplier - 0.1).toFixed(2)), 0.25, 2) }))}
                  onIncrease={() => updateStrategy(allocation.strategyId, (current) => ({ ...current, riskMultiplier: clamp(Number((current.riskMultiplier + 0.1).toFixed(2)), 0.25, 2) }))}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`移除 ${strategy.shortName}`}
                  disabled={bucket.strategies.length <= 1}
                  onPress={() => removeStrategy(allocation.strategyId)}
                  style={({ pressed }) => [styles.removeStrategy, bucket.strategies.length <= 1 && styles.disabled, pressed && styles.pressed]}
                >
                  <MaterialIcons name="close" size={17} color={V2.textMuted} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {available.length ? (
        <View style={styles.addRow}>
          <Text style={styles.addLabel}>添加兼容策略</Text>
          <View style={styles.addOptions}>
            {available.map((strategy) => (
              <Pressable
                key={strategy.id}
                accessibilityRole="button"
                onPress={() => addStrategy(strategy.id)}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <MaterialIcons name="add" size={15} color={strategy.accent} />
                <Text style={styles.addButtonText}>{strategy.shortName}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bucket: { borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: V2.backgroundRaised, overflow: "hidden" },
  dropBanner: { minHeight: 30, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, borderBottomWidth: 1, borderBottomColor: V2.border },
  dropBannerText: { fontSize: 11, fontWeight: "800" },
  header: { minHeight: 76, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, borderBottomWidth: 1, borderBottomColor: V2.border },
  headerMobile: { alignItems: "flex-start", flexDirection: "column" },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  code: { width: 42, height: 42, borderWidth: 1, borderColor: "rgba(216,188,131,0.4)", borderRadius: 4, backgroundColor: "rgba(216,188,131,0.07)", alignItems: "center", justifyContent: "center" },
  codeText: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  identityCopy: { minWidth: 130, flex: 1, gap: 3 },
  name: { color: V2.text, fontSize: 14, fontWeight: "900" },
  meta: { color: V2.textMuted, fontSize: 10 },
  headerControls: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  removeBucket: { width: 36, height: 34, borderWidth: 1, borderColor: "rgba(240,122,116,0.3)", borderRadius: 4, alignItems: "center", justifyContent: "center" },
  capitalLine: { minHeight: 42, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: V2.surfaceMuted, borderBottomWidth: 1, borderBottomColor: V2.border },
  capitalLabel: { color: V2.textDim, fontSize: 10 },
  capitalValue: { color: V2.text, fontSize: 12, fontWeight: "900" },
  capitalMeta: { marginLeft: "auto", color: V2.textDim, fontSize: 10 },
  strategyRows: {},
  strategyRow: { minHeight: 84, padding: 13, flexDirection: "row", alignItems: "center", gap: 16, borderBottomWidth: 1, borderBottomColor: V2.border },
  strategyRowMobile: { alignItems: "flex-start", flexDirection: "column" },
  strategyIdentity: { minWidth: 190, flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  strategyRail: { width: 3, height: 34 },
  strategyCopy: { flex: 1, minWidth: 0, gap: 4 },
  strategyName: { color: V2.text, fontSize: 13, fontWeight: "900" },
  strategyMeta: { color: V2.textMuted, fontSize: 10 },
  strategyControls: { flexDirection: "row", alignItems: "flex-end", gap: 7, flexWrap: "wrap" },
  removeStrategy: { width: 34, height: 34, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  addRow: { padding: 13, gap: 9 },
  addLabel: { color: V2.textDim, fontSize: 10, fontWeight: "800" },
  addOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  addButton: { minHeight: 34, paddingHorizontal: 10, borderWidth: 1, borderColor: V2.border, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  addButtonText: { color: V2.textMuted, fontSize: 11, fontWeight: "700" },
  disabled: { opacity: 0.32 },
  pressed: { opacity: 0.68 },
});
