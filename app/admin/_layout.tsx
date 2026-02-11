import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { EventEmitter } from "@/lib/event-emitter";
import { getApiBaseUrl } from "@/constants/oauth";
import * as SecureStore from "expo-secure-store";

/**
 * 获取存储的admin token
 */
async function getAdminToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem("admin_token");
  } else {
    return await SecureStore.getItemAsync("admin_token");
  }
}

export default function AdminLayout() {
  const router = useRouter();
  const colors = useColors();
  const segments = useSegments();
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean | null>(null);

  // 验证admin token
  const checkAuth = useCallback(async () => {
    try {
      const token = await getAdminToken();
      if (!token) {
        setAdminLoggedIn(false);
        return;
      }

      // 验证token是否有效
      const baseUrl = getApiBaseUrl();
      const encoded = encodeURIComponent(JSON.stringify({ json: { token } }));
      const res = await fetch(`${baseUrl}/api/trpc/adminAuth.verify?input=${encoded}`, {
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.result?.data?.json?.valid) {
        setAdminLoggedIn(true);
      } else {
        setAdminLoggedIn(false);
      }
    } catch (error) {
      console.error("[AdminLayout] Auth check failed:", error);
      setAdminLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 监听登录/退出事件
  useEffect(() => {
    const loginHandler = () => {
      setAdminLoggedIn(true);
    };
    const logoutHandler = () => {
      setAdminLoggedIn(false);
    };
    EventEmitter.on("admin_login_success", loginHandler);
    EventEmitter.on("admin_logout", logoutHandler);
    return () => {
      EventEmitter.off("admin_login_success", loginHandler);
      EventEmitter.off("admin_logout", logoutHandler);
    };
  }, []);

  // 根据登录状态重定向
  useEffect(() => {
    if (adminLoggedIn === null) return; // 还在检查中

    const isOnLoginPage = segments[segments.length - 1] === "login";

    if (!adminLoggedIn && !isOnLoginPage) {
      router.replace("/admin/login" as any);
    } else if (adminLoggedIn && isOnLoginPage) {
      router.replace("/admin" as any);
    }
  }, [adminLoggedIn, segments]);

  // 加载中状态
  if (adminLoggedIn === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
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
        name="notifications"
        options={{
          title: "通知公告管理",
        }}
      />
      <Stack.Screen
        name="contact-settings"
        options={{
          title: "联系方式设置",
        }}
      />
      <Stack.Screen
        name="group-buys"
        options={{
          title: "合购管理",
        }}
      />
      <Stack.Screen
        name="listings"
        options={{
          title: "上架申请",
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
