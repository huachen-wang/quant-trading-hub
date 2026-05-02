import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  Pressable,
  Animated,
} from "react-native";
import { useRouter, usePathname, Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

/**
 * PC 端全局顶部导航
 *
 * 仅在 Platform.OS === 'web' 且 isDesktop 时渲染。
 * 移动端 / native 平台返回 null（不影响现有底部 tabbar）。
 *
 * 包含：
 *   - Logo
 *   - 主导航（with mega menu on MT4/MT5）
 *   - 项目矩阵切换 pill
 *   - 搜索 icon
 *   - 收藏 icon
 *   - 用户头像 / 登录按钮
 *
 * Sticky 在视窗顶部，玻璃模糊背景。
 */
export function PcTopNav() {
  const colors = useColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const [megaOpen, setMegaOpen] = useState<"mt4" | "mt5" | null>(null);
  const [showSitesMenu, setShowSitesMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { data: categoriesData } = trpc.categories.list.useQuery(undefined, {
    enabled: Platform.OS === "web" && isDesktop,
  });

  // 仅 desktop web 渲染
  if (Platform.OS !== "web" || !isDesktop) return null;

  const subCategories = (categoriesData || []).filter(
    (c: any) => c.parentId === null && !["mt4", "mt5", "course"].includes(c.slug)
  );

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/" || pathname === "/(tabs)";
    return pathname?.startsWith(path);
  };

  return (
    <>
      <View style={styles.topbar}>
        <View style={styles.inner}>
          {/* Logo */}
          <Link href="/(tabs)" asChild>
            <Pressable style={styles.logo}>
              <LinearGradient
                colors={["#D97706", "#FBBF24"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoMark}
              >
                <Text style={styles.logoMarkText}>EX</Text>
              </LinearGradient>
              <View style={{ flexDirection: "column", marginLeft: 8 }}>
                <Text style={styles.logoBrand}>EAXAU</Text>
                <Text style={styles.logoSub}>· 量化军火库 ·</Text>
              </View>
            </Pressable>
          </Link>

          {/* 主导航 */}
          <View style={styles.nav}>
            <NavLink href="/(tabs)" label="策略广场" active={isActive("/")} />
            <NavLinkWithMega
              label="MT4"
              isOpen={megaOpen === "mt4"}
              onHover={(open) => setMegaOpen(open ? "mt4" : null)}
              subItems={subCategories}
              platform="MT4"
              onItemClick={() => setMegaOpen(null)}
            />
            <NavLinkWithMega
              label="MT5"
              isOpen={megaOpen === "mt5"}
              onHover={(open) => setMegaOpen(open ? "mt5" : null)}
              subItems={subCategories}
              platform="MT5"
              onItemClick={() => setMegaOpen(null)}
            />
            <NavLink href="/(tabs)/moments" label="合作授权" active={isActive("/moments")} />
            <NavLink href="/(tabs)/group-buy" label="合购拼团" active={isActive("/group-buy")} />
            <NavLink href="/promo" label="限时促销" active={isActive("/promo")} />
          </View>

          {/* 右侧操作 */}
          <View style={styles.right}>
            {/* 项目矩阵 */}
            <Pressable
              onPress={() => setShowSitesMenu((v) => !v)}
              style={styles.sitesPill}
            >
              <View style={styles.liveDot} />
              <Text style={styles.sitesPillText}>项目矩阵 · 5</Text>
              <Text style={styles.sitesPillCaret}>▾</Text>
            </Pressable>

            {/* 搜索 */}
            <Pressable onPress={() => router.push("/search" as any)} style={styles.iconBtn}>
              <Text style={{ color: colors.muted, fontSize: 16 }}>🔍</Text>
            </Pressable>

            {/* 收藏 */}
            <Pressable
              onPress={() => router.push(isAuthenticated ? "/(tabs)/favorites" : "/auth/login" as any)}
              style={styles.iconBtn}
            >
              <Text style={{ color: colors.muted, fontSize: 16 }}>♡</Text>
            </Pressable>

            {/* 用户 */}
            {isAuthenticated ? (
              <Pressable
                onPress={() => setShowUserMenu((v) => !v)}
                style={styles.userPill}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {(user?.name || "U").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || "我的"}
                </Text>
              </Pressable>
            ) : (
              <Link href="/auth/login" asChild>
                <Pressable style={styles.loginBtn}>
                  <LinearGradient
                    colors={["#D97706", "#F59E0B"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtnInner}
                  >
                    <Text style={styles.loginBtnText}>登录 / 注册</Text>
                  </LinearGradient>
                </Pressable>
              </Link>
            )}
          </View>
        </View>

        {/* Mega Menu */}
        {megaOpen && (
          <Pressable
            style={styles.megaWrap}
            onHoverIn={() => setMegaOpen(megaOpen)}
            onHoverOut={() => setMegaOpen(null)}
          >
            <View style={styles.megaInner}>
              <Text style={styles.megaTitle}>
                {megaOpen.toUpperCase()} 智能交易系统
              </Text>
              <View style={styles.megaGrid}>
                {subCategories.map((cat: any) => (
                  <Link
                    key={cat.slug}
                    href={`/(tabs)?platform=${megaOpen.toUpperCase()}&category=${cat.slug}` as any}
                    asChild
                  >
                    <Pressable
                      style={styles.megaItem}
                      onPress={() => setMegaOpen(null)}
                    >
                      <Text style={styles.megaItemIcon}>{cat.icon || "📊"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.megaItemTitle}>{cat.name}</Text>
                        <Text style={styles.megaItemDesc}>
                          {megaOpen.toUpperCase()} 平台 {cat.name}EA
                        </Text>
                      </View>
                    </Pressable>
                  </Link>
                ))}
              </View>
              <View style={styles.megaFooter}>
                <Link href={`/(tabs)?platform=${megaOpen.toUpperCase()}` as any} asChild>
                  <Pressable onPress={() => setMegaOpen(null)}>
                    <Text style={styles.megaFooterLink}>
                      查看全部 {megaOpen.toUpperCase()} 策略 →
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </Pressable>
        )}
      </View>

      {/* 项目矩阵下拉 */}
      {showSitesMenu && (
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setShowSitesMenu(false)}
        >
          <View style={styles.sitesDropdown}>
            <Text style={styles.dropdownTitle}>EAXAU 项目矩阵</Text>
            {[
              { label: "EA 军火库", href: "/", current: true, sub: "eaxau.com · 当前站点" },
              { label: "EA 破解网", href: "#", sub: "即将上线" },
              { label: "点金", href: "https://ddxau.com", sub: "ddxau.com · 订单流策略", external: true },
              { label: "量化风云榜", href: "https://eaea.ai", sub: "eaea.ai · 实盘排名", external: true },
            ].map((s) => (
              <Pressable
                key={s.label}
                style={[styles.siteItem, s.current && styles.siteItemActive]}
                onPress={() => {
                  setShowSitesMenu(false);
                  if (s.external && Platform.OS === "web") {
                    window.open(s.href, "_blank");
                  } else if (!s.current) {
                    router.push(s.href as any);
                  }
                }}
              >
                <Text
                  style={[
                    styles.siteLabel,
                    { color: s.current ? "#FBBF24" : colors.foreground },
                  ]}
                >
                  {s.label}
                </Text>
                <Text style={[styles.siteSub, { color: colors.muted }]}>{s.sub}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      )}

      {/* 用户菜单下拉 */}
      {showUserMenu && (
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setShowUserMenu(false)}
        >
          <View style={styles.userDropdown}>
            <View style={styles.userHeader}>
              <Text style={[styles.userHeaderName, { color: colors.foreground }]}>
                {user?.name}
              </Text>
              <Text style={[styles.userHeaderEmail, { color: colors.muted }]}>
                {user?.email}
              </Text>
            </View>
            <View style={styles.divider} />
            {[
              { label: "我的中心", href: "/(tabs)/profile", icon: "👤" },
              { label: "我的订单", href: "/(tabs)/profile", icon: "📋" },
              { label: "我的下载", href: "/(tabs)/profile", icon: "📥" },
              { label: "我的收藏", href: "/(tabs)/favorites", icon: "♡" },
              { label: "资料编辑", href: "/profile/edit", icon: "✏️" },
            ].map((item) => (
              <Pressable
                key={item.label}
                style={styles.userMenuItem}
                onPress={() => {
                  setShowUserMenu(false);
                  router.push(item.href as any);
                }}
              >
                <Text style={{ fontSize: 14, marginRight: 8 }}>{item.icon}</Text>
                <Text style={{ color: colors.foreground, fontSize: 13 }}>{item.label}</Text>
              </Pressable>
            ))}
            {user?.role === "admin" && (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={styles.userMenuItem}
                  onPress={() => {
                    setShowUserMenu(false);
                    router.push("/admin" as any);
                  }}
                >
                  <Text style={{ fontSize: 14, marginRight: 8 }}>⚙️</Text>
                  <Text style={{ color: "#FBBF24", fontSize: 13, fontWeight: "700" }}>
                    管理员后台
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      )}
    </>
  );
}

// ─── 子组件：普通导航链接 ───
function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href as any} asChild>
      <Pressable
        style={[styles.navLink, active && styles.navLinkActive]}
        // @ts-ignore — RN-Web hover 支持
        onHoverIn={() => {}}
      >
        <Text style={[styles.navLinkText, active && styles.navLinkTextActive]}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

// ─── 子组件：带 mega menu 的导航链接 ───
function NavLinkWithMega({
  label,
  isOpen,
  onHover,
  subItems,
  platform,
  onItemClick,
}: {
  label: string;
  isOpen: boolean;
  onHover: (open: boolean) => void;
  subItems: any[];
  platform: string;
  onItemClick: () => void;
}) {
  return (
    <Pressable
      // @ts-ignore RN-Web hover
      onHoverIn={() => onHover(true)}
      onHoverOut={() => onHover(false)}
      style={[styles.navLink, isOpen && styles.navLinkActive]}
    >
      <Text style={[styles.navLinkText, isOpen && styles.navLinkTextActive]}>
        {label} <Text style={styles.navCaret}>▾</Text>
      </Text>
    </Pressable>
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
    ...(Platform.OS === "web"
      ? {
          // @ts-ignore
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        }
      : {}),
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
  // Logo
  logo: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? { boxShadow: "0 0 20px rgba(245,158,11,0.35)" as any } : {}),
  },
  logoMarkText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  logoBrand: { color: "#F1F5F9", fontSize: 17, fontWeight: "900", letterSpacing: 0.4 },
  logoSub: { color: "#FBBF24", fontSize: 10, fontWeight: "600", letterSpacing: 1.6, marginTop: 2 },
  // Nav
  nav: { flex: 1, flexDirection: "row", gap: 4 },
  navLink: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navLinkActive: {
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  navLinkText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "500",
  },
  navLinkTextActive: {
    color: "#FBBF24",
    fontWeight: "700",
  },
  navCaret: { fontSize: 10, opacity: 0.6 },
  // Right
  right: { flexDirection: "row", alignItems: "center", gap: 12 },
  sitesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderColor: "rgba(245,158,11,0.25)",
    borderWidth: 1,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  sitesPillText: { color: "#FBBF24", fontSize: 12, fontWeight: "700" },
  sitesPillCaret: { color: "#FBBF24", fontSize: 9, opacity: 0.7 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(148,163,184,0.12)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtn: { borderRadius: 10, overflow: "hidden" },
  loginBtnInner: { paddingHorizontal: 18, paddingVertical: 9 },
  loginBtnText: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  userPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(148,163,184,0.12)",
    borderWidth: 1,
    borderRadius: 999,
    maxWidth: 180,
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  userName: { color: "#F1F5F9", fontSize: 12, fontWeight: "600", maxWidth: 100 },
  // Mega
  megaWrap: {
    position: "absolute",
    top: 64,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,14,26,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(245,158,11,0.2)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    paddingVertical: 24,
    ...(Platform.OS === "web"
      ? {
          // @ts-ignore
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }
      : {}),
  },
  megaInner: { maxWidth: 1400, width: "100%", alignSelf: "center", paddingHorizontal: 32 },
  megaTitle: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  megaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  megaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    width: "25%",
    minWidth: 180,
  },
  megaItemIcon: { fontSize: 24 },
  megaItemTitle: { color: "#F1F5F9", fontSize: 13, fontWeight: "700" },
  megaItemDesc: { color: "#64748B", fontSize: 11, marginTop: 2 },
  megaFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.08)",
  },
  megaFooterLink: { color: "#FBBF24", fontSize: 13, fontWeight: "700" },
  // Dropdown common
  dropdownBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  } as any,
  sitesDropdown: {
    position: "absolute",
    top: 56,
    right: 200,
    width: 280,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderColor: "rgba(148,163,184,0.12)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    ...(Platform.OS === "web"
      ? {
          // @ts-ignore
          backdropFilter: "blur(20px)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }
      : {}),
  } as any,
  userDropdown: {
    position: "absolute",
    top: 56,
    right: 32,
    width: 240,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderColor: "rgba(148,163,184,0.12)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    ...(Platform.OS === "web"
      ? {
          // @ts-ignore
          backdropFilter: "blur(20px)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }
      : {}),
  } as any,
  dropdownTitle: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  siteItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  siteItemActive: {
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  siteLabel: { fontSize: 13, fontWeight: "700" },
  siteSub: { fontSize: 10, marginTop: 2 },
  userHeader: { padding: 10 },
  userHeaderName: { fontSize: 14, fontWeight: "800" },
  userHeaderEmail: { fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: "rgba(148,163,184,0.08)", marginVertical: 4 },
  userMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
});
