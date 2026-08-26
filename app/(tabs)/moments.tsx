/*
 * 合作生态页面（简化版）
 * 顶部：工作室深度合作大Banner → 跳转 /cooperation
 * 核心：定价方案 + 免费领取 + CTA
 * Design: Deep blue-black + Gold accent (#C9A96E)
 */
import { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ContactModal } from "@/components/contact-modal";
import { QuickNav } from "@/components/quick-nav";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

// ===== 动画 =====
function FadeInView({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, []);
  return <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

// ===== 颜色 =====
const GOLD = "#C9A96E";
const GOLD_DIM = "rgba(245,158,11,0.6)";
const GOLD_BG = "rgba(245,158,11,0.1)";
const GOLD_BORDER = "rgba(245,158,11,0.2)";
const CARD_BG = "#1E293B";
const CARD_BORDER = "rgba(148,163,184,0.22)";
const TEXT_PRIMARY = "rgba(255,255,255,0.9)";
const TEXT_SECONDARY = "rgba(255,255,255,0.9)";
const TEXT_BODY = "rgba(255,255,255,0.95)";
const DARK_BG = "#0A1628";
const DARK_BG_MID = "#0A1628";

// ===== 数据 =====
const pricingTiers = [
  {
    id: "free",
    name: "免费策略包",
    priceLabel: "¥0",
    period: "",
    description: "提供 3 款 EA 演示/试用材料，数据口径与授权需先核验",
    features: [
      "3款 EA 演示/试用材料（先核对授权与参数）",
      "策略部署视频教程",
      "EA避坑指南 2026版",
      "策略互换社区入场券",
      "经纪商IB开户通道",
    ],
    cta: "立即免费领取",
    popular: false,
    highlight: false,
  },
  {
    id: "premium",
    name: "AI量化联盟精选会员",
    priceLabel: "免费试用一款",
    period: "",
    description: "先体验再决定 · 零风险入场",
    features: [
      "六款目录中所选 EA 的试用/使用权（以授权为准）",
      "策略参数配置方案（即插即用）",
      "专属1对1策略部署指导",
      "证据状态与策略报告",
      "策略互换社区·核心圈",
      "每月策略表现报告",
      "新策略入库优先体验",
      "经纪商IB返佣通道",
    ],
    cta: "预约咨询",
    popular: true,
    highlight: true,
  },
  {
    id: "institution",
    name: "机构定制",
    priceLabel: "面议",
    period: "",
    description: "资管团队 / 家族办公室 / 基金",
    features: [
      "精选会员全部权益",
      "专属EA定制 · 自定义策略名称与调优模式",
      "账户、终端与客户授权范围以合同为准",
      "品牌与联系方式替换需符合原权利人授权",
      "独立服务器部署 + API对接",
      "风控系统搭建 + 合规架构建议",
    ],
    cta: "联系我们",
    popular: false,
    highlight: false,
  },
];

const freeItems = [
  { name: "3款 EA 试用/演示材料", desc: "安装前先核对 MT4/MT5 版本、授权和风险参数", tag: "EA文件 · 参数说明", viral: true },
  { name: "策略部署教程（手把手）", desc: "从安装到参数配置，10分钟搞定", tag: "视频教程 · 20分钟", viral: true },
  { name: "EA避坑指南 2026版", desc: "检查过拟合、加仓、滑点、授权与数据口径", tag: "PDF · 风险清单", viral: true },
  { name: "策略交流社区入场券", desc: "交流策略与风险核验经验，不构成投资建议", tag: "Telegram社区", viral: false },
];

// ===== 主组件 =====
export default function CooperationScreen() {
  const router = useRouter();
  const { isDesktop, isMobile } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // Banner 脉冲动画
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, []);

  const pageContentsQuery = trpc.pageContents.get.useQuery({ pageKey: "cooperation" });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pageContentsQuery.refetch();
    setRefreshing(false);
  }, []);

  const handleConsult = () => setShowContactModal(true);
  const maxContentWidth = isDesktop ? 1260 : 960;

  // 脉冲透明度插值
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        >
          <LinearGradient colors={[DARK_BG, DARK_BG_MID, DARK_BG]} style={StyleSheet.absoluteFill} />

          {/* ═══════════════════════════════════════════════════════════
              1. 工作室深度合作 - 大Banner（最显眼位置）
              ═══════════════════════════════════════════════════════════ */}
          <FadeInView delay={0}>
            <TouchableOpacity
              style={[styles.coopBanner, isDesktop && styles.coopBannerDesktop, { maxWidth: maxContentWidth }]}
              activeOpacity={0.88}
              onPress={() => router.push("/cooperation" as any)}
            >
              <LinearGradient
                colors={["#070B14", "#101827", "#1E293B", "#0A0E1A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.coopBannerGradient}
              >
                {/* 装饰元素 */}
                <View style={styles.bannerDecorTL} />
                <View style={styles.bannerDecorBR} />
                <Animated.View style={[styles.bannerGlow, { opacity: pulseOpacity }]} />

                {/* 网格线装饰 */}
                {[...Array(4)].map((_, i) => (
                  <View key={`gl${i}`} style={[styles.bannerGridLine, { top: 15 + i * 30, opacity: 0.04 - i * 0.008 }]} />
                ))}

                {/* 内容 */}
                  <View style={[styles.bannerContent, isDesktop && styles.bannerContentDesktop]}>
                  {/* 左侧：图标 + 文字 */}
                    <View style={[styles.bannerLeft, isDesktop && styles.bannerLeftDesktop]}>
                    <View style={styles.bannerIconWrap}>
                      <LinearGradient colors={["#A8895A", "#D8BC83"]} style={styles.bannerIconGradient}>
                        <Ionicons name="diamond" size={24} color="#fff" />
                      </LinearGradient>
                      {/* 图标外圈光晕 */}
                      <Animated.View style={[styles.bannerIconGlow, { opacity: pulseOpacity }]} />
                    </View>

                    <View style={styles.bannerTextArea}>
                      {/* 标签 */}
                      <View style={styles.bannerTag}>
                        <View style={styles.bannerLiveDot} />
                        <Text style={styles.bannerTagText}>核心业务</Text>
                      </View>

                      <Text style={styles.bannerTitle}>工作室深度合作</Text>
                      <Text style={styles.bannerSubtitle}>
                        来源核验 · 技术适配 · 风险披露
                      </Text>

                      {/* 核心数据 */}
                      <View style={styles.bannerStats}>
                        {[
                          { num: "AUTH", label: "授权核验", color: "#D8BC83" },
                          { num: "EVID", label: "证据状态", color: "#60A5FA" },
                          { num: "RISK", label: "风险披露", color: "#34D399" },
                        ].map((s, i) => (
                          <View key={i} style={styles.bannerStatItem}>
                            <Text style={[styles.bannerStatNum, { color: s.color }]}>{s.num}</Text>
                            <Text style={styles.bannerStatLabel}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* 右侧：箭头 */}
                    <View style={[styles.bannerArrowWrap, isDesktop && styles.bannerArrowWrapDesktop]}>
                    <LinearGradient
                      colors={["rgba(216,188,131,0.16)", "rgba(216,188,131,0.05)"]}
                      style={[styles.bannerArrowBg, isDesktop && styles.bannerArrowBgDesktop]}
                    >
                      {isDesktop && <Text style={styles.bannerArrowText}>策略档案</Text>}
                      <Ionicons name="arrow-forward" size={20} color="#D8BC83" />
                    </LinearGradient>
                  </View>
                </View>

                {/* 底部装饰线 */}
                <LinearGradient
                  colors={["transparent", "rgba(216,188,131,0.32)", "transparent"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.bannerBottomLine}
                />
              </LinearGradient>
            </TouchableOpacity>
          </FadeInView>

          {/* ═══════════════════════════════════════════════════════════
              2. 选择方案（定价）
              ═══════════════════════════════════════════════════════════ */}
          <FadeInView delay={100}>
            <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop, { maxWidth: maxContentWidth, marginTop: 20 }]}>
              <View style={styles.sectionTag}>
                <Text style={styles.sectionTagText}>选择方案</Text>
              </View>
              <Text style={[styles.heroTitle, { marginTop: 10 }]}>
                免费拿策略<Text style={{ color: "rgba(255,255,255,0.9)" }}> 或 </Text>
                <Text style={{ color: GOLD }}>直接拿全部</Text>
              </Text>
              <Text style={[styles.heroSubtitle, { alignSelf: "center" }]}>
                要么免费送你EA，要么直接给你最好的。
              </Text>
            </View>
          </FadeInView>

          <FadeInView delay={150}>
            <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop, { maxWidth: maxContentWidth, marginTop: 16 }]}>
              <View style={{ flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 14, alignItems: isMobile ? "stretch" : "flex-start", justifyContent: "center" }}>
                {pricingTiers.map((tier) => (
                  <View
                    key={tier.id}
                    style={[
                      styles.pricingCard,
                      tier.highlight ? styles.pricingCardHighlight : styles.pricingCardNormal,
                      { width: isMobile ? "100%" : "31%", ...(tier.highlight && !isMobile ? Platform.OS === "web" ? { transform: [{ scale: 1.03 }] } : {} : {}) },
                    ]}
                  >
                    {tier.popular && <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>核心产品</Text></View>}
                    <Text style={[styles.pricingName, tier.highlight && { color: GOLD }]}>{tier.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginTop: 8 }}>
                      <Text style={[styles.pricingPrice, tier.highlight && { color: GOLD, fontSize: 28 }]}>{tier.priceLabel}</Text>
                      {tier.period ? <Text style={styles.pricingPeriod}>{tier.period}</Text> : null}
                    </View>
                    <Text style={styles.pricingDesc}>{tier.description}</Text>
                    <View style={{ marginTop: 14, gap: 8 }}>
                      {tier.features.map((f, i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                          <Text style={{ color: tier.highlight ? GOLD : "rgba(245,158,11,0.7)", fontSize: 14, marginTop: 1 }}>✓</Text>
                          <Text style={styles.pricingFeature}>{f}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity onPress={handleConsult} activeOpacity={0.85} style={{ marginTop: 16 }}>
                      {tier.highlight ? (
                        <LinearGradient colors={["#C9A96E", "#A8895A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pricingCTAHighlight}>
                          <Text style={styles.pricingCTAHighlightText}>{tier.cta}</Text>
                        </LinearGradient>
                      ) : tier.id === "free" ? (
                        <View style={styles.pricingCTAFree}><Text style={styles.pricingCTAFreeText}>{tier.cta}</Text></View>
                      ) : (
                        <View style={styles.pricingCTADefault}><Text style={styles.pricingCTADefaultText}>{tier.cta}</Text></View>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.priceNote}>
                <Text style={styles.priceNoteText}>
                  <Text style={{ color: GOLD, fontWeight: "600" }}>关于价格：</Text>
                  现在可免费申请一款演示/试用策略；请先核对数据类型、时间区间、最大回撤与商业授权。
                  <Text style={{ color: "rgba(255,255,255,0.95)", fontWeight: "700" }}>零成本入场</Text>
                  ，满意再谈合作。
                </Text>
              </View>
            </View>
          </FadeInView>

          {/* ═══════════════════════════════════════════════════════════
              3. 免费引流
              ═══════════════════════════════════════════════════════════ */}
          <FadeInView delay={200}>
            <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop, { maxWidth: maxContentWidth, marginTop: 32 }]}>
              <View style={styles.freeTag}>
                <Text style={styles.freeTagText}>完全免费 · 直接送EA</Text>
              </View>
              <Text style={[styles.heroTitle, { marginTop: 10 }]}>先拿3款EA跑起来</Text>
              <Text style={[styles.heroSubtitle, { alignSelf: "center", marginTop: 8 }]}>
                提供 3 款 EA 演示/试用材料，历史结果不代表未来。
              </Text>

              <View style={{ flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: isMobile ? 12 : 14, marginTop: 28 }}>
                {freeItems.map((item, i) => (
                  <View key={i} style={[styles.freeCard, { width: isMobile ? "100%" : "48%" }]}>
                    {item.viral && <View style={styles.viralBadge}><Text style={styles.viralBadgeText}>热门</Text></View>}
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                      <View style={styles.freeIconBox}><Text style={styles.freeIconText}>EA</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.freeItemName}>{item.name}</Text>
                        <Text style={styles.freeItemDesc}>{item.desc}</Text>
                        <Text style={styles.freeItemTag}>{item.tag}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ alignItems: "center", marginTop: 28 }}>
                <TouchableOpacity onPress={handleConsult} activeOpacity={0.85}>
                  <LinearGradient colors={["#C9A96E", "#A8895A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.freeCTAGradient}>
                    <Text style={styles.freeCTAText}>立即免费领取全部</Text>
                  </LinearGradient>
                </TouchableOpacity>

              </View>
            </View>
          </FadeInView>

          {/* ═══════════════════════════════════════════════════════
              3.5 专属EA定制服务
              ═══════════════════════════════════════════════════════ */}
          <FadeInView delay={250}>
            <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop, { maxWidth: maxContentWidth, marginTop: 32 }]}>
              <View style={styles.customEABanner}>
                <LinearGradient colors={["#0A0E1A", "#111827", "#1E293B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.customEAInner}>
                  <View style={styles.customEAGlow} />
                  <View style={styles.customEABadge}>
                    <Text style={styles.customEABadgeCode}>DEV</Text>
                    <Text style={styles.customEABadgeText}>专属EA定制服务</Text>
                  </View>
                  <Text style={styles.customEATitle}>你的策略，你的品牌</Text>
                  <Text style={styles.customEADesc}>
                    为工作室提供 EA 名称、参数与界面适配。源码、二次开发、账户数与品牌使用权均以权利人授权及签署合同为准。
                  </Text>
                  <View style={styles.customEAFeatures}>
                    {[
                      "♦ 自定义策略名称 & 调优模式",
                      "♦ 账户、终端与客户授权范围在合同中明示",
                      "♦ 品牌与联系方式替换需符合原授权",
                      "♦ 从来源/授权核验到最终交付保留记录",
                    ].map((text, i) => (
                      <Text key={i} style={styles.customEAFeatureText}>{text}</Text>
                    ))}
                  </View>
                  <TouchableOpacity onPress={handleConsult} activeOpacity={0.85} style={styles.customEACTA}>
                    <LinearGradient colors={["#A8895A", "#C9A96E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.customEACTAGradient}>
                      <Text style={styles.customEACTAText}>咨询定制方案</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </FadeInView>

          {/* ═══════════════════════════════════════════════════════
              4. 底部CTA
              ═══════════════════════════════════════════════════════ */}
          <FadeInView delay={300}>
            <View style={[styles.ctaWrapper, { maxWidth: maxContentWidth }]}>
              <TouchableOpacity onPress={handleConsult} activeOpacity={0.85} style={styles.ctaPrimary}>
                <LinearGradient colors={["#C9A96E", "#A8895A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPrimaryGradient}>
                  <Text style={styles.ctaPrimaryText}>免费咨询合作方案</Text>
                  <Text style={styles.ctaPrimaryArrow}>→</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/cooperation" as any)}
                activeOpacity={0.85}
                style={styles.ctaSecondary}
              >
                <Text style={styles.ctaSecondaryText}>查看策略档案详情</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>

          {/* 常驻快捷导航 */}
          <QuickNav />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ═══════════════════ 样式 ═══════════════════
const styles = StyleSheet.create({
  // ===== 工作室合作大Banner =====
  coopBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    overflow: "hidden",
    alignSelf: "center",
    width: "100%",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 14px 40px rgba(0,0,0,0.28)" }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 12 }),
  },
  coopBannerDesktop: {
    marginTop: 18,
  },
  coopBannerGradient: {
    padding: 18,
    paddingVertical: 20,
    position: "relative",
    overflow: "hidden",
  },
  bannerDecorTL: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 72,
    height: 1,
    backgroundColor: "rgba(216,188,131,0.22)",
  },
  bannerDecorBR: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 96,
    height: 1,
    backgroundColor: "rgba(52,211,153,0.16)",
  },
  bannerGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(216,188,131,0.45)",
  },
  bannerGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(216,188,131,0.10)",
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  bannerContentDesktop: {
    minHeight: 132,
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 14,
  },
  bannerLeftDesktop: {
    alignItems: "center",
    gap: 18,
  },
  bannerIconWrap: {
    position: "relative",
  },
  bannerIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIconGlow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.28)",
  },
  bannerTextArea: {
    flex: 1,
  },
  bannerTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  bannerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  bannerTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D8BC83",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 4,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, -apple-system, sans-serif" } : {}),
  },
  bannerArrowWrapDesktop: {
    marginRight: 8,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 10,
  },
  bannerStats: {
    flexDirection: "row",
    gap: 16,
  },
  bannerStatItem: {
    alignItems: "center",
  },
  bannerStatNum: {
    fontSize: 16,
    fontWeight: "900",
    ...(Platform.OS === "web" ? { fontFamily: "ui-monospace, SFMono-Regular, monospace" } : {}),
  },
  bannerStatLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.9)",
    marginTop: 1,
  },
  bannerArrowWrap: {
    marginLeft: 12,
  },
  bannerArrowBg: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.28)",
  },
  bannerArrowBgDesktop: {
    width: 104,
    height: 38,
    flexDirection: "row",
    gap: 7,
  },
  bannerArrowText: {
    color: "#D8BC83",
    fontSize: 12,
    fontWeight: "800",
  },
  bannerBottomLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },

  // ===== Section =====
  sectionWrapper: {
    paddingHorizontal: 16,
    marginTop: 32,
    alignSelf: "center",
    width: "100%",
    alignItems: "center",
  },
  sectionWrapperDesktop: {
    paddingHorizontal: 22,
  },
  sectionTag: {
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionTagText: {
    fontSize: 11,
    letterSpacing: 3,
    color: GOLD_DIM,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, -apple-system, sans-serif" } : {}),
  },
  heroSubtitle: {
    fontSize: 13,
    color: TEXT_BODY,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 480,
  },

  // ===== 定价卡片 =====
  pricingCard: {
    borderRadius: 6,
    padding: 14,
    alignItems: "center",
  },
  pricingCardNormal: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  pricingCardHighlight: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    alignSelf: "center",
    backgroundColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: DARK_BG,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  pricingName: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    textAlign: "center",
    marginTop: 4,
  },
  pricingPrice: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    ...(Platform.OS === "web" ? { fontFamily: "ui-monospace, SFMono-Regular, monospace" } : {}),
  },
  pricingPeriod: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginLeft: 2,
  },
  pricingDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  pricingFeature: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
    flex: 1,
  },
  pricingCTAHighlight: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    ...(Platform.OS === "web" ? { boxShadow: "0 0 30px rgba(245,158,11,0.3)" } : {}),
  },
  pricingCTAHighlightText: {
    color: DARK_BG,
    fontSize: 14,
    fontWeight: "800",
  },
  pricingCTAFree: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  pricingCTAFreeText: {
    color: GOLD,
    fontSize: 14,
    fontWeight: "700",
  },
  pricingCTADefault: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  pricingCTADefaultText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "600",
  },
  priceNote: {
    marginTop: 16,
    padding: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 6,
    width: "100%",
    maxWidth: 640,
  },
  priceNoteText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 22,
    textAlign: "center",
  },

  // ===== 免费引流 =====
  freeTag: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  freeTagText: {
    fontSize: 11,
    letterSpacing: 2,
    color: GOLD,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  freeCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 6,
    padding: 15,
  },
  viralBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  viralBadgeText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "700",
  },
  freeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: GOLD_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  freeIconText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  freeItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  freeItemDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 18,
  },
  freeItemTag: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    marginTop: 6,
    ...(Platform.OS === "web" ? { fontFamily: "ui-monospace, SFMono-Regular, monospace" } : {}),
  },
  freeCTAGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 6,
    ...(Platform.OS === "web" ? { boxShadow: "0 0 30px rgba(245,158,11,0.3)" } : {}),
  },
  freeCTAText: {
    color: DARK_BG,
    fontSize: 16,
    fontWeight: "800",
  },
  freeWechat: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
  },

  // ===== CTA =====
  ctaWrapper: {
    marginTop: 36,
    alignItems: "center",
    paddingHorizontal: 16,
    alignSelf: "center",
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  ctaPrimary: {
    borderRadius: 6,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 0 40px rgba(245,158,11,0.15)" }
      : { shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 }),
  },
  ctaPrimaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 13,
    gap: 8,
  },
  ctaPrimaryText: {
    color: DARK_BG,
    fontSize: 16,
    fontWeight: "800",
  },
  ctaPrimaryArrow: {
    color: DARK_BG,
    fontSize: 18,
    fontWeight: "700",
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 6,
    paddingHorizontal: 22,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ctaSecondaryText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 15,
    fontWeight: "600",
  },

  // 专属EA定制服务
  customEABanner: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.20)",
  },
  customEAInner: {
    padding: 18,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  customEAGlow: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 120,
    height: 1,
    backgroundColor: "rgba(216,188,131,0.24)",
  },
  customEABadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(216,188,131,0.10)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.22)",
  },
  customEABadgeText: {
    color: "#D8BC83",
    fontSize: 12,
    fontWeight: "700",
  },
  customEABadgeCode: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  customEATitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },
  customEADesc: {
    color: "#F1F5F9",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  customEAFeatures: {
    width: "100%",
    gap: 8,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  customEAFeatureText: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 22,
  },
  customEACTA: {
    borderRadius: 8,
    overflow: "hidden",
  },
  customEACTAGradient: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  customEACTAText: {
    color: "#0A0E1A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
});
