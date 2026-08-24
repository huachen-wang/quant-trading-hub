import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, Image, Linking, Animated, TextInput } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { glassStyle } from "@/lib/glass-styles";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";

type PayState =
  | { kind: "select" }
  | {
      kind: "zpay";
      method: "alipay" | "wxpay";
      payUrl: string;
      hint?: string;
    }
  | {
      kind: "usdt";
      address: string;
      chain: "TRC20" | "ERC20";
      qrCodeUrl?: string;
      amount: string;
      cnyPerUsdt: string;
      quoteExpiresAt: string;
      submitted?: boolean;
    };

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

export default function CheckoutOrderScreen() {
  const params = useLocalSearchParams<{ orderNo: string }>();
  const router = useRouter();
  const colors = useColors();
  const orderNo = params.orderNo;

  const [payState, setPayState] = useState<PayState>({ kind: "select" });
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [payerWalletAddress, setPayerWalletAddress] = useState("");
  const [payerOwnershipAttested, setPayerOwnershipAttested] = useState(false);
  const [tick, setTick] = useState(0); // 用于触发倒计时刷新

  // 订单详情
  const {
    data: order,
    isLoading,
    error: orderError,
    refetch,
  } = trpc.orders.detail.useQuery(
    { orderNo: orderNo! },
    {
      enabled: !!orderNo,
      retry: false,
      refetchInterval: (query) => (query.state.data?.status === "pending" ? 5000 : false),
    },
  );

  // 支付方式列表
  const { data: methods } = trpc.payments.listMethods.useQuery();

  const initiateMutation = trpc.payments.initiate.useMutation();
  const markUsdtMutation = trpc.payments.markUsdtSubmitted.useMutation();
  const cancelMutation = trpc.orders.cancel.useMutation();

  // 倒计时刷新
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  // 倒计时计算
  const remainingSeconds = useMemo(() => {
    if (!order?.expiresAt) return 0;
    const ms = new Date(order.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  }, [order, tick]);

  const handleSelectMethod = async (method: "alipay" | "wxpay" | "usdt") => {
    if (!orderNo) return;
    setBusy(true);
    try {
      const result = await initiateMutation.mutateAsync({ orderNo, method });

      if (method === "usdt") {
        if (!result.addressInfo || !result.settlementQuote) throw new Error("USDT 网关未返回完整结算报价");
        setTxHash("");
        setPayerWalletAddress("");
        setPayerOwnershipAttested(false);
        setPayState({
          kind: "usdt",
          address: result.addressInfo.address,
          chain: result.addressInfo.chain,
          qrCodeUrl: result.addressInfo.qrCodeUrl,
          amount: result.settlementQuote.amount,
          cnyPerUsdt: result.settlementQuote.cnyPerUsdt,
          quoteExpiresAt: result.settlementQuote.expiresAt,
          submitted: Boolean(result.submittedTxHash),
        });
        setTxHash(result.submittedTxHash || "");
      } else {
        // ZPay：跳转支付页
        if (!result.payUrl) throw new Error("支付页 URL 缺失");
        if (Platform.OS === "web") {
          // Web：直接打开新窗口/当前窗口跳转
          window.open(result.payUrl, "_blank");
          setPayState({
            kind: "zpay",
            method,
            payUrl: result.payUrl,
            hint: result.hint,
          });
        } else {
          // 移动端：用 Linking 打开
          await Linking.openURL(result.payUrl);
          setPayState({
            kind: "zpay",
            method,
            payUrl: result.payUrl,
            hint: result.hint,
          });
        }
      }
    } catch (e: any) {
      showMsg(e.message || "发起支付失败");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmUsdt = async () => {
    if (!orderNo) return;
    const normalizedTxHash = txHash.trim();
    if (!/^(?:0x)?[a-fA-F0-9]{64}$/.test(normalizedTxHash)) {
      showMsg("请填写完整的 64 位链上 Tx Hash");
      return;
    }
    if (payerWalletAddress.trim().length < 8) {
      showMsg("请填写本次实际付款钱包地址");
      return;
    }
    if (!payerOwnershipAttested) {
      showMsg("请确认付款钱包由本人或已授权主体控制");
      return;
    }
    setBusy(true);
    try {
      const result = await markUsdtMutation.mutateAsync({
        orderNo,
        txHashOrNote: normalizedTxHash,
        payerWalletAddress: payerWalletAddress.trim(),
        payerOwnershipAttested: true,
      });
      showMsg(result.message || "已提交，等待链上对账确认");
      setPayState((s) => (s.kind === "usdt" ? { ...s, submitted: true } : s));
      refetch();
    } catch (e: any) {
      showMsg(e.message || "提交失败");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = (text: string) => {
    if (Platform.OS === "web") {
      navigator.clipboard.writeText(text);
      showMsg("已复制");
    } else {
      // 移动端可以接 expo-clipboard
      showMsg(text);
    }
  };

  const handleCancel = async () => {
    if (!orderNo) return;
    if (Platform.OS === "web" && !confirm("确认取消订单？")) return;
    try {
      await cancelMutation.mutateAsync({ orderNo });
      showMsg("订单已取消");
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      showMsg(e.message);
    }
  };

  // 已支付 → 跳转成功页
  useEffect(() => {
    if (order?.status === "paid") {
      router.replace(`/checkout/success?orderNo=${orderNo}` as any);
    }
  }, [order?.status, orderNo, router]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerFull}>
          <ActivityIndicator size="large" color="#D8BC83" />
        </View>
      </ScreenContainer>
    );
  }

  if (!order) {
    const needsLogin = /login|unauthorized|10001/i.test(orderError?.message || "");
    return (
      <ScreenContainer>
        <View style={styles.centerFull}>
          <Text style={styles.emptyIcon}>!</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{needsLogin ? "需要登录" : "订单不存在"}</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>{needsLogin ? "请先登录后查看订单，或返回首页重新选择商品。" : "没有找到这个订单，可能已经失效或订单号有误。"}</Text>
          <TouchableOpacity onPress={() => router.replace((needsLogin ? "/auth/login" : "/(tabs)") as any)} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>{needsLogin ? "去登录" : "返回首页"}</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const statusColor = STATUS_COLORS[order.status] || colors.muted;
  const isPending = order.status === "pending" && remainingSeconds > 0;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View
          style={{
            padding: 16,
            maxWidth: 720,
            alignSelf: "center",
            width: "100%",
          }}
        >
          {/* 顶部品牌行 */}
          <View style={styles.brandRow}>
            <View style={styles.liveDot} />
            <Text style={styles.brandText}>AI量化联盟 · EA商城安全收银台</Text>
          </View>
          <View style={styles.ledgerBoundary}>
            <Text style={styles.ledgerBoundaryTitle}>EA 商城独立收银</Text>
            <Text style={[styles.ledgerBoundaryText, { color: colors.muted }]}>
              本页只结算 EA 文件/商品订单，不用于客户券商直充或资管平台代收。
              三类资金使用独立订单、地址、txHash 与后台对账记录。
            </Text>
          </View>

          {/* 订单卡片 */}
          <View style={[styles.orderCard, glassStyle("strong") as any]}>
            {order.productCover ? <Image source={{ uri: order.productCover }} style={styles.orderCover} /> : null}
            <View style={{ flex: 1, padding: 16 }}>
              <Text style={[styles.orderTitle, { color: colors.foreground }]} numberOfLines={2}>
                {order.productTitle}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  marginTop: 8,
                  gap: 6,
                }}
              >
                <Text style={styles.amount}>¥ {order.amount}</Text>
                {order.originalAmount && parseFloat(order.originalAmount) > parseFloat(String(order.amount)) ? <Text style={[styles.amountOrig, { color: colors.muted }]}>¥{order.originalAmount}</Text> : null}
              </View>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: statusColor + "20",
                      borderColor: statusColor + "60",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: statusColor,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {statusLabel}
                  </Text>
                </View>
                <Text style={[styles.orderNo, { color: colors.muted }]}>订单号 {order.orderNo}</Text>
              </View>
              {isPending ? (
                <View style={[styles.countdown, { backgroundColor: "rgba(248, 113, 113, 0.08)" }]}>
                  <Text
                    style={{
                      color: "#F87171",
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    ⏱ 订单将在 {fmtCountdown(remainingSeconds)} 后过期
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 状态分支：Selecting / ZPay / USDT */}
          {order.status === "pending" && remainingSeconds > 0 && (
            <>
              {payState.kind === "select" && (
                <View style={[styles.methodCard, glassStyle("subtle") as any]}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>选择支付方式</Text>
                  {(methods || []).map((m: any) => (
                    <TouchableOpacity key={m.method} onPress={() => handleSelectMethod(m.method)} style={[styles.methodItem, { borderColor: colors.border }]} activeOpacity={0.7} disabled={busy}>
                      <Text style={{ fontSize: 28 }}>{m.icon}</Text>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[styles.methodLabel, { color: colors.foreground }]}>{m.label}</Text>
                        <Text style={[styles.methodHint, { color: colors.muted }]}>{m.hint || ""}</Text>
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={handleCancel} style={styles.cancelLink}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>取消订单</Text>
                  </TouchableOpacity>
                </View>
              )}

              {payState.kind === "zpay" && (
                <View style={[styles.methodCard, glassStyle("subtle") as any]}>
                  <View style={styles.zpayBox}>
                    <Text style={{ fontSize: 48, marginBottom: 8 }}>{payState.method === "alipay" ? "💙" : "💚"}</Text>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{payState.method === "alipay" ? "支付宝支付" : "微信支付"}</Text>
                    <Text style={[styles.zpayHint, { color: colors.muted }]}>{payState.hint || "已为您打开支付页面，请在新窗口完成支付"}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS === "web") window.open(payState.payUrl, "_blank");
                        else Linking.openURL(payState.payUrl);
                      }}
                      style={styles.zpayReopen}
                    >
                      <Text style={{ color: "#D8BC83", fontWeight: "700" }}>重新打开支付页 →</Text>
                    </TouchableOpacity>
                    <Text style={[styles.zpayWaitHint, { color: colors.muted }]}>支付完成后页面会自动跳转。如未跳转，请刷新本页面。</Text>
                    <TouchableOpacity onPress={() => setPayState({ kind: "select" })} style={styles.zpayBack}>
                      <Text style={{ color: colors.muted, fontSize: 13 }}>← 切换其他支付方式</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {payState.kind === "usdt" && (
                <View style={[styles.methodCard, glassStyle("subtle") as any]}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🪙 USDT 转账（{payState.chain}）</Text>
                  <View style={styles.usdtQuoteCard}>
                    <Text style={[styles.usdtLabel, { color: colors.muted }]}>本单应付（锁定至订单过期）</Text>
                    <Text style={styles.usdtQuoteAmount}>{payState.amount} USDT</Text>
                    <Text style={[styles.usdtQuoteMeta, { color: colors.muted }]}>1 USDT = ¥{payState.cnyPerUsdt} · 报价到期 {new Date(payState.quoteExpiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  <Text style={[styles.usdtHint, { color: colors.muted }]}>
                    请使用 <Text style={{ color: "#D8BC83", fontWeight: "700" }}>{payState.chain}</Text> 网络，精确转入 <Text style={{ color: "#D8BC83", fontWeight: "700" }}>{payState.amount} USDT</Text> 至下方地址：
                  </Text>

                  <View style={styles.usdtAddrCard}>
                    <Text style={[styles.usdtLabel, { color: colors.muted }]}>收款地址</Text>
                    <Text style={[styles.usdtAddr, { color: colors.foreground }]} selectable>
                      {payState.address}
                    </Text>
                    <TouchableOpacity onPress={() => handleCopy(payState.address)} style={styles.copyBtn}>
                      <Text
                        style={{
                          color: "#D8BC83",
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        复制地址
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {payState.qrCodeUrl ? (
                    <View style={styles.qrBox}>
                      <Text style={[styles.usdtLabel, { color: colors.muted }]}>扫码转账</Text>
                      <Image source={{ uri: payState.qrCodeUrl }} style={styles.qrImage} />
                    </View>
                  ) : null}

                  <View style={styles.usdtNote}>
                    <Text
                      style={{
                        color: "#F87171",
                        fontSize: 12,
                        fontWeight: "700",
                        marginBottom: 6,
                      }}
                    >
                      RISK 重要提示
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        lineHeight: 20,
                      }}
                    >
                      1. 请务必使用 <Text style={{ color: "#D8BC83" }}>{payState.chain}</Text> 网络（其他网络无法到账，资金可能丢失）{"\n"}
                      2. 数量不符、网络不符或报价过期时不会自动交付{"\n"}
                      3. 转账后提交付款钱包与 Tx Hash，对账通过后订单才生效{"\n"}
                      4. EA 商城收款与券商入金、资管代收完全分账
                    </Text>
                  </View>

                  {!payState.submitted ? (
                    <>
                      <Text style={[styles.usdtLabel, { color: colors.muted }]}>本次实际付款钱包（必填）</Text>
                      <TextInput
                        value={payerWalletAddress}
                        onChangeText={setPayerWalletAddress}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={payState.chain === "ERC20" ? "0x 开头的钱包地址" : "T 开头的 TRON 钱包地址"}
                        placeholderTextColor={colors.muted}
                        style={[styles.usdtTxInput, { color: colors.foreground, borderColor: colors.border }]}
                      />
                      <TouchableOpacity
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: payerOwnershipAttested }}
                        onPress={() => setPayerOwnershipAttested((value) => !value)}
                        style={styles.attestationRow}
                      >
                        <View style={[styles.attestationBox, payerOwnershipAttested && styles.attestationBoxChecked]}>
                          <Text style={styles.attestationMark}>{payerOwnershipAttested ? "✓" : ""}</Text>
                        </View>
                        <Text style={[styles.attestationText, { color: colors.muted }]}>我确认该付款钱包由本人或已授权主体控制；退款如适用，只能退回经核验的原付款钱包。</Text>
                      </TouchableOpacity>
                      <Text style={[styles.usdtLabel, { color: colors.muted }]}>Tx Hash / TxID（必填）</Text>
                      <TextInput
                        value={txHash}
                        onChangeText={setTxHash}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={payState.chain === "ERC20" ? "0x + 64 位十六进制" : "64 位 TRON TxID"}
                        placeholderTextColor={colors.muted}
                        style={[styles.usdtTxInput, { color: colors.foreground, borderColor: colors.border }]}
                      />
                      <TouchableOpacity
                        onPress={handleConfirmUsdt}
                        style={[styles.usdtSubmitBtn, (busy || !payerOwnershipAttested) && styles.disabled]}
                        disabled={busy || !payerOwnershipAttested}
                        activeOpacity={0.85}
                      >
                        <LinearGradient colors={["#A8895A", "#C9A96E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.usdtSubmitInner}>
                          {busy ? <ActivityIndicator color="#0A1628" /> : <Text style={styles.usdtSubmitText}>提交 Tx Hash 待对账</Text>}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.usdtSubmitted}>
                      <Text
                        style={{
                          color: "#34D399",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        ✓ 已提交，等待客服确认中...
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        系统已保存 Tx Hash，管理员核对链上到账后交付
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity onPress={() => setPayState({ kind: "select" })} style={styles.zpayBack}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>← 切换其他支付方式</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* 已过期 / 已取消 */}
          {(order.status === "expired" || order.status === "cancelled" || remainingSeconds <= 0) && order.status !== "paid" && (
            <View style={[styles.methodCard, glassStyle("subtle") as any]}>
              <View style={styles.expiredIcon}>
                <IconSymbol name="exclamationmark.triangle.fill" size={25} color="#F87171" />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: "center" }]}>订单已{order.status === "cancelled" ? "取消" : "过期"}</Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                请重新下单
              </Text>
              <TouchableOpacity onPress={() => router.replace("/(tabs)" as any)} style={[styles.usdtSubmitBtn, { marginTop: 16 }]}>
                <LinearGradient colors={["#A8895A", "#C9A96E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.usdtSubmitInner}>
                  <Text style={styles.usdtSubmitText}>返回首页</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function fmtCountdown(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  centerFull: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.5)",
    color: "#D8BC83",
    textAlign: "center",
    lineHeight: 52,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  emptyText: {
    maxWidth: 360,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
  },
  emptyBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#D8BC83",
  },
  emptyBtnText: {
    color: "#0A1628",
    fontSize: 14,
    fontWeight: "800",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  brandText: {
    fontSize: 12,
    color: "#D8BC83",
    fontWeight: "700",
    letterSpacing: 1.6,
  },
  ledgerBoundary: {
    marginBottom: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.28)",
    borderRadius: 6,
    backgroundColor: "rgba(216,188,131,0.04)",
    gap: 3,
  },
  ledgerBoundaryTitle: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
  },
  ledgerBoundaryText: {
    fontSize: 9,
    lineHeight: 15,
  },
  orderCard: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  orderCover: {
    width: 110,
    height: "100%",
    backgroundColor: "#0A1628",
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  amount: {
    fontSize: 28,
    fontWeight: "900",
    color: "#D8BC83",
    letterSpacing: 0,
  },
  amountOrig: {
    fontSize: 13,
    textDecorationLine: "line-through",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  orderNo: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  countdown: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  methodCard: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
  },
  methodItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  methodLabel: { fontSize: 15, fontWeight: "700" },
  methodHint: { fontSize: 11, marginTop: 2 },
  cancelLink: {
    alignSelf: "center",
    marginTop: 12,
    padding: 8,
  },
  zpayBox: {
    alignItems: "center",
    paddingVertical: 12,
  },
  zpayHint: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  zpayReopen: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    borderRadius: 10,
  },
  zpayWaitHint: {
    fontSize: 11,
    marginTop: 16,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  zpayBack: {
    alignSelf: "center",
    marginTop: 14,
    padding: 8,
  },
  usdtHint: {
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 14,
  },
  usdtQuoteCard: {
    backgroundColor: "rgba(52, 211, 153, 0.08)",
    borderColor: "rgba(52, 211, 153, 0.28)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  usdtQuoteAmount: {
    color: "#34D399",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 4,
  },
  usdtQuoteMeta: { fontSize: 11, lineHeight: 18 },
  usdtAddrCard: {
    backgroundColor: "rgba(245,158,11,0.06)",
    borderColor: "rgba(245,158,11,0.25)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  usdtLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  usdtAddr: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 22,
    marginBottom: 8,
  },
  copyBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    borderRadius: 6,
  },
  qrBox: {
    alignItems: "center",
    marginBottom: 16,
  },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: "#fff",
  },
  usdtNote: {
    backgroundColor: "rgba(248, 113, 113, 0.06)",
    borderColor: "rgba(248, 113, 113, 0.2)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  usdtTxInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 12,
  },
  attestationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 14,
  },
  attestationBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  attestationBoxChecked: {
    borderColor: "#34D399",
    backgroundColor: "rgba(52,211,153,0.12)",
  },
  attestationMark: { color: "#34D399", fontSize: 13, fontWeight: "900" },
  attestationText: { flex: 1, fontSize: 11, lineHeight: 17 },
  usdtSubmitBtn: { borderRadius: 12, overflow: "hidden" },
  disabled: { opacity: 0.42 },
  usdtSubmitInner: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  usdtSubmitText: {
    color: "#0A1628",
    fontSize: 15,
    fontWeight: "800",
  },
  usdtSubmitted: {
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    borderColor: "rgba(52, 211, 153, 0.3)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  expiredIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.28)",
  },
});
