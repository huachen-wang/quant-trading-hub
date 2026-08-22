import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { CoreStrategy, PlatformProfile } from "@/shared/v2/contracts";
import type { AllocationBucket } from "@/lib/v2/allocation-types";
import { clamp, rebalanceBucket } from "@/lib/v2/allocation";
import { formatMoney } from "../format";
import { StatusBadge } from "../status-badge";
import { V2 } from "../tokens";
import { Stepper } from "./stepper";

export function PlatformBucketEditor({
  bucket,
  platform,
  strategies,
  totalCapital,
  currency,
  onChange,
  onRemove,
}: {
  bucket: AllocationBucket;
  platform: PlatformProfile;
  strategies: CoreStrategy[];
  totalCapital: number;
  currency: string;
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
    onChange(
      rebalanceBucket({
        ...bucket,
        strategies: [
          ...bucket.strategies,
          { strategyId, weightPct: 0, riskMultiplier: 0.8 },
        ],
      }),
    );
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

  return (
    <View style={styles.bucket}>
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
  header: { minHeight: 76, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, borderBottomWidth: 1, borderBottomColor: V2.border },
  headerMobile: { alignItems: "flex-start", flexDirection: "column" },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  code: { width: 42, height: 42, borderWidth: 1, borderColor: "rgba(216,188,131,0.4)", borderRadius: 4, backgroundColor: "rgba(216,188,131,0.07)", alignItems: "center", justifyContent: "center" },
  codeText: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  identityCopy: { minWidth: 130, flex: 1, gap: 3 },
  name: { color: V2.text, fontSize: 14, fontWeight: "900" },
  meta: { color: V2.textMuted, fontSize: 9 },
  headerControls: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  removeBucket: { width: 36, height: 34, borderWidth: 1, borderColor: "rgba(240,122,116,0.3)", borderRadius: 4, alignItems: "center", justifyContent: "center" },
  capitalLine: { minHeight: 42, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: V2.surfaceMuted, borderBottomWidth: 1, borderBottomColor: V2.border },
  capitalLabel: { color: V2.textDim, fontSize: 9 },
  capitalValue: { color: V2.text, fontSize: 11, fontWeight: "900" },
  capitalMeta: { marginLeft: "auto", color: V2.textDim, fontSize: 9 },
  strategyRows: {},
  strategyRow: { minHeight: 84, padding: 13, flexDirection: "row", alignItems: "center", gap: 16, borderBottomWidth: 1, borderBottomColor: V2.border },
  strategyRowMobile: { alignItems: "flex-start", flexDirection: "column" },
  strategyIdentity: { minWidth: 190, flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  strategyRail: { width: 3, height: 34 },
  strategyCopy: { flex: 1, minWidth: 0, gap: 4 },
  strategyName: { color: V2.text, fontSize: 13, fontWeight: "900" },
  strategyMeta: { color: V2.textMuted, fontSize: 9 },
  strategyControls: { flexDirection: "row", alignItems: "flex-end", gap: 7, flexWrap: "wrap" },
  removeStrategy: { width: 34, height: 34, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  addRow: { padding: 13, gap: 9 },
  addLabel: { color: V2.textDim, fontSize: 9, fontWeight: "800" },
  addOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  addButton: { minHeight: 31, paddingHorizontal: 9, borderWidth: 1, borderColor: V2.border, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  addButtonText: { color: V2.textMuted, fontSize: 10, fontWeight: "700" },
  disabled: { opacity: 0.32 },
  pressed: { opacity: 0.68 },
});
