import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type BrandWordmarkProps = {
  size?: "sm" | "md" | "lg";
  align?: "left" | "center";
  style?: StyleProp<ViewStyle>;
};

const SIZE_MAP = {
  sm: { fontSize: 24, lineHeight: 28, width: 92, underlineWidth: 46, underlineTop: 27 },
  md: { fontSize: 32, lineHeight: 36, width: 124, underlineWidth: 62, underlineTop: 36 },
  lg: { fontSize: 46, lineHeight: 52, width: 178, underlineWidth: 88, underlineTop: 52 },
};

export function BrandWordmark({ size = "md", align = "left", style }: BrandWordmarkProps) {
  const metrics = SIZE_MAP[size];

  return (
    <View style={[styles.root, align === "center" && styles.center, style]}>
      <View
        accessibilityRole="text"
        accessibilityLabel="EAXAU"
        style={[styles.markShell, { width: metrics.width }]}
      >
        <View style={styles.backPlate} />
        <Text
          selectable={false}
          style={[
            styles.word,
            {
              fontSize: metrics.fontSize,
              lineHeight: metrics.lineHeight,
            },
          ]}
        >
          EAXAU
        </Text>
        <LinearGradient
          colors={["rgba(216,188,131,0)", "#D8BC83", "rgba(216,188,131,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.underline,
            {
              width: metrics.underlineWidth,
              top: metrics.underlineTop,
              left: (metrics.width - metrics.underlineWidth) / 2,
            },
          ]}
        />
        <View style={[styles.centerCut, { top: metrics.underlineTop - 2 }]} />
      </View>
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
  markShell: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  word: {
    color: "#F8FAFC",
    fontWeight: "900",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(216,188,131,0.30)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  backPlate: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 2,
    bottom: 2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(216,188,131,0.14)",
    opacity: 0.72,
  },
  underline: {
    position: "absolute",
    height: 2,
    borderRadius: 1,
    alignSelf: "center",
  },
  centerCut: {
    position: "absolute",
    left: "50%",
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D8BC83",
    opacity: 0.9,
  },
});
