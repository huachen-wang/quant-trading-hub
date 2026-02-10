import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";
import { useResponsive } from "@/hooks/use-responsive";

export interface StrategyCardProps {
  id: number;
  title: string;
  platform: "MT4" | "MT5";
  totalReturn: string;
  winRate: string;
  price: string;
  isFree: boolean;
  downloadCount: number;
  onPress: () => void;
  isFavorite?: boolean;
  onFavoritePress?: () => void;
}

export function StrategyCard({
  title,
  platform,
  totalReturn,
  winRate,
  price,
  isFree,
  downloadCount,
  onPress,
  isFavorite = false,
  onFavoritePress,
}: StrategyCardProps) {
  const colors = useColors();
  const { numColumns } = useResponsive();

  // 根据平台生成不同的渐变色
  const gradientColors: readonly [string, string, ...string[]] =
    platform === "MT4"
      ? ["#1a365d", "#2563eb", "#60a5fa"] // 蓝色渐变
      : ["#4c1d95", "#7c3aed", "#a78bfa"]; // 紫色渐变

  const returnValue = parseFloat(totalReturn);
  const isPositive = returnValue >= 0;

  // 根据列数计算卡片宽度 - 使用固定gap
  const horizontalPadding = 16; // FlatList的paddingHorizontal
  const gap = numColumns >= 4 ? 12 : numColumns >= 3 ? 10 : 8;
  // 每个卡片的margin: gap/2 on each side
  const cardMargin = gap / 2;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.cardWrapper,
        {
          width: `${100 / numColumns}%` as any,
          paddingHorizontal: cardMargin,
          marginBottom: gap,
        },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            ...(Platform.OS === "web" ? {
              // @ts-ignore - web only shadow
              boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
            } : {}),
          },
        ]}
      >
        {/* 封面 - 渐变色 */}
        <View style={styles.coverContainer}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <Text style={styles.coverEmoji}>📈</Text>
            <View style={[styles.platformBadge, { backgroundColor: `${colors.background}E6` }]}>
              <Text style={[styles.platformText, { color: gradientColors[1] }]}>
                {platform}
              </Text>
            </View>
          </LinearGradient>

          {/* 收藏按钮 */}
          {onFavoritePress && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onFavoritePress();
              }}
              style={[styles.favoriteBtn, { backgroundColor: `${colors.background}CC` }]}
              activeOpacity={0.7}
            >
              <Text style={styles.favoriteIcon}>{isFavorite ? "❤️" : "🤍"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 策略信息 */}
        <View style={styles.infoContainer}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {title}
          </Text>

          {/* 实盘数据 */}
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

          {/* 价格和下载 */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View>
              {isFree ? (
                <Text style={[styles.freePrice, { color: colors.success }]}>免费</Text>
              ) : (
                <Text style={[styles.price, { color: "#F59E0B" }]}>¥{price}</Text>
              )}
            </View>
            <Text style={[styles.downloads, { color: colors.muted }]}>💾 {downloadCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    // width set dynamically
  },
  card: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 0.5,
  },
  coverContainer: {
    position: "relative",
  },
  gradient: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  coverEmoji: {
    fontSize: 36,
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
    fontWeight: "700",
  },
  favoriteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteIcon: {
    fontSize: 16,
  },
  infoContainer: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    lineHeight: 20,
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
  downloads: {
    fontSize: 11,
    lineHeight: 16,
  },
});
