import { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";
import { useResponsive } from "@/hooks/use-responsive";
import * as Haptics from "expo-haptics";

export interface StrategyCardProps {
  id: number;
  title: string;
  platform: "MT4" | "MT5";
  totalReturn: string;
  winRate: string;
  price: string;
  isFree: boolean;
  downloadCount: number;
  virtualDownloads?: number;
  coverImage?: string | null;
  pairs?: string;
  viewCount?: number;
  createdAt?: Date | string | null;
  onPress: () => void;
  onSubscribePress?: () => void;
}

export function StrategyCard({
  title,
  platform,
  totalReturn,
  winRate,
  price,
  isFree,
  downloadCount,
  virtualDownloads = 0,
  coverImage,
  viewCount = 0,
  onPress,
  onSubscribePress,
}: StrategyCardProps) {
  const colors = useColors();
  const { numColumns, isDesktop } = useResponsive();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const gradientColors: readonly [string, string, ...string[]] =
    platform === "MT4"
      ? ["#1a365d", "#2563eb", "#60a5fa"]
      : ["#4c1d95", "#7c3aed", "#a78bfa"];

  const returnValue = parseFloat(totalReturn);
  const isPositive = returnValue >= 0;

  const gap = numColumns >= 4 ? 12 : numColumns >= 3 ? 10 : 8;
  const cardMargin = gap / 2;

  // 封面高度
  const coverHeight = isDesktop ? 180 : numColumns >= 3 ? 150 : 130;

  // 响应式尺寸
  const titleSize = isDesktop ? 14 : 13;
  const priceSize = isDesktop ? 13 : 12;
  const metaSize = isDesktop ? 10 : 9;
  const infoPadH = isDesktop ? 12 : 8;
  const infoPadV = isDesktop ? 10 : 6;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={[
        styles.cardWrapper,
        {
          width: `${100 / numColumns}%` as any,
          paddingHorizontal: cardMargin,
          marginBottom: gap,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            ...(Platform.OS === "web" ? {
              // @ts-ignore
              boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
              transition: "box-shadow 0.3s ease, transform 0.3s ease",
            } : {}),
          },
        ]}
        // @ts-ignore
        className={Platform.OS === "web" ? "strategy-card-hover" : undefined}
      >
        {/* 封面区域 */}
        <View style={[styles.coverContainer, { height: coverHeight }]}>
          {coverImage ? (
            <Image
              source={{ uri: coverImage }}
              style={[styles.coverImage, { height: coverHeight }]}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gradient, { height: coverHeight }]}
            >
              <Text style={styles.coverEmoji}>📈</Text>
            </LinearGradient>
          )}

          {/* 平台标签 */}
          <View style={[styles.platformBadge, { backgroundColor: `${colors.background}E6` }]}>
            <Text style={[styles.platformText, { color: gradientColors[1] }]}>
              {platform}
            </Text>
          </View>

          {/* 订阅按钮 */}
          {onSubscribePress && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onSubscribePress();
              }}
              style={[styles.subscribeBtn, { backgroundColor: `${colors.primary}E6` }]}
              activeOpacity={0.7}
            >
              <Text style={styles.subscribeBtnIcon}>📬</Text>
            </TouchableOpacity>
          )}

          {/* 收益率浮层 */}
          <View style={[styles.returnOverlay, { backgroundColor: isPositive ? "rgba(16,185,129,0.9)" : "rgba(239,68,68,0.9)" }]}>
            <Text style={styles.returnOverlayText}>
              {isPositive ? "+" : ""}{totalReturn}%
            </Text>
          </View>
        </View>

        {/* 精简信息区 */}
        <View style={[styles.infoContainer, { paddingHorizontal: infoPadH, paddingTop: infoPadV, paddingBottom: infoPadV }]}>
          {/* 标题 */}
          <Text
            style={[styles.title, { color: colors.foreground, fontSize: titleSize }]}
            numberOfLines={1}
          >
            {title}
          </Text>

          {/* 价格 + 胜率 + 下载量 一行 */}
          <View style={styles.bottomRow}>
            <View style={styles.bottomLeft}>
              {isFree ? (
                <Text style={[styles.freePrice, { color: colors.success, fontSize: priceSize }]}>免费</Text>
              ) : (
                <Text style={[styles.price, { color: "#F59E0B", fontSize: priceSize }]}>¥{price}</Text>
              )}
              <Text style={[styles.winRateInline, { color: colors.muted, fontSize: isDesktop ? 11 : 10 }]}>
                胜率 <Text style={{ color: colors.primary, fontWeight: "700" }}>{winRate}%</Text>
              </Text>
            </View>
            <View style={styles.bottomRight}>
              {isDesktop && viewCount > 0 && (
                <Text style={[styles.metaText, { color: colors.muted, fontSize: metaSize }]}>👁 {viewCount}</Text>
              )}
              <Text style={[styles.metaText, { color: colors.muted, fontSize: metaSize }]}>💾 {downloadCount + virtualDownloads}</Text>
            </View>
          </View>
        </View>
      </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {},
  card: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 0.5,
  },
  coverContainer: {
    position: "relative",
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
  },
  gradient: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  coverEmoji: {
    fontSize: 48,
  },
  platformBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  platformText: {
    fontSize: 11,
    fontWeight: "800",
  },
  subscribeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeBtnIcon: {
    fontSize: 14,
  },
  returnOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  returnOverlayText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  infoContainer: {
    // padding set dynamically
  },
  title: {
    fontWeight: "700",
    marginBottom: 3,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bottomRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  freePrice: {
    fontWeight: "700",
  },
  price: {
    fontWeight: "700",
  },
  winRateInline: {},
  metaText: {
    lineHeight: 14,
  },
});
