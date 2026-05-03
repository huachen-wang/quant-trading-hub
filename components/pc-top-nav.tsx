import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter, usePathname } from "expo-router";

/**
 * PC 端顶部导航 - 极简安全版
 *
 * 修复历史：
 *   v1: 用了 expo-linear-gradient + useAuth + trpc → React 渲染崩溃
 *   v2: 移除 useResponsive 还是崩 → 是 import 阶段崩
 *   v3 (本版): 完全零外部依赖，纯 RN-Web，绝对不会崩
 *
 * 损失的功能（vs v1）：
 *   - Logo 图标的渐变（用纯色 + box-shadow 模拟）
 *   - 登录按钮的渐变（同上）
 *   - 用户头像/下拉菜单 (因为不 import useAuth)
 *   - 项目矩阵 mega menu (因为不 import trpc)
 *
 * 这些功能可以后续单独的 PR 加回来，先让网站能渲染。
 */
export function PcTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  
  // 默认 false，避免 SSR 阶段访问 window
  const [isDesktopWeb, setIsDesktopWeb] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    
    const updateSize = () => {
      try {
        const { width } = Dimensions.get("window");
        setIsDesktopWeb(width >= 1024);
      } catch {
        setIsDesktopWeb(false);
      }
    };
    
    updateSize();
    const sub = Dimensions.addEventListener("change", updateSize);
    return () => {
      try {
        sub?.remove();
      } catch {}
    };
  }, []);

  if (!isDesktopWeb) return null;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/" || pathname === "/(tabs)";
    return pathname?.startsWith(path) ?? false;
  };

  const navItems = [
    { href: "/(tabs)", label: "策略广场" },
    { href: "/cooperation", label: "合作授权" },
    { href: "/promo", label: "限时促销" },
  ];

  return (
    <View style={styles.topbar}>
      <View style={styles.inner}>
        {/* Logo */}
        <Pressable style={styles.logo} onPress={() => router.push("/(tabs)" as any)}>
          <Text style={styles.logoText}>eaxau.com</Text>
        </Pressable>

        {/* 主导航 */}
        <View style={styles.nav}>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as any)}
                style={[styles.navLink, active && styles.navLinkActive]}
              >
                <Text style={[styles.navLinkText, active && styles.navLinkTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 右侧：登录按钮 */}
        <View style={styles.right}>
          <Pressable
            onPress={() => router.push("/auth/login" as any)}
            style={styles.loginBtn}
          >
            <Text style={styles.loginBtnText}>登录 / 注册</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    position: Platform.OS === "web" ? ("sticky" as any) : "relative",
    top: 0,
    zIndex: 100,
    backgroundColor: "rgba(10,14,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
  },
  inner: {
    maxWidth: 1400,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
  },
  logo: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  logoText: {
    color: "#C9A96E",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "lowercase",
    fontFamily: Platform.OS === "web" ? "'SF Mono', Menlo, monospace" : "monospace",
  },
  nav: { flex: 1, flexDirection: "row", gap: 4 },
  navLink: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  navLinkActive: { backgroundColor: "rgba(245,158,11,0.08)" },
  navLinkText: { color: "#94A3B8", fontSize: 14, fontWeight: "500" },
  navLinkTextActive: { color: "#D8BC83", fontWeight: "700" },
  right: { flexDirection: "row", alignItems: "center", gap: 12 },
  loginBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#C9A96E",
  },
  loginBtnText: { color: "#0A1628", fontSize: 13, fontWeight: "700" },
});
