import { View, Text, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";

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

  // 根据平台生成不同的渐变色
  const gradientColors: readonly [string, string, ...string[]] =
    platform === "MT4"
      ? ["#1E3A8A", "#3B82F6"] // 蓝色渐变
      : ["#7C3AED", "#A78BFA"]; // 紫色渐变

  const returnValue = parseFloat(totalReturn);
  const isPositive = returnValue >= 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 m-1"
      activeOpacity={0.8}
      style={{ minWidth: "45%" }}
    >
      <View className="bg-surface rounded-2xl overflow-hidden border border-border">
        {/* 封面占位图 - 渐变色 */}
        <View className="relative">
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          className="h-24 items-center justify-center"
        >
          <Text className="text-4xl">📈</Text>
          <View className="absolute top-2 right-2 bg-background/90 px-2 py-0.5 rounded">
            <Text className="text-xs font-bold" style={{ color: gradientColors[1] }}>
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
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 items-center justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-lg">{isFavorite ? "❤️" : "🤍"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 策略信息 */}
        <View className="p-3">
          <Text className="text-sm font-bold text-foreground mb-2" numberOfLines={2}>
            {title}
          </Text>

          {/* 实盘数据 */}
          <View className="mb-2">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs text-muted">总收益</Text>
              <Text
                className={`text-sm font-bold ${isPositive ? "text-success" : "text-error"}`}
              >
                {isPositive ? "+" : ""}
                {totalReturn}%
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted">胜率</Text>
              <Text className="text-sm font-bold text-primary">{winRate}%</Text>
            </View>
          </View>

          {/* 价格和下载 */}
          <View className="flex-row items-center justify-between pt-2 border-t border-border">
            <View>
              {isFree ? (
                <Text className="text-sm font-bold text-success">免费</Text>
              ) : (
                <Text className="text-sm font-bold text-accent">¥{price}</Text>
              )}
            </View>
            <Text className="text-xs text-muted">💾 {downloadCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
