/*
 * 合作生态页面
 * 移植自 quant-promo-showcase
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
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ContactModal } from "@/components/contact-modal";
import { QuickNav } from "@/components/quick-nav";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

// ===== 动画 =====
function FadeInView({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[{ opacity: fadeAnim, transform: [{ translateY }] }, style]}
    >
      {children}
    </Animated.View>
  );
}

// ===== 颜色 =====
const GOLD = "#F59E0B";
const GOLD_DIM = "rgba(245,158,11,0.6)";
const GOLD_BG = "rgba(245,158,11,0.1)";
const GOLD_BORDER = "rgba(245,158,11,0.2)";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "rgba(255,255,255,0.9)";
const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
const TEXT_BODY = "rgba(255,255,255,0.6)";
const DARK_BG = "#0a0f1a";
const DARK_BG_MID = "#0d1225";

// ===== 数据 =====
const platformDimensions = [
  { icon: "🛡️", label: "监管资质", desc: "FCA/ASIC/CySEC主流牌照" },
  { icon: "⚡", label: "出入金效率", desc: "到账速度与隐藏费用" },
  { icon: "🔒", label: "资金安全", desc: "隔离账户与保障计划" },
  { icon: "📊", label: "执行质量", desc: "滑点控制与流动性深度" },
  { icon: "⭐", label: "市场口碑", desc: "第三方平台真实评价" },
  { icon: "🤝", label: "服务支持", desc: "专属客户经理与技术响应" },
];

const services = [
  { icon: "🔍", title: "平台筛选", desc: "根据交易风格和资金规模，匹配最合适的合规平台" },
  { icon: "📋", title: "合规审核", desc: "每家平台经过监管资质、资金安全等多维度审核" },
  { icon: "💰", title: "激励谈判", desc: "帮你争取最优的入金返利和合作条件" },
  { icon: "🔧", title: "技术对接", desc: "EA部署、VPS配置、MAM账户管理全程支持" },
];

const cooperationTypes = [
  { title: "个人交易者", desc: "筛选优质EA，匹配合规平台，专注交易本身", highlight: false },
  { title: "量化工作室", desc: "多账户管理、技术对接、阶梯合作方案", highlight: false },
  { title: "EA开发者", desc: "上架策略获得曝光，对接优质交易环境", highlight: true },
  { title: "机构合作", desc: "定制化方案、专属团队、深度合作关系", highlight: false },
];

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
    priceLabel: "¥59,800",
    period: "/年",
    description: "全部8款顶级策略 + 1对1部署 + 核心圈",
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
      "定制化策略组合方案",
      "独立服务器部署",
      "API对接支持",
      "风控系统搭建咨询",
      "合规架构建议",
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
  const { isDesktop, isMobile } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const pageContentsQuery = trpc.pageContents.get.useQuery({
    pageKey: "cooperation",
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pageContentsQuery.refetch();
    setRefreshing(false);
  }, []);

  const handleConsult = () => {
    setShowContactModal(true);
  };

  const maxContentWidth = 960;

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
      <ContactModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GOLD}
          />
        }
      >
        {/* ===== 背景渐变 ===== */}
        <LinearGradient
          colors={[DARK_BG, DARK_BG_MID, DARK_BG]}
          style={StyleSheet.absoluteFill}
        />

        {/* ===== 1. 选择方案（定价） ===== */}
        <FadeInView delay={0}>
          <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth, marginTop: 32 }]}>
            <View style={styles.sectionTag}>
              <Text style={styles.sectionTagText}>选择方案</Text>
            </View>
            <Text style={[styles.heroTitle, { marginTop: 16 }]}>
              免费拿策略<Text style={{ color: "rgba(255,255,255,0.4)" }}> 或 </Text>
              <Text style={{ color: GOLD }}>直接拿全部</Text>
            </Text>
            <Text style={[styles.heroSubtitle, { alignSelf: "center" }]}>
              我们不做中间价位。要么免费送你EA，要么直接给你最好的。
            </Text>
          </View>
        </FadeInView>

        <FadeInView delay={100}>
          <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth, marginTop: 28 }]}>
            <View
              style={{
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 16 : 14,
                alignItems: isMobile ? "stretch" : "flex-start",
                justifyContent: "center",
              }}
            >
              {pricingTiers.map((tier) => (
                <View
                  key={tier.id}
                  style={[
                    styles.pricingCard,
                    tier.highlight ? styles.pricingCardHighlight : styles.pricingCardNormal,
                    {
                      width: isMobile ? "100%" : "31%",
                      ...(tier.highlight && !isMobile
                        ? Platform.OS === "web"
                          ? { transform: [{ scale: 1.03 }] }
                          : {}
                        : {}),
                    },
                  ]}
                >
                  {/* 核心产品标签 */}
                  {tier.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>核心产品</Text>
                    </View>
                  )}

                  {/* 名称 */}
                  <Text style={[styles.pricingName, tier.highlight && { color: GOLD }]}>
                    {tier.name}
                  </Text>

                  {/* 价格 */}
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginTop: 12 }}>
                    <Text
                      style={[
                        styles.pricingPrice,
                        tier.highlight && { color: GOLD, fontSize: 40 },
                      ]}
                    >
                      {tier.priceLabel}
                    </Text>
                    {tier.period ? (
                      <Text style={styles.pricingPeriod}>{tier.period}</Text>
                    ) : null}
                  </View>

                  {/* 描述 */}
                  <Text style={styles.pricingDesc}>{tier.description}</Text>

                  {/* 功能列表 */}
                  <View style={{ marginTop: 20, gap: 10 }}>
                    {tier.features.map((f, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                        <Text style={{ color: tier.highlight ? GOLD : "rgba(245,158,11,0.7)", fontSize: 14, marginTop: 1 }}>✓</Text>
                        <Text style={styles.pricingFeature}>{f}</Text>
                      </View>
                    ))}
                  </View>

                  {/* CTA 按钮 */}
                  <TouchableOpacity
                    onPress={handleConsult}
                    activeOpacity={0.85}
                    style={{ marginTop: 24 }}
                  >
                    {tier.highlight ? (
                      <LinearGradient
                        colors={["#F59E0B", "#D97706"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.pricingCTAHighlight}
                      >
                        <Text style={styles.pricingCTAHighlightText}>{tier.cta}</Text>
                      </LinearGradient>
                    ) : tier.id === "free" ? (
                      <View style={styles.pricingCTAFree}>
                        <Text style={styles.pricingCTAFreeText}>{tier.cta}</Text>
                      </View>
                    ) : (
                      <View style={styles.pricingCTADefault}>
                        <Text style={styles.pricingCTADefaultText}>{tier.cta}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* 价格说明 */}
            <View style={styles.priceNote}>
              <Text style={styles.priceNoteText}>
                <Text style={{ color: GOLD, fontWeight: "600" }}>关于价格：</Text>
                我们测试117款EA花了¥280,000。精选会员¥59,800，相当于你用不到测试成本的
                <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700" }}> 1/4 </Text>
                的价格，直接拿到24个月实盘验证的结果。自己去测？光买EA就要花十几万，还不算爆仓的钱。
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* ===== 2. 免费引流 ===== */}
        <FadeInView delay={200}>
          <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth, marginTop: 56 }]}>
            <View style={[styles.freeTag]}>
              <Text style={styles.freeTagText}>完全免费 · 直接送EA</Text>
            </View>
            <Text style={[styles.heroTitle, { marginTop: 16 }]}>先别花钱</Text>
            <Text style={[styles.heroTitle, { color: GOLD, marginBottom: 0, marginTop: -4 }]}>
              先拿3款EA跑起来
            </Text>
            <Text style={[styles.heroSubtitle, { alignSelf: "center", marginTop: 16 }]}>
              从117款中精选出来的3款EA策略，免费送你。装上就能跑，先赚着再说。
            </Text>

            {/* 免费项目卡片 */}
            <View
              style={{
                flexDirection: isMobile ? "column" : "row",
                flexWrap: "wrap",
                gap: isMobile ? 12 : 14,
                marginTop: 28,
              }}
            >
              {freeItems.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.freeCard,
                    { width: isMobile ? "100%" : "48%" },
                  ]}
                >
                  {item.viral && (
                    <View style={styles.viralBadge}>
                      <Text style={styles.viralBadgeText}>热门</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View style={styles.freeIconBox}>
                      <Text style={{ fontSize: 18 }}>🎁</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.freeItemName}>{item.name}</Text>
                      <Text style={styles.freeItemDesc}>{item.desc}</Text>
                      <Text style={styles.freeItemTag}>{item.tag}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* 免费领取按钮 */}
            <View style={{ alignItems: "center", marginTop: 28 }}>
              <TouchableOpacity onPress={handleConsult} activeOpacity={0.85}>
                <LinearGradient
                  colors={["#F59E0B", "#D97706"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.freeCTAGradient}
                >
                  <Text style={{ fontSize: 18 }}>🎁</Text>
                  <Text style={styles.freeCTAText}>立即免费领取全部</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.freeWechat}>添加微信 xau9876 即可领取 · 无需付费</Text>
            </View>
          </View>
        </FadeInView>

        {/* ===== 3. 合作生态 Header ===== */}
        <FadeInView delay={300}>
          <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth, marginTop: 56 }]}>
            <View style={styles.sectionTag}>
              <Text style={styles.sectionTagText}>合作生态</Text>
            </View>
            <Text style={[styles.heroTitle, { marginTop: 16 }]}>好策略，配好平台</Text>
            <Text style={[styles.heroSubtitle, { alignSelf: "center" }]}>
              选对EA只是第一步。交易平台的监管资质、执行质量、
              {"\n"}资金安全同样决定最终收益。
            </Text>
          </View>
        </FadeInView>

        {/* ===== 4. 平台评估6大维度 ===== */}
        <FadeInView delay={400}>
          <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth }]}>
            <Text style={styles.sectionTitle}>
              平台评估 <Text style={{ color: GOLD }}>6大维度</Text>
            </Text>
            <View
              style={[
                styles.gridContainer,
                {
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: isMobile ? "space-between" : "center",
                  gap: isMobile ? 10 : 14,
                },
              ]}
            >
              {platformDimensions.map((dim, i) => (
                <View
                  key={i}
                  style={[
                    styles.dimensionCard,
                    { width: isMobile ? "48%" : isDesktop ? "30%" : "31%" },
                  ]}
                >
                  <View style={styles.dimensionIconBox}>
                    <Text style={styles.dimensionIconText}>{dim.icon}</Text>
                  </View>
                  <Text style={styles.dimensionLabel}>{dim.label}</Text>
                  <Text style={styles.dimensionDesc}>{dim.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 5. 我们能帮你做什么 ===== */}
        <FadeInView delay={500}>
          <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth }]}>
            <Text style={styles.sectionTitle}>我们能帮你做什么</Text>
            <View
              style={[
                styles.gridContainer,
                {
                  flexDirection: isMobile ? "column" : "row",
                  flexWrap: "wrap",
                  gap: isMobile ? 12 : 16,
                },
              ]}
            >
              {services.map((svc, i) => (
                <View
                  key={i}
                  style={[styles.serviceCard, { width: isMobile ? "100%" : "48%" }]}
                >
                  <Text style={styles.serviceIcon}>{svc.icon}</Text>
                  <View style={styles.serviceTextBox}>
                    <Text style={styles.serviceTitle}>{svc.title}</Text>
                    <Text style={styles.serviceDesc}>{svc.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 6. 适合你的合作方式 ===== */}
        <FadeInView delay={600}>
          <View style={[styles.sectionWrapper, { maxWidth: maxContentWidth }]}>
            <Text style={styles.sectionTitle}>
              适合你的 <Text style={{ color: GOLD }}>合作方式</Text>
            </Text>
            <View
              style={[
                styles.gridContainer,
                {
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: isMobile ? 10 : 14,
                },
              ]}
            >
              {cooperationTypes.map((type, i) => (
                <View
                  key={i}
                  style={[
                    styles.coopCard,
                    type.highlight ? styles.coopCardHighlight : styles.coopCardNormal,
                    { width: isMobile ? "48%" : isDesktop ? "23%" : "48%" },
                  ]}
                >
                  <Text style={[styles.coopTitle, type.highlight && { color: GOLD }]}>
                    {type.title}
                  </Text>
                  <Text style={styles.coopDesc}>{type.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 7. CTA ===== */}
        <FadeInView delay={700}>
          <View style={[styles.ctaWrapper, { maxWidth: maxContentWidth }]}>
            <TouchableOpacity
              onPress={handleConsult}
              activeOpacity={0.85}
              style={styles.ctaPrimary}
            >
              <LinearGradient
                colors={["#F59E0B", "#D97706"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaPrimaryGradient}
              >
                <Text style={styles.ctaPrimaryText}>免费咨询合作方案</Text>
                <Text style={styles.ctaPrimaryArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConsult}
              activeOpacity={0.85}
              style={styles.ctaSecondary}
            >
              <Text style={styles.ctaSecondaryText}>查看完整合作详情</Text>
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

// ===== 样式 =====
const styles = StyleSheet.create({
  // Section
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
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 16,
    ...(Platform.OS === "web"
      ? { fontFamily: "system-ui, -apple-system, sans-serif" }
      : {}),
  },
  heroSubtitle: {
    fontSize: 15,
    color: TEXT_BODY,
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 480,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 24,
  },
  gridContainer: {
    width: "100%",
  },

  // ===== 定价卡片 =====
  pricingCard: {
    borderRadius: 16,
    padding: 24,
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
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    ...(Platform.OS === "web"
      ? { fontFamily: "ui-monospace, SFMono-Regular, monospace" }
      : {}),
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
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 0 30px rgba(245,158,11,0.3)" }
      : {}),
  },
  pricingCTAHighlightText: {
    color: DARK_BG,
    fontSize: 14,
    fontWeight: "800",
  },
  pricingCTAFree: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
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
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
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
    marginTop: 28,
    padding: 18,
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
    ...(Platform.OS === "web"
      ? { fontFamily: "ui-monospace, SFMono-Regular, monospace" }
      : {}),
  },
  freeCTAGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 0 30px rgba(245,158,11,0.3)" }
      : {}),
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

  // ===== 6大维度卡片 =====
  dimensionCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
  },
  dimensionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: GOLD_BG,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  dimensionIconText: {
    fontSize: 20,
  },
  dimensionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 4,
    textAlign: "center",
  },
  dimensionDesc: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 18,
  },

  // ===== 服务卡片 =====
  serviceCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  serviceIcon: {
    fontSize: 26,
    marginTop: 2,
  },
  serviceTextBox: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 20,
  },

  // ===== 合作方式卡片 =====
  coopCard: {
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
  },
  coopCardNormal: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
  },
  coopCardHighlight: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.25)",
  },
  coopTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: "center",
  },
  coopDesc: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 18,
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
      : {
          shadowColor: GOLD,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 10,
        }),
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
});
