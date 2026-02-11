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

  // 简化版本：移除登录验证，直接允许访问
  useEffect(() => {
    setAdminLoggedIn(true);
  }, []);

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
