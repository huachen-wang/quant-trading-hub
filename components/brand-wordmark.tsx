import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type BrandWordmarkProps = {
  size?: "sm" | "md" | "lg";
  align?: "left" | "center";
  style?: StyleProp<ViewStyle>;
};

const SIZE_MAP = {
  sm: { fontSize: 23, lineHeight: 28 },
  md: { fontSize: 30, lineHeight: 35 },
  lg: { fontSize: 44, lineHeight: 50 },
};

export function BrandWordmark({
  size = "md",
  align = "left",
  style,
}: BrandWordmarkProps) {
  const metrics = SIZE_MAP[size];

  return (
    <View style={[styles.root, align === "center" && styles.center, style]}>
      <Text
        accessibilityRole="text"
        accessibilityLabel="EAXAU"
        selectable={false}
        style={[styles.word, metrics]}
      >
        EAX<Text style={styles.accent}>AU</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
  },
  word: {
    color: "#F8FAFC",
    fontWeight: "900",
    letterSpacing: 0,
  },
  accent: {
    color: "#D8BC83",
  },
});
