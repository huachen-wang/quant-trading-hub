import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { resolveStrategyArtwork } from "@/lib/strategy-artwork";

type StrategyCoverProps = {
  title: string;
  platform: "MT4" | "MT5";
  pairs?: string;
  tags?: string | null;
  productType?: string | null;
  imagePriority?: "low" | "normal" | "high";
  height: number;
};

export function StrategyCover({
  title,
  platform,
  pairs,
  tags,
  productType,
  imagePriority = "normal",
  height,
}: StrategyCoverProps) {
  const artwork = resolveStrategyArtwork({ title, tags, pairs, productType });
  const shortNameLength = Array.from(artwork.shortName).length;
  const shortNameSize =
    shortNameLength > 14 ? 11 : shortNameLength > 10 ? 12 : 15;
  const productLabel =
    productType === "indicator"
      ? "指标"
      : productType === "tool"
        ? "工具"
        : "EA";

  return (
    <LinearGradient
      colors={artwork.fallback}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cover, { height }]}
    >
      <Image
        source={{ uri: artwork.image }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
        priority={imagePriority}
        recyclingKey={artwork.image}
        accessible={false}
      />
      <LinearGradient
        colors={[
          "rgba(3,8,17,0.48)",
          "rgba(3,8,17,0.08)",
          "rgba(3,8,17,0.22)",
          "rgba(3,8,17,0.90)",
        ]}
        locations={[0, 0.3, 0.58, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View
            style={[styles.brandMark, { backgroundColor: artwork.accent }]}
          />
          <Text style={styles.brand}>EAXAU</Text>
        </View>
        <View style={styles.platformChip}>
          <Text style={styles.platform}>{`${platform} · ${productLabel}`}</Text>
        </View>
      </View>

      <View style={styles.copyBlock}>
        <View style={styles.categoryRow}>
          <View
            style={[styles.categoryRail, { backgroundColor: artwork.accent }]}
          />
          <Text
            style={[styles.category, { color: artwork.accent }]}
            numberOfLines={1}
          >
            {artwork.label}
          </Text>
        </View>
        <Text
          style={[styles.shortName, { fontSize: shortNameSize }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {artwork.shortName}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {artwork.detail}
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
  },
  brand: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  platformChip: {
    backgroundColor: "rgba(3,8,17,0.54)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  platform: {
    color: "#F8FAFC",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0,
  },
  copyBlock: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    paddingRight: 4,
    gap: 2,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryRail: {
    width: 14,
    height: 2,
  },
  category: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0,
  },
  shortName: {
    color: "#F8FAFC",
    lineHeight: 19,
    fontWeight: "900",
    letterSpacing: 0,
  },
  detail: {
    color: "rgba(226,232,240,0.78)",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
});
