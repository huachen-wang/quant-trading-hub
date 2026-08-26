import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View, Text, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { EventEmitter } from "@/lib/event-emitter";
import { getApiBaseUrl } from "@/constants/oauth";
import { PcTopNav } from "@/components/pc-top-nav";
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
  const { width } = useWindowDimensions();
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean | null>(null);
  const isCompactWeb = Platform.OS === "web" && width < 640;

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
  const isOnLoginPage = segments[segments.length - 1] === "login";

  useEffect(() => {
    if (adminLoggedIn === null) return; // 还在检查中

    if (!adminLoggedIn && !isOnLoginPage) {
      router.replace("/admin/login" as any);
    } else if (adminLoggedIn && isOnLoginPage) {
      router.replace("/admin" as any);
    }
  }, [adminLoggedIn, isOnLoginPage, router]);

  // 加载中状态
  if (adminLoggedIn === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {Platform.OS === "web" && adminLoggedIn && !isOnLoginPage && (
        <>
          <PcTopNav />
          <View style={styles.adminStrip}>
            <View style={styles.adminStripInner}>
              <Text style={styles.adminStripKicker}>{isCompactWeb ? "CONTROL ROOM" : "AI量化联盟 CONTROL ROOM"}</Text>
              {!isCompactWeb && (
                <Text style={styles.adminStripText}>ADMIN OPS / CONTENT / ORDERS / SOURCE LIBRARY</Text>
              )}
              <View style={styles.adminStripDot} />
              <Text style={styles.adminStripStatus}>{isCompactWeb ? "ONLINE" : "SYSTEM ONLINE"}</Text>
            </View>
          </View>
        </>
      )}
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: "管理员后台" }} />
        <Stack.Screen name="strategies" options={{ title: "策略管理" }} />
        <Stack.Screen name="strategy-form" options={{ title: "编辑策略" }} />
        <Stack.Screen name="backtest-data" options={{ title: "回测数据管理" }} />
        <Stack.Screen name="v2-content" options={{ title: "V2 核心策略图文" }} />
        <Stack.Screen name="v2-data" options={{ title: "V2 策略数据" }} />
        <Stack.Screen name="comments" options={{ title: "评论管理" }} />
        <Stack.Screen name="page-contents" options={{ title: "订阅页面管理" }} />
        <Stack.Screen name="subscribers" options={{ title: "订阅用户" }} />
        <Stack.Screen name="notifications" options={{ title: "通知公告管理" }} />
        <Stack.Screen name="contact-settings" options={{ title: "联系方式设置" }} />
        <Stack.Screen name="group-buys" options={{ title: "合购管理" }} />
        <Stack.Screen name="listings" options={{ title: "上架申请" }} />
        <Stack.Screen name="cooperation-contents" options={{ title: "合作页面管理" }} />
        <Stack.Screen name="cooperation-manage" options={{ title: "合作方案管理" }} />
        <Stack.Screen name="promo-manage" options={{ title: "促销商城管理" }} />
        <Stack.Screen name="site-entries" options={{ title: "侧边栏入口管理" }} />
        <Stack.Screen name="orders" options={{ title: "订单管理" }} />
        <Stack.Screen name="order-detail" options={{ title: "订单详情" }} />
        <Stack.Screen name="alliance-sessions" options={{ title: "资管委托接入与启用" }} />
        <Stack.Screen name="broker-funding" options={{ title: "券商入金与代收队列" }} />
        <Stack.Screen name="broker-funding-detail" options={{ title: "券商入金详情" }} />
        <Stack.Screen name="login" options={{ title: "管理员登录" }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  adminStrip: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.10)",
    backgroundColor: "rgba(2,6,23,0.86)",
  },
  adminStripInner: {
    maxWidth: 1360,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adminStripKicker: {
    color: "#D8BC83",
    fontSize: 11,
    fontWeight: "900",
  },
  adminStripText: {
    color: "rgba(226,232,240,0.62)",
    fontSize: 10,
    fontWeight: "800",
  },
  adminStripDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
    marginLeft: "auto",
  },
  adminStripStatus: {
    color: "#9AE6C1",
    fontSize: 10,
    fontWeight: "900",
  },
});
