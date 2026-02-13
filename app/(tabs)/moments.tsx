import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, Platform, Animated, RefreshControl, Image } from "react-native";
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
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ===== 行业数据 =====
// EA市场真相数据
const EA_TRUTH_DATA = [
  { label: "过度优化/曲线拟合", pct: 35, color: "#ef4444" },
  { label: "风控机制缺失", pct: 25, color: "#f97316" },
  { label: "不当使用加仓策略", pct: 20, color: "#eab308" },
  { label: "高频策略环境不匹配", pct: 12, color: "#7c3aed" },
  { label: "参数过度敏感", pct: 8, color: "#6b7280" },
];

// 选平台的核心维度 — 行业通用标准
const PLATFORM_CRITERIA = [
  { icon: "🛡️", title: "监管资质", desc: "是否持有FCA/ASIC/CySEC等主流监管牌照，牌照等级和价值直接反映平台实力" },
  { icon: "⚡", title: "出入金效率", desc: "出金到账时间、支持的入金渠道数量、是否有隐藏费用，直接影响资金灵活性" },
  { icon: "🔒", title: "资金安全", desc: "是否采用隔离账户、是否有第三方保障计划、反洗钱合规体系是否健全" },
  { icon: "📊", title: "执行质量", desc: "滑点控制、流动性深度、订单执行速度，决定了EA策略能否按预期运行" },
  { icon: "⭐", title: "市场口碑", desc: "Google/Trustpilot/外汇天眼等第三方平台的真实用户评价和评分" },
  { icon: "🤝", title: "服务支持", desc: "是否有专属客户经理、技术团队响应速度、是否支持MAM等专业需求" },
];

// 我们能提供的服务（桥梁角色）
const OUR_SERVICES = [
  { icon: "🔍", title: "平台筛选", desc: "根据你的交易风格、资金规模和需求，从多家合规平台中匹配最适合的方案" },
  { icon: "📋", title: "合规审核", desc: "我们对接的每家平台都经过监管资质、资金安全、用户口碑等多维度审核" },
  { icon: "💰", title: "激励谈判", desc: "不同平台提供不同的激励政策，我们帮你争取最优的入金返利和合作条件" },
  { icon: "🔧", title: "技术对接", desc: "EA部署、VPS配置、MAM账户管理等技术问题，我们提供全程支持" },
  { icon: "👥", title: "社群资源", desc: "加入量化交易社群，与同行交流策略、分享经验、获取行业一手资讯" },
  { icon: "📞", title: "持续服务", desc: "合作不是一次性的，我们提供长期的平台对接、问题协调和方案优化服务" },
];

// 合作模式 — 中性表述
const COOPERATION_MODELS = [
  { icon: "👤", title: "个人交易者", desc: "我们帮你筛选优质EA策略，匹配合适的合规交易平台，让你专注交易本身", tag: "入门" },
  { icon: "🏢", title: "量化工作室", desc: "多账户管理需求、技术对接支持、阶梯合作方案，助力团队规模化运营", tag: "进阶" },
  { icon: "🔧", title: "EA开发者", desc: "上架策略到军火库获得曝光，我们帮你对接优质交易环境和真实用户", tag: "开发" },
  { icon: "📈", title: "机构合作", desc: "定制化合作方案、专属团队支持、长期共赢的深度合作关系", tag: "深度" },
];

// 合作流程 — 强调"匹配"而非"推荐"
const COOPERATION_STEPS = [
  { step: "01", icon: "📱", label: "沟通需求", desc: "了解你的交易风格和目标" },
  { step: "02", icon: "🔍", label: "方案匹配", desc: "筛选最适合的平台和策略" },
  { step: "03", icon: "📋", label: "合规对接", desc: "协助开户和技术配置" },
  { step: "04", icon: "🚀", label: "持续优化", desc: "长期跟踪和方案调整" },
];

// 为什么选择量化军火库（桥梁价值）
const WHY_US = [
  { number: "200+", label: "已分析EA策略" },
  { number: "多家", label: "合规平台资源" },
  { number: "24h", label: "技术响应" },
  { number: "1v1", label: "专属服务" },
];

export default function CooperationScreen() {
  const colors = useColors();
  const { isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
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

  const handleContact = () => {
    setShowContactModal(true);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
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
        {/* ===== Hero 区域 - 中立桥梁定位 ===== */}
        <FadeInView>
          <LinearGradient
            colors={["#0a1628", "#0f2847", "#1a3a6b"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroSection}
          >
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>量化军火库 · 合作生态</Text>
            </View>
            <Text style={styles.heroTitle}>好策略，配好平台</Text>
            <Text style={styles.heroTitleSub}>我们帮你匹配最适合的合规交易环境</Text>
            <Text style={styles.heroSubtitle}>
              选对EA策略只是第一步{"\n"}
              交易平台的监管资质、执行质量、资金安全同样决定最终收益{"\n"}
              量化军火库为你做好功课，省去踩坑的时间
            </Text>

            {/* 核心数据 — 突出桥梁价值 */}
            <View style={[styles.highlightRow, isDesktop && styles.highlightRowDesktop]}>
              {WHY_US.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Text style={styles.highlightNumber}>{h.number}</Text>
                  <Text style={styles.highlightLabel}>{h.label}</Text>
                </View>
              ))}
            </View>

            {/* CTA按钮 — 自然引导 */}
            <TouchableOpacity
              onPress={handleConsult}
              activeOpacity={0.8}
              style={styles.heroCTABtn}
            >
              <Text style={styles.heroCTAText}>免费咨询平台匹配方案 →</Text>
            </TouchableOpacity>
          </LinearGradient>
        </FadeInView>

        {/* ===== 90%的EA为什么亏钱 - 数据洞察 ===== */}
        <FadeInView delay={100}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>90%的EA为什么亏钱？</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              我们分析了200+款EA策略，发现亏损的核心原因
            </Text>
            <View style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {EA_TRUTH_DATA.map((item, i) => (
                <View key={i} style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: colors.foreground }]}>{item.label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${item.pct}%` as any, backgroundColor: item.color }]} />
                  </View>
                  <Text style={[styles.barPct, { color: colors.muted }]}>{item.pct}%</Text>
                </View>
              ))}
              <Text style={[styles.dataSource, { color: colors.muted }]}>
                数据来源：量化军火库数据库 · 200+ EA策略深度分析
              </Text>
            </View>
            <View style={[styles.insightBox, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
              <Text style={[styles.insightText, { color: colors.foreground }]}>
                策略本身只是一半，另一半取决于你用什么平台跑。执行质量差、滑点大、出入金慢，再好的策略也白搭。
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* ===== 怎么判断一个平台靠不靠谱 ===== */}
        <FadeInView delay={200}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>怎么判断一个平台靠不靠谱？</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              行业通用的6个核心评估维度
            </Text>
            <View style={[styles.criteriaGrid, isDesktop && styles.criteriaGridDesktop]}>
              {PLATFORM_CRITERIA.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.criteriaCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      width: isDesktop ? "48%" as any : "100%" as any,
                    },
                  ]}
                >
                  <Text style={styles.criteriaIcon}>{item.icon}</Text>
                  <Text style={[styles.criteriaTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.criteriaDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 量化军火库能帮你做什么（桥梁服务） ===== */}
        <FadeInView delay={300}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>我们能帮你做什么？</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              量化军火库不是平台方，而是帮你对接优质资源的桥梁
            </Text>
            <View style={[styles.criteriaGrid, isDesktop && styles.criteriaGridDesktop]}>
              {OUR_SERVICES.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.criteriaCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      width: isDesktop ? "48%" as any : "100%" as any,
                    },
                  ]}
                >
                  <Text style={styles.criteriaIcon}>{item.icon}</Text>
                  <Text style={[styles.criteriaTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.criteriaDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 合作模式 ===== */}
        <FadeInView delay={350}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>适合你的合作方式</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              无论你是刚入门还是已经有团队，我们都有对应的支持方案
            </Text>
            <View style={[styles.modelGrid, isDesktop && styles.modelGridDesktop]}>
              {COOPERATION_MODELS.map((item, i) => (
                <View key={i} style={[styles.modelCard, { backgroundColor: colors.surface, borderColor: colors.border, width: isDesktop ? "48%" as any : "100%" as any }]}>
                  <View style={styles.modelCardTop}>
                    <Text style={styles.modelIcon}>{item.icon}</Text>
                    <View style={[styles.modelTag, { backgroundColor: colors.primary + "15" }]}>
                      <Text style={[styles.modelTagText, { color: colors.primary }]}>{item.tag}</Text>
                    </View>
                  </View>
                  <Text style={[styles.modelTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.modelDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 关于激励 — 不写具体数字 ===== */}
        <FadeInView delay={400}>
          <View style={styles.sectionContainer}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => toggleSection("incentive")}>
              <LinearGradient
                colors={["#0f172a", "#1e40af", "#3b82f6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.incentiveHeader}
              >
                <Text style={styles.incentiveHeaderIcon}>💰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.incentiveHeaderTitle}>合作激励说明</Text>
                  <Text style={styles.incentiveHeaderSub}>不同平台提供不同激励政策，我们帮你争取最优条件</Text>
                </View>
                <Text style={styles.collapseArrow}>{expandedSection === "incentive" ? "▲" : "▼"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {expandedSection === "incentive" && (
              <View style={[styles.incentiveBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.incentiveSection}>
                  <Text style={[styles.incentiveSectionTitle, { color: colors.foreground }]}>激励类型</Text>
                  <View style={styles.incentiveList}>
                    {[
                      { icon: "📅", title: "月度返利", desc: "根据净入金金额按比例返利，不同平台比例不同，我们帮你对比选择最优方案" },
                      { icon: "🏆", title: "季度奖励", desc: "达到一定交易量和客户数后可获得额外奖励，具体条件因平台而异" },
                      { icon: "🎁", title: "专属福利", desc: "部分平台提供VPS补贴、培训资源、社群资源等额外权益" },
                      { icon: "📈", title: "阶梯递增", desc: "合作规模越大，激励条件越优，我们帮你持续谈判升级合作方案" },
                    ].map((item, i) => (
                      <View key={i} style={[styles.incentiveItem, { borderBottomColor: colors.border }]}>
                        <Text style={styles.incentiveItemIcon}>{item.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.incentiveItemTitle, { color: colors.foreground }]}>{item.title}</Text>
                          <Text style={[styles.incentiveItemDesc, { color: colors.muted }]}>{item.desc}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.incentiveNote}>
                  <Text style={[styles.incentiveNoteText, { color: colors.muted }]}>
                    具体激励方案因平台和合作模式而异 · 联系我们获取针对你的定制方案
                  </Text>
                </View>
              </View>
            )}
          </View>
        </FadeInView>

        {/* ===== 合作流程 ===== */}
        <FadeInView delay={500}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>合作流程</Text>
            <View style={[styles.processContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {COOPERATION_STEPS.map((p, i) => (
                <View key={i} style={styles.processStepWrapper}>
                  <View style={styles.processStepContent}>
                    <LinearGradient
                      colors={["#1e40af", "#3b82f6"]}
                      style={styles.processCircle}
                    >
                      <Text style={styles.processIcon}>{p.icon}</Text>
                    </LinearGradient>
                    <Text style={[styles.processStepNum, { color: colors.primary }]}>{p.step}</Text>
                    <Text style={[styles.processLabel, { color: colors.foreground }]}>{p.label}</Text>
                    <Text style={[styles.processDesc, { color: colors.muted }]}>{p.desc}</Text>
                  </View>
                  {i < COOPERATION_STEPS.length - 1 && (
                    <View style={styles.processArrowContainer}>
                      <View style={[styles.processArrowLine, { backgroundColor: colors.primary + "30" }]} />
                      <View style={[styles.processArrowHead, { borderLeftColor: colors.primary }]} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 底部CTA - 自然引导 ===== */}
        <FadeInView delay={600}>
          <View style={styles.sectionContainer}>
            <LinearGradient
              colors={["#0a1628", "#1e40af", "#3b82f6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaCard}
            >
              <Text style={styles.ctaTitle}>找到适合你的方案</Text>
              <Text style={styles.ctaDesc}>
                每个人的交易风格和需求都不一样{"\n"}
                告诉我们你的情况，我们帮你匹配最合适的平台和合作方案
              </Text>
              <TouchableOpacity
                onPress={handleConsult}
                activeOpacity={0.8}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaButtonText}>免费咨询平台匹配方案 →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleContact}
                activeOpacity={0.8}
                style={styles.ctaButtonSecondary}
              >
                <Text style={styles.ctaButtonSecondaryText}>获取专属合作建议</Text>
              </TouchableOpacity>
            </LinearGradient>
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
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: "center",
  },
  heroBadge: {
    backgroundColor: "rgba(212,168,67,0.2)",
    borderWidth: 1,
    borderColor: "rgba(212,168,67,0.5)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: "#d4a843",
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 4,
    textAlign: "center",
  },
  heroTitleSub: {
    fontSize: 15,
    fontWeight: "700",
    color: "#60a5fa",
    marginBottom: 12,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  highlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  highlightRowDesktop: {
    gap: 32,
  },
  highlightItem: {
    alignItems: "center",
    minWidth: 70,
  },
  highlightNumber: {
    fontSize: 20,
    fontWeight: "900",
    color: "#60a5fa",
  },
  highlightLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  heroCTABtn: {
    backgroundColor: "#d4a843",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  heroCTAText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },

  // Section
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 20,
  },

  // Data card (EA truth)
  dataCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 16,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  barLabel: {
    width: 110,
    fontSize: 12,
    fontWeight: "600",
  },
  barTrack: {
    flex: 1,
    height: 16,
    backgroundColor: "rgba(100,116,139,0.15)",
    borderRadius: 8,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 8,
  },
  barPct: {
    width: 35,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  dataSource: {
    fontSize: 10,
    marginTop: 8,
    textAlign: "right",
    fontStyle: "italic",
  },
  insightBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 22,
    fontWeight: "500",
  },

  // Platform criteria & services
  criteriaGrid: {
    gap: 10,
    marginTop: 8,
  },
  criteriaGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  criteriaCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
  },
  criteriaIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  criteriaTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  criteriaDesc: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Cooperation models
  modelGrid: {
    gap: 10,
    marginTop: 8,
  },
  modelGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  modelCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
  },
  modelCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modelIcon: {
    fontSize: 28,
  },
  modelTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modelTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modelTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  modelDesc: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Incentive sections
  incentiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 12,
  },
  incentiveHeaderIcon: {
    fontSize: 28,
  },
  incentiveHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },
  incentiveHeaderSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  collapseArrow: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  incentiveBody: {
    borderRadius: 14,
    borderWidth: 0.5,
    marginTop: 8,
    overflow: "hidden",
  },
  incentiveSection: {
    padding: 14,
  },
  incentiveSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  incentiveList: {
    gap: 0,
  },
  incentiveItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  incentiveItemIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  incentiveItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  incentiveItemDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  incentiveNote: {
    padding: 12,
  },
  incentiveNoteText: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
  },

  // Process
  processContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    marginTop: 8,
  },
  processStepWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  processStepContent: {
    alignItems: "center",
    flex: 1,
  },
  processCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  processIcon: {
    fontSize: 20,
  },
  processStepNum: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 2,
  },
  processLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  processDesc: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 2,
  },
  processArrowContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 20,
    justifyContent: "center",
    marginTop: -20,
  },
  processArrowLine: {
    height: 2,
    flex: 1,
    borderRadius: 1,
  },
  processArrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 7,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },

  // CTA
  ctaCard: {
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 10,
  },
  ctaDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  ctaButton: {
    backgroundColor: "#d4a843",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  ctaButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaButtonSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
});
