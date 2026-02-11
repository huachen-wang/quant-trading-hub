import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { EventEmitter } from "@/lib/event-emitter";
import { clearAdminToken, getAdminToken } from "@/lib/admin-api";
import { getApiBaseUrl } from "@/constants/oauth";

export default function AdminLayout() {
  const router = useRouter();
  const colors = useColors();
  const segments = useSegments();
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean | null>(null);

  const isOnLoginScreen = segments.includes("login");

  useEffect(() => {
    let isMounted = true;

    const checkAdminToken = async () => {
      if (!isMounted) return;
      const token = await getAdminToken();

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
          const errorMessage = data?.error?.json?.message || data?.error?.message || res.statusText;
          console.error("[Admin] Admin token verification failed:", errorMessage);
          await clearAdminToken();
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
        console.error("[Admin] Failed to verify admin token (network/server issue):", error);
        setAdminLoggedIn(false);
        if (!isOnLoginScreen) {
          router.replace("/admin/login" as any);
        }
      }
    };

    checkAdminToken();

    const handleLoginSuccess = async () => {
      if (!isMounted) return;
      const token = await getAdminToken();
      if (!isMounted || !token) return;
      setAdminLoggedIn(true);
      if (isOnLoginScreen) {
        router.replace("/admin" as any);
      }
    };

    const unsubscribe = EventEmitter.on("admin_login_success", () => {
      void handleLoginSuccess();
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
