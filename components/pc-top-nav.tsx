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
import { useAuth } from "@/hooks/use-auth";
import { BrandWordmark } from "@/components/brand-wordmark";

/**
 * 全端统一顶部导航 - 响应式 + 用户状态
 *
 * 桌面（≥1024px）：完整显示 EAXAU 字标 + 5 个链接 + 用户区
 * 手机（<1024px）：EAXAU 字标 + 用户区；导航交给全局悬浮侧边栏
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
    { href: "/(tabs)", label: "策略广场", code: "MKT" },
    { href: "/(tabs)/group-buy", label: "合购", code: "GB" },
    { href: "/(tabs)/subscribe", label: "订阅", code: "ACC" },
    { href: "/cooperation", label: "合作授权", code: "B2B" },
    { href: "/promo", label: "限时促销", code: "PRM" },
  ];
  const goTo = (href: string) => {
    setUserMenuOpen(false);
    router.push(href as any);
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
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
        onPress={() => (isMobile ? goTo("/(tabs)/profile") : setUserMenuOpen((v) => !v))}
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
          <Pressable
            style={[styles.logo, isMobile && styles.logoMobile]}
            onPress={() => goTo("/(tabs)")}
            accessibilityLabel="EAXAU"
          >
            <BrandWordmark size={isMobile ? "sm" : "md"} />
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
                    <Text style={[styles.navCode, active && styles.navCodeActive]}>{item.code}</Text>
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

          {isDesktop && (
            <View style={styles.marketStatus}>
              <View style={styles.marketDot} />
              <Text style={styles.marketStatusText}>LIVE SOURCE DESK</Text>
            </View>
          )}

          {/* 右侧：用户区 */}
          <View style={styles.right}>
            {renderUserArea()}
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
              <Text style={styles.userMenuItemText}>个人中心</Text>
            </Pressable>
            <Pressable style={styles.userMenuItem} onPress={() => goTo("/(tabs)/profile")}>
              <Text style={styles.userMenuItemText}>我的订单</Text>
            </Pressable>
            <Pressable
              style={styles.userMenuItem}
              onPress={() => goTo("/(tabs)/favorites")}
            >
              <Text style={styles.userMenuItemText}>我的收藏</Text>
            </Pressable>
            {user?.role === "admin" && (
              <Pressable style={styles.userMenuItem} onPress={() => goTo("/admin")}>
                <Text style={styles.userMenuItemText}>管理后台</Text>
              </Pressable>
            )}
            <View style={styles.userMenuDivider} />
            <Pressable style={styles.userMenuItem} onPress={handleLogout}>
              <Text style={[styles.userMenuItemText, { color: "#F87171" }]}>
                退出登录
              </Text>
            </Pressable>
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
    backgroundColor: "rgba(3,7,18,0.96)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(216,188,131,0.20)",
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "saturate(1.25) blur(14px)",
        }
      : {}),
  },
  inner: {
    maxWidth: 1360,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  innerMobile: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  logo: {
    alignItems: "flex-start",
    justifyContent: "center",
    flexShrink: 0,
    minHeight: 40,
    minWidth: 134,
    paddingHorizontal: 0,
  },
  logoMobile: {
    minHeight: 36,
    minWidth: 88,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
  },
  nav: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    backgroundColor: "rgba(8,15,28,0.78)",
  },
  navLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "transparent",
  },
  navLinkActive: {
    backgroundColor: "rgba(216,188,131,0.12)",
    borderColor: "rgba(216,188,131,0.30)",
  },
  navCode: {
    color: "rgba(148,163,184,0.62)",
    fontSize: 9,
    fontWeight: "900",
  },
  navCodeActive: {
    color: "#D8BC83",
  },
  navLinkText: { color: "#A7B0C0", fontSize: 12, fontWeight: "700" },
  navLinkTextActive: { color: "#F2D99B", fontWeight: "800" },
  marketStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.18)",
    backgroundColor: "rgba(6,78,59,0.10)",
  },
  marketDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  marketStatusText: {
    color: "#9AE6C1",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
  },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },

  loginBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
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
    paddingVertical: 3,
    borderRadius: 6,
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

});
