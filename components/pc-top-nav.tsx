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
 * 全端统一顶部导航 - 响应式
 *
 * 桌面（≥1024px）：完整显示 EAXAU + Logo + 5 个链接 + 登录按钮
 * 平板/手机（<1024px）：金色 Logo + 登录按钮 + ☰ 汉堡菜单（点开抽屉显示 5 个链接）
 *
 * 替代了原来的底部 Tab Bar，全端统一交互。
 */
export function PcTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [windowWidth, setWindowWidth] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    
    const updateSize = () => {
      try {
        const { width } = Dimensions.get("window");
        setWindowWidth(width);
      } catch {
        setWindowWidth(0);
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

  // 手机/平板原生模式：不渲染（手机 App 用原生导航）
  if (Platform.OS !== "web") return null;

  // 等待客户端检测窗口宽度（避免 SSR 闪烁）
  if (windowWidth === 0) return null;

  const isDesktop = windowWidth >= 1024;
  const isMobile = !isDesktop;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/" || pathname === "/(tabs)";
    return pathname?.startsWith(path) ?? false;
  };

  const navItems = [
    { href: "/(tabs)", label: "策略广场" },
    { href: "/(tabs)/group-buy", label: "合购" },
    { href: "/(tabs)/subscribe", label: "订阅" },
    { href: "/cooperation", label: "合作授权" },
    { href: "/promo", label: "限时促销" },
  ];

  const goTo = (href: string) => {
    setDrawerOpen(false);
    router.push(href as any);
  };

  return (
    <>
      <View style={styles.topbar}>
        <View style={[styles.inner, isMobile && styles.innerMobile]}>
          {/* Logo */}
          <Pressable style={styles.logo} onPress={() => goTo("/(tabs)")}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>EX</Text>
            </View>
            <View style={{ flexDirection: "column", marginLeft: 8 }}>
              <Text style={styles.logoBrand}>EAXAU</Text>
              <Text style={styles.logoSub}>· 量化军火库 ·</Text>
            </View>
          </Pressable>

          {/* 桌面端：内联 5 个导航 */}
          {isDesktop && (
            <View style={styles.nav}>
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Pressable
                    key={item.href}
                    onPress={() => goTo(item.href)}
                    style={[styles.navLink, active && styles.navLinkActive]}
                  >
                    <Text style={[styles.navLinkText, active && styles.navLinkTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* 右侧：手机用 spacer 推开 */}
          {isMobile && <View style={{ flex: 1 }} />}

          {/* 右侧：登录按钮 */}
          <View style={styles.right}>
            <Pressable
              onPress={() => goTo("/auth/login")}
              style={[styles.loginBtn, isMobile && styles.loginBtnMobile]}
            >
              <Text style={[styles.loginBtnText, isMobile && styles.loginBtnTextMobile]}>
                {isMobile ? "登录" : "登录 / 注册"}
              </Text>
            </Pressable>

            {/* 手机端：汉堡菜单按钮 */}
            {isMobile && (
              <Pressable
                onPress={() => setDrawerOpen((v) => !v)}
                style={styles.hamburger}
              >
                <Text style={styles.hamburgerIcon}>{drawerOpen ? "✕" : "☰"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* 手机端抽屉 */}
      {isMobile && drawerOpen && (
        <>
          {/* 背景遮罩 */}
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          {/* 抽屉内容 */}
          <View style={styles.drawer}>
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Pressable
                  key={item.href}
                  onPress={() => goTo(item.href)}
                  style={[styles.drawerItem, active && styles.drawerItemActive]}
                >
                  <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topbar: {
    position: Platform.OS === "web" ? ("sticky" as any) : "relative",
    top: 0,
    zIndex: 100,
    backgroundColor: "rgba(10,14,26,0.95)",
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
  innerMobile: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  logo: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  logoBrand: { color: "#F1F5F9", fontSize: 17, fontWeight: "900", letterSpacing: 0.4 },
  logoSub: { color: "#FBBF24", fontSize: 10, fontWeight: "600", letterSpacing: 1.6, marginTop: 2 },
  nav: { flex: 1, flexDirection: "row", gap: 4 },
  navLink: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  navLinkActive: { backgroundColor: "rgba(245,158,11,0.08)" },
  navLinkText: { color: "#94A3B8", fontSize: 14, fontWeight: "500" },
  navLinkTextActive: { color: "#FBBF24", fontWeight: "700" },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  loginBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#F59E0B",
  },
  loginBtnMobile: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  loginBtnText: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  loginBtnTextMobile: { fontSize: 12 },
  hamburger: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  hamburgerIcon: {
    color: "#F1F5F9",
    fontSize: 18,
    fontWeight: "700",
  },
  drawerBackdrop: {
    position: "absolute" as any,
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 99,
  },
  drawer: {
    position: "absolute" as any,
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,14,26,0.98)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    paddingVertical: 8,
    zIndex: 100,
  },
  drawerItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.06)",
  },
  drawerItemActive: {
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  drawerItemText: { color: "#F1F5F9", fontSize: 15, fontWeight: "500" },
  drawerItemTextActive: { color: "#FBBF24", fontWeight: "700" },
});
