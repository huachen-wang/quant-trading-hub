import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

const QUICK_NAV_ITEMS = [
  {
    id: "cooperation",
    title: "工作室扶持合作",
    icon: "🤝",
    gradient: ["#0F172A", "#1E3A8A"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/cooperation",
    accent: "#60A5FA",
  },
  {
    id: "promo",
    title: "EA限时促销",
    icon: "⚡",
    gradient: ["#1A0000", "#7F1D1D"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/promo",
    accent: "#F87171",
  },
  {
    id: "ddxau",
    title: "订单流独家策略",
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
      <View style={styles.row}>
        {QUICK_NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            onPress={() => handlePress(item)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, { borderColor: item.accent + "20" }]}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.arrow, { color: item.accent }]}>→</Text>
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  item: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    color: "#E2E8F0",
    fontSize: 10,
    fontWeight: "700",
    flex: 1,
  },
  arrow: {
    fontSize: 12,
    fontWeight: "700",
  },
});
