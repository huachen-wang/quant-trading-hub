import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EventEmitter } from "@/lib/event-emitter";

export default function AdminLayout() {
  const router = useRouter();
  const colors = useColors();
  const segments = useSegments();
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean | null>(null);

  const checkAdminLogin = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem("admin_logged_in");
      setAdminLoggedIn(value === "true");
    } catch {
      setAdminLoggedIn(false);
    }
  }, []);

  // 初始检查
  useEffect(() => {
    checkAdminLogin();
  }, [checkAdminLogin]);

  // 监听登录事件
  useEffect(() => {
    const unsubscribe = EventEmitter.on("admin_login_success", () => {
      setAdminLoggedIn(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (adminLoggedIn === null) return;

    const inLoginPage = segments[segments.length - 1] === "login";

    if (adminLoggedIn) {
      // 已登录，如果在登录页则跳转到管理后台
      if (inLoginPage) {
        router.replace("/admin" as any);
      }
      return;
    }

    // 未登录，跳转到登录页
    if (!inLoginPage) {
      router.replace("/admin/login" as any);
    }
  }, [adminLoggedIn, segments]);

  // 加载中
  if (adminLoggedIn === null) {
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
        name="page-contents"
        options={{
          title: "订阅页面管理",
        }}
      />
      <Stack.Screen
        name="subscribers"
        options={{
          title: "订阅用户",
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
