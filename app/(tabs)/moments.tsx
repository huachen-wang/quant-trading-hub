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

// 月度激励档位数据
const MONTHLY_TIERS = [
  { tier: 1, deposit: "$3,000", gift: "¥300" },
  { tier: 2, deposit: "$5,000", gift: "¥500" },
  { tier: 3, deposit: "$10,000", gift: "¥1,100" },
  { tier: 4, deposit: "$30,000", gift: "¥3,500" },
  { tier: 5, deposit: "$50,000", gift: "¥6,000" },
];

// 季度激励档位数据
const QUARTERLY_TIERS = [
  { tier: 1, deposit: "$10万-20万", lots: "600", reward: "$2,000", clients: "≥15名" },
  { tier: 2, deposit: "$20万-40万", lots: "1,200", reward: "$5,000", clients: "≥20名" },
  { tier: 3, deposit: "$40万-60万", lots: "2,500", reward: "$8,000", clients: "≥25名" },
  { tier: 4, deposit: "$60万-100万", lots: "6,000", reward: "$15,000", clients: "≥30名" },
  { tier: 5, deposit: "$100万-200万", lots: "15,000", reward: "$20,000", clients: "≥35名" },
  { tier: 6, deposit: "$200万-300万", lots: "40,000", reward: "$80,000", clients: "≥40名" },
  { tier: 7, deposit: ">$300万", lots: "70,000", reward: "$150,000", clients: "≥45名" },
];

// 平台优势数据
const PLATFORM_ADVANTAGES = [
  { icon: "🛡️", title: "ASIC MM全牌照", desc: "牌照价值$600万+，澳洲政府颁发，业内最高监管等级", highlight: true },
  { icon: "🌍", title: "全球4大监管", desc: "ASIC MM + ASIC STP + VFSC + FSC 四重监管保障" },
  { icon: "📊", title: "月交易量2000亿+", desc: "全球顶级流动性，确保最优执行价格" },
  { icon: "⭐", title: "Google 4.9/5", desc: "2497条真实评价，WikiFX天眼评分9.1/10" },
  { icon: "⚡", title: "2-5小时极速出金", desc: "多币种结算，支持10+入金渠道" },
  { icon: "🔒", title: "资金安全保障", desc: "隔离账户 | SSL加密 | 反洗钱合规 | 天眼保障计划" },
];

// 团队支持
const TEAM_SUPPORT = [
  { icon: "👨‍💼", title: "总部客户经理", desc: "蓝莓总部Nathan，中国区代表，直连主管与各部门" },
  { icon: "👨‍💻", title: "985本硕IT工程师", desc: "悉尼大学技术背景，量化技术全方位支持" },
  { icon: "💬", title: "千人技术论坛", desc: "量化扶持对接，技术社群资源共享" },
  { icon: "⚖️", title: "五院四系律师", desc: "合同修改与合规支持，法律保障无忧" },
];

// 合作流程
const COOPERATION_STEPS = [
  { step: "01", icon: "📱", label: "关注量化军火库", desc: "了解EA策略生态" },
  { step: "02", icon: "🔗", label: "注册蓝莓平台", desc: "通过 www.eaxau.com" },
  { step: "03", icon: "💰", label: "入金开始交易", desc: "享受月度/季度激励" },
  { step: "04", icon: "🤝", label: "深度合作", desc: "MAM/代理/工作室孵化" },
];

const HIGHLIGHTS = [
  { number: "2000亿+", label: "月交易量(USD)" },
  { number: "4.9", label: "Google评分" },
  { number: "600万+", label: "牌照价值(USD)" },
  { number: "24/7", label: "全天候支持" },
];

export default function CooperationScreen() {
  const colors = useColors();
  const { isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("monthly");

  const pageContentsQuery = trpc.pageContents.get.useQuery({ pageKey: "cooperation" });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pageContentsQuery.refetch();
    setRefreshing(false);
  }, []);

  const handleOpenBlueberry = () => {
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
        {/* ===== Hero 区域 - 蓝莓合作主题 ===== */}
        <FadeInView>
          <LinearGradient
            colors={["#0a1628", "#0f2847", "#1a3a6b"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroSection}
          >
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>官方合作伙伴</Text>
            </View>
            <Text style={styles.heroTitle}>蓝莓 BlueberryMarkets</Text>
            <Text style={styles.heroTitleSub}>深度合作计划</Text>
            <Text style={styles.heroSubtitle}>
              ASIC MM全牌照 · 全球顶级监管 · 月交易量2000亿+{"\n"}
              量化军火库 × 蓝莓平台 为您提供最优交易环境
            </Text>

            {/* 核心数据 */}
            <View style={[styles.highlightRow, isDesktop && styles.highlightRowDesktop]}>
              {HIGHLIGHTS.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <AnimatedNumber value={h.number} delay={300 + i * 200} />
                  <Text style={styles.highlightLabel}>{h.label}</Text>
                </View>
              ))}
            </View>

            {/* CTA按钮 */}
            <TouchableOpacity
              onPress={handleOpenBlueberry}
              activeOpacity={0.8}
              style={styles.heroCTABtn}
            >
              <Text style={styles.heroCTAText}>立即开户 → www.eaxau.com</Text>
            </TouchableOpacity>
          </LinearGradient>
        </FadeInView>

        {/* ===== 平台优势 ===== */}
        <FadeInView delay={100}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>为什么选择蓝莓？</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              全球仅5家获批的ASIC MM全牌照做市商之一
            </Text>
            <View style={[styles.advantageGrid, isDesktop && styles.advantageGridDesktop]}>
              {PLATFORM_ADVANTAGES.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.advantageCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: item.highlight ? "#d4a843" : colors.border,
                      borderWidth: item.highlight ? 1.5 : 0.5,
                      width: isDesktop ? "48%" as any : "100%" as any,
                    },
                  ]}
                >
                  <Text style={styles.advantageIcon}>{item.icon}</Text>
                  <Text style={[styles.advantageTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.advantageDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 蓝莓 vs 其他平台 ===== */}
        <FadeInView delay={200}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>蓝莓 vs 其他平台</Text>
            <View style={[styles.comparisonTable, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* 表头 */}
              <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: "#1e40af" }]}>
                <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>对比项</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>蓝莓 Markets</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>二三线平台</Text>
              </View>
              {[
                { item: "牌照类型", bb: "ASIC MM全牌照", other: "STP牌照" },
                { item: "牌照价值", bb: "$600万+", other: "~$20万" },
                { item: "月交易量", bb: "2000亿+ USD", other: "不透明" },
                { item: "出金速度", bb: "2-5小时", other: "1-5个工作日" },
                { item: "Google评分", bb: "4.9/5 (2497)", other: "3-4分" },
                { item: "入金渠道", bb: "10+种", other: "2-3种" },
                { item: "资金安全", bb: "隔离账户+天眼保障", other: "无保障" },
              ].map((row, i) => (
                <View key={i} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.tableCell, { flex: 2, color: colors.foreground, fontWeight: "600" }]}>{row.item}</Text>
                  <Text style={[styles.tableCell, { flex: 2, color: "#10b981", fontWeight: "700" }]}>{row.bb}</Text>
                  <Text style={[styles.tableCell, { flex: 2, color: colors.muted }]}>{row.other}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 月度激励计划 ===== */}
        <FadeInView delay={300}>
          <View style={styles.sectionContainer}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => toggleSection("monthly")}>
              <LinearGradient
                colors={["#0f172a", "#1e40af", "#3b82f6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.incentiveHeader}
              >
                <Text style={styles.incentiveHeaderIcon}>🎁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.incentiveHeaderTitle}>月度激励计划</Text>
                  <Text style={styles.incentiveHeaderSub}>净入金返利 1.5%-1.7% · 无交易手数要求 · 与季度可叠加</Text>
                </View>
                <Text style={styles.collapseArrow}>{expandedSection === "monthly" ? "▲" : "▼"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {expandedSection === "monthly" && (
              <View style={[styles.incentiveBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* 表格 */}
                <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: "#1e3a5f" }]}>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1 }]}>档位</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>首次入金(USD)</Text>
                  <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 2 }]}>礼品卡(CNY)</Text>
                </View>
                {MONTHLY_TIERS.map((t, i) => (
                  <View key={i} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.tableCell, { flex: 1, color: colors.foreground, fontWeight: "700" }]}>{t.tier}</Text>
                    <Text style={[styles.tableCell, { flex: 2, color: colors.foreground }]}>{t.deposit}</Text>
                    <Text style={[styles.tableCell, { flex: 2, color: "#d4a843", fontWeight: "700" }]}>{t.gift}</Text>
                  </View>
                ))}
                <View style={styles.incentiveNote}>
                  <Text style={[styles.incentiveNoteText, { color: colors.muted }]}>
                    奖励形式：京东/天猫购物卡 · 次月中旬发放 · 每位客户每月仅可参与一次
                  </Text>
                </View>
              </View>
            )}
          </View>
        </FadeInView>

        {/* ===== 季度激励计划 ===== */}
        <FadeInView delay={400}>
          <View style={styles.sectionContainer}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => toggleSection("quarterly")}>
              <LinearGradient
                colors={["#1a0533", "#7c3aed", "#a78bfa"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.incentiveHeader}
              >
                <Text style={styles.incentiveHeaderIcon}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.incentiveHeaderTitle}>季度激励计划</Text>
                  <Text style={styles.incentiveHeaderSub}>净入金返利 2%-5% · 阶梯奖励 · 最高 $150,000 USD</Text>
                </View>
                <Text style={styles.collapseArrow}>{expandedSection === "quarterly" ? "▲" : "▼"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {expandedSection === "quarterly" && (
              <View style={[styles.incentiveBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: "#3b1a6b" }]}>
                      <Text style={[styles.tableCell, styles.tableCellHeader, { width: 50 }]}>档位</Text>
                      <Text style={[styles.tableCell, styles.tableCellHeader, { width: 120 }]}>净入金(USD)</Text>
                      <Text style={[styles.tableCell, styles.tableCellHeader, { width: 80 }]}>交易量</Text>
                      <Text style={[styles.tableCell, styles.tableCellHeader, { width: 90 }]}>奖励金</Text>
                      <Text style={[styles.tableCell, styles.tableCellHeader, { width: 70 }]}>客户数</Text>
                    </View>
                    {QUARTERLY_TIERS.map((t, i) => (
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
                <View style={styles.incentiveNote}>
                  <Text style={[styles.incentiveNoteText, { color: colors.muted }]}>
                    活动期限：2026年Q1 · 仅限中国大陆代理 · 美金账户入金 · 持续协助跟进
                  </Text>
                </View>
              </View>
            )}
          </View>
        </FadeInView>

        {/* ===== 其他权益与服务 ===== */}
        <FadeInView delay={450}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>专属权益与服务</Text>
            <View style={[styles.benefitsGrid, isDesktop && styles.benefitsGridDesktop]}>
              <View style={[styles.benefitCard, { backgroundColor: "#1e40af15", borderColor: "#1e40af40" }]}>
                <Text style={styles.benefitIcon}>💎</Text>
                <Text style={[styles.benefitTitle, { color: colors.foreground }]}>{">$50,000 资金量"}</Text>
                <Text style={[styles.benefitDesc, { color: colors.muted }]}>
                  首次合作客户量/资金量持续增长，可向总部申请额外一次性扶持
                </Text>
              </View>
              <View style={[styles.benefitCard, { backgroundColor: "#7c3aed15", borderColor: "#7c3aed40" }]}>
                <Text style={styles.benefitIcon}>👥</Text>
                <Text style={[styles.benefitTitle, { color: colors.foreground }]}>{">100 客户量"}</Text>
                <Text style={[styles.benefitDesc, { color: colors.muted }]}>
                  客户量增长需求更密集，可直连蓝莓总部后台团队
                </Text>
              </View>
              <View style={[styles.benefitCard, { backgroundColor: "#10b98115", borderColor: "#10b98140" }]}>
                <Text style={styles.benefitIcon}>📈</Text>
                <Text style={[styles.benefitTitle, { color: colors.foreground }]}>指标达成协助</Text>
                <Text style={[styles.benefitDesc, { color: colors.muted }]}>
                  针对注册量与交易量，提供策略支持与协助达成
                </Text>
              </View>
              <View style={[styles.benefitCard, { backgroundColor: "#d4a84315", borderColor: "#d4a84340" }]}>
                <Text style={styles.benefitIcon}>🔧</Text>
                <Text style={[styles.benefitTitle, { color: colors.foreground }]}>MAM技术支持</Text>
                <Text style={[styles.benefitDesc, { color: colors.muted }]}>
                  多账户管理系统，灵活分配、智能化分配
                </Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* ===== 3-4人团队支持 ===== */}
        <FadeInView delay={500}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>3-4人专属团队支持</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              24小时快速响应 · 全方位扶持
            </Text>
            <View style={[styles.teamGrid, isDesktop && styles.teamGridDesktop]}>
              {TEAM_SUPPORT.map((item, i) => (
                <View key={i} style={[styles.teamCard, { backgroundColor: colors.surface, borderColor: colors.border, width: isDesktop ? "48%" as any : "100%" as any }]}>
                  <Text style={styles.teamIcon}>{item.icon}</Text>
                  <Text style={[styles.teamTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.teamDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ===== 入金渠道 ===== */}
        <FadeInView delay={550}>
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>便捷入金渠道</Text>
            <View style={[styles.paymentGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {["支付宝", "微信", "Wise", "Revolut", "Bank Wire", "银行汇款", "信用卡", "人民币", "Fastpay", "USDT"].map((method, i) => (
                <View key={i} style={[styles.paymentChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.paymentText, { color: colors.foreground }]}>{method}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.paymentNote, { color: colors.muted }]}>
              出金效率：2-5小时极速到账 · 多币种结算
            </Text>
          </View>
        </FadeInView>

        {/* ===== 合作流程 ===== */}
        <FadeInView delay={600}>
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

        {/* ===== 底部CTA ===== */}
        <FadeInView delay={700}>
          <View style={styles.sectionContainer}>
            <LinearGradient
              colors={["#0a1628", "#1e40af", "#3b82f6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaCard}
            >
              <Text style={styles.ctaBadge}>限时激励活动进行中</Text>
              <Text style={styles.ctaTitle}>开启蓝莓深度合作</Text>
              <Text style={styles.ctaDesc}>
                无论您是量化工作室、EA开发者还是个人交易者{"\n"}
                蓝莓平台都能为您提供最优质的交易环境和最丰厚的激励回报
              </Text>
              <TouchableOpacity
                onPress={handleOpenBlueberry}
                activeOpacity={0.8}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaButtonText}>立即注册开户 → www.eaxau.com</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleContact}
                activeOpacity={0.8}
                style={styles.ctaButtonSecondary}
              >
                <Text style={styles.ctaButtonSecondaryText}>咨询合作详情 contact@eaxau.com</Text>
              </TouchableOpacity>
              <Text style={styles.ctaDisclaimer}>
                蓝莓 BlueberryMarkets · 2016年成立 · ASIC MM全牌照 · 全球信赖
              </Text>
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
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 2,
    textAlign: "center",
  },
  heroTitleSub: {
    fontSize: 20,
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
    fontSize: 22,
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

  // Advantages
  advantageGrid: {
    gap: 10,
    marginTop: 8,
  },
  advantageGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  advantageCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
  },
  advantageIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  advantageTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  advantageDesc: {
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
  incentiveNote: {
    padding: 12,
  },
  incentiveNoteText: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
  },

  // Benefits
  benefitsGrid: {
    gap: 10,
    marginTop: 8,
  },
  benefitsGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  benefitCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  benefitIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Team
  teamGrid: {
    gap: 10,
    marginTop: 8,
  },
  teamGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  teamCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
  },
  teamIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  teamTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  teamDesc: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Payment
  paymentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 0.5,
  },
  paymentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  paymentText: {
    fontSize: 12,
    fontWeight: "600",
  },
  paymentNote: {
    fontSize: 12,
    marginTop: 8,
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
    marginBottom: 14,
  },
  ctaButtonSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  ctaDisclaimer: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
});
