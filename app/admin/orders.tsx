import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type StatusFilter = "all" | "pending" | "paid" | "cancelled" | "expired";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待支付" },
  { value: "paid", label: "已支付" },
  { value: "cancelled", label: "已取消" },
  { value: "expired", label: "已过期" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#D8BC83",
  paid: "#34D399",
  cancelled: "#94A3B8",
  refunded: "#60A5FA",
  expired: "#F87171",
};

export default function AdminOrdersScreen() {
  const colors = useColors();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confirmOrder, setConfirmOrder] = useState<any | null>(null);
  const [txHash, setTxHash] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: orders, isLoading, refetch } = trpc.orders.adminList.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 200,
  });

  const { data: pendingUsdt } = trpc.orders.adminPendingUsdt.useQuery();
  const confirmUsdtMutation = trpc.orders.adminConfirmUsdt.useMutation();

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  const handleConfirmUsdt = async () => {
    if (!confirmOrder) return;
    setBusy(true);
    try {
      await confirmUsdtMutation.mutateAsync({
        orderNo: confirmOrder.orderNo,
        gatewayOrderNo: txHash || undefined,
        note: adminNote || undefined,
      });
      showMsg("订单已确认为已支付");
      setConfirmOrder(null);
      setTxHash("");
      setAdminNote("");
      refetch();
    } catch (e: any) {
      showMsg(e.message || "确认失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* 顶部：返回按钮 + 标题 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: colors.foreground, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>订单管理</Text>
        </View>

        {/* 待确认 USDT 提示卡 */}
        {pendingUsdt && pendingUsdt.length > 0 ? (
          <View style={[styles.pendingCard, { borderColor: "rgba(245, 158, 11, 0.4)" }]}>
            <Text style={{ color: "#D8BC83", fontWeight: "800", fontSize: 14 }}>
              ⚠️ 有 {pendingUsdt.length} 笔 USDT 转账等待确认
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              核对客服收到的截图后，点击下方对应订单的「确认收款」按钮
            </Text>
          </View>
        ) : null}

        {/* 状态筛选 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const isActive = statusFilter === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setStatusFilter(opt.value)}
                style={[
                  styles.filterChip,
                  isActive
                    ? { backgroundColor: "#A8895A", borderColor: "#A8895A" }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  style={{
                    color: isActive ? "#fff" : colors.muted,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 订单列表 */}
        {isLoading ? (
          <ActivityIndicator color="#D8BC83" style={{ marginTop: 40 }} />
        ) : !orders || orders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36 }}>📭</Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>暂无订单</Text>
          </View>
        ) : (
          orders.map((order: any) => {
            const statusColor = STATUS_COLORS[order.status] || colors.muted;
            const isPendingUsdt = pendingUsdt?.some((p: any) => p.orderId === order.id);
            return (
              <View
                key={order.id}
                style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.orderTop}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.orderTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {order.productTitle}
                    </Text>
                    <Text style={[styles.orderNo, { color: colors.muted }]}>
                      {order.orderNo}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColor + "20", borderColor: statusColor + "60" },
                    ]}
                  >
                    <Text style={{ color: statusColor, fontSize: 11, fontWeight: "700" }}>
                      {labelForStatus(order.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderMeta}>
                  <Text style={[styles.metaItem, { color: colors.muted }]}>
                    💰 ¥{order.amount}
                  </Text>
                  <Text style={[styles.metaItem, { color: colors.muted }]}>
                    👤 用户 #{order.userId}
                  </Text>
                  <Text style={[styles.metaItem, { color: colors.muted }]}>
                    {order.paymentMethod ? `📱 ${labelForMethod(order.paymentMethod)}` : "📱 未选支付"}
                  </Text>
                  <Text style={[styles.metaItem, { color: colors.muted }]}>
                    {fmtDate(order.createdAt)}
                  </Text>
                </View>

                {isPendingUsdt ? (
                  <TouchableOpacity
                    onPress={() => setConfirmOrder(order)}
                    style={styles.confirmBtn}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["#A8895A", "#C9A96E"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.confirmBtnInner}
                    >
                      <Text style={{ color: "#0A1628", fontWeight: "800", fontSize: 13 }}>
                        ✓ 确认 USDT 收款
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* USDT 确认 Modal */}
      <Modal
        visible={!!confirmOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOrder(null)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.box, { backgroundColor: colors.surface }]}>
            <Text style={[modalStyles.title, { color: colors.foreground }]}>
              确认 USDT 收款
            </Text>
            <Text style={[modalStyles.hint, { color: colors.muted }]}>
              确认收到 {confirmOrder?.productTitle} 订单（¥{confirmOrder?.amount}）的 USDT 转账后再点击确认。此操作不可撤销。
            </Text>
            <Text style={[modalStyles.label, { color: colors.muted }]}>
              链上 Tx Hash（选填，可后期补）
            </Text>
            <TextInput
              value={txHash}
              onChangeText={setTxHash}
              placeholder="例如 0x... 或 TRC20 tx id"
              placeholderTextColor={colors.muted}
              style={[modalStyles.input, { color: colors.foreground, borderColor: colors.border }]}
            />
            <Text style={[modalStyles.label, { color: colors.muted }]}>
              备注（选填）
            </Text>
            <TextInput
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder="如：用户提供截图，金额匹配，确认到账"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={[
                modalStyles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  minHeight: 70,
                  textAlignVertical: "top",
                },
              ]}
            />
            <View style={modalStyles.btnRow}>
              <TouchableOpacity
                onPress={() => setConfirmOrder(null)}
                style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.muted }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmUsdt}
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

function labelForStatus(s: string): string {
  return (
    { pending: "待支付", paid: "已支付", cancelled: "已取消", refunded: "已退款", expired: "已过期" }[s] ||
    s
  );
}

function labelForMethod(m: string): string {
  return ({ alipay: "支付宝", wxpay: "微信", usdt: "USDT" }[m] || m);
}

function fmtDate(d: any): string {
  try {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  headerTitle: { fontSize: 20, fontWeight: "900" },
  pendingCard: {
    backgroundColor: "rgba(245, 158, 11, 0.06)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  empty: { alignItems: "center", padding: 60 },
  orderCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  orderTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  orderTitle: { fontSize: 14, fontWeight: "700" },
  orderNo: { fontSize: 11, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  orderMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 6,
  },
  metaItem: { fontSize: 11, fontWeight: "500" },
  confirmBtn: { borderRadius: 8, overflow: "hidden", marginTop: 8 },
  confirmBtnInner: { paddingVertical: 10, alignItems: "center" },
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
    maxWidth: 440,
    borderRadius: 16,
    padding: 20,
  },
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
