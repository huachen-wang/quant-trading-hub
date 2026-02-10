import { Stack, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AdminLayout() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const colors = useColors();
  const segments = useSegments();
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean | null>(null);

  // 检查简单的管理员登录状态
  useEffect(() => {
    AsyncStorage.getItem("admin_logged_in").then((value) => {
      setAdminLoggedIn(value === "true");
    });
  }, []);

  useEffect(() => {
    if (adminLoggedIn === null) return; // 还在加载

    const inLoginPage = segments[segments.length - 1] === "login";

    // 如果已经简单登录,允许访问管理后台
    if (adminLoggedIn) {
      return; // 已登录,允许访问
    }

    // 如果没有简单登录,检查OAuth登录
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      // 如果不在登录页,跳转到登录页
      if (!inLoginPage) {
        router.replace("/admin/login" as any);
      }
    }
  }, [isAuthenticated, user, loading, adminLoggedIn, segments]);

  // 如果在加载中,显示加载指示器
  if (adminLoggedIn === null || (loading && !adminLoggedIn)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.foreground,
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "管理员后台",
        }}
      />
      <Stack.Screen
        name="strategies"
        options={{
          title: "策略管理",
        }}
      />
      <Stack.Screen
        name="strategy-form"
        options={{
          title: "编辑策略",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="comments"
        options={{
          title: "评论管理",
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: "管理员登录",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
