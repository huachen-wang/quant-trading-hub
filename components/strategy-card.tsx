import { View, Text, TouchableOpacity, Image } from "react-native";
import { IconSymbol } from "./ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

interface StrategyCardProps {
  id: number;
  title: string;
  platform: "MT4" | "MT5";
  totalReturn: string;
  avgRating: string;
  followCount: number;
  ratingCount: number;
  author: {
    name: string | null;
    avatar: string | null;
  } | null;
  coverImage?: string | null;
  onPress: () => void;
  onFavorite?: () => void;
  isFavorited?: boolean;
}

export function StrategyCard({
  title,
  platform,
  totalReturn,
  avgRating,
  followCount,
  ratingCount,
  author,
  coverImage,
  onPress,
  onFavorite,
  isFavorited,
}: StrategyCardProps) {
  const colors = useColors();
  const returnValue = parseFloat(totalReturn);
  const returnColor = returnValue >= 0 ? colors.success : colors.error;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
      style={{ opacity: 1 }}
      activeOpacity={0.7}
    >
      {/* 头部 */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center mb-1">
            <Text className="text-lg font-bold text-foreground mr-2" numberOfLines={1}>
              {title}
            </Text>
            <View className={cn("px-2 py-0.5 rounded", platform === "MT4" ? "bg-primary/20" : "bg-accent/20")}>
              <Text className={cn("text-xs font-semibold", platform === "MT4" ? "text-primary" : "text-accent")}>
                {platform}
              </Text>
            </View>
          </View>
          {author && (
            <View className="flex-row items-center">
              {author.avatar ? (
                <Image source={{ uri: author.avatar }} className="w-4 h-4 rounded-full mr-1" />
              ) : (
                <View className="w-4 h-4 rounded-full bg-muted mr-1" />
              )}
              <Text className="text-xs text-muted">{author.name || "匿名用户"}</Text>
            </View>
          )}
        </View>
        {onFavorite && (
          <TouchableOpacity onPress={onFavorite} className="p-1" activeOpacity={0.6}>
            <IconSymbol
              name={isFavorited ? "heart.fill" : "heart"}
              size={24}
              color={isFavorited ? colors.error : colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* 收益率 */}
      <View className="mb-3">
        <Text className="text-xs text-muted mb-1">总收益率</Text>
        <Text className="text-3xl font-bold" style={{ color: returnColor }}>
          {returnValue >= 0 ? "+" : ""}
          {returnValue.toFixed(2)}%
        </Text>
      </View>

      {/* 底部信息 */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <IconSymbol name="star.fill" size={16} color={colors.accent} />
          <Text className="text-sm text-foreground ml-1 mr-3">
            {parseFloat(avgRating).toFixed(1)} ({ratingCount})
          </Text>
          <IconSymbol name="person.fill" size={16} color={colors.muted} />
          <Text className="text-sm text-muted ml-1">{followCount} 关注</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
