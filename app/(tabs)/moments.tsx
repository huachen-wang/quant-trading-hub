import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, Platform, Animated, RefreshControl, Image } from "react-native";
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

// 数字滚动动画
function AnimatedNumber({ value, duration = 1500, delay = 0 }: { value: string; duration?: number; delay?: number }) {
  const match = value.match(/^([\d.]+)(.*)$/);
  const numericPart = match ? parseFloat(match[1]) : 0;
  const suffix = match ? match[2] : value;
  const isFloat = value.includes(".");
  const decimalPlaces = isFloat ? (match?.[1]?.split(".")[1]?.length || 1) : 0;

  const animValue = useRef(new Animated.Value(0)).current;
  const [displayNum, setDisplayNum] = useState("0");

  useEffect(() => {
    const listener = animValue.addListener(({ value: v }) => {
      if (isFloat) {
        setDisplayNum(v.toFixed(decimalPlaces));
      } else {
        setDisplayNum(Math.round(v).toString());
      }
    });

    const timer = setTimeout(() => {
      Animated.timing(animValue, {
        toValue: numericPart,
        duration,
        useNativeDriver: false,
      }).start();
    }, delay);

    return () => {
      animValue.removeListener(listener);
      clearTimeout(timer);
    };
  }, [numericPart]);

  if (!match) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }, delay);
      return () => clearTimeout(timer);
    }, []);
    return <Animated.Text style={[styles.highlightNumber, { opacity: fadeAnim }]}>{value}</Animated.Text>;
  }

  return (
    <Text style={styles.highlightNumber}>{displayNum}{suffix}</Text>
  );
}

// ===== 行业数据 =====
// EA市场真相数据
const EA_TRUTH_DATA = [
  { label: "过度优化/曲线拟合", pct: 35, color: "#ef4444" },
  { label: "马丁/网格高风险", pct: 25, color: "#f97316" },
  { label: "缺乏风控机制", pct: 20, color: "#eab308" },
  { label: "高频剥头皮失效", pct: 12, color: "#7c3aed" },
  { label: "参数过度敏感", pct: 8, color: "#6b7280" },
];

// 选平台的核心维度
const PLATFORM_CRITERIA = [
  { icon: "🛡️", title: "监管等级", desc: "做市商(MM)牌照是最高等级，牌照价值数百万美元，远超普通STP牌照", key: "regulation" },
  { icon: "⚡", title: "出入金效率", desc: "优质平台出金2-5小时到账，支持多种入金渠道（支付宝/微信/USDT等）", key: "speed" },
  { icon: "🔒", title: "资金安全", desc: "隔离账户、多重加密、反洗钱合规、第三方保障计划缺一不可", key: "safety" },
  { icon: "📊", title: "流动性深度", desc: "月交易量千亿级别以上，确保EA策略获得最优执行价格和低滑点", key: "liquidity" },
  { icon: "⭐", title: "真实口碑", desc: "Google/Trustpilot/天眼等多平台评分4.5+，数千条真实用户评价", key: "reputation" },
  { icon: "🤝", title: "合作支持", desc: "专属客户经理、技术团队支持、MAM多账户管理、社群资源对接", key: "support" },
];

// 平台对比维度（不点名，用"顶级平台"vs"普通平台"）
const COMPARISON_DATA = [
  { item: "监管牌照", top: "MM做市商全牌照", normal: "STP/普通牌照" },
  { item: "牌照价值", top: "$500万+", normal: "~$20万" },
  { item: "月交易量", top: "千亿级 USD", normal: "不透明" },
  { item: "出金速度", top: "2-5小时", normal: "1-5个工作日" },
  { item: "用户评分", top: "4.7-4.9/5", normal: "3-4分" },
  { item: "入金方式", top: "10+种", normal: "2-3种" },
  { item: "资金保障", top: "隔离账户+第三方保障", normal: "无额外保障" },
];

// 合作模式
const COOPERATION_MODELS = [
  { icon: "👤", title: "个人交易者", desc: "使用我们筛选的EA策略，在合规平台上稳健交易，享受入金激励", tag: "入门" },
  { icon: "🏢", title: "量化工作室", desc: "MAM多账户管理、专属技术支持、阶梯激励计划，规模化运营", tag: "进阶" },
  { icon: "🔧", title: "EA开发者", desc: "上架策略到军火库，获得曝光和用户，对接优质交易环境", tag: "开发" },
  { icon: "📈", title: "代理合作", desc: "月度/季度激励叠加，专属团队支持，长期共赢的深度合作关系", tag: "深度" },
];

// 合作流程（不提品牌名）
const COOPERATION_STEPS = [
  { step: "01", icon: "📱", label: "关注量化军火库", desc: "了解EA策略生态" },
  { step: "02", icon: "🔍", label: "选择优质策略", desc: "180天+实盘验证" },
  { step: "03", icon: "🏦", label: "开设合规账户", desc: "顶级监管保障" },
  { step: "04", icon: "🤝", label: "开启深度合作", desc: "激励+技术+社群" },
];

// 激励概览（不提品牌名）
const INCENTIVE_HIGHLIGHTS = [
  { number: "1.5%-5%", label: "净入金返利" },
  { number: "150K", label: "最高季度奖励(USD)" },
  { number: "10+", label: "入金渠道" },
  { number: "24/7", label: "专属团队支持" },
];

export default function CooperationScreen() {
  const colors = useColors();
  const { isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const pageContentsQuery = trpc.pageContents.get.useQuery({ pageKey: "cooperation" });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pageContentsQuery.refetch();
    setRefreshing(false);
  }, []);

  const handleLearnMore = () => {
    Linking.openURL("https://www.eaxau.com");
  };

  const handleContact = () => {
    Linking.openURL("mailto:contact@eaxau.com");
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
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
        {/* ===== Hero 区域 - 以"量化交易合作生态"为主题 ===== */}
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
            <Text style={styles.heroTitle}>打造你的量化交易闭环</Text>
            <Text style={styles.heroTitleSub}>策略 + 平台 + 激励 = 长期盈利</Text>
            <Text style={styles.heroSubtitle}>
              选对EA策略只是第一步，选对交易平台才是关键{"\n"}
              我们为你筛选顶级合规平台，提供全方位合作支持
            </Text>

            {/* 核心数据 */}
            <View style={[styles.highlightRow, isDesktop && styles.highlightRowDesktop]}>
              {INCENTIVE_HIGHLIGHTS.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <AnimatedNumber value={h.number} delay={300 + i * 200} />
                  <Text style={styles.highlightLabel}>{h.label}</Text>
                </View>
              ))}
            </View>

            {/* CTA按钮 */}
            <TouchableOpacity
              onPress={handleLearnMore}
              activeOpacity={0.8}
              style={styles.heroCTABtn}
            >
              <Text style={styles.heroCTAText}>了解合作详情 →</Text>
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
                选对策略只解决了一半问题。平台的执行质量、滑点控制、出入金效率同样决定了你的最终收益。
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* ===== 如何选择靠谱的交易平台 ===== */}
        <FadeInView delay={200}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>如何选择靠谱的交易平台？</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              6个核心维度，帮你避开90%的坑
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

        {/* ===== 顶级平台 vs 普通平台 ===== */}
        <FadeInView delay={300}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>顶级平台 vs 普通平台</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              选择不同等级的平台，交易体验天差地别
            </Text>
            <View style={[styles.comparisonTable, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* 表头 */}
              <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: "#1e40af" }]}>
                <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>对比维度</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>顶级合规平台</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>普通平台</Text>
              </View>
              {COMPARISON_DATA.map((row, i) => (
                <View key={i} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.tableCell, { flex: 2, color: colors.foreground, fontWeight: "600" }]}>{row.item}</Text>
                  <Text style={[styles.tableCell, { flex: 2, color: "#10b981", fontWeight: "700" }]}>{row.top}</Text>
                  <Text style={[styles.tableCell, { flex: 2, color: colors.muted }]}>{row.normal}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 合作模式 ===== */}
        <FadeInView delay={350}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>合作模式</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              无论你是个人交易者还是量化团队，都能找到适合的合作方式
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

        {/* ===== 激励计划概览（不提品牌名，用"合作平台"代替） ===== */}
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
                  <Text style={styles.incentiveHeaderTitle}>合作激励计划</Text>
                  <Text style={styles.incentiveHeaderSub}>月度返利 + 季度奖励 · 可叠加 · 无隐藏门槛</Text>
                </View>
                <Text style={styles.collapseArrow}>{expandedSection === "incentive" ? "▲" : "▼"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {expandedSection === "incentive" && (
              <View style={[styles.incentiveBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* 月度激励 */}
                <View style={styles.incentiveSection}>
                  <Text style={[styles.incentiveSectionTitle, { color: colors.foreground }]}>月度激励</Text>
                  <Text style={[styles.incentiveSectionSub, { color: colors.muted }]}>
                    净入金返利 1.5%-1.7% · 无交易手数要求 · 奖励形式：购物卡
                  </Text>
                  <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: "#1e3a5f" }]}>
                    <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1 }]}>档位</Text>
                    <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>首次入金(USD)</Text>
                    <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>返利(CNY)</Text>
                  </View>
                  {[
                    { tier: 1, deposit: "$3,000", gift: "¥300" },
                    { tier: 2, deposit: "$5,000", gift: "¥500" },
                    { tier: 3, deposit: "$10,000", gift: "¥1,100" },
                    { tier: 4, deposit: "$30,000", gift: "¥3,500" },
                    { tier: 5, deposit: "$50,000", gift: "¥6,000" },
                  ].map((t, i) => (
                    <View key={i} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.tableCell, { flex: 1, color: colors.foreground, fontWeight: "700" }]}>{t.tier}</Text>
                      <Text style={[styles.tableCell, { flex: 2, color: colors.foreground }]}>{t.deposit}</Text>
                      <Text style={[styles.tableCell, { flex: 2, color: "#d4a843", fontWeight: "700" }]}>{t.gift}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* 季度激励 */}
                <View style={styles.incentiveSection}>
                  <Text style={[styles.incentiveSectionTitle, { color: colors.foreground }]}>季度激励</Text>
                  <Text style={[styles.incentiveSectionSub, { color: colors.muted }]}>
                    净入金返利 2%-5% · 阶梯奖励 · 最高 $150,000 USD
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: "#3b1a6b" }]}>
                        <Text style={[styles.tableCell, styles.tableCellHeader, { width: 50 }]}>档位</Text>
                        <Text style={[styles.tableCell, styles.tableCellHeader, { width: 120 }]}>净入金(USD)</Text>
                        <Text style={[styles.tableCell, styles.tableCellHeader, { width: 80 }]}>交易量</Text>
                        <Text style={[styles.tableCell, styles.tableCellHeader, { width: 90 }]}>奖励金</Text>
                        <Text style={[styles.tableCell, styles.tableCellHeader, { width: 70 }]}>客户数</Text>
                      </View>
                      {[
                        { tier: 1, deposit: "$10万-20万", lots: "600", reward: "$2,000", clients: "≥15名" },
                        { tier: 2, deposit: "$20万-40万", lots: "1,200", reward: "$5,000", clients: "≥20名" },
                        { tier: 3, deposit: "$40万-60万", lots: "2,500", reward: "$8,000", clients: "≥25名" },
                        { tier: 4, deposit: "$60万-100万", lots: "6,000", reward: "$15,000", clients: "≥30名" },
                        { tier: 5, deposit: "$100万-200万", lots: "15,000", reward: "$20,000", clients: "≥35名" },
                        { tier: 6, deposit: "$200万-300万", lots: "40,000", reward: "$80,000", clients: "≥40名" },
                        { tier: 7, deposit: ">$300万", lots: "70,000", reward: "$150,000", clients: "≥45名" },
                      ].map((t, i) => (
                        <View key={i} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                          <Text style={[styles.tableCell, { width: 50, color: colors.foreground, fontWeight: "700" }]}>{t.tier}</Text>
                          <Text style={[styles.tableCell, { width: 120, color: colors.foreground }]}>{t.deposit}</Text>
                          <Text style={[styles.tableCell, { width: 80, color: colors.muted }]}>{t.lots}</Text>
                          <Text style={[styles.tableCell, { width: 90, color: "#d4a843", fontWeight: "700" }]}>{t.reward}</Text>
                          <Text style={[styles.tableCell, { width: 70, color: colors.muted }]}>{t.clients}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.incentiveNote}>
                  <Text style={[styles.incentiveNoteText, { color: colors.muted }]}>
                    月度与季度激励可叠加 · 次月中旬发放 · 详情请咨询合作团队
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

        {/* ===== 专属服务 ===== */}
        <FadeInView delay={550}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>专属合作服务</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              3-4人专属团队 · 24小时响应 · 全方位技术支持
            </Text>
            <View style={[styles.serviceGrid, isDesktop && styles.serviceGridDesktop]}>
              {[
                { icon: "👨‍💼", title: "专属客户经理", desc: "一对一服务，直连平台总部各部门" },
                { icon: "👨‍💻", title: "技术工程师", desc: "量化技术全方位支持，EA部署调试" },
                { icon: "💬", title: "千人技术社群", desc: "量化交流、策略分享、资源对接" },
                { icon: "⚖️", title: "合规法律支持", desc: "合同审核、合规咨询、法律保障" },
              ].map((item, i) => (
                <View key={i} style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border, width: isDesktop ? "48%" as any : "100%" as any }]}>
                  <Text style={styles.serviceIcon}>{item.icon}</Text>
                  <Text style={[styles.serviceTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.serviceDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 底部CTA - 软性引导 ===== */}
        <FadeInView delay={650}>
          <View style={styles.sectionContainer}>
            <LinearGradient
              colors={["#0a1628", "#1e40af", "#3b82f6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaCard}
            >
              <Text style={styles.ctaBadge}>限时激励活动进行中</Text>
              <Text style={styles.ctaTitle}>开启深度合作</Text>
              <Text style={styles.ctaDesc}>
                无论你是量化工作室、EA开发者还是个人交易者{"\n"}
                我们都能为你匹配最优质的交易环境和最丰厚的激励回报
              </Text>
              <TouchableOpacity
                onPress={handleLearnMore}
                activeOpacity={0.8}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaButtonText}>了解合作方案 →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleContact}
                activeOpacity={0.8}
                style={styles.ctaButtonSecondary}
              >
                <Text style={styles.ctaButtonSecondaryText}>咨询合作详情</Text>
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
    fontSize: 16,
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
    gap: 16,
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

  // Platform criteria
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

  // Comparison Table
  comparisonTable: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
  },
  tableHeader: {
    borderBottomWidth: 0,
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
  },
  tableCellHeader: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
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
    marginBottom: 4,
  },
  incentiveSectionSub: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 18,
  },
  divider: {
    height: 0.5,
    marginHorizontal: 14,
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

  // Service
  serviceGrid: {
    gap: 10,
    marginTop: 8,
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
  serviceIcon: {
    fontSize: 28,
    marginBottom: 8,
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

  // CTA
  ctaCard: {
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
  },
  ctaBadge: {
    backgroundColor: "rgba(212,168,67,0.2)",
    color: "#d4a843",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
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
