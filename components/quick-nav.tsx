import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

const QUICK_NAV_ITEMS = [
  {
    id: "cooperation",
    title: "工作室扶持合作",
    subtitle: "深度扶持 · 源头直供",
    icon: "🤝",
    gradient: ["#0F172A", "#1E3A8A"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/cooperation",
    accent: "#60A5FA",
  },
  {
    id: "promo",
    title: "EA限时促销",
    subtitle: "源头价 · 限时特惠",
    icon: "⚡",
    gradient: ["#1A0000", "#7F1D1D"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/promo",
    accent: "#F87171",
  },
  {
    id: "ddxau",
    title: "订单流独家策略",
    subtitle: "四维共振 · 独家研发",
    icon: "🏆",
    gradient: ["#1A0E00", "#78350F"] as readonly [string, string, ...string[]],
    type: "link" as const,
    target: "https://ddxau.com",
    accent: "#FBBF24",
  },
];

export function QuickNav() {
  const router = useRouter();

  const handlePress = (item: typeof QUICK_NAV_ITEMS[0]) => {
    if (item.type === "link") {
      Linking.openURL(item.target);
    } else {
      router.push(item.target as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>快捷导航</Text>
      <View style={styles.column}>
        {QUICK_NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handlePress(item)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, { borderColor: item.accent + "20" }]}
              // @ts-ignore - web-only className

            >
              <View style={[styles.iconWrap, { backgroundColor: item.accent + "18" }]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <View style={styles.textArea}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.subtitle, { color: item.accent + "99" }]} numberOfLines={1}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.arrow, { color: item.accent }]}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.08)",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  column: {
    gap: 8,
  },
  card: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  icon: {
    fontSize: 16,
  },
  textArea: {
    flex: 1,
  },
  title: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  arrow: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
});
