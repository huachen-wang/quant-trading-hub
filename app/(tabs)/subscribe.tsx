import { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { LinearGradient } from "expo-linear-gradient";

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
    promo: "#F59E0B",
  };

  const accentColor = typeColors[item.type] || colors.primary;

  const toggleExpand = () => {
    const toValue = expanded ? 0 : 1;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue,
      duration: 250,
      useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={toggleExpand}
      style={[styles.notifCard, { backgroundColor: colors.surface, borderLeftColor: accentColor }]}
    >
      <View style={styles.notifCardHeader}>
        <Text style={{ fontSize: 18 }}>{item.icon || "📌"}</Text>
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
              style={[styles.notifLinkBtn, { backgroundColor: accentColor + "15" }]}
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
    </TouchableOpacity>
  );
}

// 入场动画
function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
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
  { label: "马丁/网格", pct: 25, color: "#f97316" },
  { label: "风控缺失", pct: 20, color: "#eab308" },
  { label: "高频剥头皮", pct: 12, color: "#7c3aed" },
  { label: "参数敏感", pct: 8, color: "#6b7280" },
];

// 量化军火库筛选标准
const SCREENING_CRITERIA = [
  { icon: "✅", label: "180天+实盘验证", desc: "所有策略必须提供不少于180天的真实实盘数据" },
  { icon: "📉", label: "最大回撤<25%", desc: "严格风控标准，剔除高风险策略" },
  { icon: "📊", label: "夏普比率>1.0", desc: "单位风险获得的回报必须达标" },
  { icon: "💰", label: "盈利因子>1.5", desc: "总盈利至少是总亏损的1.5倍" },
];

// 订阅权益
const SUBSCRIBE_BENEFITS = [
  { icon: "🔔", title: "新策略上架通知", desc: "第一时间获取通过审核的优质EA策略" },
  { icon: "📈", title: "行业数据报告", desc: "定期推送EA市场分析和趋势洞察" },
  { icon: "🎁", title: "合作激励动态", desc: "最新合作活动、返利计划等信息" },
  { icon: "💡", title: "量化交易干货", desc: "EA避坑指南、风控技巧、实战经验" },
];

export default function SubscribeScreen() {
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const isEmailFocused = useRef(false);

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
      if (isEmailFocused.current || isAnimating.current) return;
      isAnimating.current = true;

      Animated.timing(slideAnim, {
        toValue: -1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentNotifIdx((prev) => (prev + 1) % notifications.length);
        slideAnim.setValue(1);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
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

  const handleSubscribe = async () => {
    if (!email.trim()) {
      setSubscribeMsg({ type: "error", text: "请输入邮箱地址" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setSubscribeMsg({ type: "error", text: "请输入有效的邮箱地址" });
      return;
    }

    setIsSubmitting(true);
    setSubscribeMsg(null);
    try {
      const result = await subscribeMutation.mutateAsync({ email: email.trim() });
      if (result?.success) {
        setSubscribeMsg({ type: "success", text: result.message || "订阅成功！" });
        setEmail("");
        subscriberCountQuery.refetch();
      } else {
        setSubscribeMsg({ type: "error", text: result?.message || "订阅失败" });
      }
    } catch (error: any) {
      setSubscribeMsg({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLearnMore = () => {
    Linking.openURL("https://www.eaxau.com");
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

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.listContainer}
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
              <Text style={styles.notifBarIcon}>📢</Text>
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

          {/* 页面标题 */}
          <View style={styles.headerSection}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>订阅中心</Text>
            <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
              订阅获取最新策略更新、行业资讯和合作动态
            </Text>
          </View>

          {/* 邮箱订阅卡片 */}
          <FadeInView delay={50}>
            <View style={[styles.subscribeCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
              <View style={styles.subscribeHeader}>
                <Text style={{ fontSize: 28 }}>📧</Text>
                <View style={styles.subscribeHeaderText}>
                  <Text style={[styles.subscribeTitle, { color: colors.foreground }]}>邮箱订阅</Text>
                  <Text style={[styles.subscribeDesc, { color: colors.muted }]}>
                    订阅后将收到最新策略上架、激励活动、行业分析等通知
                  </Text>
                </View>
              </View>

              <View style={styles.emailInputRow}>
                <TextInput
                  ref={emailInputRef}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setSubscribeMsg(null); }}
                  placeholder="请输入您的邮箱地址"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubscribe}
                  blurOnSubmit={false}
                  onFocus={() => { isEmailFocused.current = true; }}
                  onBlur={() => { isEmailFocused.current = false; }}
                  style={[styles.emailInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />
                <TouchableOpacity
                  onPress={handleSubscribe}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                  style={[styles.subscribeBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.subscribeBtnText}>订阅</Text>
                  )}
                </TouchableOpacity>
              </View>

              {subscribeMsg && (
                <View style={[styles.msgBox, { backgroundColor: subscribeMsg.type === "success" ? colors.success + "15" : colors.error + "15" }]}>
                  <Text style={{ color: subscribeMsg.type === "success" ? colors.success : colors.error, fontSize: 13 }}>
                    {subscribeMsg.type === "success" ? "✅ " : "❌ "}{subscribeMsg.text}
                  </Text>
                </View>
              )}

              {subscriberCountQuery.data != null && (
                <Text style={[styles.subscriberCount, { color: colors.muted }]}>
                  已有 {subscriberCountQuery.data} 位用户订阅
                </Text>
              )}
            </View>
          </FadeInView>

          {/* 订阅权益 */}
          <FadeInView delay={100}>
            <View style={styles.dataSection}>
              <Text style={[styles.dataSectionTitle, { color: colors.foreground }]}>订阅权益</Text>
              <View style={styles.benefitsGrid}>
                {SUBSCRIBE_BENEFITS.map((item, i) => (
                  <View key={i} style={[styles.benefitCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={styles.benefitIcon}>{item.icon}</Text>
                    <View style={styles.benefitContent}>
                      <Text style={[styles.benefitTitle, { color: colors.foreground }]}>{item.title}</Text>
                      <Text style={[styles.benefitDesc, { color: colors.muted }]}>{item.desc}</Text>
                    </View>
                  </View>
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

              {/* 亏损原因可视化 */}
              <View style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>EA亏损原因分布</Text>
                {EA_MARKET_DATA.map((item, i) => (
                  <View key={i} style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${item.pct}%` as any, backgroundColor: item.color }]} />
                    </View>
                    <Text style={[styles.barPct, { color: colors.muted }]}>{item.pct}%</Text>
                  </View>
                ))}
                <Text style={[styles.dataSource, { color: colors.muted }]}>
                  数据来源：量化军火库数据库 200+ EA策略分析
                </Text>
              </View>
            </View>
          </FadeInView>

          {/* ===== 量化军火库筛选标准 ===== */}
          <FadeInView delay={300}>
            <View style={styles.dataSection}>
              <Text style={[styles.dataSectionTitle, { color: colors.foreground }]}>量化军火库筛选标准</Text>
              <Text style={[styles.dataSectionSub, { color: colors.muted }]}>
                我们用严格的审核机制，为你过滤掉虚假宣传和高风险EA
              </Text>
              {SCREENING_CRITERIA.map((item, i) => (
                <View key={i} style={[styles.criteriaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={styles.criteriaIcon}>{item.icon}</Text>
                  <View style={styles.criteriaContent}>
                    <Text style={[styles.criteriaLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <Text style={[styles.criteriaDesc, { color: colors.muted }]}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </FadeInView>

          {/* ===== 底部引导 - 软性 ===== */}
          <FadeInView delay={400}>
            <View style={styles.dataSection}>
              <View style={[styles.cooperationGuide, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
                <Text style={[styles.guideTitle, { color: colors.foreground }]}>选好策略，更要选好平台</Text>
                <Text style={[styles.guideDesc, { color: colors.muted }]}>
                  量化军火库帮你筛选优质EA策略，同时为你对接顶级合规交易平台。MM全牌照监管、极速出入金、丰厚激励回报，让你的量化交易事半功倍。
                </Text>
                <TouchableOpacity
                  onPress={handleLearnMore}
                  activeOpacity={0.8}
                  style={styles.guideBtn}
                >
                  <Text style={styles.guideBtnText}>了解合作详情 →</Text>
                </TouchableOpacity>
              </View>
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
                  <View key={item.id} style={[styles.contentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.contentCardHeader}>
                      <Text style={{ fontSize: 24 }}>{item.icon || "📄"}</Text>
                      <Text style={[styles.contentCardTitle, { color: colors.foreground }]}>{item.title}</Text>
                    </View>
                    <Text style={[styles.contentCardBody, { color: colors.muted }]}>{item.content}</Text>
                  </View>
                ))}
              </View>
            </FadeInView>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContainer: { paddingBottom: 16 },

  // 通知栏
  notifBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
    height: 42,
  },
  notifBarIcon: { fontSize: 16, marginRight: 8 },
  notifBarTextBox: { flex: 1, overflow: "hidden", height: 20 },
  notifBarText: { fontSize: 13 },
  notifDots: {
    flexDirection: "row",
    gap: 4,
    marginLeft: 8,
  },
  notifDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // Header
  headerSection: { paddingHorizontal: 16, marginTop: 12, marginBottom: 16 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },

  // Subscribe card
  subscribeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  subscribeHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  subscribeHeaderText: { flex: 1 },
  subscribeTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  subscribeDesc: { fontSize: 13, lineHeight: 18 },
  emailInputRow: { flexDirection: "row", gap: 10 },
  emailInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  subscribeBtn: { borderRadius: 10, paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  subscribeBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  msgBox: { marginTop: 10, padding: 10, borderRadius: 8 },
  subscriberCount: { marginTop: 10, fontSize: 12, textAlign: "center" },

  // Benefits
  benefitsGrid: {
    gap: 8,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
    gap: 12,
  },
  benefitIcon: {
    fontSize: 24,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 12,
    lineHeight: 18,
  },

  // Data section
  dataSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  dataSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  dataSectionSub: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 20,
  },
  dataCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 16,
  },
  dataCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  barLabel: {
    width: 80,
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

  // Screening criteria
  criteriaCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  criteriaIcon: {
    fontSize: 24,
  },
  criteriaContent: {
    flex: 1,
  },
  criteriaLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  criteriaDesc: {
    fontSize: 12,
    lineHeight: 18,
  },

  // Cooperation guide
  cooperationGuide: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  guideTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  guideDesc: {
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  guideBtn: {
    backgroundColor: "#1e40af",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  guideBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitleInner: { fontSize: 18, fontWeight: "800", marginBottom: 12, paddingHorizontal: 16 },

  // Notification card
  notifCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  notifCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notifCardTitle: { fontSize: 15, fontWeight: "700", flex: 1 },
  expandArrow: { fontSize: 10 },
  notifCardPreview: { fontSize: 13, marginTop: 4, marginLeft: 26 },
  notifCardContent: { fontSize: 14, lineHeight: 22, marginTop: 10, marginLeft: 26 },
  notifLinkBtn: {
    marginTop: 10,
    marginLeft: 26,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  notifLinkText: { fontSize: 13, fontWeight: "700" },

  // Content card
  contentCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  contentCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  contentCardTitle: { fontSize: 17, fontWeight: "700", flex: 1 },
  contentCardBody: { fontSize: 14, lineHeight: 22 },
});
