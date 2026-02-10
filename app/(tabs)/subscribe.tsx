import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

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

export default function SubscribeScreen() {
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 获取页面内容
  const pageContentsQuery = trpc.pageContents.get.useQuery({ pageKey: "subscribe" });
  const subscriberCountQuery = trpc.subscriptions.count.useQuery();
  const subscribeMutation = trpc.subscriptions.subscribe.useMutation();

  const contents = (pageContentsQuery.data || []) as PageContentItem[];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pageContentsQuery.refetch();
    await subscriberCountQuery.refetch();
    setRefreshing(false);
  }, []);

  const handleSubscribe = async () => {
    if (!email.trim()) {
      setSubscribeMsg({ type: "error", text: "请输入邮箱地址" });
      return;
    }

    // 简单的邮箱格式验证
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

  const renderHeader = () => (
    <View>
      {/* 页面标题 */}
      <View style={styles.headerSection}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>📬 订阅与支持</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
          订阅获取最新策略资讯，或联系我们获取技术支持
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
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setSubscribeMsg(null);
            }}
            placeholder="请输入您的邮箱地址"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubscribe}
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

      {/* 内容区域标题 */}
      {contents.length > 0 && (
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>详细信息</Text>
      )}
    </View>
  );

  const renderContentCard = ({ item }: { item: PageContentItem }) => (
    <View style={[styles.contentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.contentCardHeader}>
        <Text style={{ fontSize: 24 }}>{item.icon || "📄"}</Text>
        <Text style={[styles.contentCardTitle, { color: colors.foreground }]}>{item.title}</Text>
      </View>
      <Text style={[styles.contentCardBody, { color: colors.muted }]}>{item.content}</Text>
    </View>
  );

  if (pageContentsQuery.isLoading && !pageContentsQuery.data) {
    return (
      <ScreenContainer className="bg-background">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <FlatList
        data={contents}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderContentCard}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
  },
  headerSection: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  subscribeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  subscribeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  subscribeHeaderText: {
    flex: 1,
  },
  subscribeTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  subscribeDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  emailInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  emailInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  subscribeBtn: {
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  subscribeBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  msgBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  subscriberCount: {
    marginTop: 10,
    fontSize: 12,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  contentCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
  },
  contentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  contentCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
  },
  contentCardBody: {
    fontSize: 14,
    lineHeight: 22,
  },
});
