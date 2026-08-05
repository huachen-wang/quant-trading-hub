import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type StrategyCoverProps = {
  title: string;
  platform: "MT4" | "MT5";
  pairs?: string;
  productType?: string | null;
  isCurated?: boolean;
  isFeatured?: boolean;
  height: number;
};

export function StrategyCover({
  title,
  platform,
  pairs,
  productType,
  isCurated,
  isFeatured,
  height,
}: StrategyCoverProps) {
  const productLabel =
    productType === "indicator"
      ? "INDICATOR"
      : productType === "tool"
        ? "TOOL"
        : "EXPERT ADVISOR";
  const titleSize = title.length > 30 ? 14 : title.length > 20 ? 16 : 18;
  const platformColor = platform === "MT4" ? "#93C5FD" : "#6EE7B7";

  return (
    <LinearGradient
      colors={["#07101D", "#101C2E", "#17283B"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cover, { height }]}
    >
      <View style={styles.gridLineHorizontal} />
      <View style={styles.gridLineVertical} />
      <Text style={styles.watermark}>EA</Text>

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark} />
          <Text style={styles.brand}>EAXAU</Text>
          <Text style={styles.catalogLabel}>
            {isFeatured ? "OFFICIAL" : isCurated ? "SELECT" : "CATALOG"}
          </Text>
        </View>
        <View
          style={[styles.platformChip, { borderColor: `${platformColor}66` }]}
        >
          <Text style={[styles.platform, { color: platformColor }]}>
            {platform}
          </Text>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.productType}>{productLabel}</Text>
        <Text
          style={[
            styles.title,
            { fontSize: titleSize, lineHeight: titleSize + 4 },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.76}
        >
          {title}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.pairs} numberOfLines={1}>
          {pairs || "MULTI ASSET"}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
    paddingHorizontal: 13,
    paddingVertical: 11,
    justifyContent: "space-between",
  },
  gridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "38%",
    height: 1,
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: "25%",
    width: 1,
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  watermark: {
    position: "absolute",
    right: 8,
    bottom: -12,
    color: "rgba(226,232,240,0.045)",
    fontSize: 72,
    lineHeight: 78,
    fontWeight: "900",
    letterSpacing: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  brandMark: {
    width: 3,
    height: 12,
    backgroundColor: "#C9A96E",
  },
  brand: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  catalogLabel: {
    color: "rgba(201,169,110,0.72)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0,
  },
  platformChip: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  platform: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleBlock: {
    maxWidth: "88%",
    gap: 3,
  },
  productType: {
    color: "rgba(148,163,184,0.78)",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0,
  },
  title: {
    color: "#F8FAFC",
    fontWeight: "900",
    letterSpacing: 0,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingRight: 76,
  },
  pairs: {
    color: "rgba(226,232,240,0.64)",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0,
    flex: 1,
  },
});
