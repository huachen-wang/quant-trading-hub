import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type CustomEABannerProps = {
  onPress: () => void;
};

export function CustomEABanner({ onPress }: CustomEABannerProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.outer}
    >
      <LinearGradient
        colors={["#0A1628", "#1A1410", "#2A1F0E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.gridLine1} />
        <View style={styles.gridLine2} />

        <View style={styles.iconWrap}>
          <Text style={{ fontSize: 28 }}>🔓</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>EA 破解网 · 专属 EA 破解</Text>
          <Text style={styles.desc} numberOfLines={2}>
            联系定制 · 专业团队
          </Text>
        </View>

        <View style={styles.arrow}>
          <Text style={{ color: "#A8895A", fontSize: 18, fontWeight: "900" }}>›</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    position: "relative",
    overflow: "hidden",
  },
  gridLine1: {
    position: "absolute",
    top: 0,
    left: "30%",
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  gridLine2: {
    position: "absolute",
    top: "50%",
    left: 0,
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  iconWrap: {
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  desc: {
    color: "#F1F5F9",
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 4,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(217,119,6,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
});
