import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useResponsive } from "@/hooks/use-responsive";
import { useLanguage } from "@/lib/language";

const QUICK_NAV_ITEMS = [
  {
    id: "cooperation",
    code: "B2B",
    title: "工作室扶持合作",
    subtitle: "技术适配 · 授权核验",
    gradient: ["#0A1628", "#1E3A8A"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/cooperation",
    accent: "#60A5FA",
  },
  {
    id: "promo",
    code: "PRM",
    title: "EA限时促销",
    subtitle: "源头价 · 限时特惠",
    gradient: ["#1A0000", "#7F1D1D"] as readonly [string, string, ...string[]],
    type: "route" as const,
    target: "/promo",
    accent: "#F87171",
  },
  {
    id: "ddxau",
    code: "XAU",
    title: "订单流独家策略",
    subtitle: "四维共振 · 独家研发",
    gradient: ["#1A0E00", "#78350F"] as readonly [string, string, ...string[]],
    type: "link" as const,
    target: "https://ddxau.com",
    accent: "#D8BC83",
  },
];

export function QuickNav() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { text } = useLanguage();
  const items = QUICK_NAV_ITEMS.map((item) => {
    if (item.id === "cooperation") {
      return {
        ...item,
        title: text(
          "工作室扶持合作",
          "Studio partnerships",
          "شراكات الاستوديو",
        ),
        subtitle: text(
          "深度扶持 · 源头直供",
          "Direct support · Source access",
          "دعم مباشر · وصول للمصدر",
        ),
      };
    }
    if (item.id === "promo") {
      return {
        ...item,
        title: text("EA限时促销", "EA promotions", "عروض EA"),
        subtitle: text(
          "源头价 · 限时特惠",
          "Source pricing · Limited time",
          "سعر المصدر · لفترة محدودة",
        ),
      };
    }
    return {
      ...item,
      title: text(
        "订单流独家策略",
        "Order-flow strategy",
        "استراتيجية تدفق الأوامر",
      ),
      subtitle: text(
        "四维共振 · 独家研发",
        "Four-factor model · Proprietary",
        "نموذج رباعي · تطوير خاص",
      ),
    };
  });

  const handlePress = (item: (typeof QUICK_NAV_ITEMS)[0]) => {
    if (item.type === "link") {
      Linking.openURL(item.target);
    } else {
      router.push(item.target as any);
    }
  };

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.divider} />
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {text("快捷导航", "Resources", "الموارد")}
        </Text>
        {isDesktop && <Text style={styles.sectionMeta}>RESOURCE MATRIX</Text>}
      </View>
      <View style={[styles.column, isDesktop && styles.grid]}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handlePress(item)}
            activeOpacity={0.85}
            style={isDesktop && styles.gridCell}
          >
            <LinearGradient
              colors={["rgba(15,23,42,0.94)", "rgba(9,15,28,0.98)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.card,
                isDesktop && styles.cardDesktop,
                {
                  borderColor: item.accent + "38",
                  borderLeftColor: item.accent + "A6",
                },
              ]}
              // @ts-ignore - web-only className
            >
              <View
                style={[
                  styles.iconWrap,
                  isDesktop && styles.iconWrapDesktop,
                  { backgroundColor: item.accent + "18" },
                ]}
              >
                <Text style={[styles.icon, isDesktop && styles.iconDesktop]}>
                  {item.code}
                </Text>
              </View>
              <View style={styles.textArea}>
                <Text
                  style={[styles.title, isDesktop && styles.titleDesktop]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[styles.subtitle, { color: item.accent + "99" }]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
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
  containerDesktop: {
    paddingHorizontal: 0,
    paddingTop: 18,
    paddingBottom: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.18)",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionMeta: {
    color: "rgba(148,163,184,0.58)",
    fontSize: 10,
    fontWeight: "800",
  },
  column: {
    gap: 8,
  },
  grid: {
    flexDirection: "row",
    gap: 10,
  },
  gridCell: {
    flex: 1,
  },
  card: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  cardDesktop: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconWrapDesktop: {
    borderRadius: 6,
  },
  icon: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  iconDesktop: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "900",
  },
  textArea: {
    flex: 1,
  },
  title: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "700",
  },
  titleDesktop: {
    fontSize: 12,
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
