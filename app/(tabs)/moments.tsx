/*
 * 合作生态页面
 * 移植自 quant-promo-showcase/CooperationSection.tsx
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
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
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

// ===== 数据 =====
const GOLD = "#F59E0B";
const GOLD_DIM = "rgba(245,158,11,0.6)";
const GOLD_BG = "rgba(245,158,11,0.1)";
const GOLD_BORDER = "rgba(245,158,11,0.2)";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const CARD_BORDER_HOVER = "rgba(245,158,11,0.2)";
const TEXT_PRIMARY = "rgba(255,255,255,0.9)";
const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
const TEXT_BODY = "rgba(255,255,255,0.6)";
const DARK_BG = "#0a0f1a";
const DARK_BG_MID = "#0d1225";

const platformDimensions = [
  { icon: "🛡️", label: "监管资质", desc: "FCA/ASIC/CySEC主流牌照" },
  { icon: "⚡", label: "出入金效率", desc: "到账速度与隐藏费用" },
  { icon: "🔒", label: "资金安全", desc: "隔离账户与保障计划" },
  { icon: "📊", label: "执行质量", desc: "滑点控制与流动性深度" },
  { icon: "⭐", label: "市场口碑", desc: "第三方平台真实评价" },
  { icon: "🤝", label: "服务支持", desc: "专属客户经理与技术响应" },
];

const services = [
  {
    icon: "🔍",
    title: "平台筛选",
    desc: "根据交易风格和资金规模，匹配最合适的合规平台",
  },
  {
    icon: "📋",
    title: "合规审核",
    desc: "每家平台经过监管资质、资金安全等多维度审核",
  },
  {
    icon: "💰",
    title: "激励谈判",
    desc: "帮你争取最优的入金返利和合作条件",
  },
  {
    icon: "🔧",
    title: "技术对接",
    desc: "EA部署、VPS配置、MAM账户管理全程支持",
  },
];

const cooperationTypes = [
  {
    title: "个人交易者",
    desc: "筛选优质EA，匹配合规平台，专注交易本身",
    highlight: false,
  },
  {
    title: "量化工作室",
    desc: "多账户管理、技术对接、阶梯合作方案",
    highlight: false,
  },
  {
    title: "EA开发者",
    desc: "上架策略获得曝光，对接优质交易环境",
    highlight: true,
  },
  {
    title: "机构合作",
    desc: "定制化方案、专属团队、深度合作关系",
    highlight: false,
  },
];

// ===== 主组件 =====
export default function CooperationScreen() {
  const colors = useColors();
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
    <ScreenContainer containerClassName="bg-[#0a0f1a]">
      <ContactModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
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

        {/* ===== Header ===== */}
        <FadeInView delay={0}>
          <View style={[styles.headerContainer, { maxWidth: maxContentWidth }]}>
            {/* Tag */}
            <View style={styles.sectionTag}>
              <Text style={styles.sectionTagText}>合作生态</Text>
            </View>
            {/* Title */}
            <Text style={styles.heroTitle}>好策略，配好平台</Text>
            {/* Subtitle */}
            <Text style={styles.heroSubtitle}>
              选对EA只是第一步。交易平台的监管资质、执行质量、
              {"\n"}资金安全同样决定最终收益。
            </Text>
          </View>
        </FadeInView>

        {/* ===== 平台评估6大维度 ===== */}
        <FadeInView delay={100}>
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
                    {
                      width: isMobile ? "48%" : isDesktop ? "30%" : "31%",
                    },
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

        {/* ===== 我们能帮你做什么 ===== */}
        <FadeInView delay={200}>
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
                  style={[
                    styles.serviceCard,
                    {
                      width: isMobile ? "100%" : "48%",
                    },
                  ]}
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

        {/* ===== 适合你的合作方式 ===== */}
        <FadeInView delay={300}>
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
                    type.highlight
                      ? styles.coopCardHighlight
                      : styles.coopCardNormal,
                    {
                      width: isMobile ? "48%" : isDesktop ? "23%" : "48%",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.coopTitle,
                      type.highlight && { color: GOLD },
                    ]}
                  >
                    {type.title}
                  </Text>
                  <Text style={styles.coopDesc}>{type.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== CTA ===== */}
        <FadeInView delay={400}>
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
      </ScrollView>
    </ScreenContainer>
  );
}

// ===== 样式 =====
const styles = StyleSheet.create({
  // Header
  headerContainer: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 16,
    alignSelf: "center",
    width: "100%",
  },
  sectionTag: {
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
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

  // Section
  sectionWrapper: {
    paddingHorizontal: 16,
    marginTop: 40,
    alignSelf: "center",
    width: "100%",
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

  // 6大维度卡片
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

  // 服务卡片
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

  // 合作方式卡片
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

  // CTA
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
      ? {
          boxShadow: "0 0 40px rgba(245,158,11,0.15)",
        }
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
