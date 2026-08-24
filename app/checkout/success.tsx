import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Linking, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { glassStyle } from "@/lib/glass-styles";
import { shouldUseContactForDownload } from "@/lib/download-links";
import { ContactModal } from "@/components/contact-modal";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";

/**
 * 支付成功页
 *
 * URL: /checkout/success?orderNo=xxx
 *
 * 行为：
 *   - 拉取订单详情
 *   - 已支付 → 显示成功 + 下载链接
 *   - 还在 pending（ZPay 异步通知有延迟）→ 轮询 5 秒一次
 *   - 已取消/过期 → 显示对应状态
 */
export default function CheckoutSuccessScreen() {
  const params = useLocalSearchParams<{
    orderNo?: string;
    out_trade_no?: string;
  }>();
  const router = useRouter();
  const colors = useColors();

  // 兼容 ZPay return_url 用 out_trade_no 的情况
  const orderNo = params.orderNo || params.out_trade_no;

  const checkAnim = useRef(new Animated.Value(0)).current;
  const [showContactModal, setShowContactModal] = useState(false);

  const {
    data: order,
    isLoading,
    error: orderError,
  } = trpc.orders.detail.useQuery(
    { orderNo: orderNo! },
    {
      enabled: !!orderNo,
      retry: false,
      // 只有待支付订单需要轮询；未登录、订单不存在和终态都立即停止。
      refetchInterval: (query) => (query.state.data?.status === "pending" ? 3000 : false),
    },
  );

  useEffect(() => {
    if (order?.status === "paid") {
      Animated.spring(checkAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== "web",
        damping: 12,
        stiffness: 180,
      }).start();
    }
  }, [order?.status, checkAnim]);

  if (!orderNo) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>订单号缺失</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D8BC83" />
          <Text style={{ color: colors.muted, marginTop: 16 }}>加载订单中...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!order) {
    const needsLogin = /login|unauthorized|10001/i.test(orderError?.message || "");
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <IconSymbol name="exclamationmark.triangle.fill" size={25} color="#D8BC83" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{needsLogin ? "需要登录" : "订单不存在"}</Text>
          <Text style={[styles.subtitle, { color: colors.muted, textAlign: "center" }]}>{needsLogin ? "请先登录后查看支付结果，或返回首页重新选择商品。" : "没有找到支付结果，请返回首页重新选择商品。"}</Text>
          <TouchableOpacity onPress={() => router.replace((needsLogin ? "/auth/login" : "/") as any)} style={styles.cta}>
            <LinearGradient colors={["#A8895A", "#C9A96E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}>
              <Text style={styles.ctaText}>{needsLogin ? "去登录" : "返回首页"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // 仍在等待支付确认
  if (order.status === "pending") {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D8BC83" />
          <Text style={[styles.title, { color: colors.foreground, marginTop: 24 }]}>支付确认中...</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>请稍候，我们正在等待网关回调（最多约 30 秒）</Text>
        </View>
      </ScreenContainer>
    );
  }

  // 已取消/过期
  if (order.status === "cancelled" || order.status === "expired") {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <View style={styles.expiredIcon}>
            <IconSymbol name="exclamationmark.triangle.fill" size={25} color="#F87171" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>订单已{order.status === "cancelled" ? "取消" : "过期"}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>请重新下单</Text>
          <TouchableOpacity onPress={() => router.replace("/" as any)} style={styles.cta}>
            <LinearGradient colors={["#A8895A", "#C9A96E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}>
              <Text style={styles.ctaText}>返回首页</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ─── 已支付 ───
  const downloadRequiresContact = shouldUseContactForDownload(order.downloadUrl);

  return (
    <ScreenContainer>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <View style={styles.successWrap}>
        <Animated.View
          style={[
            styles.successCard,
            glassStyle("strong") as any,
            {
              transform: [
                {
                  scale: checkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* 大对勾 */}
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkAnim }] }]}>
            <IconSymbol name="checkmark.circle.fill" size={44} color="#34D399" />
          </Animated.View>
          <Text style={[styles.title, { color: colors.foreground }]}>支付成功</Text>
          <Text style={[styles.subtitle, { color: colors.muted, textAlign: "center" }]}>感谢您的购买。订单已生效。</Text>

          {/* 订单信息 */}
          <View style={[styles.infoCard, { borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>订单号</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>
                {order.orderNo}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>商品</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>
                {order.productTitle}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>支付金额</Text>
              <Text style={[styles.infoValue, { color: "#D8BC83", fontWeight: "800" }]}>¥ {order.amount}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>支付方式</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{paymentMethodLabel(order.paymentMethod)}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (downloadRequiresContact) {
                setShowContactModal(true);
                return;
              }
              if (Platform.OS === "web") window.open(order.downloadUrl!, "_blank");
              else Linking.openURL(order.downloadUrl!);
            }}
            style={styles.cta}
            activeOpacity={0.85}
          >
            <LinearGradient colors={downloadRequiresContact ? ["#A8895A", "#C9A96E"] : ["#10B981", "#34D399"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}>
              <Text style={styles.ctaText}>{downloadRequiresContact ? "联系获取文件" : "立即下载"}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.btnRow}>
            <TouchableOpacity onPress={() => router.replace("/profile" as any)} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                查看我的订单
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace("/" as any)} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                继续选购
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

function paymentMethodLabel(m?: string | null): string {
  if (!m) return "—";
  const labels: Record<string, string> = {
    alipay: "支付宝",
    wxpay: "微信支付",
    usdt: "USDT",
  };
  return labels[m] || m;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  expiredIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.28)",
  },
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    minHeight: "100%" as any,
  },
  successCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 8,
    padding: 32,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "rgba(52, 211, 153, 0.18)",
    borderWidth: 2,
    borderColor: "#34D399",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 22,
  },
  infoCard: {
    width: "100%",
    marginTop: 20,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 12, fontWeight: "600" },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  cta: {
    width: "100%",
    marginTop: 18,
    borderRadius: 8,
    overflow: "hidden",
  },
  ctaInner: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#0A1628",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    width: "100%",
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: "center",
  },
});
