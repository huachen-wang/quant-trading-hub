import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function AdminLayout() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/(tabs)/" as any);
    }
  }, [isAuthenticated, user, loading]);

  if (loading || !isAuthenticated || user?.role !== "admin") {
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
    </Stack>
  );
}
