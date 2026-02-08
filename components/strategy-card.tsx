import { View, Text, TouchableOpacity, Image } from "react-native";
import { IconSymbol } from "./ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export interface StrategyCardProps {
  id: number;
  title: string;
  platform: "MT4" | "MT5";
  totalReturn: string;
  winRate: string;
  downloadCount: number;
  viewCount: number;
  coverImage: string | null;
  onPress: () => void;
}

export function StrategyCard({
  title,
  platform,
  totalReturn,
  winRate,
  downloadCount,
  viewCount,
  coverImage,
  onPress,
}: StrategyCardProps) {
  const colors = useColors();
  const returnValue = parseFloat(totalReturn);
  const isPositive = returnValue >= 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface rounded-2xl overflow-hidden mb-4"
      activeOpacity={0.8}
    >
      {/* 封面图 */}
      {coverImage ? (
        <Image source={{ uri: coverImage }} className="w-full h-40" resizeMode="cover" />
      ) : (
        <View className="w-full h-40 bg-border items-center justify-center">
          <IconSymbol name="chart.line.uptrend.xyaxis" size={48} color={colors.muted} />
        </View>
      )}

      {/* 内容区 */}
      <View className="p-4">
        {/* 标题和平台 */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-foreground flex-1" numberOfLines={1}>
            {title}
          </Text>
          <View
            className={`ml-2 px-3 py-1 rounded-full ${platform === "MT4" ? "bg-primary/20" : "bg-accent/20"}`}
          >
            <Text
              className={`text-xs font-bold ${platform === "MT4" ? "text-primary" : "text-accent"}`}
            >
              {platform}
            </Text>
          </View>
        </View>

        {/* 实盘数据 */}
        <View className="flex-row items-center mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1">总收益率</Text>
            <Text
              className={`text-2xl font-bold ${isPositive ? "text-success" : "text-error"}`}
            >
              {isPositive ? "+" : ""}
              {totalReturn}%
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1">胜率</Text>
            <Text className="text-2xl font-bold text-primary">{winRate}%</Text>
          </View>
        </View>

        {/* 统计信息 */}
        <View className="flex-row items-center pt-3 border-t border-border">
          <View className="flex-row items-center flex-1">
            <IconSymbol name="arrow.down.circle" size={16} color={colors.muted} />
            <Text className="text-xs text-muted ml-1">{downloadCount} 下载</Text>
          </View>
          <View className="flex-row items-center flex-1">
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <Text className="text-xs text-muted ml-1">{viewCount} 浏览</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
