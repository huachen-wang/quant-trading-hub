import { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useResponsive } from "@/hooks/use-responsive";
import { BrandWordmark } from "@/components/brand-wordmark";

type HeroCount = {
  ea: number;
  studio: number;
  exclusive: number;
};

export function HomeHero() {
  const { isDesktop } = useResponsive();
  const heroFade = useRef(new Animated.Value(1)).current;
  const heroSlide = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(1)).current;
  const [displayCount, setDisplayCount] = useState<HeroCount>({ ea: 200, studio: 30, exclusive: 50 });

  useEffect(() => {
    const entranceAnimation = Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(heroSlide, { toValue: 0, duration: 800, useNativeDriver: Platform.OS !== "web" }),
    ]);

    const countAnimation = Animated.timing(countAnim, { toValue: 1, duration: 1500, useNativeDriver: false });
    const listener = countAnim.addListener(({ value }) => {
      setDisplayCount({
        ea: Math.round(200 * value),
        studio: Math.round(30 * value),
        exclusive: Math.round(50 * value),
      });
    });

    entranceAnimation.start();
    countAnimation.start();

    return () => {
      entranceAnimation.stop();
      countAnimation.stop();
      countAnim.removeListener(listener);
    };
  }, [countAnim, heroFade, heroSlide]);

  return (
    <Animated.View style={[styles.container, isDesktop && styles.containerDesktop, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}>
      <LinearGradient
        colors={["#050810", "#0A0E1A", "#101827", "#0A0E1A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, isDesktop && styles.gradientDesktop]}
      >
        {[...Array(5)].map((_, i) => (
          <View key={`vl${i}`} style={[styles.gridLineV, { right: 30 + i * 60, opacity: 0.03 - i * 0.004 }]} />
        ))}
        {[...Array(3)].map((_, i) => (
          <View key={`hl${i}`} style={[styles.gridLineH, { top: 20 + i * 40, opacity: 0.03 - i * 0.005 }]} />
        ))}

        <View style={[styles.heroBody, isDesktop && styles.heroBodyDesktop]}>
          <View style={styles.heroMain}>
            <View style={styles.brandRow}>
              <BrandWordmark size="sm" />
            </View>

            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>全网EA源头提货</Text>
            <Text style={[styles.tagline, isDesktop && styles.taglineDesktop]}>200+ 源码库 · 100% 破解能力 · 独家调优</Text>

            <View style={[styles.statsRow, isDesktop && styles.statsRowDesktop]}>
              {[
                { num: `${displayCount.ea}+`, label: "EA源码", color: "#D8BC83", bgColor: "rgba(251,191,36,0.08)" },
                { num: `${displayCount.studio}+`, label: "合作工作室", color: "#60A5FA", bgColor: "rgba(96,165,250,0.08)" },
                { num: `${displayCount.exclusive}+`, label: "独家版", color: "#34D399", bgColor: "rgba(52,211,153,0.08)" },
              ].map((stat) => (
                <View key={stat.label} style={[styles.statItem, isDesktop && styles.statItemDesktop, { backgroundColor: stat.bgColor }]}>
                  <Text style={[styles.statNum, isDesktop && styles.statNumDesktop, { color: stat.color }]}>{stat.num}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {isDesktop && (
            <View style={styles.terminalPanel}>
              <View style={styles.terminalHeader}>
                <Text style={styles.terminalKicker}>SOURCE DESK</Text>
                <Text style={styles.terminalStatus}>LIVE</Text>
              </View>
              {[
                { label: "策略入库", value: "T+0", tone: "#D8BC83" },
                { label: "实盘观测", value: "24H", tone: "#60A5FA" },
                { label: "授权交付", value: "1:1", tone: "#34D399" },
              ].map((row) => (
                <View key={row.label} style={styles.terminalRow}>
                  <Text style={styles.terminalLabel}>{row.label}</Text>
                  <Text style={[styles.terminalValue, { color: row.tone }]}>{row.value}</Text>
                </View>
              ))}
              <View style={styles.signalStrip}>
                <View style={[styles.signalBar, { height: 22, backgroundColor: "#34D399" }]} />
                <View style={[styles.signalBar, { height: 36, backgroundColor: "#D8BC83" }]} />
                <View style={[styles.signalBar, { height: 28, backgroundColor: "#60A5FA" }]} />
                <View style={[styles.signalBar, { height: 44, backgroundColor: "#D8BC83" }]} />
                <View style={[styles.signalBar, { height: 31, backgroundColor: "#34D399" }]} />
              </View>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 6,
  },
  containerDesktop: {
    marginTop: 10,
    marginBottom: 8,
  },
  gradient: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  gradientDesktop: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 15,
    minHeight: 168,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  heroBody: {},
  heroBodyDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 18,
  },
  heroMain: {
    flex: 1,
    minWidth: 0,
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255,255,255,1)",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,1)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  liveDotOuter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(16,185,129,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  brandText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  brandDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 10,
  },
  brandSub: {
    color: "rgba(251,191,36,0.7)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 3,
  },
  titleDesktop: {
    fontSize: 31,
    lineHeight: 37,
    marginTop: 3,
    marginBottom: 5,
  },
  tagline: {
    color: "rgba(251,191,36,0.85)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 10,
  },
  taglineDesktop: {
    color: "rgba(226,232,240,0.82)",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statsRowDesktop: {
    maxWidth: 660,
    gap: 9,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    position: "relative",
    overflow: "hidden",
  },
  statItemDesktop: {
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
  },
  statNumDesktop: {
    fontSize: 23,
    lineHeight: 27,
  },
  statLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
  terminalPanel: {
    width: 272,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(2,6,23,0.58)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  terminalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  terminalKicker: {
    color: "rgba(148,163,184,0.78)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
  },
  terminalStatus: {
    color: "#34D399",
    fontSize: 10,
    fontWeight: "900",
  },
  terminalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.10)",
  },
  terminalLabel: {
    color: "rgba(226,232,240,0.78)",
    fontSize: 12,
    fontWeight: "600",
  },
  terminalValue: {
    fontSize: 15,
    fontWeight: "900",
  },
  signalStrip: {
    height: 46,
    marginTop: 8,
    borderRadius: 6,
    backgroundColor: "rgba(15,23,42,0.78)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingHorizontal: 18,
    paddingBottom: 7,
  },
  signalBar: {
    width: 10,
    borderRadius: 6,
    opacity: 0.84,
  },
});
