import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, Platform } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { useColors } from "@/hooks/use-colors";

// 自定义Tab图标组件 - 支持高亮和置灰
function TabIcon({ emoji, label, focused, activeColor, inactiveColor }: {
  emoji: string;
  label: string;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <View style={styles.tabIconContainer}>
      <View style={[
        styles.tabIconCircle,
        focused && { backgroundColor: activeColor + "15" },
      ]}>
        <Text style={[
          styles.tabEmoji,
          { opacity: focused ? 1 : 0.45 },
        ]}>
          {emoji}
        </Text>
      </View>
      <Text style={[
        styles.tabLabel,
        {
          color: focused ? activeColor : inactiveColor,
          fontWeight: focused ? "700" : "400",
        },
      ]}>
        {label}
      </Text>
      {focused && (
        <View style={[styles.tabIndicator, { backgroundColor: activeColor }]} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 4 : Math.max(insets.bottom, 4);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarStyle: {
          paddingTop: 2,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "策略",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📈" label="策略" focused={focused} activeColor={colors.primary} inactiveColor={colors.muted} />
          ),
        }}
      />
      <Tabs.Screen
        name="moments"
        options={{
          title: "合作",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🤝" label="合作" focused={focused} activeColor={colors.primary} inactiveColor={colors.muted} />
          ),
        }}
      />
      <Tabs.Screen
        name="group-buy"
        options={{
          title: "合购",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🛒" label="合购" focused={focused} activeColor={colors.primary} inactiveColor={colors.muted} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscribe"
        options={{
          title: "订阅",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📬" label="订阅" focused={focused} activeColor={colors.primary} inactiveColor={colors.muted} />
          ),
        }}
      />
      {/* 隐藏不需要的Tab页面 */}
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 48,
    paddingTop: 2,
  },
  tabIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  tabEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 13,
  },
  tabIndicator: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
    marginTop: 2,
  },
});
