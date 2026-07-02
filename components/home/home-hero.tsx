import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type HeroCount = {
  ea: number;
  studio: number;
  exclusive: number;
};

export function HomeHero() {
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayCount, setDisplayCount] = useState<HeroCount>({ ea: 0, studio: 0, exclusive: 0 });

  useEffect(() => {
    const entranceAnimation = Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 800, useNativeDriver: true }),
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
    <Animated.View style={[styles.container, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}>
      <LinearGradient
        colors={["#050810", "#0A0E1A", "#0D1525", "#0A0E1A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {[...Array(5)].map((_, i) => (
          <View key={`vl${i}`} style={[styles.gridLineV, { right: 30 + i * 60, opacity: 0.03 - i * 0.004 }]} />
        ))}
        {[...Array(3)].map((_, i) => (
          <View key={`hl${i}`} style={[styles.gridLineH, { top: 20 + i * 40, opacity: 0.03 - i * 0.005 }]} />
        ))}

        <View style={styles.brandRow}>
          <View style={styles.liveDotOuter}>
            <View style={styles.liveDot} />
          </View>
          <Text style={styles.brandText}>量化军火库</Text>
          <View style={styles.brandDivider} />
          <Text style={styles.brandSub}>eaxau.com</Text>
        </View>

        <Text style={styles.title}>全网EA源头提货</Text>
        <Text style={styles.tagline}>200+源码库 · 100%破解能力 · 独家调优</Text>

        <View style={styles.statsRow}>
          {[
            { num: `${displayCount.ea}+`, label: "EA源码", color: "#D8BC83", bgColor: "rgba(251,191,36,0.08)" },
            { num: `${displayCount.studio}+`, label: "合作工作室", color: "#60A5FA", bgColor: "rgba(96,165,250,0.08)" },
            { num: `${displayCount.exclusive}+`, label: "独家版", color: "#34D399", bgColor: "rgba(52,211,153,0.08)" },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statItem, { backgroundColor: stat.bgColor }]}>
              <Text style={[styles.statNum, { color: stat.color }]}>{stat.num}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 6,
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
    letterSpacing: 1.5,
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
    letterSpacing: 0.5,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  tagline: {
    color: "rgba(251,191,36,0.85)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    position: "relative",
    overflow: "hidden",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
});
