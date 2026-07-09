import { useState } from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, Platform, TouchableOpacity, Animated, useWindowDimensions } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { ContactModal } from "@/components/contact-modal";
import { useColors } from "@/hooks/use-colors";
import { glassStyle } from "@/lib/glass-styles";
import { PcTopNav } from "@/components/pc-top-nav";
import { FloatingSideNav } from "@/components/floating-side-nav";
import { IconSymbol } from "@/components/ui/icon-symbol";

// 自定义Tab图标组件 - 支持高亮和置灰
function TabIcon({ code, label, focused, activeColor, inactiveColor }: {
  code: string;
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
          styles.tabCode,
          { opacity: focused ? 1 : 0.45 },
        ]}>
          {code}
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
function FloatingConsultButton({
  compact,
  dockInHeader,
  isWeb,
}: {
  compact: boolean;
  dockInHeader: boolean;
  isWeb: boolean;
}) {
  const colors = useColors();
  const [showContactModal, setShowContactModal] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: Platform.OS !== "web" }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: Platform.OS !== "web" }).start();
  };

  return (
    <>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <Animated.View
        style={[
          styles.floatingBtnWrapper,
          isWeb && styles.floatingBtnWrapperWeb,
          dockInHeader && styles.floatingBtnWrapperHeader,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <TouchableOpacity
          onPress={() => setShowContactModal(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          style={[
            styles.floatingBtn,
            compact && styles.floatingBtnCompact,
            dockInHeader && styles.floatingBtnHeader,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
            glassStyle("btn") as any,
          ]}
          accessibilityLabel="联系咨询"

        >
          <IconSymbol name="bubble.left.fill" size={compact ? 19 : 16} color="#fff" />
          {!compact && <Text style={styles.floatingBtnText}>咨询</Text>}
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isCompactWeb = isWeb && width < 768;
  const bottomPadding = isWeb ? 4 : Math.max(insets.bottom, 4);
  const tabBarHeight = (isWeb ? 72 : 56) + bottomPadding;

  return (
    <View style={{ flex: 1 }}>
      {/* B: PC 顶部导航 */}
      <PcTopNav />
      <FloatingSideNav />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarShowLabel: false,
          tabBarIconStyle: isWeb ? { height: 52 } : undefined,
          tabBarStyle: isWeb
            ? { display: "none" }
            : {
                paddingTop: 2,
                paddingBottom: bottomPadding,
                height: tabBarHeight,
                backgroundColor: colors.background,
                borderTopColor: "rgba(148,163,184,0.08)",
                borderTopWidth: StyleSheet.hairlineWidth,
              },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "策略",
            tabBarIcon: ({ focused }) => (
              <TabIcon code="EA" label="策略" focused={focused} activeColor={colors.primary} inactiveColor={colors.muted} />
            ),
          }}
        />
        <Tabs.Screen
          name="moments"
          options={{
            title: "合作",
            tabBarIcon: ({ focused }) => (
              <TabIcon code="B2B" label="合作" focused={focused} activeColor={colors.primary} inactiveColor={colors.muted} />
            ),
          }}
        />
        <Tabs.Screen
          name="group-buy"
          options={{
            title: "合购",
            tabBarIcon: ({ focused }) => (
              <TabIcon code="GB" label="合购" focused={focused} activeColor={colors.primary} inactiveColor={colors.muted} />
            ),
          }}
        />
        <Tabs.Screen
          name="subscribe"
          options={{
            title: "订阅",
            tabBarIcon: ({ focused }) => (
              <TabIcon code="ACC" label="订阅" focused={focused} activeColor={colors.primary} inactiveColor={colors.muted} />
            ),
          }}
        />
        {/* 隐藏不需要的Tab页面 */}
        <Tabs.Screen name="favorites" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
      {/* 全局悬浮咋询按钮 */}
      <FloatingConsultButton compact={isWeb} dockInHeader={isCompactWeb} isWeb={isWeb} />
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
  tabCode: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0,
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
  floatingBtnWrapperWeb: {
    right: 8,
    bottom: 24,
  },
  floatingBtnWrapperHeader: {
    right: 68,
    top: 8,
    bottom: "auto" as any,
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
  floatingBtnCompact: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 6,
    justifyContent: "center",
  },
  floatingBtnHeader: {
    width: 40,
    height: 40,
  },
  floatingBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
