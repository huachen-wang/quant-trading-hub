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
  const animHeight = useRef(new Animated.Value(0)).current;
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
    Animated.parallel([
      Animated.spring(animHeight, {
        toValue,
        useNativeDriver: false,
        friction: 8,
        tension: 60,
      }),
      Animated.timing(rotateAnim, {
        toValue,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
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

      // 滑出动画
      Animated.timing(slideAnim, {
        toValue: -1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // 切换到下一条
        setCurrentNotifIdx((prev) => (prev + 1) % notifications.length);
        // 从下方准备进入
        slideAnim.setValue(1);
        // 滑入动画
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
          {/* 通知栏 - 顶部滑动轮播公告 */}
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

          {/* 页面标题 - 去掉多余emoji */}
          <View style={styles.headerSection}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>订阅中心</Text>
            <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
              订阅获取最新策略更新、行业资讯和技术支持
            </Text>
          </View>

          {/* 邮箱订阅卡片 */}
          <View style={[styles.subscribeCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
            <View style={styles.subscribeHeader}>
              <Text style={{ fontSize: 28 }}>📧</Text>
              <View style={styles.subscribeHeaderText}>
                <Text style={[styles.subscribeTitle, { color: colors.foreground }]}>邮箱订阅</Text>
                <Text style={[styles.subscribeDesc, { color: colors.muted }]}>
                  订阅后将收到最新策略上架、优惠活动等通知
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

          {/* 通知公告列表 - 可展开/收起 */}
          {notifications.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>最新公告</Text>
              {notifications.map((n) => (
                <NotifCard key={n.id} item={n} colors={colors} />
              ))}
            </View>
          )}

          {/* 自定义内容区域 */}
          {contents.length > 0 && (
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>详细信息</Text>
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
  headerSection: { paddingHorizontal: 16, marginTop: 12, marginBottom: 20 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },

  // Subscribe card
  subscribeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 24,
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

  // Section
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: "800", marginBottom: 12, paddingHorizontal: 16 },

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
