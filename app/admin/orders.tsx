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
import { LinearGradient } from "expo-linear-gradient";
import { EmptyState } from "@/components/empty-state";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confirmOrder, setConfirmOrder] = useState<any | null>(null);
  const [txHash, setTxHash] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [confirmations, setConfirmations] = useState("1");
  const [observedNetwork, setObservedNetwork] = useState<"TRC20" | "ERC20">("TRC20");
  const [commerceTotpCode, setCommerceTotpCode] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: orders, isLoading, refetch } = trpc.orders.adminList.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 200,
  });

  const { data: pendingUsdt } = trpc.orders.adminPendingUsdt.useQuery();
  const confirmUsdtMutation = trpc.orders.adminReconcileUsdt.useMutation();

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  const handleConfirmUsdt = async () => {
    if (!confirmOrder) return;
    if (!/^(?:0x)?[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      showMsg("请核对并填写完整的 64 位 Tx Hash");
      return;
    }
    if (!Number.isFinite(Number(receivedAmount)) || Number(receivedAmount) <= 0) {
      showMsg("请填写大于 0 的链上实收金额");
      return;
    }
    if (!Number.isInteger(Number(confirmations)) || Number(confirmations) < 1) {
      showMsg("至少需要 1 个链上确认");
      return;
    }
    if (!/^\d{6}$/.test(commerceTotpCode)) {
      showMsg("请输入当前 6 位动态验证码");
      return;
    }
    setBusy(true);
    try {
      await confirmUsdtMutation.mutateAsync({
        orderNo: confirmOrder.orderNo,
        gatewayOrderNo: txHash.trim(),
        receivedAmount,
        confirmations: Number(confirmations),
        observedNetwork,
        totpCode: commerceTotpCode,
        note: adminNote || undefined,
      });
      showMsg("已记录链上实收并完成对账；异常结果请进入订单详情处理");
      setConfirmOrder(null);
      setTxHash("");
      setReceivedAmount("");
      setConfirmations("1");
      setCommerceTotpCode("");
      setAdminNote("");
      refetch();
    } catch (e: any) {
      showMsg(e.message || "确认失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPageChrome
      eyebrow="ORDER LEDGER"
      title="订单管理"
      subtitle="支付确认、订单状态和用户交易记录集中处理"
      metrics={[
        { label: "订单总量", value: orders?.length ?? "-", tone: colors.primary },
        { label: "待收 USDT", value: pendingUsdt?.length ?? 0, tone: "#D8BC83" },
        { label: "当前筛选", value: labelForStatus(statusFilter), tone: "#60A5FA" },
      ]}
      maxWidth={1320}
    >
        {/* 待确认 USDT 提示卡 */}
        {pendingUsdt && pendingUsdt.length > 0 ? (
          <View style={[styles.pendingCard, { borderColor: "rgba(245, 158, 11, 0.4)" }]}>
            <Text style={{ color: "#D8BC83", fontWeight: "800", fontSize: 14 }}>
              USDT 转账等待确认：{pendingUsdt.length} 笔
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              必须在区块浏览器或企业钱包核对收款地址、金额、网络与确认数；客户截图不作为到账证明。
            </Text>
          </View>
        ) : null}

        <AdminSection title="订单流水" meta="STATUS FILTER">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
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
                      color: isActive ? "#07111F" : colors.muted,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {isLoading ? (
            <ActivityIndicator color="#D8BC83" style={{ marginTop: 40 }} />
          ) : !orders || orders.length === 0 ? (
            <EmptyState
              emoji=""
              title={statusFilter === "all" ? "暂无订单" : `暂无${STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label || ""}订单`}
              subtitle="本地预览会显示样例订单；真实部署后这里会连接线上数据库订单。"
            />
          ) : (
            <View style={[styles.tablePanel, { borderColor: colors.border }]}>
              {orders.map((order: any) => {
                const statusColor = STATUS_COLORS[order.status] || colors.muted;
                const pendingPayment = pendingUsdt?.find((p: any) => p.orderId === order.id);
                const isPendingUsdt = Boolean(pendingPayment);
                return (
                  <View
                    key={order.id}
                    style={[styles.orderRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.orderMain}>
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
                    <View style={styles.orderMeta}>
                      <Text style={[styles.metaItem, { color: colors.muted }]}>¥{order.amount}</Text>
                      <Text style={[styles.metaItem, { color: colors.muted }]}>用户 #{order.userId}</Text>
                      <Text style={[styles.metaItem, { color: colors.muted }]}>
                        {order.paymentMethod ? labelForMethod(order.paymentMethod) : "未选支付"}
                      </Text>
                      <Text style={[styles.metaItem, { color: colors.muted }]}>
                        {fmtDate(order.createdAt)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: statusColor + "20", borderColor: statusColor + "60" },
                      ]}
                    >
                      <Text style={{ color: statusColor, fontSize: 11, fontWeight: "800" }}>
                        {labelForStatus(order.status)}
                      </Text>
                    </View>

                    {isPendingUsdt ? (
                      <TouchableOpacity
                        onPress={() => {
                          setConfirmOrder({ ...order, pendingPayment });
                          setTxHash(pendingPayment?.gatewayOrderNo || "");
                          setReceivedAmount(
                            String(pendingPayment?.quotedAmount || pendingPayment?.amount || ""),
                          );
                          setObservedNetwork(
                            pendingPayment?.settlementNetwork === "ERC20" ? "ERC20" : "TRC20",
                          );
                          setCommerceTotpCode("");
                        }}
                        style={styles.confirmBtn}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={["#A8895A", "#C9A96E"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.confirmBtnInner}
                        >
                          <Text style={{ color: "#07111F", fontWeight: "900", fontSize: 12 }}>
                            确认收款
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </AdminSection>

      {/* USDT 确认 Modal */}
      <Modal
        visible={!!confirmOrder}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmOrder(null);
          setCommerceTotpCode("");
        }}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.box, { backgroundColor: colors.surface }]}>
            <Text style={[modalStyles.title, { color: colors.foreground }]}>
              确认 USDT 收款
            </Text>
            <Text style={[modalStyles.hint, { color: colors.muted }]}>
              请在区块链浏览器核对收款地址与 {confirmOrder?.pendingPayment?.amount} {confirmOrder?.pendingPayment?.currency}，确认到账后再操作。
            </Text>
            <Text style={[modalStyles.label, { color: colors.muted }]}>
              链上 Tx Hash（必填）
            </Text>
            <TextInput
              value={txHash}
              onChangeText={setTxHash}
              placeholder="例如 0x... 或 TRC20 tx id"
              placeholderTextColor={colors.muted}
              style={[modalStyles.input, { color: colors.foreground, borderColor: colors.border }]}
            />
            <Text style={[modalStyles.label, { color: colors.muted }]}>实际收到 USDT</Text>
            <TextInput
              value={receivedAmount}
              onChangeText={(value) => setReceivedAmount(value.replace(/[^0-9.]/g, ""))}
              placeholder="按链上实收填写"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={[modalStyles.input, { color: colors.foreground, borderColor: colors.border }]}
            />
            <Text style={[modalStyles.label, { color: colors.muted }]}>链上确认数</Text>
            <TextInput
              value={confirmations}
              onChangeText={(value) => setConfirmations(value.replace(/[^0-9]/g, ""))}
              placeholder="1"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={[modalStyles.input, { color: colors.foreground, borderColor: colors.border }]}
            />
            <Text style={[modalStyles.label, { color: colors.muted }]}>观测网络</Text>
            <View style={modalStyles.networkRow}>
              {(["TRC20", "ERC20"] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setObservedNetwork(item)}
                  style={[
                    modalStyles.networkButton,
                    { borderColor: observedNetwork === item ? "#D8BC83" : colors.border },
                  ]}
                >
                  <Text style={{ color: observedNetwork === item ? "#D8BC83" : colors.muted, fontWeight: "800" }}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[modalStyles.label, { color: colors.muted }]}>动态验证码</Text>
            <TextInput
              accessibilityLabel="EA商城对账六位动态验证码"
              value={commerceTotpCode}
              onChangeText={(value) => setCommerceTotpCode(value.replace(/\D/g, "").slice(0, 6))}
              placeholder="当前 6 位动态验证码"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={[modalStyles.input, modalStyles.totpInput, { color: colors.foreground, borderColor: colors.border }]}
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
                onPress={() => {
                  setConfirmOrder(null);
                  setCommerceTotpCode("");
                }}
                style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.muted }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmUsdt}
                disabled={busy || !/^\d{6}$/.test(commerceTotpCode)}
                style={[
                  modalStyles.okBtn,
                  { opacity: busy || !/^\d{6}$/.test(commerceTotpCode) ? 0.6 : 1 },
                ]}
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
    </AdminPageChrome>
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
  pendingCard: {
    backgroundColor: "rgba(245, 158, 11, 0.06)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  tablePanel: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.56)",
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  orderMain: {
    flex: 1.4,
    minWidth: 180,
  },
  orderTitle: { fontSize: 13, fontWeight: "800" },
  orderNo: { fontSize: 11, marginTop: 3, fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  statusPill: {
    minWidth: 66,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  orderMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    flex: 1.2,
    minWidth: 220,
  },
  metaItem: { fontSize: 11, fontWeight: "500" },
  confirmBtn: { width: 92, borderRadius: 6, overflow: "hidden" },
  confirmBtnInner: { paddingVertical: 8, alignItems: "center" },
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
  networkRow: { flexDirection: "row", gap: 8 },
  networkButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  totpInput: { letterSpacing: 7, fontWeight: "900" },
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
