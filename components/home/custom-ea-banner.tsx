import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useResponsive } from "@/hooks/use-responsive";

type CustomEABannerProps = {
  onPress: () => void;
};

export function CustomEABanner({ onPress }: CustomEABannerProps) {
  const { isDesktop } = useResponsive();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.outer, isDesktop && styles.outerDesktop]}
    >
      <LinearGradient
        colors={["#0A1628", "#1A1410", "#2A1F0E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, isDesktop && styles.containerDesktop]}
      >
        <View style={styles.gridLine1} />
        <View style={styles.gridLine2} />

        <View style={[styles.iconWrap, isDesktop && styles.iconWrapDesktop]}>
          <Text style={styles.iconText}>EA</Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>私有 EA 交付 · 源码授权</Text>
          <Text style={styles.desc} numberOfLines={2}>
            定制命名 · 参数调优 · 工作室交付
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
  outerDesktop: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 8,
    borderRadius: 8,
    borderColor: "rgba(216,188,131,0.22)",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    position: "relative",
    overflow: "hidden",
  },
  containerDesktop: {
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  iconWrapDesktop: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,188,131,0.10)",
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.18)",
  },
  iconText: {
    color: "#D8BC83",
    fontSize: 13,
    fontWeight: "900",
  },
  content: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
    letterSpacing: 0,
  },
  titleDesktop: {
    fontSize: 13,
    lineHeight: 18,
  },
  desc: {
    color: "#F1F5F9",
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 4,
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(217,119,6,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
});
