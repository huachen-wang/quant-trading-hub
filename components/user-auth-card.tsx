import { useRef, useEffect, ReactNode } from "react";
import { View, Text, StyleSheet, Animated, Platform, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/use-colors";
import { glassStyle } from "@/lib/glass-styles";
import { BrandWordmark } from "@/components/brand-wordmark";

interface UserAuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const { width: SW } = Dimensions.get("window");

/**
 * 用户认证页共享外壳 ——
 *  - 保留现有的深蓝玻璃风格（同 admin/login）
 *  - hero 区有粒子 + 网格 + 金色光带的简化版
 *  - PC 端宽度收窄到 480
 *  - 移动端铺满
 */
export function UserAuthCard({ title, subtitle, children, footer }: UserAuthCardProps) {
  const colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, []);

  return (
    <View style={styles.outer}>
      {/* 背景渐变 */}
      <LinearGradient
        colors={["#050810", "#0A0E1A", "#0D1525", "#0A0E1A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      >
        <View style={StyleSheet.absoluteFill} />
      </LinearGradient>

      {/* 装饰粒子 */}
      <View style={[styles.particle, { top: "12%", right: "18%", backgroundColor: "rgba(251,191,36,0.4)" }]} />
      <View style={[styles.particle, { top: "30%", left: "12%", backgroundColor: "rgba(96,165,250,0.3)" }]} />
      <View style={[styles.particle, { bottom: "22%", right: "14%", backgroundColor: "rgba(52,211,153,0.3)" }]} />

      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: Platform.OS === "web" ? "rgba(15,23,42,0.7)" : colors.surface,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
          glassStyle("strong") as any,
        ]}
      >
        {/* 标题 */}
        <View style={styles.header}>
          <BrandWordmark size="sm" style={styles.brand} />
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
        </View>

        {/* 内容 */}
        <View style={styles.body}>{children}</View>

        {/* 底栏 */}
        {footer ? <View style={styles.footer}>{footer}</View> : null}

        {/* 底部金色光带 */}
        <LinearGradient
        colors={["transparent", "rgba(245,158,11,0.4)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bottomGlow}
        >
          <View style={styles.gradientFill} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    minHeight: "100%" as any,
  },
  particle: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 24,
    padding: 32,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
  },
  header: {
    marginBottom: 24,
  },
  brand: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
  },
  body: {
    gap: 12,
  },
  footer: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.12)",
  },
  bottomGlow: {
    position: "absolute",
    bottom: 0,
    left: 24,
    right: 24,
    height: 1,
  },
  gradientFill: {
    flex: 1,
  },
});
