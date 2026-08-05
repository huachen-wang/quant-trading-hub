import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useResponsive } from "@/hooks/use-responsive";

type CustomEABannerProps = {
  onPress: () => void;
};

export function CustomEABanner({ onPress }: CustomEABannerProps) {
  const { isDesktop } = useResponsive();

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      style={[styles.container, isDesktop && styles.containerDesktop]}
      accessibilityRole="button"
      accessibilityLabel="联系私有 EA 定制"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="code-slash" size={18} color="#D8BC83" />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          私有 EA 交付
        </Text>
        <Text style={styles.desc} numberOfLines={1}>
          定制命名 · 参数调优 · 源码授权
        </Text>
      </View>

      <View style={styles.action}>
        <Text style={styles.actionText}>联系定制</Text>
        <Ionicons name="arrow-forward" size={15} color="#D8BC83" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 58,
    marginHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(216,188,131,0.18)",
    gap: 11,
  },
  containerDesktop: {
    minHeight: 60,
    marginHorizontal: 8,
    paddingHorizontal: 0,
    gap: 13,
  },
  iconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 2,
    borderLeftColor: "#D8BC83",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: 0,
  },
  titleDesktop: {
    fontSize: 14,
  },
  desc: {
    color: "rgba(148,163,184,0.82)",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 1,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  actionText: {
    color: "#D8BC83",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
