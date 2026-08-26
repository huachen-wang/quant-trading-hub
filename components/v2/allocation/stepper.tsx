import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "@/lib/language";
import { V2 } from "../tokens";

export function Stepper({
  label,
  value,
  suffix = "%",
  onDecrease,
  onIncrease,
  compact = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
}) {
  const { text } = useLanguage();
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.control}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text(
            `减少${label}`,
            `Decrease ${label}`,
            `تقليل ${label}`,
          )}
          onPress={onDecrease}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <MaterialIcons name="remove" size={16} color={V2.text} />
        </Pressable>
        <Text style={styles.value}>
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text(
            `增加${label}`,
            `Increase ${label}`,
            `زيادة ${label}`,
          )}
          onPress={onIncrease}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <MaterialIcons name="add" size={16} color={V2.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 146, gap: 5 },
  wrapCompact: { minWidth: 132 },
  label: { color: V2.textDim, fontSize: 10, fontWeight: "700" },
  control: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  button: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: V2.surfaceMuted,
  },
  value: {
    minWidth: 62,
    flex: 1,
    color: V2.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  pressed: { opacity: 0.65 },
});
