import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Linking,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { ContactModal } from "@/components/contact-modal";
import { QuickNav } from "@/components/quick-nav";
import { GlassCard } from "@/components/glass-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

// 启用Android LayoutAnimation
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

type NotificationItem = {
  id: number;
  icon?: string;
  title: string;
  type: string;
  content: string;
  link?: string | null;
};

// 公告卡片组件 - 支持展开/收起
function NotifCard({ item, colors }: { item: NotificationItem; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const typeColors: Record<string, string> = {
    info: colors.primary,
    success: colors.success,
    warning: colors.warning,
    promo: "#C9A96E",
  };

  const accentColor = typeColors[item.type] || colors.primary;

  const toggleExpand = () => {
    const toValue = expanded ? 0 : 1;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue,
      duration: 250,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    setExpanded(!expanded);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={toggleExpand}>
      <GlassCard intensity="subtle" accentColor={accentColor} style={[styles.notifCard, { borderLeftWidth: 3, borderLeftColor: accentColor }]}>
        <View style={styles.notifCardHeader}>
          <View style={[styles.typeCode, { borderColor: accentColor + "70" }]}>
            <Text style={[styles.typeCodeText, { color: accentColor }]}>{String(item.type || "INFO").slice(0, 4).toUpperCase()}</Text>
          </View>
          <Text style={[styles.notifCardTitle, { color: colors.foreground }]} numberOfLines={expanded ? undefined : 1}>
            {item.title}
          </Text>
          <Animated.Text style={[styles.expandArrow, { color: colors.muted, transform: [{ rotate: rotation }] }]}>
            ▼
          </Animated.Text>
        </View>
        {expanded && (
          <View>
            <Text style={[styles.notifCardContent, { color: colors.muted }]}>{item.content}</Text>
            {item.link && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.link!)}
                activeOpacity={0.7}
                style={[styles.notifLinkBtn, { backgroundColor: accentColor + "20" }]}
              >
                <Text style={[styles.notifLinkText, { color: accentColor }]}>查看详情 →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {!expanded && (
          <Text style={[styles.notifCardPreview, { color: colors.muted }]} numberOfLines={1}>
            {item.content}
          </Text>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

// 入场动画
function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// EA市场数据
const EA_MARKET_DATA = [
  { label: "过度优化", pct: 35, color: "#ef4444" },
  { label: "风控缺失", pct: 25, color: "#f97316" },
  { label: "加仓使用不当", pct: 20, color: "#eab308" },
  { label: "环境不匹配", pct: 12, color: "#7c3aed" },
  { label: "参数敏感", pct: 8, color: "#6b7280" },
];

// EAXAU 筛选标准
const SCREENING_CRITERIA = [
  { icon: "180D", label: "180天+实盘验证", desc: "所有策略必须提供不少于180天的真实实盘数据" },
  { icon: "DD", label: "最大回撤<25%", desc: "严格风控标准，剔除高风险策略" },
  { icon: "SR", label: "夏普比率>1.0", desc: "单位风险获得的回报必须达标" },
  { icon: "PF", label: "盈利因子>1.5", desc: "总盈利至少是总亏损的1.5倍" },
];

// 订阅权益 - 突出EA领取
const SUBSCRIBE_BENEFITS = [
  { icon: "EA", title: "免费获得实战EA", desc: "提交即可获得一款经过实盘验证的精选EA策略" },
  { icon: "NEW", title: "新策略上架通知", desc: "第一时间获取通过审核的优质EA策略" },
  { icon: "DATA", title: "行业数据报告", desc: "定期推送EA市场分析和趋势洞察" },
  { icon: "1:1", title: "1对1部署指导", desc: "专属策略顾问协助您完成EA安装与参数配置" },
];

export default function SubscribeScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [contactInput, setContactInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isInputFocused = useRef(false);

  // 轮播动画状态
  const [currentNotifIdx, setCurrentNotifIdx] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // 获取数据
  const pageContentsQuery = trpc.pageContents.get.useQuery({ pageKey: "subscribe" });
  const subscriberCountQuery = trpc.subscriptions.count.useQuery();
  const notificationsQuery = trpc.notifications.active.useQuery();
  const subscribeMutation = trpc.subscriptions.subscribe.useMutation();

  const contents = (pageContentsQuery.data || []) as PageContentItem[];
  const notifications = (notificationsQuery.data || []) as NotificationItem[];

  // 顶部通知栏滑动轮播动画
  useEffect(() => {
    if (notifications.length <= 1) return;
    const interval = setInterval(() => {
      if (isInputFocused.current || isAnimating.current) return;
      isAnimating.current = true;

      Animated.timing(slideAnim, {
        toValue: -1,
        duration: 300,
        useNativeDriver: Platform.OS !== "web",
      }).start(() => {
        setCurrentNotifIdx((prev) => (prev + 1) % notifications.length);
        slideAnim.setValue(1);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== "web",
        }).start(() => {
          isAnimating.current = false;
        });
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [notifications.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      pageContentsQuery.refetch(),
      subscriberCountQuery.refetch(),
      notificationsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  // 智能识别输入类型
  const detectInputType = (value: string): { email?: string; contactInfo?: string } => {
    const v = value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(v)) {
      return { email: v };
    }
    return { contactInfo: v };
  };

  const handleSubscribe = async () => {
    const trimmed = contactInput.trim();
    if (!trimmed) {
      setSubscribeMsg({ type: "error", text: "请输入您的联系方式" });
      return;
    }
    if (trimmed.length < 3) {
      setSubscribeMsg({ type: "error", text: "请输入有效的联系方式（至少3个字符）" });
      return;
    }

    setIsSubmitting(true);
    setSubscribeMsg(null);
    try {
      const payload = detectInputType(trimmed);
      const result = await subscribeMutation.mutateAsync(payload);
      if (result?.success) {
        setSubscribeMsg({ type: "success", text: result.message || "提交成功！我们将尽快与您联系" });
        setContactInput("");
        subscriberCountQuery.refetch();
      } else {
        setSubscribeMsg({ type: "error", text: result?.message || "提交失败" });
      }
    } catch (error: any) {
      setSubscribeMsg({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConsult = () => {
    setShowContactModal(true);
  };

  if (pageContentsQuery.isLoading && !pageContentsQuery.data) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  // 轮播偏移
  const slideTranslateY = slideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-24, 0, 24],
  });
  const slideOpacity = slideAnim.interpolate({
    inputRange: [-1, -0.5, 0, 0.5, 1],
    outputRange: [0, 0.5, 1, 0.5, 0],
  });

  // 输入框样式 - Web端使用glass-input className
  const inputProps = {};

  return (
    <ScreenContainer>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.listContainer, isDesktop && styles.listContainerDesktop]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* 通知栏 */}
          {notifications.length > 0 && (
            <View style={[styles.notifBar, { backgroundColor: colors.primary + "10", overflow: "hidden" }]}>
              <Text style={styles.notifBarIcon}>NEWS</Text>
              <View style={styles.notifBarTextBox}>
                <Animated.View style={{ transform: [{ translateY: slideTranslateY }], opacity: slideOpacity }}>
                  <Text style={[styles.notifBarText, { color: colors.foreground }]} numberOfLines={1}>
                    {notifications[currentNotifIdx]?.title}
                    {" — "}
                    {notifications[currentNotifIdx]?.content}
                  </Text>
                </Animated.View>
              </View>
              {notifications.length > 1 && (
                <View style={styles.notifDots}>
                  {notifications.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.notifDot,
                        { backgroundColor: i === currentNotifIdx ? colors.primary : colors.muted + "40" },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={[styles.subscribeHero, isDesktop && styles.subscribeHeroDesktop]}>
            {/* 页面标题 */}
            <View style={[styles.headerSection, isDesktop && styles.headerSectionDesktop]}>
              <Text style={styles.headerKicker}>EAXAU STRATEGY ACCESS</Text>
              <Text style={[styles.pageTitle, isDesktop && styles.pageTitleDesktop, { color: colors.foreground }]}>免费领取实战 EA</Text>
              <Text style={[styles.pageSubtitle, isDesktop && styles.pageSubtitleDesktop, { color: colors.muted }]}>
                留下您的联系方式，系统将自动为您发送一款经过实盘验证的精选 EA 策略
              </Text>
              {isDesktop && (
                <View style={styles.heroAuditPanel}>
                  {[
                    ["实盘筛选", "180D+"],
                    ["部署指导", "1:1"],
                    ["策略顾问", "在线"],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.heroAuditRow}>
                      <Text style={styles.heroAuditLabel}>{label}</Text>
                      <Text style={styles.heroAuditValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 核心订阅卡片 - 玻璃拟态 */}
            <FadeInView delay={50}>
              <View style={[styles.cardWrapper, isDesktop && styles.subscribeCardWrapperDesktop]}>
                <GlassCard intensity="strong" accentColor={colors.primary} highlight style={[styles.subscribeCardInner, isDesktop && styles.subscribeCardInnerDesktop]}>
                  <View style={styles.subscribeHeader}>
                    <View style={styles.subscribeCodeBox}>
                      <Text style={styles.subscribeCodeText}>EA</Text>
                    </View>
                    <View style={styles.subscribeHeaderText}>
                      <Text style={[styles.subscribeTitle, { color: colors.foreground }]}>立即领取 EA 策略</Text>
                      <Text style={[styles.subscribeDesc, { color: colors.muted }]}>
                        提交联系方式后，我们将为您发送精选EA并提供部署指导
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.emailInputRow, !isDesktop && styles.emailInputRowMobile]}>
                    <TextInput
                      ref={inputRef}
                      value={contactInput}
                      onChangeText={(t) => { setContactInput(t); setSubscribeMsg(null); }}
                      placeholder="请输入微信号 / QQ / 邮箱"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSubscribe}
                      blurOnSubmit={false}
                      onFocus={() => { isInputFocused.current = true; }}
                      onBlur={() => { isInputFocused.current = false; }}
                      style={[styles.emailInput, { backgroundColor: colors.background + "90", borderColor: colors.border, color: colors.foreground }]}
                      // @ts-ignore
                      {...inputProps}
                    />
                    <TouchableOpacity
                      onPress={handleSubscribe}
                      disabled={isSubmitting}
                      activeOpacity={0.8}
                      style={[styles.subscribeBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
                      // @ts-ignore

                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.subscribeBtnText}>立即领取</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* 推荐微信提示 */}
                  <Text style={[styles.contactTip, { color: "rgba(191,219,254,0.78)" }]}>
                    * 推荐留下微信号，我们的策略顾问将为您提供 1 对 1 的 EA 部署指导
                  </Text>

                  {subscribeMsg && (
                    <View style={[styles.msgBox, { backgroundColor: subscribeMsg.type === "success" ? colors.success + "18" : colors.error + "18" }]}>
                      <Text style={{ color: subscribeMsg.type === "success" ? colors.success : colors.error, fontSize: 13 }}>
                        {subscribeMsg.type === "success" ? "提交成功：" : "提交失败："}{subscribeMsg.text}
                      </Text>
                    </View>
                  )}

                  {subscriberCountQuery.data != null && (
                    <Text style={[styles.subscriberCount, { color: colors.muted }]}>
                      已有 {subscriberCountQuery.data} 位用户领取
                    </Text>
                  )}
                </GlassCard>
              </View>
            </FadeInView>
          </View>

          {/* 订阅权益 */}
          <FadeInView delay={100}>
            <View style={styles.dataSection}>
              <Text style={[styles.dataSectionTitle, { color: colors.foreground }]}>领取权益</Text>
              <View style={[styles.benefitsGrid, isDesktop && styles.benefitsGridDesktop]}>
                {SUBSCRIBE_BENEFITS.map((item, i) => (
                  <GlassCard key={i} intensity="subtle" style={[styles.benefitCardInner, isDesktop && styles.benefitCardInnerDesktop]}>
                    <View style={styles.benefitIconBox}>
                      <Text style={styles.benefitIconText}>{item.icon}</Text>
                    </View>
                    <View style={styles.benefitContent}>
                      <Text style={[styles.benefitTitle, { color: colors.foreground }]}>{item.title}</Text>
                      <Text style={[styles.benefitDesc, { color: colors.muted }]}>{item.desc}</Text>
                    </View>
                  </GlassCard>
                ))}
              </View>
            </View>
          </FadeInView>

          {/* ===== EA市场数据分析 ===== */}
          <FadeInView delay={200}>
            <View style={styles.dataSection}>
              <Text style={[styles.dataSectionTitle, { color: colors.foreground }]}>EA市场数据洞察</Text>
              <Text style={[styles.dataSectionSub, { color: colors.muted }]}>
                为什么90%的EA都会亏钱？数据告诉你答案
              </Text>

              <GlassCard intensity="medium" style={styles.dataCardInner}>
                <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>EA亏损原因分布</Text>
                {EA_MARKET_DATA.map((item, i) => (
                  <View key={i} style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.barFill, { width: `${item.pct}%` as any, backgroundColor: item.color }]} />
                    </View>
                    <Text style={[styles.barPct, { color: colors.muted }]}>{item.pct}%</Text>
                  </View>
                ))}
                <Text style={[styles.dataSource, { color: colors.muted }]}>
                  数据来源：EAXAU 数据库 200+ EA策略分析
                </Text>
              </GlassCard>
            </View>
          </FadeInView>

          {/* ===== EAXAU 筛选标准 ===== */}
          <FadeInView delay={300}>
            <View style={styles.dataSection}>
              <Text style={[styles.dataSectionTitle, { color: colors.foreground }]}>EAXAU 筛选标准</Text>
              <Text style={[styles.dataSectionSub, { color: colors.muted }]}>
                我们用严格的审核机制，为你过滤掉虚假宣传和高风险EA
              </Text>
              <View style={[styles.criteriaGrid, isDesktop && styles.criteriaGridDesktop]}>
                {SCREENING_CRITERIA.map((item, i) => (
                  <GlassCard key={i} intensity="subtle" style={[styles.criteriaCardInner, isDesktop && styles.criteriaCardInnerDesktop]}>
                    <View style={styles.criteriaIconBox}>
                      <Text style={styles.criteriaIconText}>{item.icon}</Text>
                    </View>
                    <View style={styles.criteriaContent}>
                      <Text style={[styles.criteriaLabel, { color: colors.foreground }]}>{item.label}</Text>
                      <Text style={[styles.criteriaDesc, { color: colors.muted }]}>{item.desc}</Text>
                    </View>
                  </GlassCard>
                ))}
              </View>
            </View>
          </FadeInView>

          {/* ===== 底部引导 ===== */}
          <FadeInView delay={400}>
            <View style={styles.dataSection}>
              <GlassCard intensity="medium" accentColor={colors.primary} highlight style={styles.guideInner}>
                <Text style={[styles.guideTitle, { color: colors.foreground }]}>好策略，配好平台</Text>
                <Text style={[styles.guideDesc, { color: colors.muted }]}>
                  EAXAU 不仅帮你筛选优质EA策略，还为你匹配最适合的合规交易平台。告诉我们你的需求，我们帮你做好功课。
                </Text>
                <TouchableOpacity
                  onPress={handleConsult}
                  activeOpacity={0.8}
                  style={[styles.guideBtn, { backgroundColor: colors.primary }]}
                  // @ts-ignore
                  
                >
                  <Text style={styles.guideBtnText}>免费咨询平台匹配方案 →</Text>
                </TouchableOpacity>
              </GlassCard>
            </View>
          </FadeInView>

          {/* 通知公告列表 */}
          {notifications.length > 0 && (
            <FadeInView delay={500}>
              <View style={styles.section}>
                <Text style={[styles.sectionTitleInner, { color: colors.foreground }]}>最新公告</Text>
                {notifications.map((n) => (
                  <NotifCard key={n.id} item={n} colors={colors} />
                ))}
              </View>
            </FadeInView>
          )}

          {/* 自定义内容区域 */}
          {contents.length > 0 && (
            <FadeInView delay={600}>
              <View>
                <Text style={[styles.sectionTitleInner, { color: colors.foreground }]}>详细信息</Text>
                {contents.map((item) => (
                  <View key={item.id} style={styles.cardWrapper}>
                    <GlassCard intensity="subtle" style={styles.contentCardInner}>
                      <View style={styles.contentCardHeader}>
                        <View style={styles.contentCodeBox}>
                          <Text style={styles.contentCodeText}>{item.sectionKey.slice(0, 3).toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.contentCardTitle, { color: colors.foreground }]}>{item.title}</Text>
                      </View>
                      <Text style={[styles.contentCardBody, { color: colors.muted }]}>{item.content}</Text>
                    </GlassCard>
                  </View>
                ))}
              </View>
            </FadeInView>
          )}

          {/* 常驻快捷导航 */}
          <QuickNav />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContainer: { paddingBottom: 16 },
  listContainerDesktop: {
    width: "100%",
    maxWidth: 1260,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 42,
  },

  // 通知栏
  notifBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
    height: 42,
  },
  notifBarIcon: { color: "#D8BC83", fontSize: 10, fontWeight: "900", marginRight: 10 },
  notifBarTextBox: { flex: 1, overflow: "hidden", height: 20 },
  notifBarText: { fontSize: 13 },
  notifDots: { flexDirection: "row", gap: 4, marginLeft: 8 },
  notifDot: { width: 5, height: 5, borderRadius: 2.5 },

  subscribeHero: {},
  subscribeHeroDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    marginBottom: 18,
  },

  // Header
  headerSection: { paddingHorizontal: 16, marginTop: 12, marginBottom: 16 },
  headerSectionDesktop: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 20,
    paddingVertical: 19,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    backgroundColor: "rgba(9,15,28,0.82)",
  },
  headerKicker: {
    color: "#C9A96E",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 10,
  },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  pageTitleDesktop: {
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    marginBottom: 8,
  },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },
  pageSubtitleDesktop: {
    maxWidth: 560,
    fontSize: 15,
    lineHeight: 24,
  },
  heroAuditPanel: {
    marginTop: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    backgroundColor: "rgba(2,6,23,0.38)",
    overflow: "hidden",
  },
  heroAuditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.10)",
  },
  heroAuditLabel: {
    color: "rgba(226,232,240,0.76)",
    fontSize: 12,
    fontWeight: "700",
  },
  heroAuditValue: {
    color: "#D8BC83",
    fontSize: 13,
    fontWeight: "900",
  },

  // Card wrapper
  cardWrapper: { marginHorizontal: 16, marginBottom: 16 },
  subscribeCardWrapperDesktop: {
    width: 392,
    marginHorizontal: 0,
    marginBottom: 0,
  },

  // Subscribe card inner
  subscribeCardInner: { padding: 20 },
  subscribeCardInnerDesktop: {
    minHeight: 236,
    justifyContent: "center",
  },
  subscribeHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  subscribeCodeBox: {
    width: 48,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.28)",
    backgroundColor: "rgba(216,188,131,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeCodeText: { color: "#D8BC83", fontSize: 14, fontWeight: "900" },
  subscribeHeaderText: { flex: 1 },
  subscribeTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  subscribeDesc: { fontSize: 13, lineHeight: 18 },
  emailInputRow: { flexDirection: "row", gap: 10 },
  emailInputRowMobile: {
    flexDirection: "column",
  },
  emailInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  subscribeBtn: { borderRadius: 6, paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  subscribeBtnText: { color: "#07111F", fontWeight: "900", fontSize: 15 },
  contactTip: { fontSize: 12, marginTop: 10, fontStyle: "italic", lineHeight: 18 },
  msgBox: { marginTop: 10, padding: 10, borderRadius: 8 },
  subscriberCount: { marginTop: 10, fontSize: 12, textAlign: "center" },

  // Benefits
  benefitsGrid: { gap: 8 },
  benefitsGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  benefitCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  benefitCardInnerDesktop: {
    width: "24%" as any,
    minHeight: 104,
    alignItems: "flex-start",
  },
  benefitIconBox: { width: 46, height: 34, borderRadius: 4, borderWidth: 1, borderColor: "rgba(216,188,131,0.24)", backgroundColor: "rgba(216,188,131,0.10)", alignItems: "center", justifyContent: "center" },
  benefitIconText: { color: "#D8BC83", fontSize: 10, fontWeight: "900" },
  benefitContent: { flex: 1 },
  benefitTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  benefitDesc: { fontSize: 12, lineHeight: 18 },

  // Data section
  dataSection: { paddingHorizontal: 16, marginBottom: 20 },
  dataSectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  dataSectionSub: { fontSize: 13, marginBottom: 12, lineHeight: 20 },
  dataCardInner: { padding: 16 },
  dataCardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  barLabel: { width: 80, fontSize: 12, fontWeight: "600" },
  barTrack: { flex: 1, height: 16, borderRadius: 8, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 8 },
  barPct: { width: 35, fontSize: 12, fontWeight: "700", textAlign: "right" },
  dataSource: { fontSize: 10, marginTop: 8, textAlign: "right", fontStyle: "italic" },

  // Screening criteria
  criteriaGrid: {},
  criteriaGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  criteriaCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  criteriaCardInnerDesktop: {
    width: "49%" as any,
    marginBottom: 0,
    minHeight: 84,
  },
  criteriaIconBox: { width: 46, height: 34, borderRadius: 4, borderWidth: 1, borderColor: "rgba(216,188,131,0.24)", backgroundColor: "rgba(216,188,131,0.10)", alignItems: "center", justifyContent: "center" },
  criteriaIconText: { color: "#D8BC83", fontSize: 10, fontWeight: "900" },
  criteriaContent: { flex: 1 },
  criteriaLabel: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  criteriaDesc: { fontSize: 12, lineHeight: 18 },

  // Cooperation guide
  guideInner: { padding: 20, alignItems: "center" },
  guideTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  guideDesc: { fontSize: 13, lineHeight: 22, textAlign: "center", marginBottom: 16 },
  guideBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 6 },
  guideBtnText: { color: "#07111F", fontSize: 14, fontWeight: "900" },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitleInner: { fontSize: 18, fontWeight: "800", marginBottom: 12, paddingHorizontal: 16 },

  // Notification card
  notifCard: { padding: 14, marginBottom: 10 },
  notifCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeCode: { width: 44, height: 30, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(2,6,23,0.22)" },
  typeCodeText: { fontSize: 9, fontWeight: "900" },
  notifCardTitle: { fontSize: 15, fontWeight: "700", flex: 1 },
  expandArrow: { fontSize: 10 },
  notifCardPreview: { fontSize: 13, marginTop: 4, marginLeft: 26 },
  notifCardContent: { fontSize: 14, lineHeight: 22, marginTop: 10, marginLeft: 26 },
  notifLinkBtn: { marginTop: 10, marginLeft: 26, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignSelf: "flex-start" },
  notifLinkText: { fontSize: 13, fontWeight: "700" },

  // Content card
  contentCardInner: { padding: 18 },
  contentCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  contentCodeBox: { width: 46, height: 34, borderRadius: 4, borderWidth: 1, borderColor: "rgba(216,188,131,0.24)", backgroundColor: "rgba(216,188,131,0.10)", alignItems: "center", justifyContent: "center" },
  contentCodeText: { color: "#D8BC83", fontSize: 10, fontWeight: "900" },
  contentCardTitle: { fontSize: 17, fontWeight: "700", flex: 1 },
  contentCardBody: { fontSize: 14, lineHeight: 22 },
});
