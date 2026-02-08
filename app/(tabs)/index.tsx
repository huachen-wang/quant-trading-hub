import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type Platform = "MT4" | "MT5" | undefined;
type OrderBy = "latest" | "popular" | "return";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>(undefined);
  const [orderBy, setOrderBy] = useState<OrderBy>("latest");

  const { data: strategies, isLoading, refetch, isRefetching } = trpc.strategies.list.useQuery({
    platform,
    orderBy,
    limit: 20,
    offset: 0,
  });

  const handleStrategyPress = (id: number) => {
    router.push(`/strategy/${id}` as any);
  };

  const renderHeader = () => (
    <View className="mb-4">
      {/* 标题和搜索 */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-3xl font-bold text-foreground">策略广场</Text>
        <TouchableOpacity
          onPress={() => router.push("/search" as any)}
          className="w-10 h-10 items-center justify-center rounded-full bg-surface"
          activeOpacity={0.7}
        >
          <IconSymbol name="magnifyingglass" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* 平台筛选 */}
      <View className="flex-row mb-3">
        <TouchableOpacity
          onPress={() => setPlatform(undefined)}
          className={`px-4 py-2 rounded-full mr-2 ${!platform ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`font-semibold ${!platform ? "text-background" : "text-foreground"}`}>全部</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPlatform("MT4")}
          className={`px-4 py-2 rounded-full mr-2 ${platform === "MT4" ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`font-semibold ${platform === "MT4" ? "text-background" : "text-foreground"}`}>MT4</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPlatform("MT5")}
          className={`px-4 py-2 rounded-full ${platform === "MT5" ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`font-semibold ${platform === "MT5" ? "text-background" : "text-foreground"}`}>MT5</Text>
        </TouchableOpacity>
      </View>

      {/* 排序 */}
      <View className="flex-row">
        <TouchableOpacity
          onPress={() => setOrderBy("latest")}
          className={`px-4 py-2 rounded-full mr-2 ${orderBy === "latest" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "latest" ? "text-primary font-semibold" : "text-muted"}`}>
            最新
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("popular")}
          className={`px-4 py-2 rounded-full mr-2 ${orderBy === "popular" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "popular" ? "text-primary font-semibold" : "text-muted"}`}>
            最热
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("return")}
          className={`px-4 py-2 rounded-full ${orderBy === "return" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "return" ? "text-primary font-semibold" : "text-muted"}`}>
            收益率
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center justify-center py-20">
      <Text className="text-muted text-base">暂无策略</Text>
      <Text className="text-muted text-sm mt-2">成为第一个发布策略的用户</Text>
    </View>
  );

  if (isLoading && !strategies) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        data={strategies || []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <StrategyCard
            id={item.id}
            title={item.title}
            platform={item.platform}
            totalReturn={item.totalReturn || "0.00"}
            avgRating={item.avgRating || "0.00"}
            followCount={item.followCount}
            ratingCount={item.ratingCount}
            author={item.author}
            coverImage={item.coverImage}
            onPress={() => handleStrategyPress(item.id)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      />
    </ScreenContainer>
  );
}
