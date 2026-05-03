import { useState } from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, Platform, TouchableOpacity, Animated } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { ContactModal } from "@/components/contact-modal";
import { useColors } from "@/hooks/use-colors";
import { glassStyle } from "@/lib/glass-styles";
import { PcTopNav } from "@/components/pc-top-nav";
import { useResponsive } from "@/hooks/use-responsive";

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

// 全局悬浮咨询按钮
function FloatingConsultButton() {
  const colors = useColors();
  const [showContactModal, setShowContactModal] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  };

  return (
    <>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <Animated.View style={[styles.floatingBtnWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          onPress={() => setShowContactModal(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          style={[styles.floatingBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, glassStyle("btn") as any]}

        >
          <Text style={styles.floatingBtnEmoji}>💬</Text>
          <Text style={styles.floatingBtnText}>咨询</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const isDesktopWeb = Platform.OS === "web" && isDesktop;
  const bottomPadding = Platform.OS === "web" ? 4 : Math.max(insets.bottom, 4);
  const tabBarHeight = (Platform.OS === "web" ? 72 : 56) + bottomPadding;

  return (
    <View style={{ flex: 1 }}>
      {/* B: PC 顶部导航 */}
      <PcTopNav />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarShowLabel: false,
          tabBarIconStyle: Platform.OS === "web" ? { height: 52 } : undefined,
          tabBarStyle: Platform.OS === "web"
            ? { display: "none" }
            : {
                paddingTop: 2,
                paddingBottom: bottomPadding,
                height: tabBarHeight,
                backgroundColor: Platform.OS === "web" ? "rgba(15,23,42,0.75)" : colors.background,
                borderTopColor: "rgba(148,163,184,0.08)",
                borderTopWidth: StyleSheet.hairlineWidth,
                ...(Platform.OS === "web" ? {
                  // @ts-ignore - web-only CSS properties
                  backdropFilter: "blur(20px) saturate(150%)",
                  WebkitBackdropFilter: "blur(20px) saturate(150%)",
                } : {}),
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
      {/* 全局悬浮咋询按钮 */}
      <FloatingConsultButton />
    </View>
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
  // 悬浮按钮
  floatingBtnWrapper: {
    position: "absolute",
    right: 16,
    bottom: 80,
    zIndex: 999,
  },
  floatingBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    gap: 4,
  },
  floatingBtnEmoji: {
    fontSize: 16,
  },
  floatingBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
