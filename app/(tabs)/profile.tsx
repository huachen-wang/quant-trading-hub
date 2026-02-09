import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";
import { useState } from "react";
import * as WebBrowser from "expo-web-browser";

export default function ProfileScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const { data: downloads, isLoading } = trpc.downloads.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: purchases } = trpc.purchases.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const handleLogin = async () => {
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${process.env.EXPO_PUBLIC_API_URL}/api/auth/login`,
        "exp://localhost:8081/oauth/callback"
      );
      if (result.type === "success") {
        // 登录成功后刷新页面
        router.replace("/(tabs)/profile");
      }
    } catch (error) {
      Alert.alert("登录失败", "请稍后重试");
    }
  };

  const handleQuickRegister = () => {
    if (!email || !email.includes("@")) {
      Alert.alert("提示", "请输入有效的邮箱地址");
      return;
    }
    
    Alert.alert(
      "注册提示",
      "简化版暂不支持注册功能。您可以直接浏览所有EA策略,无需登录即可查看详情和下载链接。",
      [{ text: "知道了" }]
    );
  };

  if (authLoading || isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  // 未登录状态 - 显示简化的访客模式
  if (!isAuthenticated) {
    return (
      <ScreenContainer>
        <View className="p-6">
          {/* 访客信息 */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-3">
              <Text className="text-3xl">👤</Text>
            </View>
            <Text className="text-xl font-semibold text-foreground">访客模式</Text>
            <Text className="text-sm text-muted mt-1">浏览所有EA策略</Text>
          </View>

          {/* 提示卡片 */}
          <View className="bg-surface rounded-2xl p-6 mb-6">
            <Text className="text-base text-foreground mb-2">✨ 无需登录即可使用</Text>
            <Text className="text-sm text-muted leading-relaxed">
              您可以自由浏览所有EA策略、查看详细信息、实盘数据和下载链接。如需保存下载记录,可选择登录。
            </Text>
          </View>

          {/* 快速注册(可选) */}
          {!isRegistering ? (
            <TouchableOpacity
              onPress={() => setIsRegistering(true)}
              className="bg-primary rounded-2xl p-4 mb-3"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-center text-base">
                登录/注册 (可选)
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="bg-surface rounded-2xl p-6 mb-3">
              <Text className="text-base font-semibold text-foreground mb-4">快速注册</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="输入您的邮箱"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-background rounded-xl px-4 py-3 text-foreground mb-4"
                placeholderTextColor={colors.muted}
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleQuickRegister}
                  className="flex-1 bg-primary rounded-xl py-3"
                  activeOpacity={0.8}
                >
                  <Text className="text-background font-semibold text-center">注册</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsRegistering(false)}
                  className="flex-1 bg-border rounded-xl py-3"
                  activeOpacity={0.8}
                >
                  <Text className="text-foreground font-semibold text-center">取消</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 功能说明 */}
          <View className="bg-surface rounded-2xl p-6">
            <Text className="text-base font-semibold text-foreground mb-3">平台功能</Text>
            <View className="gap-3">
              <View className="flex-row items-center">
                <Text className="text-lg mr-2">📊</Text>
                <Text className="text-sm text-muted flex-1">查看所有EA策略和实盘数据</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-lg mr-2">💬</Text>
                <Text className="text-sm text-muted flex-1">阅读策略说明和评论</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-lg mr-2">📥</Text>
                <Text className="text-sm text-muted flex-1">获取下载链接和联系方式</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-lg mr-2">🔍</Text>
                <Text className="text-sm text-muted flex-1">搜索和筛选策略</Text>
              </View>
            </View>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // 已登录状态
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
