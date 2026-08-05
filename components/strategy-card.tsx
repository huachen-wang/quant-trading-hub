import { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StrategyCover } from "@/components/strategy-cover";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import * as Haptics from "expo-haptics";

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
  isCurated?: boolean;
  featuredLink?: string | null;
  saleMode?: "direct" | "inquiry" | null;
  dataStatus?: "estimated" | "referenced" | "verified" | null;
  imagePriority?: "low" | "normal" | "high";
  onPress: () => void;
  onSubscribePress?: () => void;
}

export function StrategyCard({
  title,
  platform,
  totalReturn,
  winRate,
  pairs,
  tags,
  productType,
  isFeatured,
  imagePriority,
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
    onPress();
  };

  const returnValue = parseFloat(totalReturn) || 0;
  const isPositive = returnValue >= 0;

  const returnText = `${isPositive ? "+" : ""}${totalReturn}%`;

  // 解析标签
  const tagList = tags
    ? tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 2)
    : [];

  const gap =
    numColumns >= 5 ? 10 : numColumns >= 4 ? 12 : numColumns >= 3 ? 10 : 8;
  const cardMargin = gap / 2;

  // 封面高度
  const coverHeight = isDesktop ? 128 : numColumns >= 3 ? 150 : 130;

  // 响应式尺寸
  const titleSize = isDesktop ? 14 : 13;
  const priceSize = isDesktop ? 14 : 12;
  const metaSize = isDesktop ? 10 : 9;
  const infoPadH = isDesktop ? 11 : 8;
  const infoPadV = isDesktop ? 9 : 6;

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
            <StrategyCover
              title={title}
              platform={platform}
              pairs={pairs}
              tags={tags}
              productType={productType}
              imagePriority={imagePriority}
              height={coverHeight}
            />

            {/* 订阅按钮 */}
            {onSubscribePress && !isFeatured && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onSubscribePress();
                }}
                style={[
                  styles.subscribeBtn,
                  {
                    backgroundColor: "rgba(3,8,17,0.70)",
                    borderColor: "rgba(216,188,131,0.58)",
                    top: 34,
                  },
                ]}
                activeOpacity={0.7}
                accessibilityLabel="订阅策略更新"
              >
                <IconSymbol name="bell.fill" size={13} color="#D8BC83" />
              </TouchableOpacity>
            )}

            {/* 收益率浮层 */}
            <View
              style={[
                styles.returnOverlay,
                {
                  backgroundColor: isPositive
                    ? "rgba(16,185,129,0.9)"
                    : "rgba(239,68,68,0.9)",
                },
              ]}
            >
              <Text style={styles.returnOverlayText}>{returnText}</Text>
            </View>
          </View>

          {/* 精简信息区 */}
          <View
            style={[
              styles.infoContainer,
              {
                paddingHorizontal: infoPadH,
                paddingTop: infoPadV,
                paddingBottom: infoPadV,
              },
            ]}
          >
            {/* 标题 */}
            <Text
              style={[
                styles.title,
                {
                  color: isFeatured ? "#A8895A" : colors.foreground,
                  fontSize: titleSize,
                },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>

            {/* 标签行 */}
            {tagList.length > 0 && (
              <View style={styles.tagRow}>
                {tagList.map((tag, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tagChip,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: colors.primary, fontSize: metaSize },
                      ]}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* 获取方式 */}
            <View style={styles.bottomRow}>
              <View style={styles.priceSlot}>
                <Text
                  style={[
                    styles.price,
                    { color: "#C9A96E", fontSize: priceSize },
                  ]}
                  numberOfLines={1}
                >
                  联系咨询
                </Text>
              </View>
              <View style={styles.bottomRight}>
                <Text
                  style={[
                    styles.metaText,
                    { color: colors.muted, fontSize: metaSize },
                  ]}
                >
                  版本确认
                </Text>
              </View>
            </View>
            <View style={styles.winRateInline}>
              <Text
                style={[
                  styles.winRateLabel,
                  { color: colors.muted, fontSize: isDesktop ? 11 : 10 },
                ]}
                numberOfLines={1}
              >
                胜率
              </Text>
              <Text
                style={[
                  styles.winRateValue,
                  { color: colors.primary, fontSize: isDesktop ? 11 : 10 },
                ]}
                numberOfLines={1}
              >
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
  subscribeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  price: {
    fontWeight: "700",
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
