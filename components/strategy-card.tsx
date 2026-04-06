import { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Linking } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";
import { useResponsive } from "@/hooks/use-responsive";
import * as Haptics from "expo-haptics";

// 默认 blurhash 占位符 - 深色渐变风格，适合金融/交易类封面
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

export interface StrategyCardProps {
  id: number;
  title: string;
  platform: "MT4" | "MT5";
  totalReturn: string;
  winRate: string;
  price: string;
  originalPrice?: string | null;
  isFree: boolean;
  downloadCount: number;
  virtualDownloads?: number;
  coverImage?: string | null;
  coverImageBlurhash?: string | null;
  pairs?: string;
  viewCount?: number;
  createdAt?: Date | string | null;
  tags?: string | null;
  productType?: string | null;
  isFeatured?: boolean;
  featuredLink?: string | null;
  onPress: () => void;
  onSubscribePress?: () => void;
}

export function StrategyCard({
  title,
  platform,
  totalReturn,
  winRate,
  price,
  originalPrice,
  isFree,
  downloadCount,
  virtualDownloads = 0,
  coverImage,
  coverImageBlurhash,
  viewCount = 0,
  tags,
  productType,
  isFeatured,
  featuredLink,
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
    // 旗舰产品且有外部链接时，跳转外部
    if (isFeatured && featuredLink) {
      Linking.openURL(featuredLink);
      return;
    }
    onPress();
  };

  const gradientColors: readonly [string, string, ...string[]] =
    isFeatured
      ? ["#92400E", "#D97706", "#FCD34D"] // 金色渐变 - 旗舰产品
      : platform === "MT4"
        ? ["#1a365d", "#2563eb", "#60a5fa"]
        : ["#4c1d95", "#7c3aed", "#a78bfa"];

  const returnValue = parseFloat(totalReturn) || 0;
  const isPositive = returnValue >= 0;

  // 计算折扣率
  const priceNum = parseFloat(price) || 0;
  const originalPriceNum = parseFloat(originalPrice || "") || 0;
  const hasDiscount = !isFree && originalPriceNum > 0 && originalPriceNum > priceNum;
  const discountPercent = hasDiscount ? Math.round((1 - priceNum / originalPriceNum) * 100) : 0;

  // 解析标签
  const tagList = tags ? tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 2) : [];

  // 产品类型标签
  const productTypeLabel = productType === "indicator" ? "指标" : productType === "tool" ? "工具" : null;

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
            borderColor: isFeatured ? "#D97706" : colors.border,
            borderWidth: isFeatured ? 1.5 : 0.5,
            ...(Platform.OS === "web" ? {
              // @ts-ignore
              boxShadow: isFeatured
                ? "0 4px 16px rgba(217,119,6,0.2), 0 2px 6px rgba(217,119,6,0.1)"
                : "0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
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
              placeholder={{ blurhash: coverImageBlurhash || DEFAULT_BLURHASH }}
              contentFit="cover"
              transition={300}
              recyclingKey={coverImage}
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gradient, { height: coverHeight }]}
            >
              <Text style={styles.coverEmoji}>
                {isFeatured ? "🏆" : productType === "indicator" ? "📊" : productType === "tool" ? "🔧" : "📈"}
              </Text>
            </LinearGradient>
          )}

          {/* 旗舰标签 */}
          {isFeatured && (
            <View style={styles.featuredBadge}>
              <LinearGradient
                colors={["#D97706", "#F59E0B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.featuredGradient}
              >
                <Text style={styles.featuredText}>⭐ 官方旗舰</Text>
              </LinearGradient>
            </View>
          )}

          {/* 平台标签 */}
          <View style={[
            styles.platformBadge,
            { backgroundColor: `${colors.background}E6` },
            isFeatured ? { top: 34 } : {},
          ]}>
            <Text style={[styles.platformText, { color: isFeatured ? "#D97706" : gradientColors[1] }]}>
              {platform}
              {productTypeLabel ? ` · ${productTypeLabel}` : ""}
            </Text>
          </View>

          {/* 折扣标签 */}
          {hasDiscount && discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discountPercent}%</Text>
            </View>
          )}

          {/* 订阅按钮 */}
          {onSubscribePress && !isFeatured && (
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
            style={[styles.title, { color: isFeatured ? "#D97706" : colors.foreground, fontSize: titleSize }]}
            numberOfLines={1}
          >
            {title}
          </Text>

          {/* 标签行 */}
          {tagList.length > 0 && (
            <View style={styles.tagRow}>
              {tagList.map((tag, i) => (
                <View key={i} style={[styles.tagChip, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.tagText, { color: colors.primary, fontSize: metaSize }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 价格 + 胜率 + 下载量 一行 */}
          <View style={styles.bottomRow}>
            <View style={styles.bottomLeft}>
              {isFree ? (
                <Text style={[styles.freePrice, { color: colors.success, fontSize: priceSize }]}>免费</Text>
              ) : (
                <View style={styles.priceGroup}>
                  <Text style={[styles.price, { color: "#F59E0B", fontSize: priceSize }]}>¥{price}</Text>
                  {hasDiscount && (
                    <Text style={[styles.originalPrice, { color: colors.muted, fontSize: metaSize }]}>¥{originalPrice}</Text>
                  )}
                </View>
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
  // 旗舰标签
  featuredBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    borderBottomRightRadius: 10,
    overflow: "hidden",
  },
  featuredGradient: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featuredText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
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
  // 折扣标签
  discountBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: "#fff",
    fontSize: 10,
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
  // 标签行
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagText: {
    fontWeight: "600",
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
  priceGroup: {
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
  originalPrice: {
    textDecorationLine: "line-through",
    fontWeight: "400",
  },
  winRateInline: {},
  metaText: {
    lineHeight: 14,
  },
});
