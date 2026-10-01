import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { getInternalStrategyRoute } from "@/lib/download-links";
import { INQUIRY_CHECKLIST } from "@/lib/inquiry-message";
import { describeDownloadHrefFailure, resolveDownloadHref } from "@/lib/download-href";
import { API_BASE_URL, getApiBaseUrl } from "@/constants/oauth";

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
 *                          免费产品 → 登录后调用 downloads.claimFree 领取签名下载链接：
 *                            有真文件 → 打开受控下载路由（下载完成后记入「我的下载」）
 *                            缺文件 / 开户链接 → 服务端返回 contact，转联系客服；不建单、不伪造付款
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
  const claimFreeMutation = trpc.downloads.claimFree.useMutation();
  const [claiming, setClaiming] = useState(false);
  // 领取成功后的受控下载路径：Web 上 await 之后再 window.open 会被弹窗拦截，
  // 所以改为同窗口导航到 attachment 路由，并保留一个显式"点击下载"按钮（用户手势内触发）。
  const [readyDownload, setReadyDownload] = useState<{ downloadUrl: string; expiresInMinutes: number } | null>(null);

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  const openDownloadPath = async (downloadUrl: string) => {
    // 原生端只有配置了可信 API base 才拼接相对下载地址；没配就明确失败。
    const target = resolveDownloadHref(downloadUrl, {
      platform: Platform.OS,
      baseUrl: Platform.OS === "web" ? getApiBaseUrl() : API_BASE_URL,
    });
    if (!target.ok) {
      showMsg(describeDownloadHrefFailure(target.reason));
      return;
    }
    if (Platform.OS === "web") {
      // 受控路由返回 Content-Disposition: attachment，同窗口导航只触发下载、不离开页面，
      // 且不依赖弹窗权限。
      window.location.assign(target.url);
      return;
    }
    await Linking.openURL(target.url);
  };

  const claimFreeDownload = async () => {
    if (productKind !== "strategy") {
      onContact();
      return;
    }
    if (!isAuthenticated) {
      showMsg("请先登录后获取免费文件");
      router.push("/auth/login" as any);
      return;
    }
    if (claiming) return;
    setClaiming(true);
    try {
      const result = await claimFreeMutation.mutateAsync({ strategyId: productId });
      if (result.delivery === "contact") {
        // 服务端判定没有可交付的真文件：明确转人工咨询，不假装已下载。
        onContact();
        return;
      }
      setReadyDownload({ downloadUrl: result.downloadUrl, expiresInMinutes: result.expiresInMinutes });
      await openDownloadPath(result.downloadUrl);
    } catch (e: any) {
      showMsg(e?.message || "获取文件失败，请稍后重试或联系客服");
    } finally {
      setClaiming(false);
    }
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
    // 免费 → 登录后领取受控下载链接；没有真文件则转联系客服
    if (isFree) {
      return (
        <View style={styles.priceBox}>
          <TouchableOpacity
            onPress={downloadRequiresContact ? onContact : claimFreeDownload}
            disabled={claiming}
            style={[styles.cta, claiming ? styles.ctaDisabled : null]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={downloadRequiresContact ? ["#A8895A", "#C9A96E"] : ["#10B981", "#34D399"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}
            >
              <Text style={styles.ctaText}>
                {downloadRequiresContact ? "联系获取 EA" : claiming ? "正在获取下载链接..." : "免费下载"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          {readyDownload && !downloadRequiresContact ? (
            <TouchableOpacity
              onPress={() => openDownloadPath(readyDownload.downloadUrl).catch((e: any) => showMsg(e?.message || "无法打开下载链接"))}
              style={[styles.cta, styles.readyBtn]}
              activeOpacity={0.85}
            >
              <Text style={styles.readyBtnText}>
                下载未开始？点击这里下载（链接 {readyDownload.expiresInMinutes} 分钟内有效）
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.priceFootnote, { color: colors.muted }]}>
            {downloadRequiresContact ? "客服确认文件版本与交付方式后提供" : "登录后免费获取 · 下载记录可在「我的下载」查看"}
          </Text>
        </View>
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
          支付后解锁受控下载 · 可选 USDT 链上结算
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
          此商品采用工作室授权模式，价格与授权范围按版本单独确认。咨询时一起核对：
        </Text>
        <View style={styles.inquiryChecklist}>
          {INQUIRY_CHECKLIST.map((item, index) => (
            <View key={item} style={styles.inquiryChecklistRow}>
              <Text style={styles.inquiryChecklistIndex}>{index + 1}</Text>
              <Text style={[styles.inquiryChecklistText, { color: colors.muted }]}>{item}</Text>
            </View>
          ))}
        </View>
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
      <Text style={[styles.priceFootnote, { color: colors.muted }]}>
        点开后会带上本商品的名称、编号与页面地址，不用自己再描述一遍
      </Text>
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
  ctaDisabled: {
    opacity: 0.7,
  },
  readyBtn: {
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.5)",
    paddingVertical: 11,
    alignItems: "center",
  },
  readyBtnText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "700",
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
  inquiryChecklist: {
    marginTop: 10,
    gap: 5,
  },
  inquiryChecklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  inquiryChecklistIndex: {
    minWidth: 14,
    color: "#D8BC83",
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "900",
  },
  inquiryChecklistText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
