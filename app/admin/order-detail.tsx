import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
import { EmptyState } from "@/components/empty-state";
import { AdminPageChrome } from "@/components/admin/page-chrome";
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

const USDT_REVIEW_LABELS: Record<string, string> = {
  NOT_APPLICABLE: "不适用",
  AWAITING_TX: "等待客户提交 Tx",
  PENDING_REVIEW: "待人工复核",
  MATCHED: "金额与网络匹配",
  UNDERPAID: "少付",
  OVERPAID: "多付",
  WRONG_NETWORK: "网络不一致",
  QUOTE_EXPIRED_RECEIPT: "报价过期后到账",
  DUPLICATE_TX: "重复 Tx",
  REFUND_PENDING: "待退款",
  REFUNDED: "已退款",
  REJECTED: "已拒绝",
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
 *   - USDT 待确认 → 记录实收、网络、确认数与人工复核事件
 */
export default function AdminOrderDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ orderNo?: string }>();
  const [showConfirm, setShowConfirm] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [note, setNote] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [confirmations, setConfirmations] = useState("1");
  const [observedNetwork, setObservedNetwork] = useState<"TRC20" | "ERC20">(
    "TRC20",
  );
  const [commerceTotpCode, setCommerceTotpCode] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNetwork, setRefundNetwork] = useState<"TRC20" | "ERC20">(
    "TRC20",
  );
  const [refundTxHash, setRefundTxHash] = useState("");
  const [refundRecipientAddress, setRefundRecipientAddress] = useState("");
  const [recipientVerificationReference, setRecipientVerificationReference] =
    useState("");
  const [busy, setBusy] = useState(false);

  const {
    data: order,
    isLoading,
    refetch,
  } = trpc.orders.detail.useQuery(
    { orderNo: params.orderNo! },
    { enabled: !!params.orderNo }
  );
  const usdtQueue = trpc.orders.adminUsdtQueue.useQuery({ limit: 200 });
  const reconcileMutation = trpc.orders.adminReconcileUsdt.useMutation();
  const reviewMutation = trpc.orders.adminSetUsdtReviewStatus.useMutation();
  const verifyRefundAddressMutation =
    trpc.orders.adminVerifyUsdtRefundAddress.useMutation();
  const refundMutation = trpc.orders.adminRecordUsdtRefund.useMutation();

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  if (isLoading) {
    return (
      <AdminPageChrome eyebrow="ORDER DETAIL" title="订单详情" subtitle="加载订单信息" maxWidth={980}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D8BC83" />
        </View>
      </AdminPageChrome>
    );
  }
  if (!order) {
    return (
      <AdminPageChrome eyebrow="ORDER DETAIL" title="订单详情" subtitle="未找到订单" maxWidth={980}>
        <EmptyState
          emoji=""
          title={params.orderNo ? "订单不存在" : "缺少订单号"}
          subtitle="请从订单管理列表进入详情页，避免手动输入错误的订单编号。"
          actionLabel="返回订单管理"
          onAction={() => router.replace("/admin/orders" as any)}
        />
      </AdminPageChrome>
    );
  }

  const statusColor = STATUS_COLORS[order.status] || colors.muted;
  const commerceUsdt = usdtQueue.data?.find(
    (payment) => payment.orderNo === order.orderNo,
  );
  const pendingUsdtPayment = order.payments?.find(
    (p: any) => p.gateway === "usdt-manual" && p.status === "pending"
  );
  const isPendingUsdt = Boolean(pendingUsdtPayment);

  const handleConfirm = async () => {
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
      const reconciled = await reconcileMutation.mutateAsync({
        orderNo: order.orderNo,
        gatewayOrderNo: txHash.trim(),
        receivedAmount,
        confirmations: Number(confirmations),
        observedNetwork,
        note: note || undefined,
        totpCode: commerceTotpCode,
      });
      showMsg(
        reconciled.orderMarkedPaid
          ? "对账匹配，订单已标记支付完成"
          : `已记录对账结果：${reconciled.reviewStatus}`,
      );
      setShowConfirm(false);
      setTxHash("");
      setNote("");
      setCommerceTotpCode("");
      await Promise.all([refetch(), usdtQueue.refetch()]);
    } catch (e: any) {
      showMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const setUsdtReviewStatus = async (
    reviewStatus:
      | "UNDERPAID"
      | "OVERPAID"
      | "WRONG_NETWORK"
      | "QUOTE_EXPIRED_RECEIPT"
      | "DUPLICATE_TX"
      | "REFUND_PENDING"
      | "REJECTED",
  ) => {
    if (reviewNote.trim().length < 3) {
      showMsg("请先填写至少 3 个字的人工处理备注");
      return;
    }
    try {
      await reviewMutation.mutateAsync({
        orderNo: order.orderNo,
        reviewStatus,
        note: reviewNote.trim(),
      });
      showMsg(`已更新为 ${USDT_REVIEW_LABELS[reviewStatus]}`);
      setReviewNote("");
      await Promise.all([refetch(), usdtQueue.refetch()]);
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "状态更新失败");
    }
  };

  const recordUsdtRefund = async () => {
    if (!Number.isFinite(Number(refundAmount)) || Number(refundAmount) <= 0) {
      showMsg("请填写大于 0 的实际退款金额");
      return;
    }
    if (!/^(?:0x)?[a-fA-F0-9]{64}$/.test(refundTxHash.trim())) {
      showMsg("请核对退款交易的 64 位 Tx Hash");
      return;
    }
    if (!/^\d{6}$/.test(commerceTotpCode)) {
      showMsg("请输入当前 6 位动态验证码");
      return;
    }
    try {
      await refundMutation.mutateAsync({
        orderNo: order.orderNo,
        refundAmount,
        refundNetwork,
        refundTxHash: refundTxHash.trim(),
        note: reviewNote.trim() || undefined,
        totpCode: commerceTotpCode,
      });
      showMsg("已登记外部企业钱包退款与审计事件");
      setRefundAmount("");
      setRefundTxHash("");
      setRefundRecipientAddress("");
      setRecipientVerificationReference("");
      setCommerceTotpCode("");
      await Promise.all([refetch(), usdtQueue.refetch()]);
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "退款登记失败");
    }
  };

  const verifyUsdtRefundAddress = async () => {
    if (refundRecipientAddress.trim().length < 8) {
      showMsg("请填写客户提交的原付款钱包地址");
      return;
    }
    if (recipientVerificationReference.trim().length < 6) {
      showMsg("请填写地址复核参考号或证据哈希");
      return;
    }
    if (!/^\d{6}$/.test(commerceTotpCode)) {
      showMsg("请输入当前 6 位动态验证码");
      return;
    }
    try {
      await verifyRefundAddressMutation.mutateAsync({
        orderNo: order.orderNo,
        refundRecipientAddress: refundRecipientAddress.trim(),
        recipientVerificationReference:
          recipientVerificationReference.trim(),
        note: reviewNote.trim() || undefined,
        totpCode: commerceTotpCode,
      });
      showMsg("原付款钱包已核验；登记退款交易必须使用下一周期的新动态码");
      setRecipientVerificationReference("");
      setCommerceTotpCode("");
      await Promise.all([refetch(), usdtQueue.refetch()]);
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "退款地址核验失败");
    }
  };

  return (
    <AdminPageChrome
      eyebrow="ORDER DETAIL"
      title="订单详情"
      subtitle="订单、支付尝试和人工确认记录"
      metrics={[
        { label: "订单状态", value: STATUS_LABELS[order.status] || order.status, tone: statusColor },
        { label: "实付金额", value: `¥${order.amount}`, tone: "#D8BC83" },
        { label: "支付记录", value: order.payments?.length || 0, tone: colors.primary },
      ]}
      action={
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "900" }}>返回</Text>
          </TouchableOpacity>
      }
      maxWidth={980}
    >

        <View style={styles.ledgerBoundary}>
          <Text style={styles.ledgerBoundaryTitle}>EA 商城 USDT 独立对账</Text>
          <Text style={styles.ledgerBoundaryText}>
            本页不处理客户券商直充或资管平台代收。EA 销售款使用独立 recipient、quote、txHash、reviewStatus 与事件审计。
          </Text>
        </View>

        {/* 订单基本信息 */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, glassStyle("subtle") as any]}>
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
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>下单用户</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow label="用户 ID" value={`#${order.userId}`} colors={colors} />
          {order.remark ? <InfoRow label="用户备注" value={order.remark} colors={colors} /> : null}
        </View>

        {/* 支付记录 */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>支付记录</Text>
        {!order.payments || order.payments.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", padding: 12 }}>
              暂无支付记录
            </Text>
          </View>
        ) : (
          order.payments.map((p: any) => {
            const pStatusColor = pStatusColorMap[p.status] || colors.muted;
            const quote = paymentQuote(p.callbackRaw);
            return (
              <View
                key={p.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                <InfoRow label="结算金额" value={`${p.amount} ${p.currency}`} colors={colors} />
                {quote ? (
                  <>
                    <InfoRow label="网络" value={quote.network} colors={colors} />
                    <InfoRow
                      label="收款地址"
                      value={quote.recipientAddress}
                      valueStyle={{ fontFamily: "monospace", fontSize: 11 }}
                      colors={colors}
                    />
                  </>
                ) : null}
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

        {commerceUsdt ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>EA 商城 USDT 对账审计</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <InfoRow label="报价网络" value={commerceUsdt.settlementNetwork || "—"} colors={colors} />
              <InfoRow label="报价金额" value={`${commerceUsdt.quotedAmount || commerceUsdt.amount} USDT`} colors={colors} />
              <InfoRow label="报价到期" value={commerceUsdt.quoteExpiresAt ? fmtDate(commerceUsdt.quoteExpiresAt) : "—"} colors={colors} />
              <InfoRow
                label="EA 商城收款地址"
                value={commerceUsdt.recipientAddress || "—"}
                valueStyle={{ fontFamily: "monospace", fontSize: 11 }}
                colors={colors}
              />
              <InfoRow
                label="客户提交 txHash"
                value={commerceUsdt.gatewayOrderNo || "未提交"}
                valueStyle={{ fontFamily: "monospace", fontSize: 11 }}
                colors={colors}
              />
              <InfoRow label="申报时间" value={commerceUsdt.submittedAt ? fmtDate(commerceUsdt.submittedAt) : "—"} colors={colors} />
              <InfoRow label="实收金额" value={commerceUsdt.receivedAmount ? `${commerceUsdt.receivedAmount} USDT` : "未核对"} colors={colors} />
              <InfoRow label="确认数" value={commerceUsdt.confirmations == null ? "—" : String(commerceUsdt.confirmations)} colors={colors} />
              <InfoRow label="观测网络" value={commerceUsdt.observedNetwork || "—"} colors={colors} />
              <InfoRow
                label="人工复核状态"
                value={USDT_REVIEW_LABELS[commerceUsdt.usdtReviewStatus] || commerceUsdt.usdtReviewStatus}
                valueStyle={{ color: commerceUsdt.usdtReviewStatus === "MATCHED" ? "#34D399" : "#FBBF24", fontWeight: "900" }}
                colors={colors}
              />
              <InfoRow label="核验方式" value={commerceUsdt.verificationMode || "未核验"} colors={colors} />
              {commerceUsdt.reviewNote ? <InfoRow label="人工备注" value={commerceUsdt.reviewNote} colors={colors} /> : null}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.auditTitle, { color: colors.foreground }]}>USDT 对账事件</Text>
              {commerceUsdt.events.length ? commerceUsdt.events.map((event: {
                id: number;
                eventType: string;
                payload: string | null;
                createdAt: Date | string;
              }) => (
                <View key={event.id} style={styles.auditEvent}>
                  <Text style={styles.auditEventType}>{event.eventType}</Text>
                  <Text style={[styles.auditEventPayload, { color: colors.muted }]} numberOfLines={3}>{event.payload || "—"}</Text>
                  <Text style={[styles.auditEventTime, { color: colors.muted }]}>{fmtDate(event.createdAt)}</Text>
                </View>
              )) : <Text style={{ color: colors.muted, fontSize: 11 }}>暂无对账事件</Text>}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.auditTitle, { color: colors.foreground }]}>异常 / 退款状态</Text>
              <TextInput
                value={reviewNote}
                onChangeText={setReviewNote}
                placeholder="必填：人工处理原因、证据来源或退款说明（不得填私钥/密码）"
                placeholderTextColor={colors.muted}
                multiline
                style={[styles.reviewInput, { color: colors.foreground, borderColor: colors.border }]}
              />
              <View style={styles.reviewButtons}>
                {(
                  [
                    ["UNDERPAID", "少付"],
                    ["OVERPAID", "多付"],
                    ["WRONG_NETWORK", "错链"],
                    ["QUOTE_EXPIRED_RECEIPT", "晚到"],
                    ["DUPLICATE_TX", "重复 Tx"],
                    ["REFUND_PENDING", "待退款"],
                    ["REJECTED", "拒绝"],
                  ] as const
                ).map(([status, label]) => (
                  <TouchableOpacity
                    key={status}
                    disabled={reviewMutation.isPending}
                    onPress={() => void setUsdtReviewStatus(status)}
                    style={[styles.reviewButton, { borderColor: colors.border }]}
                  >
                    <Text style={styles.reviewButtonText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {commerceUsdt.usdtReviewStatus === "REFUND_PENDING" ? (
                <View style={styles.refundPanel}>
                  <Text style={[styles.auditTitle, { color: colors.foreground }]}>退款步骤 1 · 核验原付款钱包</Text>
                  {commerceUsdt.refundRecipientVerifiedAt ? (
                    <Text style={styles.verifiedText}>
                      已核验：退款只能发往客户提交的原付款钱包。请使用下一周期的新动态码执行步骤 2。
                    </Text>
                  ) : (
                    <>
                      <TextInput
                        value={refundRecipientAddress}
                        onChangeText={setRefundRecipientAddress}
                        placeholder="客户提交的原付款钱包地址"
                        placeholderTextColor={colors.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[styles.refundInput, { color: colors.foreground, borderColor: colors.border }]}
                      />
                      <TextInput
                        value={recipientVerificationReference}
                        onChangeText={setRecipientVerificationReference}
                        placeholder="地址复核参考号 / 证据哈希"
                        placeholderTextColor={colors.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[styles.refundInput, { color: colors.foreground, borderColor: colors.border }]}
                      />
                      <TotpInput
                        value={commerceTotpCode}
                        onChange={setCommerceTotpCode}
                        colors={colors}
                        label="EA商城退款地址核验六位动态验证码"
                      />
                      <TouchableOpacity
                        disabled={verifyRefundAddressMutation.isPending || !/^\d{6}$/.test(commerceTotpCode)}
                        onPress={() => void verifyUsdtRefundAddress()}
                        style={[styles.refundButton, (verifyRefundAddressMutation.isPending || !/^\d{6}$/.test(commerceTotpCode)) && styles.disabled]}
                      >
                        <Text style={styles.refundButtonText}>动态验证原付款钱包</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {commerceUsdt.refundRecipientVerifiedAt ? (
                    <>
                      <Text style={[styles.auditTitle, { color: colors.foreground }]}>退款步骤 2 · 外部钱包退款后登记</Text>
                      <Text style={[styles.ledgerBoundaryText, { marginBottom: 4 }]}>
                        先在 BVNK、Cobo 或经批准的外部企业钱包向已核验地址退款，再用新的动态码登记金额、网络与 txHash；本站不会自动转币。
                      </Text>
                      <TextInput
                        value={refundAmount}
                        onChangeText={(value) => setRefundAmount(value.replace(/[^0-9.]/g, ""))}
                        placeholder="实际退款 USDT"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        style={[styles.refundInput, { color: colors.foreground, borderColor: colors.border }]}
                      />
                      <View style={styles.reviewButtons}>
                        {(["TRC20", "ERC20"] as const).map((item) => (
                          <TouchableOpacity
                            key={item}
                            onPress={() => setRefundNetwork(item)}
                            style={[
                              styles.reviewButton,
                              { borderColor: refundNetwork === item ? "#D8BC83" : colors.border },
                            ]}
                          >
                            <Text style={styles.reviewButtonText}>{item}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        value={refundTxHash}
                        onChangeText={setRefundTxHash}
                        placeholder="外部钱包退款 txHash"
                        placeholderTextColor={colors.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[styles.refundInput, { color: colors.foreground, borderColor: colors.border }]}
                      />
                      <TotpInput
                        value={commerceTotpCode}
                        onChange={setCommerceTotpCode}
                        colors={colors}
                        label="EA商城退款交易登记六位动态验证码"
                      />
                      <TouchableOpacity
                        disabled={refundMutation.isPending || !/^\d{6}$/.test(commerceTotpCode)}
                        onPress={() => void recordUsdtRefund()}
                        style={[styles.refundButton, (refundMutation.isPending || !/^\d{6}$/.test(commerceTotpCode)) && styles.disabled]}
                      >
                        <Text style={styles.refundButtonText}>再次验证并登记真实退款</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {/* 操作区 */}
        {isPendingUsdt && (
          <TouchableOpacity
            onPress={() => {
              setTxHash(pendingUsdtPayment?.gatewayOrderNo || "");
              setReceivedAmount(
                String(
                  commerceUsdt?.quotedAmount ||
                    pendingUsdtPayment?.amount ||
                    "",
                ),
              );
              setObservedNetwork(
                commerceUsdt?.settlementNetwork === "ERC20"
                  ? "ERC20"
                  : "TRC20",
              );
              setCommerceTotpCode("");
              setShowConfirm(true);
            }}
            style={styles.actionBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#A8895A", "#C9A96E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtnInner}
            >
              <Text style={styles.actionBtnText}>核对 EA 商城 USDT 实收</Text>
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
                查看商品下载链接
              </Text>
            </View>
          </TouchableOpacity>
        )}

      {/* 确认 USDT Modal */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirm(false);
          setCommerceTotpCode("");
        }}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.box, { backgroundColor: colors.surface }]}>
            <Text style={[modalStyles.title, { color: colors.foreground }]}>
              核对 EA 商城 USDT 实收
            </Text>
            <Text style={[modalStyles.hint, { color: colors.muted }]}>
              请在区块链浏览器核对本商城订单的 recipient、网络、txHash 与实际到账；少付、多付、错链和晚到不会自动标记支付完成。
            </Text>
            <Text style={[modalStyles.label, { color: colors.muted }]}>链上 Tx Hash</Text>
            <TextInput
              value={txHash}
              onChangeText={setTxHash}
              placeholder="必填，TRC20/ERC20 tx id"
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
              {(["TRC20", "ERC20"] as const).map((network) => (
                <TouchableOpacity
                  key={network}
                  onPress={() => setObservedNetwork(network)}
                  style={[
                    modalStyles.networkButton,
                    { borderColor: observedNetwork === network ? "#D8BC83" : colors.border },
                  ]}
                >
                  <Text style={{ color: observedNetwork === network ? "#D8BC83" : colors.muted, fontWeight: "800", fontSize: 11 }}>
                    {network}
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
                onPress={() => {
                  setShowConfirm(false);
                  setCommerceTotpCode("");
                }}
                style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.muted }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
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
                  <Text style={{ color: "#0A1628", fontWeight: "800" }}>提交对账结果</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AdminPageChrome>
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

function TotpInput({
  value,
  onChange,
  colors,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  colors: any;
  label: string;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={(next) => onChange(next.replace(/\D/g, "").slice(0, 6))}
      placeholder="当前 6 位动态验证码"
      placeholderTextColor={colors.muted}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      style={[
        styles.refundInput,
        styles.totpInput,
        { color: colors.foreground, borderColor: colors.border },
      ]}
    />
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

function paymentQuote(raw?: string | null): { network: string; recipientAddress: string } | null {
  if (!raw) return null;
  try {
    const quote = JSON.parse(raw)?.quote;
    return typeof quote?.network === "string" && typeof quote?.recipientAddress === "string"
      ? { network: quote.network, recipientAddress: quote.recipientAddress }
      : null;
  } catch {
    return null;
  }
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
  backBtn: {
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  card: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
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
  ledgerBoundary: {
    padding: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.28)",
    borderRadius: 8,
    backgroundColor: "rgba(52, 211, 153, 0.05)",
    gap: 5,
  },
  ledgerBoundaryTitle: { color: "#34D399", fontSize: 12, fontWeight: "900" },
  ledgerBoundaryText: { color: "#94A3B8", fontSize: 11, lineHeight: 17 },
  auditTitle: { fontSize: 12, fontWeight: "900", marginBottom: 8 },
  auditEvent: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.12)",
    gap: 3,
  },
  auditEventType: { color: "#D8BC83", fontSize: 10, fontWeight: "900" },
  auditEventPayload: { fontSize: 10, lineHeight: 15, fontFamily: "monospace" },
  auditEventTime: { fontSize: 9 },
  reviewInput: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    textAlignVertical: "top",
    fontSize: 11,
  },
  reviewButtons: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  reviewButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewButtonText: { color: "#E2E8F0", fontSize: 10, fontWeight: "800" },
  refundPanel: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.16)",
    gap: 8,
  },
  refundInput: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 10,
    fontSize: 11,
    fontFamily: "monospace",
  },
  totpInput: { maxWidth: 280, letterSpacing: 7, fontWeight: "900" },
  refundButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D8BC83",
    alignSelf: "flex-start",
  },
  refundButtonText: { color: "#050810", fontSize: 10, fontWeight: "900" },
  verifiedText: { color: "#34D399", fontSize: 10, lineHeight: 16, fontWeight: "800" },
  disabled: { opacity: 0.38 },
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
