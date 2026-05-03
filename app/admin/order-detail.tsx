import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { glassStyle } from "@/lib/glass-styles";

const STATUS_LABELS: Record<string, string> = {
  pending: "待支付",
  paid: "已支付",
  cancelled: "已取消",
  refunded: "已退款",
  expired: "已过期",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#D8BC83",
  paid: "#34D399",
  cancelled: "#94A3B8",
  refunded: "#60A5FA",
  expired: "#F87171",
};

/**
 * Admin 订单详情页
 *
 * URL: /admin/order-detail?orderNo=xxx
 *
 * 功能：
 *   - 显示订单完整信息
 *   - 显示商品信息
 *   - 显示用户信息
 *   - 显示所有支付尝试记录
 *   - USDT 待确认 → 一键确认收款（含 tx hash + 备注）
 */
export default function AdminOrderDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ orderNo?: string }>();
  const [showConfirm, setShowConfirm] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const {
    data: order,
    isLoading,
    refetch,
  } = trpc.orders.detail.useQuery(
    { orderNo: params.orderNo! },
    { enabled: !!params.orderNo }
  );

  const confirmMutation = trpc.orders.adminConfirmUsdt.useMutation();

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D8BC83" />
        </View>
      </ScreenContainer>
    );
  }
  if (!order) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>订单不存在</Text>
        </View>
      </ScreenContainer>
    );
  }

  const statusColor = STATUS_COLORS[order.status] || colors.muted;
  const isPendingUsdt = order.payments?.some(
    (p: any) => p.gateway === "usdt-manual" && p.status === "pending"
  );

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await confirmMutation.mutateAsync({
        orderNo: order.orderNo,
        gatewayOrderNo: txHash || undefined,
        note: note || undefined,
      });
      showMsg("已确认收款");
      setShowConfirm(false);
      setTxHash("");
      setNote("");
      refetch();
    } catch (e: any) {
      showMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* 顶部 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: colors.foreground, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>订单详情</Text>
        </View>

        {/* 订单基本信息 */}
        <View style={[styles.card, { backgroundColor: colors.surface }, glassStyle("subtle") as any]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.orderNo, { color: colors.foreground }]}>{order.orderNo}</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusColor + "20", borderColor: statusColor + "60" },
              ]}
            >
              <Text style={{ color: statusColor, fontSize: 12, fontWeight: "700" }}>
                {STATUS_LABELS[order.status] || order.status}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <InfoRow label="商品名" value={order.productTitle} colors={colors} />
          <InfoRow
            label="商品类型"
            value={
              order.productKind === "strategy" ? "策略 EA" : order.productKind === "promo" ? "促销商品" : order.productKind
            }
            colors={colors}
          />
          <InfoRow label="商品 ID" value={String(order.productId)} colors={colors} />
          <InfoRow label="实付金额" value={`¥ ${order.amount}`} valueStyle={{ color: "#D8BC83", fontWeight: "800" }} colors={colors} />
          {order.originalAmount ? (
            <InfoRow label="原价" value={`¥ ${order.originalAmount}`} colors={colors} />
          ) : null}
          <InfoRow label="支付方式" value={paymentMethodLabel(order.paymentMethod)} colors={colors} />
          <InfoRow label="支付网关" value={order.paymentGateway || "—"} colors={colors} />
          <InfoRow label="创建时间" value={fmtDate(order.createdAt)} colors={colors} />
          {order.paidAt ? (
            <InfoRow label="支付时间" value={fmtDate(order.paidAt)} colors={colors} />
          ) : null}
          {order.expiresAt ? (
            <InfoRow label="过期时间" value={fmtDate(order.expiresAt)} colors={colors} />
          ) : null}
        </View>

        {/* 用户信息 */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>👤 下单用户</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <InfoRow label="用户 ID" value={`#${order.userId}`} colors={colors} />
          {order.remark ? <InfoRow label="用户备注" value={order.remark} colors={colors} /> : null}
        </View>

        {/* 支付记录 */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>💳 支付记录</Text>
        {!order.payments || order.payments.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", padding: 12 }}>
              暂无支付记录
            </Text>
          </View>
        ) : (
          order.payments.map((p: any) => {
            const pStatusColor = pStatusColorMap[p.status] || colors.muted;
            return (
              <View
                key={p.id}
                style={[styles.card, { backgroundColor: colors.surface }]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.payGateway, { color: colors.foreground }]}>
                      {p.gateway} · {paymentMethodLabel(p.method)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: pStatusColor + "20", borderColor: pStatusColor + "60" },
                    ]}
                  >
                    <Text style={{ color: pStatusColor, fontSize: 11, fontWeight: "700" }}>
                      {pStatusLabels[p.status] || p.status}
                    </Text>
                  </View>
                </View>
                <InfoRow label="金额" value={`¥ ${p.amount}`} colors={colors} />
                <InfoRow
                  label="网关订单号"
                  value={p.gatewayOrderNo || "—"}
                  valueStyle={{ fontFamily: "monospace", fontSize: 11 }}
                  colors={colors}
                />
                <InfoRow label="创建时间" value={fmtDate(p.createdAt)} colors={colors} />
                {p.paidAt ? (
                  <InfoRow label="到账时间" value={fmtDate(p.paidAt)} colors={colors} />
                ) : null}
                {p.callbackVerified ? (
                  <InfoRow
                    label="回调状态"
                    value="✓ 已验签"
                    valueStyle={{ color: "#34D399" }}
                    colors={colors}
                  />
                ) : null}
                {p.errorMessage ? (
                  <InfoRow
                    label="错误"
                    value={p.errorMessage}
                    valueStyle={{ color: "#F87171" }}
                    colors={colors}
                  />
                ) : null}
              </View>
            );
          })
        )}

        {/* 操作区 */}
        {isPendingUsdt && (
          <TouchableOpacity
            onPress={() => setShowConfirm(true)}
            style={styles.actionBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#A8895A", "#C9A96E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtnInner}
            >
              <Text style={styles.actionBtnText}>✓ 确认 USDT 收款</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {order.downloadUrl && (
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS === "web") window.open(order.downloadUrl!, "_blank");
              else Linking.openURL(order.downloadUrl!);
            }}
            style={[styles.actionBtn, { marginTop: 8 }]}
          >
            <View
              style={[
                styles.actionBtnInner,
                { backgroundColor: "rgba(96,165,250,0.15)", borderWidth: 1, borderColor: "rgba(96,165,250,0.3)" },
              ]}
            >
              <Text style={[styles.actionBtnText, { color: "#93c5fd" }]}>
                📥 查看商品下载链接
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 确认 USDT Modal */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.box, { backgroundColor: colors.surface }]}>
            <Text style={[modalStyles.title, { color: colors.foreground }]}>
              确认 USDT 收款
            </Text>
            <Text style={[modalStyles.hint, { color: colors.muted }]}>
              确认收到金额 ¥{order.amount} 后再操作。此操作不可撤销。
            </Text>
            <Text style={[modalStyles.label, { color: colors.muted }]}>链上 Tx Hash</Text>
            <TextInput
              value={txHash}
              onChangeText={setTxHash}
              placeholder="选填，TRC20/ERC20 tx id"
              placeholderTextColor={colors.muted}
              style={[modalStyles.input, { color: colors.foreground, borderColor: colors.border }]}
            />
            <Text style={[modalStyles.label, { color: colors.muted }]}>备注</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="如：客服已收到截图，金额匹配"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={[
                modalStyles.input,
                { color: colors.foreground, borderColor: colors.border, minHeight: 70, textAlignVertical: "top" },
              ]}
            />
            <View style={modalStyles.btnRow}>
              <TouchableOpacity
                onPress={() => setShowConfirm(false)}
                style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.muted }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
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
                  <Text style={{ color: "#0A1628", fontWeight: "800" }}>确认收款</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function InfoRow({
  label,
  value,
  valueStyle,
  colors,
}: {
  label: string;
  value: string;
  valueStyle?: any;
  colors: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }, valueStyle]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const pStatusLabels: Record<string, string> = {
  pending: "等待中",
  success: "成功",
  failed: "失败",
  refunded: "已退款",
};
const pStatusColorMap: Record<string, string> = {
  pending: "#D8BC83",
  success: "#34D399",
  failed: "#F87171",
  refunded: "#60A5FA",
};

function paymentMethodLabel(m?: string | null): string {
  if (!m) return "—";
  return ({ alipay: "支付宝", wxpay: "微信支付", usdt: "USDT", qqpay: "QQ 钱包" } as any)[m] || m;
}

function fmtDate(d: any): string {
  try {
    return new Date(d).toLocaleString("zh-CN");
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  title: { fontSize: 22, fontWeight: "900" },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  orderNo: { fontSize: 15, fontWeight: "800", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  payGateway: { fontSize: 13, fontWeight: "700" },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 6,
    gap: 8,
  },
  infoLabel: { fontSize: 12, fontWeight: "600", flexShrink: 0 },
  infoValue: { fontSize: 13, flex: 1, textAlign: "right" },
  actionBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
  },
  actionBtnInner: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  actionBtnText: {
    color: "#0A1628",
    fontSize: 15,
    fontWeight: "800",
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
  box: { width: "100%", maxWidth: 440, borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  label: { fontSize: 11, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 16 },
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
