import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { getInternalStrategyRoute } from "@/lib/download-links";

interface PurchaseActionsProps {
  /** 商品 saleMode：direct=直购 | inquiry=私聊授权 */
  saleMode: "direct" | "inquiry";
  /** 商品 id（A.3 收银台路由会用） */
  productId: number;
  productKind?: "strategy" | "promo";
  /** 价格（直购模式下显示） */
  price?: string | number | null;
  originalPrice?: string | number | null;
  isFree?: boolean;
  /** 是否是旗舰跳转产品（外链） */
  featuredLink?: string | null;
  /** 下载地址为空或属于开户链接时，统一转联系客服交付 */
  downloadRequiresContact?: boolean;
  onContact: () => void;
}

/**
 * 商品详情页核心 CTA 按钮组件
 *
 * saleMode === "direct"  → 显示「立即购买 ¥XXX」+ 跳转收银台 (/checkout/[orderNo]，A.3 实装)
 *                          免费产品 → 显示「立即下载」直接打开 downloadUrl
 *
 * saleMode === "inquiry" → 显示「商务咨询授权」按钮并打开统一联系方式弹窗
 *
 * featuredLink 非空 → 优先处理站内策略路径，其余链接打开外部官网
 */
export function PurchaseActions({
  saleMode,
  productId,
  productKind = "strategy",
  price,
  originalPrice,
  isFree,
  featuredLink,
  downloadRequiresContact,
  onContact,
}: PurchaseActionsProps) {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  // 旗舰外链优先
  if (featuredLink) {
    const internalRoute = getInternalStrategyRoute(featuredLink);
    return (
      <TouchableOpacity
        onPress={() => {
          if (internalRoute) router.push(internalRoute as any);
          else Linking.openURL(featuredLink);
        }}
        style={styles.cta}
        activeOpacity={0.85}
      >
        <LinearGradient colors={["#A8895A", "#C9A96E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}>
          <Text style={styles.ctaText}>{internalRoute ? "查看完整策略" : "前往官网了解详情"}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // ─── 直购模式（saleMode = "direct"） ───
  if (saleMode === "direct") {
    // 免费 → 立即下载
    if (isFree) {
      return (
        <TouchableOpacity
          onPress={downloadRequiresContact ? onContact : () => showMsg("请使用下载按钮获取文件")}
          style={styles.cta}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={downloadRequiresContact ? ["#A8895A", "#C9A96E"] : ["#10B981", "#34D399"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}
          >
            <Text style={styles.ctaText}>{downloadRequiresContact ? "联系获取 EA" : "免费下载"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    if (downloadRequiresContact) {
      return (
        <View style={styles.priceBox}>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.muted }]}>现价</Text>
            <Text style={styles.priceValue}>¥ {price || "0.00"}</Text>
          </View>
          <TouchableOpacity onPress={onContact} style={styles.cta} activeOpacity={0.85}>
            <LinearGradient
              colors={["#A8895A", "#C9A96E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaInner}
            >
              <Text style={styles.ctaText}>联系确认交付</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={[styles.priceFootnote, { color: colors.muted }]}>客服确认文件版本与交付方式后再付款</Text>
        </View>
      );
    }

    // 付费 → 跳转收银台
    const buy = () => {
      if (!isAuthenticated) {
        showMsg("请先登录后再购买");
        router.push("/auth/login" as any);
        return;
      }
      // 跳转到 A.3 实装的下单页面
      router.push(`/checkout/new?productId=${productId}&productKind=${productKind}` as any);
    };

    return (
      <View style={styles.priceBox}>
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, { color: colors.muted }]}>现价</Text>
          <Text style={[styles.priceValue]}>¥ {price || "0.00"}</Text>
          {originalPrice && parseFloat(String(originalPrice)) > parseFloat(String(price || 0)) ? (
            <Text style={[styles.priceOrig, { color: colors.muted }]}>
              ¥{originalPrice}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity onPress={buy} style={styles.cta} activeOpacity={0.85}>
          <LinearGradient
            colors={["#A8895A", "#C9A96E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaInner}
          >
            <Text style={styles.ctaText}>立即购买</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.priceFootnote, { color: colors.muted }]}>
          支付后立即解锁下载 · 支持支付宝/微信/USDT
        </Text>
      </View>
    );
  }

  // ─── 私聊模式（saleMode = "inquiry"） ───
  return (
    <View style={styles.priceBox}>
      <View style={[styles.inquiryBanner, { borderColor: "rgba(245,158,11,0.3)" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Text style={styles.inquiryCode}>B2B</Text>
          <Text style={[styles.inquiryTitle, { color: "#D8BC83" }]}>商务授权合作</Text>
        </View>
        <Text style={[styles.inquiryDesc, { color: colors.muted }]}>
          此商品采用工作室授权模式。请联系客服洽谈合作方案、试用账户、定价细节。
        </Text>
      </View>

      <TouchableOpacity
        onPress={onContact}
        style={styles.cta}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#A8895A", "#C9A96E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaInner}
        >
          <Text style={styles.ctaText}>联系客服咨询授权</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  priceBox: {
    gap: 10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#D8BC83",
    letterSpacing: 0,
  },
  priceOrig: {
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  priceFootnote: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  cta: {
    borderRadius: 7,
    overflow: "hidden",
  },
  ctaInner: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  ctaText: {
    color: "#0A1628",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  inquiryBanner: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  inquiryCode: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  inquiryTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  inquiryDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
});
