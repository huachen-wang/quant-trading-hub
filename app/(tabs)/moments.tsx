/*
 * 合作生态页面（简化版）
 * 顶部：工作室深度合作大Banner → 跳转 /cooperation
 * 核心：定价方案 + 免费领取 + CTA
 * Design: Deep blue-black + Gold accent (#F59E0B)
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
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ContactModal } from "@/components/contact-modal";
import { QuickNav } from "@/components/quick-nav";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

const { width: SW } = Dimensions.get("window");

// ===== 动画 =====
function FadeInView({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

// ===== 颜色 =====
const GOLD = "#F59E0B";
const GOLD_DIM = "rgba(245,158,11,0.6)";
const GOLD_BG = "rgba(245,158,11,0.1)";
const GOLD_BORDER = "rgba(245,158,11,0.2)";
const CARD_BG = "rgba(30,41,59,0.5)";
const CARD_BORDER = "rgba(148,163,184,0.08)";
const TEXT_PRIMARY = "rgba(255,255,255,0.9)";
const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
const TEXT_BODY = "rgba(255,255,255,0.6)";
const DARK_BG = "#0F172A";
const DARK_BG_MID = "#0F172A";

// ===== 数据 =====
const pricingTiers = [
  {
    id: "free",
    name: "免费策略包",
    priceLabel: "¥0",
    period: "",
    description: "直接送你3款实盘验证EA，先跑起来",
    features: [
      "3款精选EA策略（即插即用）",
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
    name: "军火库·精选会员",
    priceLabel: "免费试用一款",
    period: "",
    description: "先体验再决定 · 零风险入场",
    features: [
      "全部8款精选EA策略使用权",
      "策略参数配置方案（即插即用）",
      "专属1对1策略部署指导",
      "实盘信号跟单通道",
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
      "无限授权 · 不限账户、不限终端、不限客户",
      "版权与联系方式替换为工作室自有品牌",
      "独立服务器部署 + API对接",
      "风控系统搭建 + 合规架构建议",
    ],
    cta: "联系我们",
    popular: false,
    highlight: false,
  },
];

const freeItems = [
  { name: "3款精选EA策略（即插即用）", desc: "从117款中筛选出来的，直接装上MT4/MT5就能跑", tag: "EA文件 · 含参数配置", viral: true },
  { name: "策略部署教程（手把手）", desc: "从安装到参数配置，10分钟搞定", tag: "视频教程 · 20分钟", viral: true },
  { name: "EA避坑指南 2026版", desc: "我们花28万踩过的坑，你不用再踩一遍", tag: "PDF · 47页", viral: true },
  { name: "策略互换社区入场券", desc: "和200+实盘交易者交流策略、共享资源", tag: "Telegram社区", viral: false },
];

// ===== 主组件 =====
export default function CooperationScreen() {
  const router = useRouter();
  const { isDesktop, isMobile } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // Banner 脉冲动画
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);

  const pageContentsQuery = trpc.pageContents.get.useQuery({ pageKey: "cooperation" });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pageContentsQuery.refetch();
    setRefreshing(false);
  }, []);

  const handleConsult = () => setShowContactModal(true);
  const maxContentWidth = 960;

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
              style={[styles.coopBanner, { maxWidth: maxContentWidth }]}
              activeOpacity={0.88}
              onPress={() => router.push("/cooperation" as any)}
            >
              <LinearGradient
                colors={["#0A0E1A", "#1A0E2E", "#2D1B69", "#1A0E2E"]}
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
                <View style={styles.bannerContent}>
                  {/* 左侧：图标 + 文字 */}
                  <View style={styles.bannerLeft}>
                    <View style={styles.bannerIconWrap}>
                      <LinearGradient colors={["#7C3AED", "#A855F7"]} style={styles.bannerIconGradient}>
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
                        策略源码掌控 · 独家优化 · 源头直供
                      </Text>

                      {/* 核心数据 */}
                      <View style={styles.bannerStats}>
                        {[
                          { num: "200+", label: "EA源码", color: "#FBBF24" },
                          { num: "30+", label: "合作工作室", color: "#A78BFA" },
                          { num: "50+", label: "独家版", color: "#34D399" },
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
                  <View style={styles.bannerArrowWrap}>
                    <LinearGradient colors={["rgba(168,85,247,0.2)", "rgba(168,85,247,0.05)"]} style={styles.bannerArrowBg}>
                      <Ionicons name="arrow-forward" size={20} color="#A855F7" />
                    </LinearGradient>
                  </View>
                </View>

                {/* 底部装饰线 */}
                <LinearGradient
                  colors={["transparent", "rgba(168,85,247,0.3)", "transparent"]}
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
            <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth, marginTop: 20 }]}>
              <View style={styles.sectionTag}>
                <Text style={styles.sectionTagText}>选择方案</Text>
              </View>
              <Text style={[styles.heroTitle, { marginTop: 10 }]}>
                免费拿策略<Text style={{ color: "rgba(255,255,255,0.4)" }}> 或 </Text>
                <Text style={{ color: GOLD }}>直接拿全部</Text>
              </Text>
              <Text style={[styles.heroSubtitle, { alignSelf: "center" }]}>
                要么免费送你EA，要么直接给你最好的。
              </Text>
            </View>
          </FadeInView>

          <FadeInView delay={150}>
            <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth, marginTop: 16 }]}>
              <View style={{ flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 14, alignItems: isMobile ? "stretch" : "flex-start", justifyContent: "center" }}>
                {pricingTiers.map((tier) => (
                  <View
                    key={tier.id}
                    style={[
                      styles.pricingCard,
                      tier.highlight ? styles.pricingCardHighlight : styles.pricingCardNormal,
                      { width: isMobile ? "100%" : "31%", ...(tier.highlight && !isMobile ? Platform.OS === "web" ? { transform: [{ scale: 1.03 }] } : {} : {}) },
                    ]}
                    // @ts-ignore
                    {...(Platform.OS === "web" ? { className: tier.highlight ? "glass-strong" : "glass-medium" } : {})}
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
                        <LinearGradient colors={["#F59E0B", "#D97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pricingCTAHighlight}>
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
                  我们测试117款EA花了¥280,000。现在你可以免费试用一款精选策略，亲身体验24个月实盘验证的结果。
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700" }}>零成本入场</Text>
                  ，满意再谈合作。
                </Text>
              </View>
            </View>
          </FadeInView>

          {/* ═══════════════════════════════════════════════════════════
              3. 免费引流
              ═══════════════════════════════════════════════════════════ */}
          <FadeInView delay={200}>
            <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth, marginTop: 32 }]}>
              <View style={styles.freeTag}>
                <Text style={styles.freeTagText}>完全免费 · 直接送EA</Text>
              </View>
              <Text style={[styles.heroTitle, { marginTop: 10 }]}>先拿3款EA跑起来</Text>
              <Text style={[styles.heroSubtitle, { alignSelf: "center", marginTop: 8 }]}>
                从117款中精选的3款EA策略，免费送你。
              </Text>

              <View style={{ flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: isMobile ? 12 : 14, marginTop: 28 }}>
                {freeItems.map((item, i) => (
                  <View key={i} style={[styles.freeCard, { width: isMobile ? "100%" : "48%" }]}>
                    {item.viral && <View style={styles.viralBadge}><Text style={styles.viralBadgeText}>热门</Text></View>}
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                      <View style={styles.freeIconBox}><Text style={{ fontSize: 18 }}>🎁</Text></View>
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
                  <LinearGradient colors={["#F59E0B", "#D97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.freeCTAGradient}>
                    <Text style={{ fontSize: 18 }}>🎁</Text>
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
            <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth, marginTop: 32 }]}>
              <View style={styles.customEABanner}>
                <LinearGradient colors={["#1E1B4B", "#312E81", "#1E1B4B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.customEAInner}>
                  <View style={styles.customEAGlow} />
                  <View style={styles.customEABadge}>
                    <Text style={{ fontSize: 14 }}>🛠️</Text>
                    <Text style={styles.customEABadgeText}>专属EA定制服务</Text>
                  </View>
                  <Text style={styles.customEATitle}>你的策略，你的品牌</Text>
                  <Text style={styles.customEADesc}>
                    为工作室量身打造专属EA策略。源头低价拿货，自定义策略名称与调优模式，无限授权不受限，版权与联系方式全部替换为工作室自有品牌。
                  </Text>
                  <View style={styles.customEAFeatures}>
                    {[
                      "♦ 自定义策略名称 & 调优模式",
                      "♦ 无限授权：不限账户、不限终端、不限客户",
                      "♦ 版权信息 & 联系方式替换为工作室品牌",
                      "♦ 从源码编译到最终交付，全流程透明",
                    ].map((text, i) => (
                      <Text key={i} style={styles.customEAFeatureText}>{text}</Text>
                    ))}
                  </View>
                  <TouchableOpacity onPress={handleConsult} activeOpacity={0.85} style={styles.customEACTA}>
                    <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.customEACTAGradient}>
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
                <LinearGradient colors={["#F59E0B", "#D97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPrimaryGradient}>
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
    borderRadius: 20,
    overflow: "hidden",
    alignSelf: "center",
    width: SW - 32,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 4px 30px rgba(168,85,247,0.15), 0 0 60px rgba(168,85,247,0.05)" }
      : { shadowColor: "#A855F7", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 }),
  },
  coopBannerGradient: {
    padding: 20,
    paddingVertical: 24,
    position: "relative",
    overflow: "hidden",
  },
  bannerDecorTL: {
    position: "absolute",
    top: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(168,85,247,0.08)",
  },
  bannerDecorBR: {
    position: "absolute",
    bottom: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  bannerGlow: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(168,85,247,0.08)",
    transform: [{ translateX: -100 }, { translateY: -100 }],
  },
  bannerGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(168,85,247,0.15)",
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 14,
  },
  bannerIconWrap: {
    position: "relative",
  },
  bannerIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIconGlow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
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
    backgroundColor: "#A855F7",
  },
  bannerTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A855F7",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#F1F5F9",
    marginBottom: 4,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, -apple-system, sans-serif" } : {}),
  },
  bannerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
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
    color: "rgba(255,255,255,0.4)",
    marginTop: 1,
  },
  bannerArrowWrap: {
    marginLeft: 12,
  },
  bannerArrowBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: 40,
    alignSelf: "center",
    width: "100%",
    alignItems: "center",
  },
  sectionTag: {
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: 20,
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
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  pricingCardNormal: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  pricingCardHighlight: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 2,
    borderColor: "rgba(245,158,11,0.3)",
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    alignSelf: "center",
    backgroundColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
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
    color: "rgba(255,255,255,0.5)",
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
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
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    width: "100%",
    maxWidth: 640,
  },
  priceNoteText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 22,
    textAlign: "center",
  },

  // ===== 免费引流 =====
  freeTag: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    borderRadius: 20,
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
    borderRadius: 16,
    padding: 18,
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
    borderRadius: 10,
    backgroundColor: GOLD_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  freeItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  freeItemDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
  },
  freeItemTag: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 6,
    ...(Platform.OS === "web" ? { fontFamily: "ui-monospace, SFMono-Regular, monospace" } : {}),
  },
  freeCTAGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
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
    color: "rgba(255,255,255,0.35)",
  },

  // ===== CTA =====
  ctaWrapper: {
    marginTop: 48,
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
    borderRadius: 14,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 0 40px rgba(245,158,11,0.15)" }
      : { shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 }),
  },
  ctaPrimaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
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
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ctaSecondaryText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: "600",
  },

  // 专属EA定制服务
  customEABanner: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
  },
  customEAInner: {
    padding: 24,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  customEAGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(139,92,246,0.1)",
  },
  customEABadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(139,92,246,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  customEABadgeText: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "700",
  },
  customEATitle: {
    color: "#F1F5F9",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },
  customEADesc: {
    color: "#94A3B8",
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
    borderRadius: 24,
    overflow: "hidden",
  },
  customEACTAGradient: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  customEACTAText: {
    color: "#0A0E1A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
});
