import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, StyleSheet } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Web端增加底部padding以适配手机浏览器底部工具栏和iOS Home Indicator
  const bottomPadding = Platform.OS === "web" ? 28 : Math.max(insets.bottom, 12);
  const tabBarHeight = 62 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "策略",
          tabBarIcon: () => <Text style={styles.tabIcon}>📈</Text>,
        }}
      />
      <Tabs.Screen
        name="moments"
        options={{
          title: "动态",
          tabBarIcon: () => <Text style={styles.tabIcon}>📣</Text>,
        }}
      />
      <Tabs.Screen
        name="group-buy"
        options={{
          title: "合购",
          tabBarIcon: () => <Text style={styles.tabIcon}>🤝</Text>,
        }}
      />
      <Tabs.Screen
        name="subscribe"
        options={{
          title: "订阅",
          tabBarIcon: () => <Text style={styles.tabIcon}>📬</Text>,
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
    fontSize: 22,
    lineHeight: 28,
  },
});
