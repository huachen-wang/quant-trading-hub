import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";

/**
 * 创建订单中转页
 *
 * URL: /checkout/new?productId=1&productKind=strategy
 *
 * 行为：
 *   - 自动调用 orders.create
 *   - 创建成功 → 跳转 /checkout/[orderNo]
 *   - 失败 → 显示错误（含可点的"返回上页"按钮）
 *   - 未登录 → 跳转 /auth/login
 */
export default function CheckoutNewScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ productId?: string; productKind?: string }>();
  const [error, setError] = useState<string | null>(null);

  const createOrderMutation = trpc.orders.create.useMutation();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/auth/login" as any);
      return;
    }

    const productId = parseInt(params.productId || "0", 10);
    const productKind = (params.productKind as "strategy" | "promo") || "strategy";

    if (!productId) {
      setError("缺少商品参数");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await createOrderMutation.mutateAsync({
          productId,
          productKind,
        });
        if (cancelled) return;
        if (result.ok) {
          // replace 而非 push，避免回退到 /new 重复创建
          router.replace(`/checkout/${result.orderNo}` as any);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message || "创建订单失败");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, params.productId, params.productKind]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorCode}>ERR</Text>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>下单失败</Text>
        <Text style={[styles.errorMsg, { color: colors.muted }]}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>返回上一页</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#D8BC83" />
      <Text style={[styles.loadingText, { color: colors.muted }]}>正在为您创建订单...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 16, fontSize: 14 },
  errorCode: {
    color: "#F87171",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 12,
  },
  errorTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  errorMsg: { fontSize: 14, marginBottom: 24, textAlign: "center", maxWidth: 320 },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.4)",
    borderWidth: 1,
    borderRadius: 10,
  },
  backBtnText: { color: "#D8BC83", fontWeight: "700" },
});
