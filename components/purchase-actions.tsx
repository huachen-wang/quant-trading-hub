import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

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
  /** 联系方式（私聊模式下用） */
  telegramGroup?: string | null;
  qqGroup?: string | null;
  /** 是否是旗舰跳转产品（外链） */
  featuredLink?: string | null;
  /** 直购模式下，付费 EA 没设下载链接时禁用购买按钮 */
  hasDownloadUrl?: boolean;
}

/**
 * 商品详情页核心 CTA 按钮组件
 *
 * saleMode === "direct"  → 显示「立即购买 ¥XXX」+ 跳转收银台 (/checkout/[orderNo]，A.3 实装)
 *                          免费产品 → 显示「立即下载」直接打开 downloadUrl
 *
 * saleMode === "inquiry" → 显示「商务咨询授权」按钮 + 弹出联系方式 modal
 *                          有 Telegram/QQ 直接展示，没有就提示先去客服
 *
 * featuredLink 非空 → 优先级最高，渲染为「⭐ 前往官网了解详情」外链
 */
export function PurchaseActions({
  saleMode,
  productId,
  productKind = "strategy",
  price,
  originalPrice,
  isFree,
  telegramGroup,
  qqGroup,
  featuredLink,
  hasDownloadUrl,
}: PurchaseActionsProps) {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [showInquiry, setShowInquiry] = useState(false);

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  // 旗舰外链优先
  if (featuredLink) {
    return (
      <TouchableOpacity
        onPress={() => Linking.openURL(featuredLink)}
        style={styles.cta}
        activeOpacity={0.85}
      >
        <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}>
          <Text style={styles.ctaText}>⭐ 前往官网了解详情</Text>
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
          onPress={() => {
            if (!hasDownloadUrl) return showMsg("暂无下载链接，请联系客服");
            // 实际下载触发由父组件处理（兼容旧逻辑）
            // 这里只是一个回退按钮，父组件应直接渲染下载按钮而不是用这个组件
            showMsg("正在打开下载链接...");
          }}
          style={[styles.cta, !hasDownloadUrl && styles.ctaDisabled]}
          disabled={!hasDownloadUrl}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={hasDownloadUrl ? ["#10B981", "#34D399"] : ["#475569", "#64748B"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}
          >
            <Text style={styles.ctaText}>{hasDownloadUrl ? "⚡ 免费下载" : "暂无下载链接"}</Text>
          </LinearGradient>
        </TouchableOpacity>
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
            colors={["#D97706", "#F59E0B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaInner}
          >
            <Text style={styles.ctaText}>⚡ 立即购买</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.priceFootnote, { color: colors.muted }]}>
          🔒 支付后立即解锁下载 · 支持支付宝/微信/USDT
        </Text>
      </View>
    );
  }

  // ─── 私聊模式（saleMode = "inquiry"） ───
  const hasTelegram = !!telegramGroup;
  const hasQQ = !!qqGroup;
  const hasContact = hasTelegram || hasQQ;

  return (
    <View style={styles.priceBox}>
      <View style={[styles.inquiryBanner, { borderColor: "rgba(245,158,11,0.3)" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Text style={{ fontSize: 16 }}>🤝</Text>
          <Text style={[styles.inquiryTitle, { color: "#FBBF24" }]}>商务授权合作</Text>
        </View>
        <Text style={[styles.inquiryDesc, { color: colors.muted }]}>
          此商品采用工作室授权模式。请联系客服洽谈合作方案、试用账户、定价细节。
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => setShowInquiry((v) => !v)}
        style={styles.cta}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#D97706", "#F59E0B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaInner}
        >
          <Text style={styles.ctaText}>💬 联系客服咨询授权</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* 展开的联系方式 */}
      {showInquiry && (
        <View style={styles.contactPanel}>
          {hasTelegram ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(telegramGroup!)}
              style={[styles.contactBtn, { backgroundColor: colors.primary + "12" }]}
            >
              <Text style={{ fontSize: 18 }}>📱</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.contactLabel, { color: colors.foreground }]}>Telegram</Text>
                <Text style={[styles.contactValue, { color: colors.muted }]} numberOfLines={1}>
                  {telegramGroup}
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>打开 →</Text>
            </TouchableOpacity>
          ) : null}
          {hasQQ ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(qqGroup!)}
              style={[styles.contactBtn, { backgroundColor: colors.primary + "12" }]}
            >
              <Text style={{ fontSize: 18 }}>👥</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.contactLabel, { color: colors.foreground }]}>QQ 群</Text>
                <Text style={[styles.contactValue, { color: colors.muted }]} numberOfLines={1}>
                  {qqGroup}
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>打开 →</Text>
            </TouchableOpacity>
          ) : null}
          {!hasContact && (
            <Text style={[styles.contactEmpty, { color: colors.muted }]}>
              暂未配置联系方式，请联系站长后台设置 Telegram / QQ 群
            </Text>
          )}
        </View>
      )}
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
    color: "#FBBF24",
    letterSpacing: -0.5,
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
    borderRadius: 14,
    overflow: "hidden",
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaInner: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  ctaText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  inquiryBanner: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  inquiryTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  inquiryDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  contactPanel: {
    gap: 8,
    marginTop: 4,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  contactValue: {
    fontSize: 11,
    marginTop: 2,
  },
  contactEmpty: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
    fontStyle: "italic",
  },
});
