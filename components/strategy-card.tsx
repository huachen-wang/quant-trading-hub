import { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Linking } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useResponsive } from "@/hooks/use-responsive";
import { getInternalStrategyRoute } from "@/lib/download-links";
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
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 80,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // 旗舰产品既支持站内策略路径，也支持真正的外部官网。
    if (isFeatured && featuredLink) {
      const internalRoute = getInternalStrategyRoute(featuredLink);
      if (internalRoute) {
        router.push(internalRoute as any);
      } else {
        Linking.openURL(featuredLink);
      }
      return;
    }
    onPress();
  };

  const gradientColors: readonly [string, string, ...string[]] =
    isFeatured
      ? ["#100D07", "#2A2112", "#C9A96E"]
      : platform === "MT4"
        ? ["#06101D", "#11233A", "#41607A"]
        : ["#06140F", "#12382B", "#34D399"];

  const returnValue = parseFloat(totalReturn) || 0;
  const isPositive = returnValue >= 0;

  // 计算折扣率
  const priceNum = parseFloat(price) || 0;
  const originalPriceNum = parseFloat(originalPrice || "") || 0;
  const hasDiscount = !isFree && originalPriceNum > 0 && originalPriceNum > priceNum;
  const discountPercent = hasDiscount ? Math.round((1 - priceNum / originalPriceNum) * 100) : 0;
  const returnText = `${isPositive ? "+" : ""}${totalReturn}%`;
  const priceText = `¥${price}`;
  const originalPriceText = originalPrice ? `¥${originalPrice}` : "";
  const viewText = `VIEW ${viewCount}`;
  const downloadText = `DL ${downloadCount + virtualDownloads}`;

  // 解析标签
  const tagList = tags ? tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 2) : [];

  // 产品类型标签
  const productTypeLabel = productType === "indicator" ? "指标" : productType === "tool" ? "工具" : null;

  const gap = numColumns >= 5 ? 10 : numColumns >= 4 ? 12 : numColumns >= 3 ? 10 : 8;
  const cardMargin = gap / 2;

  // 封面高度
  const coverHeight = isDesktop ? 128 : numColumns >= 3 ? 150 : 130;

  // 响应式尺寸
  const titleSize = isDesktop ? 14 : 13;
  const priceSize = isDesktop ? 14 : 12;
  const metaSize = isDesktop ? 10 : 9;
  const infoPadH = isDesktop ? 11 : 8;
  const infoPadV = isDesktop ? 9 : 6;
  const coverCode = isFeatured ? "PRO" : productType === "indicator" ? "IND" : productType === "tool" ? "TOOL" : "EA";

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
            borderColor: isFeatured ? "#A8895A" : colors.border,
            borderWidth: isFeatured ? 1.5 : 0.5,
          },
        ]}
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
              <View style={styles.coverCodePanel}>
                <Text style={styles.coverCodeText}>{coverCode}</Text>
                <Text style={styles.coverCodeSub}>{platform} SOURCE</Text>
              </View>
            </LinearGradient>
          )}

          {/* 旗舰标签 */}
          {isFeatured && (
            <View style={styles.featuredBadge}>
              <LinearGradient
                colors={["#A8895A", "#C9A96E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.featuredGradient}
              >
                <Text style={styles.featuredText}>官方旗舰</Text>
              </LinearGradient>
            </View>
          )}

          {/* 平台标签 */}
          <View style={[
            styles.platformBadge,
            { backgroundColor: `${colors.background}E6` },
            isFeatured ? { top: 34 } : {},
          ]}>
            <Text style={[styles.platformText, { color: isFeatured ? "#A8895A" : gradientColors[1] }]}>
              {productTypeLabel ? `${platform} · ${productTypeLabel}` : platform}
            </Text>
          </View>

          {/* 折扣标签 */}
          {hasDiscount && discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{`-${discountPercent}%`}</Text>
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
              <Text style={styles.subscribeBtnIcon}>SUB</Text>
            </TouchableOpacity>
          )}

          {/* 收益率浮层 */}
          <View style={[styles.returnOverlay, { backgroundColor: isPositive ? "rgba(16,185,129,0.9)" : "rgba(239,68,68,0.9)" }]}>
            <Text style={styles.returnOverlayText}>{returnText}</Text>
          </View>
        </View>

        {/* 精简信息区 */}
        <View style={[styles.infoContainer, { paddingHorizontal: infoPadH, paddingTop: infoPadV, paddingBottom: infoPadV }]}>
          {/* 标题 */}
          <Text
            style={[styles.title, { color: isFeatured ? "#A8895A" : colors.foreground, fontSize: titleSize }]}
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

          {/* 价格 + 下载量 */}
          <View style={styles.bottomRow}>
            <View style={styles.priceSlot}>
              {isFree ? (
                <Text style={[styles.freePrice, { color: colors.success, fontSize: priceSize }]}>免费</Text>
              ) : (
                <View style={styles.priceGroup}>
                  <Text style={[styles.price, { color: "#C9A96E", fontSize: priceSize }]} numberOfLines={1}>
                    {priceText}
                  </Text>
                  {hasDiscount && (
                    <Text style={[styles.originalPrice, { color: colors.muted, fontSize: metaSize }]} numberOfLines={1}>
                      {originalPriceText}
                    </Text>
                  )}
                </View>
              )}
            </View>
            <View style={styles.bottomRight}>
              {isDesktop && viewCount > 0 && (
                <Text style={[styles.metaText, { color: colors.muted, fontSize: metaSize }]}>{viewText}</Text>
              )}
              <Text style={[styles.metaText, { color: colors.muted, fontSize: metaSize }]}>{downloadText}</Text>
            </View>
          </View>
          <View style={styles.winRateInline}>
            <Text style={[styles.winRateLabel, { color: colors.muted, fontSize: isDesktop ? 11 : 10 }]} numberOfLines={1}>
              胜率
            </Text>
            <Text style={[styles.winRateValue, { color: colors.primary, fontSize: isDesktop ? 11 : 10 }]} numberOfLines={1}>
              {`${winRate}%`}
            </Text>
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
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
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
  coverCodePanel: {
    minWidth: 78,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(2,6,23,0.28)",
  },
  coverCodeText: {
    color: "#F8FAFC",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  coverCodeSub: {
    color: "rgba(226,232,240,0.72)",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    marginTop: 2,
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
    borderRadius: 3,
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
    minWidth: 34,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  subscribeBtnIcon: {
    color: "#0A1628",
    fontSize: 10,
    fontWeight: "900",
  },
  returnOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
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
    fontWeight: "800",
    marginBottom: 4,
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
    borderRadius: 3,
  },
  tagText: {
    fontWeight: "600",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.10)",
  },
  priceSlot: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bottomRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  priceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
    flexShrink: 1,
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
  winRateInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    minWidth: 0,
    flexShrink: 1,
  },
  winRateLabel: {
    lineHeight: 14,
  },
  winRateValue: {
    fontWeight: "700",
    lineHeight: 14,
  },
  metaText: {
    lineHeight: 14,
  },
});
