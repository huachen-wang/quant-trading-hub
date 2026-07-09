import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { glassStyle } from "@/lib/glass-styles";
import * as SecureStore from "expo-secure-store";
import { EventEmitter } from "@/lib/event-emitter";

export default function ProfileScreen() {
  const { user, isAuthenticated, loading: authLoading, logout, refresh } = useAuth();
  const colors = useColors();
  const { isDesktop } = useResponsive();
  const [showSettings, setShowSettings] = useState(false);
  const [showVerifyEmailModal, setShowVerifyEmailModal] = useState(false);
  const [showBindPhoneModal, setShowBindPhoneModal] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  // 未登录跳转到 user login（不是 admin login）
  if (!authLoading && !isAuthenticated) {
    router.replace("/auth/login" as any);
  }

  // 拉取扩展的用户信息（含验证状态、福利标记）
  const { data: profile, refetch: refetchProfile } = trpc.auth.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: features } = trpc.features.get.useQuery();
  const { data: downloads } = trpc.downloads.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: purchases } = trpc.purchases.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: favorites } = trpc.favorites.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myOrders } = trpc.orders.myList.useQuery({ limit: 10 }, { enabled: isAuthenticated });

  const sendCodeMutation = trpc.auth.sendEmailCode.useMutation();
  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation();
  const bindPhoneMutation = trpc.auth.bindPhone.useMutation();

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  // ─── 邮箱验证流程 ───
  const handleSendVerifyCode = async () => {
    if (!user?.email) return showMsg("当前账号未绑定邮箱");
    if (cooldown > 0) return;
    try {
      await sendCodeMutation.mutateAsync({
        email: user.email,
        purpose: "verify_email",
      });
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((s) => {
          if (s <= 1) {
            clearInterval(timer);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      showMsg("验证码已发送");
    } catch (e: any) {
      showMsg(e.message || "发送失败");
    }
  };

  const handleVerifyEmail = async () => {
    if (!verifyCode) return showMsg("请输入验证码");
    setBusy(true);
    try {
      await verifyEmailMutation.mutateAsync({ code: verifyCode });
      showMsg("邮箱验证成功！福利已解锁");
      setShowVerifyEmailModal(false);
      setVerifyCode("");
      refetchProfile();
    } catch (e: any) {
      showMsg(e.message || "验证失败");
    } finally {
      setBusy(false);
    }
  };

  // ─── 绑定手机号流程（不验证，直接保存） ───
  const handleBindPhone = async () => {
    const phone = phoneInput.trim();
    if (!phone) return showMsg("请输入手机号");
    setBusy(true);
    try {
      await bindPhoneMutation.mutateAsync({ phone });
      showMsg(
        features?.phoneVerification
          ? "手机号已保存，请验证"
          : "手机号已保存。验证功能即将开放，到时享受 EA 福利"
      );
      setShowBindPhoneModal(false);
      setPhoneInput("");
      refetchProfile();
      refresh();
    } catch (e: any) {
      showMsg(e.message || "绑定失败");
    } finally {
      setBusy(false);
    }
  };

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
        await logout();
        await clearAdminToken();
        EventEmitter.emit("admin_logout");
      } finally {
        setShowSettings(false);
        router.replace("/auth/login" as any);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("确认退出登录吗？")) performLogout();
      return;
    }

    Alert.alert("退出登录", "确认退出吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => void performLogout() },
    ]);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const emailVerified = profile?.emailVerified || false;
  const phoneBound = !!profile?.phone;
  const phoneVerified = profile?.phoneVerified || false;
  const isFullMember = profile?.isFullMember || false;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageContent, isDesktop && styles.pageContentDesktop]}>
          {/* 顶部：设置按钮 */}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: "700" }}>设置</Text>
            </TouchableOpacity>
          </View>

          {/* 头像 + 名字 + 福利徽章 */}
          <View style={[styles.profileHeader, isDesktop && styles.profileHeaderDesktop]}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
                borderWidth: 2,
                borderColor: isFullMember ? "#D8BC83" : "transparent",
              }}
            >
              <Text style={{ fontSize: 32, color: colors.primary, fontWeight: "900" }}>
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </Text>
              {isFullMember && (
                <View style={styles.crownBadge}>
                  <Text style={{ fontSize: 10, color: "#07111F", fontWeight: "900" }}>VIP</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>
              {user?.name || "用户"}
            </Text>
            {user?.email && (
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
                {user.email}
              </Text>
            )}
            {isFullMember ? (
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>完整福利会员</Text>
              </View>
            ) : (
              <View style={styles.normalBadge}>
                <Text style={styles.normalBadgeText}>普通用户</Text>
              </View>
            )}
          </View>

          {/* 管理员入口 */}
          {user?.role === "admin" && (
            <TouchableOpacity
              onPress={() => router.push("/admin" as any)}
              style={{
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#1E40AF", "#3B82F6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>ADM</Text>
                </View>
                <View>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                    管理员后台
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                    管理策略 / 订单 / 用户
                  </Text>
                </View>
              </View>
              <Text style={{ color: "#fff", fontSize: 18, zIndex: 1 }}>→</Text>
            </TouchableOpacity>
          )}

          {/* ─── 福利引导卡片（关键位置）─── */}
          {!isFullMember && (
            <View style={[styles.welfareCard, glassStyle("subtle") as any]}>
              <LinearGradient
                colors={["rgba(245,158,11,0.18)", "rgba(245,158,11,0.04)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.welfareHeader}>
                <Text style={styles.welfareTitle}>解锁完整福利</Text>
                <Text style={[styles.welfareSubtitle, { color: colors.muted }]}>
                  完成下方任务，享受会员专属权益
                </Text>
              </View>

              {/* 任务 1：邮箱验证 */}
              <TouchableOpacity
                onPress={() => setShowVerifyEmailModal(true)}
                style={styles.welfareTask}
                disabled={emailVerified}
              >
                <View style={styles.welfareTaskLeft}>
                  <View
                    style={[
                      styles.welfareCheck,
                      { backgroundColor: emailVerified ? "#10B981" : "rgba(148,163,184,0.2)" },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>
                      {emailVerified ? "✓" : "1"}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.welfareTaskTitle,
                        { color: colors.foreground },
                        emailVerified && styles.welfareDone,
                      ]}
                    >
                      验证邮箱
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {emailVerified ? "已完成" : "点击发送验证码"}
                    </Text>
                  </View>
                </View>
                {!emailVerified && (
                  <Text style={{ color: "#D8BC83", fontSize: 13, fontWeight: "700" }}>去验证 →</Text>
                )}
              </TouchableOpacity>

              {/* 任务 2：绑定手机号 */}
              <TouchableOpacity
                onPress={() => {
                  if (phoneBound) {
                    showMsg(
                      features?.phoneVerification
                        ? "手机号验证功能开放后会通知您"
                        : "手机号已绑定。验证功能开放后将自动启用"
                    );
                  } else {
                    setShowBindPhoneModal(true);
                  }
                }}
                style={styles.welfareTask}
              >
                <View style={styles.welfareTaskLeft}>
                  <View
                    style={[
                      styles.welfareCheck,
                      {
                        backgroundColor: phoneVerified
                          ? "#10B981"
                          : phoneBound
                          ? "rgba(245,158,11,0.4)"
                          : "rgba(148,163,184,0.2)",
                      },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>
                      {phoneVerified ? "✓" : phoneBound ? "..." : "2"}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.welfareTaskTitle,
                        { color: colors.foreground },
                        phoneVerified && styles.welfareDone,
                      ]}
                    >
                      绑定并验证手机号
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {phoneVerified
                        ? "已完成"
                        : phoneBound
                        ? `${profile?.phone} · 验证功能即将开放`
                        : "未绑定 · 接收 EA 更新通知"}
                    </Text>
                  </View>
                </View>
                {!phoneBound && (
                  <Text style={{ color: "#D8BC83", fontSize: 13, fontWeight: "700" }}>去绑定 →</Text>
                )}
              </TouchableOpacity>

              <View style={styles.welfareFooter}>
                <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>
                  <Text style={{ color: "#D8BC83", fontWeight: "700" }}>会员福利：</Text>
                  独家 EA 限时领取 · 新策略优先体验 · 专属客服通道 · 不定期空投活动
                </Text>
              </View>
            </View>
          )}

          {/* 数据统计 - A.3 扩展为 4 列 */}
          <View style={[styles.statsRow, glassStyle("subtle") as any]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: "#D8BC83" }]}>
                {myOrders?.filter((o: any) => o.status === "paid").length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>订单</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.primary }]}>
                {purchases?.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>已购</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: "#34D399" }]}>{downloads?.length || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>下载</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: "#60A5FA" }]}>{favorites?.length || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>收藏</Text>
            </View>
          </View>

          {/* A.3: 我的订单 */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>我的订单</Text>
          {myOrders && myOrders.length > 0 ? (
            myOrders.slice(0, 5).map((order: any) => {
              const statusColors: Record<string, string> = { pending: "#D8BC83", paid: "#34D399", cancelled: "#94A3B8", expired: "#F87171" };
              const statusLabels: Record<string, string> = { pending: "待支付", paid: "已支付", cancelled: "已取消", expired: "已过期" };
              const statusColor = statusColors[order.status] || colors.muted;
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.itemCard, { backgroundColor: colors.surface }]}
                  onPress={() => router.push(`/checkout/${order.orderNo}` as any)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text style={[styles.itemTitle, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{order.productTitle}</Text>
                    <View style={{ backgroundColor: statusColor + "20", borderColor: statusColor + "60", borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: statusColor, fontSize: 10, fontWeight: "700" }}>{statusLabels[order.status] || order.status}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>¥{order.amount} · {new Date(order.createdAt).toLocaleDateString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 10, fontFamily: "monospace" }}>{order.orderNo}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.foreground, fontWeight: "700" }}>暂无订单</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>浏览策略广场，开始你的第一笔交易</Text>
            </View>
          )}
          {/* 我的下载 */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>我的下载</Text>
          {downloads && downloads.length > 0 ? (
            downloads.slice(0, 5).map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemCard, { backgroundColor: colors.surface }]}
                onPress={() => router.push(`/strategy/${item.strategy?.id}` as any)}
              >
                <Text style={[styles.itemTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {item.strategy?.title || "未命名策略"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                  下载于 {new Date(item.downloadedAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.foreground, fontWeight: "700" }}>暂无下载记录</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                浏览策略广场开始探索
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── 邮箱验证 Modal ─── */}
      <Modal
        visible={showVerifyEmailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVerifyEmailModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.box, { backgroundColor: colors.surface }]}>
            <Text style={[modalStyles.title, { color: colors.foreground }]}>验证邮箱</Text>
            <Text style={[modalStyles.subtitle, { color: colors.muted }]}>
              点击「发送验证码」后查收 {user?.email}
            </Text>
            <View style={modalStyles.codeRow}>
              <TextInput
                value={verifyCode}
                onChangeText={setVerifyCode}
                placeholder="6 位验证码"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={6}
                style={[
                  modalStyles.input,
                  { color: colors.foreground, borderColor: colors.border, flex: 1 },
                ]}
              />
              <TouchableOpacity
                onPress={handleSendVerifyCode}
                disabled={cooldown > 0 || sendCodeMutation.isPending}
                style={[
                  modalStyles.sendBtn,
                  { borderColor: colors.primary, opacity: cooldown > 0 ? 0.5 : 1 },
                ]}
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                  {cooldown > 0 ? `${cooldown}s` : "发送"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={modalStyles.btnRow}>
              <TouchableOpacity
                onPress={() => setShowVerifyEmailModal(false)}
                style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.muted }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleVerifyEmail}
                disabled={busy}
                style={[modalStyles.okBtn, { opacity: busy ? 0.6 : 1 }]}
              >
                <LinearGradient
                  colors={["#A8895A", "#C9A96E"]}
                  style={StyleSheet.absoluteFillObject}
                />
                {busy ? (
                  <ActivityIndicator color="#0A1628" size="small" />
                ) : (
                  <Text style={{ color: "#0A1628", fontWeight: "800" }}>确认验证</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── 绑定手机号 Modal ─── */}
      <Modal
        visible={showBindPhoneModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBindPhoneModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.box, { backgroundColor: colors.surface }]}>
            <Text style={[modalStyles.title, { color: colors.foreground }]}>绑定手机号</Text>
            <Text style={[modalStyles.subtitle, { color: colors.muted }]}>
              暂不需要短信验证。等通道开放后，已绑定用户优先享受 EA 福利。
            </Text>
            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="请输入手机号"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              maxLength={20}
              style={[
                modalStyles.input,
                { color: colors.foreground, borderColor: colors.border },
              ]}
            />
            <View style={modalStyles.btnRow}>
              <TouchableOpacity
                onPress={() => setShowBindPhoneModal(false)}
                style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.muted }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBindPhone}
                disabled={busy}
                style={[modalStyles.okBtn, { opacity: busy ? 0.6 : 1 }]}
              >
                <LinearGradient
                  colors={["#A8895A", "#C9A96E"]}
                  style={StyleSheet.absoluteFillObject}
                />
                {busy ? (
                  <ActivityIndicator color="#0A1628" size="small" />
                ) : (
                  <Text style={{ color: "#0A1628", fontWeight: "800" }}>保存</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── 设置 Modal ─── */}
      <Modal
        visible={showSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <TouchableOpacity
          style={modalStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowSettings(false)}
        >
          <View
            style={[modalStyles.box, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[modalStyles.title, { color: colors.foreground }]}>设置</Text>
            <TouchableOpacity
              onPress={handleLogout}
              style={{
                backgroundColor: colors.error + "15",
                borderRadius: 10,
                paddingVertical: 12,
                marginTop: 12,
              }}
            >
              <Text
                style={{ color: colors.error, fontWeight: "700", textAlign: "center" }}
              >
                退出登录
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    padding: 20,
  },
  pageContentDesktop: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  profileHeaderDesktop: {
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    backgroundColor: "rgba(9,15,28,0.82)",
    borderRadius: 6,
    padding: 15,
  },
  crownBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#D8BC83",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0A1628",
  },
  memberBadge: {
    marginTop: 8,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderColor: "rgba(245,158,11,0.4)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  memberBadgeText: { color: "#D8BC83", fontWeight: "700", fontSize: 12 },
  normalBadge: {
    marginTop: 8,
    backgroundColor: "rgba(148,163,184,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  normalBadgeText: { color: "#94A3B8", fontWeight: "600", fontSize: 12 },
  welfareCard: {
    borderRadius: 6,
    padding: 15,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  welfareHeader: { marginBottom: 14 },
  welfareTitle: { color: "#D8BC83", fontSize: 16, fontWeight: "900", marginBottom: 4 },
  welfareSubtitle: { fontSize: 12 },
  welfareTask: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.08)",
  },
  welfareTaskLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  welfareCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  welfareTaskTitle: { fontSize: 14, fontWeight: "700" },
  welfareDone: { textDecorationLine: "line-through", opacity: 0.7 },
  welfareFooter: { paddingTop: 12 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(30,41,59,0.4)",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 11, marginTop: 4, fontWeight: "600" },
  statDivider: { width: 1, opacity: 0.3 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  itemCard: { borderRadius: 6, padding: 12, marginBottom: 8 },
  itemTitle: { fontSize: 14, fontWeight: "700" },
  emptyCard: {
    borderRadius: 6,
    padding: 24,
    alignItems: "center",
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  box: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 13, marginBottom: 16, lineHeight: 20 },
  codeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
  },
  btnRow: { flexDirection: "row", gap: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  okBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
