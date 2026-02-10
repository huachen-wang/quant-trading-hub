import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
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
      ? ["#1E3A8A", "#3B82F6"] // 蓝色渐变
      : ["#7C3AED", "#A78BFA"]; // 紫色渐变

  const returnValue = parseFloat(totalReturn);
  const isPositive = returnValue >= 0;

  // 根据列数计算卡片宽度百分比和间距
  const gap = 8;
  const cardWidthPercent = `${(100 / numColumns) - 1}%` as const;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.cardWrapper, { width: cardWidthPercent as any, marginBottom: gap }]}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* 封面占位图 - 渐变色 */}
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
                <Text style={[styles.price, { color: colors.success }]}>免费</Text>
              ) : (
                <Text style={[styles.price, { color: "#F59E0B" }]}>￥{price}</Text>
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
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  coverContainer: {
    position: "relative",
  },
  gradient: {
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  coverEmoji: {
    fontSize: 32,
  },
  platformBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
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
  },
  dataValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  price: {
    fontSize: 15,
    fontWeight: "700",
  },
  downloads: {
    fontSize: 12,
  },
});
