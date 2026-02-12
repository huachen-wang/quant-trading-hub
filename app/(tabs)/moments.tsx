import { useRef, useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, Platform, Animated, ActivityIndicator, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";

// 入场动画
function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// 后台内容类型
type PageContentItem = {
  id: number;
  pageKey: string;
  sectionKey: string;
  title: string;
  content: string;
  icon: string | null;
  sortOrder: number;
  isVisible: boolean;
};

// 默认服务板块数据（后台无数据时使用）
interface ServiceItem {
  icon: string;
  title: string;
  desc: string;
}

interface ServiceSection {
  id: string;
  sectionKey: string;
  icon: string;
  title: string;
  subtitle: string;
  gradient: readonly [string, string, ...string[]];
  items: ServiceItem[];
}

const DEFAULT_SERVICES: ServiceSection[] = [
  {
    id: "compliance",
    sectionKey: "compliance",
    icon: "🛡️",
    title: "合规支持",
    subtitle: "全球多司法管辖区合规框架搭建",
    gradient: ["#0f172a", "#1e40af", "#3b82f6"],
    items: [
      { icon: "📋", title: "牌照申请与维护", desc: "协助申请 FCA / ASIC / CySEC / FSA 等主流监管牌照，提供持续合规维护方案" },
      { icon: "📑", title: "法律文件审查", desc: "客户协议、风险披露、隐私政策等合规文件的起草与审查" },
      { icon: "🔍", title: "反洗钱(AML)体系", desc: "KYC/AML 流程设计、可疑交易监控系统搭建与合规培训" },
      { icon: "🌐", title: "跨境合规咨询", desc: "多司法管辖区运营的合规架构设计，规避监管冲突风险" },
    ],
  },
  {
    id: "technology",
    sectionKey: "technology",
    icon: "⚡",
    title: "技术支持",
    subtitle: "企业级量化交易基础设施",
    gradient: ["#1a0533", "#7c3aed", "#a78bfa"],
    items: [
      { icon: "🖥️", title: "交易服务器部署", desc: "全球低延迟 VPS 集群部署，纽约 NY4 / 伦敦 LD4 / 东京 TY3 机房直连" },
      { icon: "🤖", title: "EA 策略开发", desc: "MQL4/MQL5 专业开发团队，从策略原型到生产级代码的全流程交付" },
      { icon: "📊", title: "风控系统搭建", desc: "实时风险监控、自动止损熔断、仓位管理系统的定制开发" },
      { icon: "🔗", title: "流动性对接", desc: "主流 LP 流动性聚合接入，FIX 协议桥接，点差优化方案" },
    ],
  },
  {
    id: "business",
    sectionKey: "business",
    icon: "🚀",
    title: "业务支持",
    subtitle: "从 0 到 1 的量化业务全链路赋能",
    gradient: ["#14260b", "#16a34a", "#4ade80"],
    items: [
      { icon: "🏢", title: "工作室孵化", desc: "为量化交易工作室提供办公场地、资金对接、运营管理的一站式孵化服务" },
      { icon: "💰", title: "资金引入", desc: "对接合规资金方，协助搭建资管产品结构，提供业绩审计与报告服务" },
      { icon: "📈", title: "品牌与获客", desc: "量化品牌定位策划、官网与社媒矩阵搭建、精准客户获取方案" },
      { icon: "🤝", title: "机构合作", desc: "券商 / 经纪商白标方案、MAM/PAMM 多账户管理系统、IB 代理体系搭建" },
    ],
  },
];

// 合作伙伴类型
const PARTNER_TYPES = [
  { icon: "🏦", label: "量化工作室" },
  { icon: "💻", label: "技术开发方" },
  { icon: "🏛️", label: "金融机构" },
  { icon: "📊", label: "资管公司" },
  { icon: "🌍", label: "海外经纪商" },
  { icon: "🎓", label: "量化培训机构" },
];

// 数据亮点
const HIGHLIGHTS = [
  { number: "50+", label: "合作机构" },
  { number: "12", label: "覆盖国家" },
  { number: "99.9%", label: "系统可用率" },
  { number: "24/7", label: "技术响应" },
];

// 将后台数据按sectionKey分组
function groupContentsBySection(contents: PageContentItem[]): Record<string, PageContentItem[]> {
  const groups: Record<string, PageContentItem[]> = {};
  for (const item of contents) {
    if (!item.isVisible) continue;
    if (!groups[item.sectionKey]) groups[item.sectionKey] = [];
    groups[item.sectionKey].push(item);
  }
  // 按sortOrder排序
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return groups;
}

// 将后台数据转换为ServiceItem
function contentToServiceItem(item: PageContentItem): ServiceItem {
  return {
    icon: item.icon || "📄",
    title: item.title,
    desc: item.content,
  };
}

export default function CooperationScreen() {
  const colors = useColors();
  const { isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);

  // 从后台获取合作页面数据
  const pageContentsQuery = trpc.pageContents.get.useQuery({ pageKey: "cooperation" });
  const contents = (pageContentsQuery.data || []) as PageContentItem[];
  const groupedContents = useMemo(() => groupContentsBySection(contents), [contents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pageContentsQuery.refetch();
    setRefreshing(false);
  }, []);

  // 构建服务板块：后台有对应sectionKey的数据就用后台数据，否则用默认数据
  const services = useMemo(() => {
    return DEFAULT_SERVICES.map((section) => {
      const backendItems = groupedContents[section.sectionKey];
      if (backendItems && backendItems.length > 0) {
        return {
          ...section,
          items: backendItems.map(contentToServiceItem),
        };
      }
      return section;
    });
  }, [groupedContents]);

  // 检查是否有不属于默认板块的自定义板块
  const customSections = useMemo(() => {
    const defaultKeys = new Set(DEFAULT_SERVICES.map(s => s.sectionKey));
    const customKeys = Object.keys(groupedContents).filter(k => !defaultKeys.has(k));
    return customKeys.map(key => ({
      sectionKey: key,
      items: groupedContents[key],
    }));
  }, [groupedContents]);

  const handleContact = () => {
    Linking.openURL("mailto:contact@eaxau.com");
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Hero 区域 */}
        <FadeInView>
          <LinearGradient
            colors={["#0f172a", "#1e293b", "#334155"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroSection}
          >
            <Text style={styles.heroEmoji}>🏗️</Text>
            <Text style={styles.heroTitle}>量化生态合作</Text>
            <Text style={styles.heroSubtitle}>
              为量化工作室、技术方与金融机构提供{"\n"}合规 · 技术 · 业务 全方位支持
            </Text>

            {/* 数据亮点 */}
            <View style={[styles.highlightRow, isDesktop && styles.highlightRowDesktop]}>
              {HIGHLIGHTS.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Text style={styles.highlightNumber}>{h.number}</Text>
                  <Text style={styles.highlightLabel}>{h.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </FadeInView>

        {/* 合作对象 */}
        <FadeInView delay={100}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>合作对象</Text>
            <View style={styles.partnerGrid}>
              {PARTNER_TYPES.map((p, i) => (
                <View key={i} style={[styles.partnerChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={styles.partnerIcon}>{p.icon}</Text>
                  <Text style={[styles.partnerLabel, { color: colors.foreground }]}>{p.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* 三大服务板块 */}
        {services.map((section, sIdx) => (
          <FadeInView key={section.id} delay={200 + sIdx * 150}>
            <View style={styles.sectionContainer}>
              {/* 板块标题 */}
              <LinearGradient
                colors={section.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.serviceTitleBar}
              >
                <Text style={styles.serviceTitleIcon}>{section.icon}</Text>
                <View>
                  <Text style={styles.serviceTitleText}>{section.title}</Text>
                  <Text style={styles.serviceSubtitleText}>{section.subtitle}</Text>
                </View>
              </LinearGradient>

              {/* 服务项目 */}
              <View style={[styles.serviceGrid, isDesktop && styles.serviceGridDesktop]}>
                {section.items.map((item, iIdx) => (
                  <View
                    key={iIdx}
                    style={[
                      styles.serviceCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        width: isDesktop ? "48%" as any : "100%" as any,
                      },
                      Platform.OS === "web" ? {
                        // @ts-ignore
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                        transition: "box-shadow 0.3s ease, transform 0.3s ease",
                      } : {},
                    ]}
                    // @ts-ignore
                    className={Platform.OS === "web" ? "strategy-card-hover" : undefined}
                  >
                    <Text style={styles.serviceItemIcon}>{item.icon}</Text>
                    <Text style={[styles.serviceItemTitle, { color: colors.foreground }]}>{item.title}</Text>
                    <Text style={[styles.serviceItemDesc, { color: colors.muted }]}>{item.desc}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeInView>
        ))}

        {/* 自定义板块（后台新增的非默认sectionKey） */}
        {customSections.map((cs, csIdx) => (
          <FadeInView key={cs.sectionKey} delay={700 + csIdx * 100}>
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{cs.sectionKey}</Text>
              {cs.items.map((item) => (
                <View key={item.id} style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border, width: "100%" as any, marginBottom: 10 }]}>
                  <Text style={styles.serviceItemIcon}>{item.icon || "📄"}</Text>
                  <Text style={[styles.serviceItemTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.serviceItemDesc, { color: colors.muted }]}>{item.content}</Text>
                </View>
              ))}
            </View>
          </FadeInView>
        ))}

        {/* 合作流程 */}
        <FadeInView delay={700}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>合作流程</Text>
            <View style={styles.processRow}>
              {[
                { step: "01", icon: "💬", label: "需求沟通" },
                { step: "02", icon: "📝", label: "方案定制" },
                { step: "03", icon: "🤝", label: "签约合作" },
                { step: "04", icon: "🚀", label: "落地交付" },
              ].map((p, i) => (
                <View key={i} style={styles.processStep}>
                  <LinearGradient
                    colors={["#1e40af", "#3b82f6"]}
                    style={styles.processCircle}
                  >
                    <Text style={styles.processIcon}>{p.icon}</Text>
                  </LinearGradient>
                  <Text style={[styles.processStepNum, { color: colors.primary }]}>{p.step}</Text>
                  <Text style={[styles.processLabel, { color: colors.foreground }]}>{p.label}</Text>
                  {i < 3 && <Text style={[styles.processArrow, { color: colors.muted }]}>→</Text>}
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* CTA */}
        <FadeInView delay={850}>
          <View style={styles.sectionContainer}>
            <LinearGradient
              colors={["#1e40af", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaCard}
            >
              <Text style={styles.ctaTitle}>开启合作</Text>
              <Text style={styles.ctaDesc}>
                无论您是量化工作室、技术团队还是金融机构，{"\n"}我们都能为您提供专业的定制化解决方案
              </Text>
              <TouchableOpacity
                onPress={handleContact}
                activeOpacity={0.8}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaButtonText}>联系我们 →</Text>
              </TouchableOpacity>
              <Text style={styles.ctaEmail}>contact@eaxau.com</Text>
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
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: "center",
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  highlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  highlightRowDesktop: {
    gap: 32,
  },
  highlightItem: {
    alignItems: "center",
    minWidth: 70,
  },
  highlightNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: "#60a5fa",
  },
  highlightLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },

  // Section
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },

  // Partner chips
  partnerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  partnerChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    gap: 6,
  },
  partnerIcon: {
    fontSize: 18,
  },
  partnerLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Service title bar
  serviceTitleBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 12,
    marginBottom: 12,
  },
  serviceTitleIcon: {
    fontSize: 28,
  },
  serviceTitleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  serviceSubtitleText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  // Service grid
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
  },
  serviceItemIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  serviceItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  serviceItemDesc: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Process
  processRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  processStep: {
    alignItems: "center",
    position: "relative",
  },
  processCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  processIcon: {
    fontSize: 22,
  },
  processStepNum: {
    fontSize: 11,
    fontWeight: "800",
  },
  processLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  processArrow: {
    position: "absolute",
    right: -16,
    top: 18,
    fontSize: 16,
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
    backgroundColor: "#fff",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e40af",
  },
  ctaEmail: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
});
