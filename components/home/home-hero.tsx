import { StyleSheet, Text, View } from "react-native";
import { useResponsive } from "@/hooks/use-responsive";

const STATS = [
  { value: "200+", label: "EA 源码", color: "#D8BC83" },
  { value: "30+", label: "合作工作室", color: "#72A7F7" },
  { value: "50+", label: "独家版本", color: "#45C79B" },
];

export function HomeHero() {
  const { isDesktop } = useResponsive();

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={[styles.copy, isDesktop && styles.copyDesktop]}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowRail} />
          <Text style={styles.eyebrow}>EAXAU SOURCE LIBRARY</Text>
        </View>
        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          全网 EA 源头提货
        </Text>
        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          策略筛选、版本确认与源码交付，一站完成
        </Text>
      </View>

      <View style={[styles.stats, isDesktop && styles.statsDesktop]}>
        {STATS.map((stat) => (
          <View
            key={stat.label}
            style={[styles.stat, isDesktop && styles.statDesktop]}
          >
            <Text
              style={[
                styles.statValue,
                isDesktop && styles.statValueDesktop,
                { color: stat.color },
              ]}
            >
              {stat.value}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
  },
  containerDesktop: {
    minHeight: 184,
    paddingHorizontal: 8,
    paddingTop: 30,
    paddingBottom: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 48,
  },
  copy: {
    minWidth: 0,
  },
  copyDesktop: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  eyebrowRail: {
    width: 24,
    height: 2,
    backgroundColor: "#D8BC83",
  },
  eyebrow: {
    color: "rgba(216,188,131,0.88)",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleDesktop: {
    fontSize: 38,
    lineHeight: 46,
  },
  subtitle: {
    color: "rgba(203,213,225,0.72)",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
    marginTop: 7,
  },
  subtitleDesktop: {
    fontSize: 14,
    lineHeight: 22,
  },
  stats: {
    flexDirection: "row",
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.12)",
    paddingTop: 15,
  },
  statsDesktop: {
    width: 410,
    flexShrink: 0,
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(148,163,184,0.14)",
  },
  statDesktop: {
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: 0,
  },
  statValueDesktop: {
    fontSize: 29,
    lineHeight: 35,
  },
  statLabel: {
    color: "rgba(203,213,225,0.66)",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 3,
  },
});
