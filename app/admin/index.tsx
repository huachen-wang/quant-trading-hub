import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useState, useEffect } from "react";
import { getAdminStats } from "@/lib/admin-api";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/hooks/use-auth";
import { EventEmitter } from "@/lib/event-emitter";

export default function AdminDashboard() {
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { logout } = useAuth({ autoFetch: false });
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const isDesktop = width >= 1024;

  useEffect(() => {
    getAdminStats()
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to load stats:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const clearAdminToken = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_email");
      return;
    }
    await SecureStore.deleteItemAsync("admin_token");
    await SecureStore.deleteItemAsync("admin_email");
  };

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        await clearAdminToken();
        await logout();
        EventEmitter.emit("admin_logout");
      } finally {
        setShowSettings(false);
        router.replace("/admin/login" as any);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("确认退出登录吗？")) {
        void performLogout();
      }
      return;
    }

    Alert.alert("退出登录", "确认退出当前账户吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => void performLogout() },
    ]);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const menuItems = [
    {
      code: "MGT",
      title: "资管委托接入",
      route: "/admin/alliance-sessions",
      count: 0,
      description: "审核委托、核验券商账户与交易权、显式启用",
    },
    {
      code: "FND",
      title: "券商入金与代收",
      route: "/admin/broker-funding",
      count: 0,
      description: "直充核对、专属代收、动态验证转出与券商到账",
    },
    {
      code: "DAT",
      title: "V2 策略数据",
      route: "/admin/v2-data",
      count: 6,
      description: "编辑历史指标、净值曲线与实盘接管时间",
    },
    {
      code: "V2",
      title: "V2 核心策略图文",
      route: "/admin/v2-content",
      count: 6,
      description: "编辑六策略说明、证据、时间线与风险内容",
    },
    {
      code: "STR",
      title: "策略管理",
      route: "/admin/strategies",
      count: stats?.totalStrategies || 0,
      description: "管理所有EA策略",
    },
    {
      code: "REV",
      title: "评论审核",
      route: "/admin/comments",
      count: stats?.totalComments || 0,
      description: "审核用户匿名留言",
    },
    {
      code: "GB",
      title: "合购申请",
      route: "/admin/group-buys",
      count: 0,
      description: "查看和审核合购申请",
    },
    {
      code: "LST",
      title: "上架申请",
      route: "/admin/listings",
      count: 0,
      description: "查看和审核EA上架申请",
    },
    {
      code: "NTF",
      title: "通知公告",
      route: "/admin/notifications",
      count: 0,
      description: "管理订阅页面通知公告",
    },
    {
      code: "SUB",
      title: "订阅页面管理",
      route: "/admin/page-contents",
      count: 0,
      description: "管理订阅页面展示内容",
    },
    {
      code: "COP",
      title: "合作页面管理",
      route: "/admin/cooperation-contents",
      count: 0,
      description: "管理合作页面服务内容（合规/技术/业务）",
    },
    {
      code: "PLN",
      title: "合作方案管理",
      route: "/admin/cooperation-manage",
      count: 0,
      description: "管理合作展示卡片、合作模式（面向工作室/客户）",
    },
    {
      code: "PRM",
      title: "促销商城管理",
      route: "/admin/promo-manage",
      count: 0,
      description: "管理限时促销商品、价格和库存",
    },
    {
      code: "USR",
      title: "订阅用户",
      route: "/admin/subscribers",
      count: 0,
      description: "查看邮箱订阅用户列表",
    },
    {
      code: "CTC",
      title: "联系方式设置",
      route: "/admin/contact-settings",
      count: 0,
      description: "设置上架EA弹窗的联系方式",
    },
    {
      code: "NAV",
      title: "侧边栏入口管理",
      route: "/admin/site-entries",
      count: 0,
      description: "管理左上角悬浮侧边栏的快捷入口",
    },
    {
      code: "ORD",
      title: "订单管理",
      route: "/admin/orders",
      count: 0,
      description: "查看所有订单、对账、改状态",
    },
    {
      code: "BT",
      title: "回测数据",
      route: "/admin/backtest-data",
      count: 0,
      description: "管理 EA 的回测数据曲线",
    },
  ];

  const statCards = [
    { label: "总策略数", value: stats?.totalStrategies || 0, tone: colors.primary },
    { label: "已发布", value: stats?.publishedStrategies || 0, tone: colors.success },
    { label: "总下载", value: stats?.totalDownloads || 0, tone: colors.foreground },
    { label: "总购买", value: stats?.totalPurchases || 0, tone: colors.warning },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}>
        <View style={[styles.dashboardShell, isDesktop && styles.dashboardShellDesktop]}>
          <View style={styles.headerRow}>
            <View style={styles.headerMain}>
              <Text style={[styles.kicker, { color: colors.primary }]}>AI量化联盟 CONTROL ROOM</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>管理员后台</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                内容、订单、订阅与合作资源集中管理
              </Text>
            </View>
            {isDesktop && (
              <View style={styles.healthPanel}>
                <View style={styles.healthTop}>
                  <View style={styles.healthDot} />
                  <Text style={styles.healthLabel}>SYSTEM ONLINE</Text>
                </View>
                <Text style={styles.healthValue}>实时管理台</Text>
                <Text style={styles.healthDesc}>API / 内容库 / 支付回调</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            activeOpacity={0.8}
            style={[styles.settingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>设置</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>数据概览</Text>
            <Text style={[styles.sectionMeta, { color: colors.muted }]}>LIVE SNAPSHOT</Text>
          </View>
          <View style={styles.statsGrid}>
            {statCards.map((item) => (
              <View
                key={item.label}
                style={[
                  styles.statCard,
                  isDesktop && styles.statCardDesktop,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.muted }]}>{item.label}</Text>
                <Text style={[styles.statValue, { color: item.tone }]}>{item.value}</Text>
                <View style={[styles.statRule, { backgroundColor: item.tone }]} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>管理功能</Text>
            <Text style={[styles.sectionMeta, { color: colors.muted }]}>OPERATIONS</Text>
          </View>
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.76}
                style={[
                  styles.menuCard,
                  isDesktop && styles.menuCardDesktop,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.moduleCode}>
                  <Text style={styles.moduleCodeText}>{item.code}</Text>
                </View>
                <View style={styles.menuCardContent}>
                  <Text style={[styles.menuTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.menuDesc, { color: colors.muted }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
                <View style={styles.menuRight}>
                  <Text style={[styles.menuCount, { color: colors.primary }]}>{item.count}</Text>
                  <Text style={{ fontSize: 18, color: colors.muted }}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowSettings(false)}
        >
          <Pressable
            style={[styles.settingsModal, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
              设置
            </Text>
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.8}
              style={{ backgroundColor: colors.error + "15", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 }}
            >
              <Text style={{ color: colors.error, fontWeight: "700", textAlign: "center" }}>退出登录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSettings(false)}
              activeOpacity={0.8}
              style={{ marginTop: 10, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}
            >
              <Text style={{ color: colors.muted, textAlign: "center" }}>取消</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  scrollContentDesktop: {
    width: "100%",
    maxWidth: 1360,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 42,
  },
  dashboardShell: {
    borderRadius: 6,
    padding: 15,
    marginBottom: 14,
    backgroundColor: "rgba(9,15,28,0.84)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
  },
  dashboardShellDesktop: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  headerRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  healthPanel: {
    width: 260,
    borderRadius: 8,
    padding: 16,
    backgroundColor: "rgba(2,6,23,0.44)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
  },
  healthTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  healthLabel: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "900",
  },
  healthValue: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  healthDesc: {
    color: "rgba(148,163,184,0.86)",
    fontSize: 12,
  },
  settingsBtn: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  sectionMeta: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    minWidth: "47%" as any,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
  },
  statCardDesktop: {
    minWidth: 0,
    width: "24%" as any,
    flexGrow: 1,
    flexBasis: 0,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
  },
  statRule: {
    width: 44,
    height: 2,
    borderRadius: 2,
    marginTop: 12,
    opacity: 0.72,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  menuCard: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuCardDesktop: {
    width: "32.72%" as any,
    minHeight: 78,
  },
  moduleCode: {
    width: 38,
    height: 38,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,188,131,0.12)",
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.24)",
  },
  moduleCodeText: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
  },
  menuCardContent: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  menuDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  menuRight: {
    alignItems: "flex-end",
    gap: 5,
  },
  menuCount: {
    fontSize: 16,
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  settingsModal: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
  },
});
