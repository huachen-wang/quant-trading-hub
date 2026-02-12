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

// 相对时间格式化
function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
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
  pairs,
  viewCount = 0,
  createdAt,
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

  // 解析交易对标签（最多显示3个）
  const pairTags = pairs
    ? pairs.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 3)
    : [];

  // 封面高度：桌面端更大
  const coverHeight = isDesktop ? 180 : numColumns >= 3 ? 150 : 140;

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
              // @ts-ignore - web-only CSS property
              boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
              transition: "box-shadow 0.3s ease, transform 0.3s ease",
            } : {}),
          },
        ]}
        // @ts-ignore - web-only className for hover effect
        className={Platform.OS === "web" ? "strategy-card-hover" : undefined}
      >
        {/* 封面区域 - 增大显示 */}
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

          {/* 订阅/技术支持按钮 */}
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

          {/* 收益率浮层 - 右下角醒目显示 */}
          <View style={[styles.returnOverlay, { backgroundColor: isPositive ? "rgba(16,185,129,0.9)" : "rgba(239,68,68,0.9)" }]}>
            <Text style={styles.returnOverlayText}>
              {isPositive ? "+" : ""}{totalReturn}%
            </Text>
          </View>
        </View>

        {/* 策略信息 */}
        <View style={styles.infoContainer}>
          {/* 标题 */}
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {title}
          </Text>

          {/* 交易对标签 */}
          {pairTags.length > 0 && (
            <View style={styles.tagRow}>
              {pairTags.map((tag, idx) => (
                <View key={idx} style={[styles.tag, { backgroundColor: gradientColors[1] + "15" }]}>
                  <Text style={[styles.tagText, { color: gradientColors[1] }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 数据行 */}
          <View style={styles.dataSection}>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.muted }]}>总收益</Text>
              <Text
                style={[
                  styles.dataValue,
                  { color: isPositive ? colors.success : colors.error },
                ]}
              >
                {isPositive ? "+" : ""}
                {totalReturn}%
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.muted }]}>胜率</Text>
              <Text style={[styles.dataValue, { color: colors.primary }]}>{winRate}%</Text>
            </View>
          </View>

          {/* 底部信息 */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View>
              {isFree ? (
                <Text style={[styles.freePrice, { color: colors.success }]}>免费</Text>
              ) : (
                <Text style={[styles.price, { color: "#F59E0B" }]}>¥{price}</Text>
              )}
            </View>
            <View style={styles.footerRight}>
              {viewCount > 0 && (
                <Text style={[styles.metaText, { color: colors.muted }]}>👁 {viewCount}</Text>
              )}
              <Text style={[styles.metaText, { color: colors.muted }]}>💾 {downloadCount + virtualDownloads}</Text>
            </View>
          </View>

          {/* 相对时间 */}
          {createdAt && (
            <Text style={[styles.timeText, { color: colors.muted }]}>
              {formatRelativeTime(createdAt)}
            </Text>
          )}
        </View>
      </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {},
  card: {
    borderRadius: 16,
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
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  platformText: {
    fontSize: 12,
    fontWeight: "800",
  },
  subscribeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeBtnIcon: {
    fontSize: 15,
  },
  returnOverlay: {
    position: "absolute",
    bottom: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  returnOverlayText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  infoContainer: {
    padding: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
  },
  dataSection: {
    marginBottom: 8,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  dataLabel: {
    fontSize: 12,
    lineHeight: 18,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  freePrice: {
    fontSize: 14,
    fontWeight: "700",
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 11,
    lineHeight: 16,
  },
  timeText: {
    fontSize: 10,
    marginTop: 6,
  },
});
