import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";

export default function ProfileScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();

  const { data: downloads, isLoading } = trpc.downloads.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: purchases } = trpc.purchases.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl font-semibold text-foreground mb-4">请先登录</Text>
        <Text className="text-base text-muted text-center mb-6">
          登录后可查看您的下载记录和已购买策略
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="p-6">
        {/* 用户信息 */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-3">
            <Text className="text-3xl text-primary font-bold">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <Text className="text-xl font-semibold text-foreground">{user?.name || "用户"}</Text>
          {user?.email && <Text className="text-sm text-muted mt-1">{user.email}</Text>}
        </View>

        {/* 管理员入口 */}
        {user?.role === "admin" && (
          <TouchableOpacity
            onPress={() => router.push("/admin" as any)}
            className="bg-primary rounded-2xl p-4 mb-6 flex-row items-center justify-between"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-background/20 items-center justify-center mr-3">
                <Text className="text-background text-xl">⚙️</Text>
              </View>
              <View>
                <Text className="text-background font-bold text-base">管理员后台</Text>
                <Text className="text-background/80 text-xs">管理策略和评论</Text>
              </View>
            </View>
            <Text className="text-background text-xl">→</Text>
          </TouchableOpacity>
        )}

        {/* 统计信息 */}
        <View className="flex-row justify-around mb-8 bg-surface rounded-2xl p-6">
          <View className="items-center">
            <Text className="text-2xl font-bold text-primary">{purchases?.length || 0}</Text>
            <Text className="text-sm text-muted mt-1">已购买</Text>
          </View>
          <View className="w-px bg-border" />
          <View className="items-center">
            <Text className="text-2xl font-bold text-accent">{downloads?.length || 0}</Text>
            <Text className="text-sm text-muted mt-1">下载次数</Text>
          </View>
        </View>

        {/* 我的下载 */}
        <Text className="text-lg font-semibold text-foreground mb-4">我的下载</Text>
        {downloads && downloads.length > 0 ? (
          <FlatList
            data={downloads}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="bg-surface rounded-xl p-4 mb-3"
                onPress={() => router.push(`/strategy/${item.strategy?.id}` as any)}
              >
                <Text className="text-base font-semibold text-foreground mb-1">
                  {item.strategy?.title}
                </Text>
                <Text className="text-sm text-muted">
                  下载于 {new Date(item.downloadedAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View className="bg-surface rounded-xl p-8 items-center">
            <Text className="text-base text-muted">暂无下载记录</Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
