import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

/**
 * 全端统一顶部导航 - 响应式 + 用户状态
 *
 * 桌面（≥1024px）：完整显示 EAXAU + Logo + 5 个链接 + 用户区
 * 手机（<1024px）：金色 Logo + 用户区 + ☰ 汉堡菜单
 *
 * 用户区状态：
 * - 未登录：[登录/注册] 按钮
 * - 已登录：[头像 + 昵称 ▾] 点击展开下拉（个人中心 / 我的订单 / 退出）
 */
export function PcTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, loading } = useAuth();

  const [windowWidth, setWindowWidth] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const updateSize = () => {
      try {
        setWindowWidth(Dimensions.get("window").width);
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

  if (Platform.OS !== "web") return null;
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
    setUserMenuOpen(false);
    router.push(href as any);
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setDrawerOpen(false);
    try {
      await logout();
      router.replace("/(tabs)" as any);
    } catch (e) {
      console.error("logout failed", e);
    }
  };

  // 用户名显示（昵称优先，邮箱前缀其次，"用户" 兜底）
  const displayName = user?.name || user?.email?.split("@")[0] || "用户";
  // 头像首字母
  const avatarLetter = (displayName[0] || "U").toUpperCase();

  // 用户区组件
  const renderUserArea = () => {
    if (loading) {
      return <View style={styles.loadingDot} />;
    }

    if (!isAuthenticated) {
      return (
        <Pressable
          onPress={() => goTo("/auth/login")}
          style={[styles.loginBtn, isMobile && styles.loginBtnMobile]}
        >
          <Text style={[styles.loginBtnText, isMobile && styles.loginBtnTextMobile]}>
            {isMobile ? "登录" : "登录 / 注册"}
          </Text>
        </Pressable>
      );
    }

    // 已登录
    return (
      <Pressable
        onPress={() => setUserMenuOpen((v) => !v)}
        style={[styles.userPill, isMobile && styles.userPillMobile]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
        {!isMobile && (
          <>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.userArrow}>▾</Text>
          </>
        )}
      </Pressable>
    );
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

          {/* 手机端 spacer */}
          {isMobile && <View style={{ flex: 1 }} />}

          {/* 右侧：用户区 + 汉堡 */}
          <View style={styles.right}>
            {renderUserArea()}

            {isMobile && (
              <Pressable
                onPress={() => {
                  setUserMenuOpen(false);
                  setDrawerOpen((v) => !v);
                }}
                style={styles.hamburger}
              >
                <Text style={styles.hamburgerIcon}>{drawerOpen ? "✕" : "☰"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* 桌面端用户下拉菜单 */}
      {isDesktop && userMenuOpen && isAuthenticated && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setUserMenuOpen(false)} />
          <View style={styles.userMenu}>
            <View style={styles.userMenuHeader}>
              <Text style={styles.userMenuName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.userMenuEmail} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <Pressable
              style={styles.userMenuItem}
              onPress={() => goTo("/(tabs)/profile")}
            >
              <Text style={styles.userMenuItemText}>👤  个人中心</Text>
            </Pressable>
            <Pressable style={styles.userMenuItem} onPress={() => goTo("/(tabs)/profile")}>
              <Text style={styles.userMenuItemText}>📦  我的订单</Text>
            </Pressable>
            <Pressable
              style={styles.userMenuItem}
              onPress={() => goTo("/(tabs)/favorites")}
            >
              <Text style={styles.userMenuItemText}>⭐  我的收藏</Text>
            </Pressable>
            {user?.role === "admin" && (
              <Pressable style={styles.userMenuItem} onPress={() => goTo("/admin")}>
                <Text style={styles.userMenuItemText}>🛠  管理后台</Text>
              </Pressable>
            )}
            <View style={styles.userMenuDivider} />
            <Pressable style={styles.userMenuItem} onPress={handleLogout}>
              <Text style={[styles.userMenuItemText, { color: "#F87171" }]}>
                🚪  退出登录
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* 手机端抽屉 */}
      {isMobile && drawerOpen && (
        <>
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawer}>
            {/* 已登录时显示用户信息 */}
            {isAuthenticated && (
              <View style={styles.drawerUserHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{avatarLetter}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.drawerUserName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.drawerUserEmail} numberOfLines={1}>
                    {user?.email}
                  </Text>
                </View>
              </View>
            )}

            {/* 导航项 */}
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Pressable
                  key={item.href}
                  onPress={() => goTo(item.href)}
                  style={[styles.drawerItem, active && styles.drawerItemActive]}
                >
                  <Text
                    style={[styles.drawerItemText, active && styles.drawerItemTextActive]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* 已登录时显示用户操作 */}
            {isAuthenticated && (
              <>
                <View style={{ height: 8 }} />
                <Pressable
                  style={styles.drawerItem}
                  onPress={() => goTo("/(tabs)/profile")}
                >
                  <Text style={styles.drawerItemText}>👤  个人中心</Text>
                </Pressable>
                <Pressable style={styles.drawerItem} onPress={() => goTo("/(tabs)/profile")}>
                  <Text style={styles.drawerItemText}>📦  我的订单</Text>
                </Pressable>
                <Pressable
                  style={styles.drawerItem}
                  onPress={() => goTo("/(tabs)/favorites")}
                >
                  <Text style={styles.drawerItemText}>⭐  我的收藏</Text>
                </Pressable>
                {user?.role === "admin" && (
                  <Pressable style={styles.drawerItem} onPress={() => goTo("/admin")}>
                    <Text style={styles.drawerItemText}>🛠  管理后台</Text>
                  </Pressable>
                )}
                <Pressable style={styles.drawerItem} onPress={handleLogout}>
                  <Text style={[styles.drawerItemText, { color: "#F87171" }]}>
                    🚪  退出登录
                  </Text>
                </Pressable>
              </>
            )}
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
    backgroundColor: "#C9A96E",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: {
    color: "#0A1628",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  logoBrand: { color: "#F1F5F9", fontSize: 17, fontWeight: "900", letterSpacing: 0.4 },
  logoSub: { color: "#D8BC83", fontSize: 10, fontWeight: "600", letterSpacing: 1.6, marginTop: 2 },
  nav: { flex: 1, flexDirection: "row", gap: 4 },
  navLink: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  navLinkActive: { backgroundColor: "rgba(245,158,11,0.08)" },
  navLinkText: { color: "#94A3B8", fontSize: 14, fontWeight: "500" },
  navLinkTextActive: { color: "#D8BC83", fontWeight: "700" },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },

  loginBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#C9A96E",
  },
  loginBtnMobile: { paddingHorizontal: 12, paddingVertical: 7 },
  loginBtnText: { color: "#0A1628", fontSize: 13, fontWeight: "700" },
  loginBtnTextMobile: { fontSize: 12 },

  loadingDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
  },

  userPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)",
    maxWidth: 220,
  },
  userPillMobile: { paddingRight: 6 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#C9A96E",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#0A1628", fontSize: 13, fontWeight: "900" },
  userName: { color: "#F1F5F9", fontSize: 13, fontWeight: "600", maxWidth: 120 },
  userArrow: { color: "#94A3B8", fontSize: 10 },

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
  hamburgerIcon: { color: "#F1F5F9", fontSize: 18, fontWeight: "700" },

  // 桌面用户下拉菜单
  menuBackdrop: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  userMenu: {
    position: "absolute" as any,
    top: 60,
    right: 24,
    width: 240,
    backgroundColor: "#0A0E1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    paddingVertical: 8,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  userMenuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    marginBottom: 4,
  },
  userMenuName: { color: "#F1F5F9", fontSize: 14, fontWeight: "700" },
  userMenuEmail: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  userMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userMenuItemText: { color: "#F1F5F9", fontSize: 13, fontWeight: "500" },
  userMenuDivider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.12)",
    marginVertical: 4,
    marginHorizontal: 12,
  },

  // 手机抽屉
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
  drawerUserHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    marginBottom: 4,
  },
  drawerUserName: { color: "#F1F5F9", fontSize: 15, fontWeight: "700" },
  drawerUserEmail: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  drawerItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.06)",
  },
  drawerItemActive: { backgroundColor: "rgba(245,158,11,0.08)" },
  drawerItemText: { color: "#F1F5F9", fontSize: 15, fontWeight: "500" },
  drawerItemTextActive: { color: "#D8BC83", fontWeight: "700" },
});
