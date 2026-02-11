import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import * as SecureStore from "expo-secure-store";
import { EventEmitter } from "@/lib/event-emitter";
import { getApiBaseUrl } from "@/constants/oauth";

export default function AdminLayout() {
  const router = useRouter();
  const colors = useColors();
  const segments = useSegments();
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean | null>(null);

  const isOnLoginScreen = segments.includes("login");

  useEffect(() => {
    let isMounted = true;

    const getStoredAdminToken = async () => {
      if (Platform.OS === "web") {
        return sessionStorage.getItem("admin_token") || localStorage.getItem("admin_token");
      }
      return SecureStore.getItemAsync("admin_token");
    };

    const clearStoredAdminToken = async () => {
      if (Platform.OS === "web") {
        sessionStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_email");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_email");
        return;
      }

      await SecureStore.deleteItemAsync("admin_token");
      await SecureStore.deleteItemAsync("admin_email");
    };

    const checkAdminToken = async () => {
      if (!isMounted) return;
      const token = await getStoredAdminToken();

      if (!isMounted) return;

      if (!token) {
        setAdminLoggedIn(false);
        if (!isOnLoginScreen) {
          router.replace("/admin/login" as any);
        }
        return;
      }

      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/trpc/adminAuth.verifyToken`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ json: { token } }),
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          await clearStoredAdminToken();
          setAdminLoggedIn(false);
          if (!isOnLoginScreen) {
            router.replace("/admin/login" as any);
          }
          return;
        }

        setAdminLoggedIn(true);
        if (isOnLoginScreen) {
          router.replace("/admin" as any);
        }
      } catch (error) {
        console.error("[Admin] Failed to verify admin token:", error);
        setAdminLoggedIn(false);
        if (!isOnLoginScreen) {
          router.replace("/admin/login" as any);
        }
      }
    };

    checkAdminToken();

    const handleLoginSuccess = async () => {
      if (!isMounted) return;
      const token = await getStoredAdminToken();
      if (!isMounted || !token) return;
      await checkAdminToken();
    };

    const unsubscribe = EventEmitter.on("admin_login_success", () => {
      void handleLoginSuccess().catch((error) => {
        console.error("[Admin] Failed to handle login success:", error);
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOnLoginScreen, router]);

  if (adminLoggedIn === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
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
