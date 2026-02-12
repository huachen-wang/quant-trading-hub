import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, StyleSheet } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Web端减小底部padding，避免过多空白
  const bottomPadding = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 8);
  const tabBarHeight = 52 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 4,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "策略",
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>📈</Text>,
        }}
      />
      <Tabs.Screen
        name="moments"
        options={{
          title: "合作",
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🤝</Text>,
        }}
      />
      <Tabs.Screen
        name="group-buy"
        options={{
          title: "合购",
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🛒</Text>,
        }}
      />
      <Tabs.Screen
        name="subscribe"
        options={{
          title: "订阅",
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>📬</Text>,
        }}
      />
      {/* 隐藏不需要的Tab页面 */}
      <Tabs.Screen
        name="favorites"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
});
