import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

  const { data: myStrategies, isLoading: strategiesLoading } = trpc.strategies.myStrategies.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const handleLogout = async () => {
    await logout();
    router.replace("/(tabs)/" as any);
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
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-surface items-center justify-center mb-4">
            <IconSymbol name="person.fill" size={48} color={colors.muted} />
          </View>
          <Text className="text-2xl font-bold text-foreground mb-2">欢迎来到量化交易平台</Text>
          <Text className="text-muted text-center">登录后可以发布策略、关注和评价其他策略</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/login" as any)}
          className="bg-primary px-8 py-3 rounded-full w-full"
          activeOpacity={0.8}
        >
          <Text className="text-background font-semibold text-base text-center">立即登录</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 用户信息 */}
        <View className="p-6 border-b border-border">
          <View className="flex-row items-center mb-4">
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} className="w-20 h-20 rounded-full mr-4" />
            ) : (
              <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mr-4">
                <IconSymbol name="person.fill" size={40} color={colors.muted} />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground mb-1">{user?.name || "用户"}</Text>
              <Text className="text-sm text-muted">{user?.email || ""}</Text>
            </View>
          </View>
        </View>

        {/* 我的策略 */}
        <View className="p-6 border-b border-border">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-foreground">我的策略</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/publish" as any)}
              className="flex-row items-center"
              activeOpacity={0.7}
            >
              <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
              <Text className="text-primary font-semibold ml-1">发布</Text>
            </TouchableOpacity>
          </View>

          {strategiesLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : myStrategies && myStrategies.length > 0 ? (
            <View>
              {myStrategies.slice(0, 3).map((strategy) => (
                <TouchableOpacity
                  key={strategy.id}
                  onPress={() => router.push(`/strategy/${strategy.id}` as any)}
                  className="bg-surface rounded-xl p-4 mb-2"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground mb-1" numberOfLines={1}>
                        {strategy.title}
                      </Text>
                      <View className="flex-row items-center">
                        <View
                          className={`px-2 py-0.5 rounded ${strategy.platform === "MT4" ? "bg-primary/20" : "bg-accent/20"}`}
                        >
                          <Text
                            className={`text-xs font-semibold ${strategy.platform === "MT4" ? "text-primary" : "text-accent"}`}
                          >
                            {strategy.platform}
                          </Text>
                        </View>
                        <Text className="text-xs text-muted ml-2">
                          {strategy.followCount} 关注 · {strategy.viewCount} 浏览
                        </Text>
                      </View>
                    </View>
                    <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                  </View>
                </TouchableOpacity>
              ))}
              {myStrategies.length > 3 && (
                <TouchableOpacity className="py-2 items-center" activeOpacity={0.7}>
                  <Text className="text-primary font-semibold">查看全部 {myStrategies.length} 个策略</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="py-8 items-center">
              <Text className="text-muted">您还没有发布策略</Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/publish" as any)}
                className="bg-primary px-6 py-2 rounded-full mt-4"
                activeOpacity={0.8}
              >
                <Text className="text-background font-semibold">立即发布</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 设置选项 */}
        <View className="p-6">
          <Text className="text-xl font-bold text-foreground mb-4">设置</Text>

          <TouchableOpacity className="flex-row items-center justify-between py-4 border-b border-border" activeOpacity={0.7}>
            <View className="flex-row items-center">
              <IconSymbol name="person.fill" size={20} color={colors.foreground} />
              <Text className="text-base text-foreground ml-3">编辑个人资料</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            className="flex-row items-center py-4"
            activeOpacity={0.7}
          >
            <Text className="text-base text-error ml-8">退出登录</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
