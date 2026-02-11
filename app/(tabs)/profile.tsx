import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Modal, Pressable, Alert, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { EventEmitter } from "@/lib/event-emitter";

export default function ProfileScreen() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const colors = useColors();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/admin/login" as any);
    }
  }, [authLoading, isAuthenticated]);

  const { data: downloads, isLoading } = trpc.downloads.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: purchases } = trpc.purchases.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const clearAdminToken = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_email");
      return;
    }
    await SecureStore.deleteItemAsync("admin_token");
    await SecureStore.deleteItemAsync("admin_email");
  };

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        await logout();
        await clearAdminToken();
        EventEmitter.emit("admin_logout");
      } finally {
        setShowSettings(false);
        router.replace("/admin/login" as any);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("确认退出登录吗？")) {
        performLogout();
      }
      return;
    }

    Alert.alert("退出登录", "确认退出当前登录账户吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => void performLogout() },
    ]);
  };

  if (authLoading || isLoading || !isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="p-6">
          <View className="flex-row justify-end mb-4">
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              className="bg-surface rounded-xl px-4 py-2"
              activeOpacity={0.8}
            >
              <Text className="text-foreground font-semibold">设置</Text>
            </TouchableOpacity>
          </View>

          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-3">
              <Text className="text-3xl text-primary font-bold">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <Text className="text-xl font-semibold text-foreground">{user?.name || "用户"}</Text>
            {user?.email && <Text className="text-sm text-muted mt-1">{user.email}</Text>}
          </View>

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
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📥</Text>
              <Text className="text-base font-semibold text-foreground">暂无下载记录</Text>
              <Text className="text-sm text-muted mt-1">浏览策略广场开始探索</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 24 }}
          onPress={() => setShowSettings(false)}
        >
          <Pressable
            style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
              设置
            </Text>
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.8}
              style={{ backgroundColor: colors.error + "15", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 }}
            >
              <Text style={{ color: colors.error, fontWeight: "700", textAlign: "center" }}>退出登录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSettings(false)}
              activeOpacity={0.8}
              style={{ marginTop: 10, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
            >
              <Text style={{ color: colors.muted, textAlign: "center" }}>取消</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
