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
        accessibilityLabel="AI量化联盟"
        selectable={false}
        style={[styles.word, metrics]}
      >
        AI量化<Text style={styles.accent}>联盟</Text>
      </Text>
      <Text style={styles.domain}>eaxau.com</Text>
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
  domain: {
    marginTop: -2,
    color: "rgba(226,232,240,0.48)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
