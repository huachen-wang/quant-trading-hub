import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

export default function FollowingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: strategies, isLoading, refetch, isRefetching } = trpc.follows.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated }
  );

  const handleStrategyPress = (id: number) => {
    router.push(`/strategy/${id}` as any);
  };

  if (authLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-2xl font-bold text-foreground mb-4">请先登录</Text>
        <Text className="text-muted text-center mb-6">登录后可以关注您感兴趣的策略,随时查看最新动态</Text>
        <TouchableOpacity
          onPress={() => router.push("/login" as any)}
          className="bg-primary px-8 py-3 rounded-full"
          activeOpacity={0.8}
        >
          <Text className="text-background font-semibold text-base">立即登录</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const renderEmpty = () => (
    <View className="items-center justify-center py-20">
      <Text className="text-muted text-base">暂无关注的策略</Text>
      <Text className="text-muted text-sm mt-2">去策略广场发现感兴趣的策略</Text>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/" as any)}
        className="bg-primary px-6 py-2 rounded-full mt-4"
        activeOpacity={0.8}
      >
        <Text className="text-background font-semibold">浏览策略</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      onPress={() => handleStrategyPress(item.id)}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground mb-1" numberOfLines={1}>
            {item.title}
          </Text>
          <View className="flex-row items-center">
            <View className={`px-2 py-0.5 rounded ${item.platform === "MT4" ? "bg-primary/20" : "bg-accent/20"}`}>
              <Text className={`text-xs font-semibold ${item.platform === "MT4" ? "text-primary" : "text-accent"}`}>
                {item.platform}
              </Text>
            </View>
            {item.author && (
              <Text className="text-xs text-muted ml-2">by {item.author.name || "匿名用户"}</Text>
            )}
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Text className="text-sm text-muted mr-4">
            收益率:{" "}
            <Text
              className="font-semibold"
              style={{
                color: parseFloat(item.totalReturn || "0") >= 0 ? colors.success : colors.error,
              }}
            >
              {parseFloat(item.totalReturn || "0") >= 0 ? "+" : ""}
              {parseFloat(item.totalReturn || "0").toFixed(2)}%
            </Text>
          </Text>
          <Text className="text-sm text-muted">
            评分: <Text className="font-semibold text-foreground">{parseFloat(item.avgRating || "0").toFixed(1)}</Text>
          </Text>
        </View>
        <Text className="text-xs text-muted">{new Date(item.updatedAt).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="p-4 border-b border-border">
        <Text className="text-3xl font-bold text-foreground">我的关注</Text>
        <Text className="text-sm text-muted mt-1">共关注 {strategies?.length || 0} 个策略</Text>
      </View>
      <FlatList
        data={strategies || []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      />
    </ScreenContainer>
  );
}
