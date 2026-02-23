import { useRef, useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Animated, RefreshControl } from "react-native";
import { ContactModal } from "@/components/contact-modal";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

// 入场动画
function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ===== 平台评估6大维度 =====
const PLATFORM_DIMENSIONS = [
  { icon: "🛡️", title: "监管资质", desc: "FCA/ASIC/CySEC主流牌照" },
  { icon: "⚡", title: "出入金效率", desc: "到账速度与隐藏费用" },
  { icon: "🔒", title: "资金安全", desc: "隔离账户与保障计划" },
  { icon: "📊", title: "执行质量", desc: "滑点控制与流动性深度" },
  { icon: "⭐", title: "市场口碑", desc: "第三方平台真实评价" },
  { icon: "🤝", title: "服务支持", desc: "专属客户经理与技术响应" },
];

// ===== 我们能帮你做什么 =====
const OUR_SERVICES = [
  { icon: "🔍", title: "平台筛选", desc: "根据交易风格和资金规模，匹配最合适的合规平台" },
  { icon: "📋", title: "合规审核", desc: "每家平台经过监管资质、资金安全等多维度审核" },
  { icon: "💰", title: "激励谈判", desc: "帮你争取最优的入金返利和合作条件" },
  { icon: "🔧", title: "技术对接", desc: "EA部署、VPS配置、MAM账户管理全程支持" },
];

// ===== 合作方式 =====
const COOPERATION_MODELS = [
  { icon: "👤", title: "个人交易者", desc: "筛选优质EA，匹配合规平台，专注交易本身" },
  { icon: "🏢", title: "量化工作室", desc: "多账户管理、技术对接、阶梯合作方案" },
  { icon: "🔧", title: "EA开发者", desc: "上架策略获得曝光，对接优质交易环境", highlight: true },
  { icon: "📈", title: "机构合作", desc: "定制化方案、专属团队、深度合作关系" },
];

export default function CooperationScreen() {
  const colors = useColors();
  const { isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const pageContentsQuery = trpc.pageContents.get.useQuery({ pageKey: "cooperation" });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pageContentsQuery.refetch();
    setRefreshing(false);
  }, []);

  const handleConsult = () => {
    setShowContactModal(true);
  };

  return (
    <ScreenContainer>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ===== Hero 区域 ===== */}
        <FadeInView>
          <View style={styles.heroSection}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>合作生态</Text>
            </View>
            <Text style={styles.heroTitle}>好策略，配好平台</Text>
            <Text style={styles.heroSubtitle}>
              选对EA只是第一步。交易平台的监管资质、执行质量、{"\n"}资金安全同样决定最终收益。
            </Text>
          </View>
        </FadeInView>

        {/* ===== 平台评估6大维度 ===== */}
        <FadeInView delay={100}>
          <View style={styles.sectionContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>平台评估 </Text>
              <Text style={[styles.sectionTitleHighlight, { color: colors.primary }]}>6大维度</Text>
            </View>
            <View style={[styles.dimensionGrid, isDesktop && styles.dimensionGridDesktop]}>
              {PLATFORM_DIMENSIONS.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.dimensionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      width: isDesktop ? "31%" as any : "48%" as any,
                    },
                  ]}
                >
                  <Text style={styles.dimensionIcon}>{item.icon}</Text>
                  <Text style={[styles.dimensionTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.dimensionDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 我们能帮你做什么 ===== */}
        <FadeInView delay={200}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitleCenter, { color: colors.foreground }]}>我们能帮你做什么</Text>
            <View style={[styles.serviceGrid, isDesktop && styles.serviceGridDesktop]}>
              {OUR_SERVICES.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.serviceCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      width: isDesktop ? "48%" as any : "100%" as any,
                    },
                  ]}
                >
                  <Text style={styles.serviceIcon}>{item.icon}</Text>
                  <View style={styles.serviceTextContainer}>
                    <Text style={[styles.serviceTitle, { color: colors.foreground }]}>{item.title}</Text>
                    <Text style={[styles.serviceDesc, { color: colors.muted }]}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 适合你的合作方式 ===== */}
        <FadeInView delay={300}>
          <View style={styles.sectionContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitleCenter, { color: colors.foreground }]}>适合你的 </Text>
              <Text style={[styles.sectionTitleHighlight, { color: colors.primary }]}>合作方式</Text>
            </View>
            <View style={[styles.modelGrid, isDesktop && styles.modelGridDesktop]}>
              {COOPERATION_MODELS.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.modelCard,
                    {
                      backgroundColor: item.highlight ? "#d4a84315" : colors.surface,
                      borderColor: item.highlight ? "#d4a84340" : colors.border,
                    },
                    isDesktop && { width: "23%" as any },
                  ]}
                >
                  <Text style={styles.modelIcon}>{item.icon}</Text>
                  <Text style={[
                    styles.modelTitle,
                    { color: item.highlight ? "#d4a843" : colors.foreground },
                  ]}>{item.title}</Text>
                  <Text style={[styles.modelDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 底部CTA ===== */}
        <FadeInView delay={400}>
          <View style={styles.sectionContainer}>
            <View style={styles.ctaContainer}>
              <TouchableOpacity
                onPress={handleConsult}
                activeOpacity={0.8}
                style={styles.ctaPrimaryBtn}
              >
                <Text style={styles.ctaPrimaryText}>免费咨询合作方案  →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConsult}
                activeOpacity={0.8}
                style={[styles.ctaSecondaryBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.ctaSecondaryText, { color: colors.foreground }]}>查看完整合作详情</Text>
              </TouchableOpacity>
            </View>
          </View>
        </FadeInView>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Hero
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: "center",
  },
  heroBadge: {
    backgroundColor: "rgba(212,168,67,0.15)",
    borderWidth: 1,
    borderColor: "rgba(212,168,67,0.3)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
  },
  heroBadgeText: {
    color: "#d4a843",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#d4a843",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(148,163,184,0.9)",
    textAlign: "center",
    lineHeight: 24,
  },

  // Section
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 32,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  sectionTitleCenter: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
  },
  sectionTitleHighlight: {
    fontSize: 20,
    fontWeight: "800",
  },

  // 平台评估6大维度 - 网格
  dimensionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  dimensionGridDesktop: {
    gap: 14,
  },
  dimensionCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 0.5,
    alignItems: "center",
    marginBottom: 4,
  },
  dimensionIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  dimensionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  dimensionDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  // 我们能帮你做什么 - 服务卡片
  serviceGrid: {
    gap: 10,
  },
  serviceGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  serviceCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  serviceIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  serviceTextContainer: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 13,
    lineHeight: 20,
  },

  // 合作方式 - 卡片
  modelGrid: {
    gap: 10,
  },
  modelGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  modelCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 0.5,
    alignItems: "center",
    flex: 1,
    minWidth: 150,
  },
  modelIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  modelTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  modelDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  // CTA
  ctaContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    flexWrap: "wrap",
  },
  ctaPrimaryBtn: {
    backgroundColor: "#d4a843",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#d4a843",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaPrimaryText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  ctaSecondaryBtn: {
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
