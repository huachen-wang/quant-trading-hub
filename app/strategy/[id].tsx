import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { EquityCurveChart } from "@/components/equity-curve-chart";
import { CommentSection } from "@/components/comment-section";
import { SubscribeModal } from "@/components/subscribe-modal";

export default function StrategyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [commentText, setCommentText] = useState("");
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const strategyId = parseInt(id || "0");
  const isDesktop = Platform.OS === "web" && width >= 768;
  const maxContentWidth = isDesktop ? 720 : width;

  const { data: strategy, isLoading } = trpc.strategies.detail.useQuery({ id: strategyId });
  const { data: comments, refetch: refetchComments } = trpc.comments.list.useQuery({ strategyId });
  const { data: backtestData } = trpc.strategies.backtestData.useQuery({ strategyId });

  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      refetchComments();
    },
  });

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => refetchComments(),
  });

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    createCommentMutation.mutate({ strategyId, content: commentText.trim() });
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert("删除评论", "确定要删除这条评论吗？", [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => deleteCommentMutation.mutate({ id: commentId }) },
    ]);
  };

  const handleDownload = () => {
    if (strategy?.downloadUrl) {
      Linking.openURL(strategy.downloadUrl);
    }
  };

  const handleContact = (type: "telegram" | "qq") => {
    if (type === "telegram" && strategy?.telegramGroup) {
      Linking.openURL(strategy.telegramGroup);
    } else if (type === "qq" && strategy?.qqGroup) {
      Alert.alert("QQ群", `QQ群号: ${strategy.qqGroup}`, [{ text: "确定" }]);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!strategy) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-lg text-muted">策略不存在</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 bg-primary rounded-full"
        >
          <Text className="text-background font-semibold">返回</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const gradientColors: readonly [string, string, ...string[]] =
    strategy.platform === "MT4" ? ["#1E3A8A", "#3B82F6"] : ["#7C3AED", "#A78BFA"];

  const returnValue = parseFloat(strategy.totalReturn || "0");
  const isPositive = returnValue >= 0;
  const isAdmin = user?.role === "admin";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <SubscribeModal
        visible={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        strategyTitle={strategy.title}
      />
      <ScrollView className="flex-1" contentContainerStyle={isDesktop ? styles.desktopContainer : undefined}>
        <View style={isDesktop ? [styles.desktopContent, { maxWidth: maxContentWidth }] : undefined}>
          {/* 顶部导航栏 */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: colors.surface }]}
              activeOpacity={0.7}
            >
              <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSubscribeModal(true)}
              style={[styles.subscribeTopBtn, { backgroundColor: colors.primary + "15" }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>📬</Text>
              <Text style={[styles.subscribeTopText, { color: colors.primary }]}>获取支持</Text>
            </TouchableOpacity>
          </View>

          {/* 封面 - 紧凑设计 */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.coverGradient, isDesktop && styles.coverDesktop]}
          >
            <Text style={styles.coverEmoji}>📈</Text>
            <View style={[styles.platformBadge, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
              <Text style={[styles.platformText, { color: gradientColors[1] }]}>{strategy.platform}</Text>
            </View>
          </LinearGradient>

          {/* 标题和描述 */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: colors.foreground }]}>{strategy.title}</Text>
            <Text style={[styles.description, { color: colors.muted }]}>{strategy.description}</Text>
          </View>

          {/* 核心数据 - 3列紧凑布局 */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>实盘数据</Text>
            <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>总收益率</Text>
                  <Text style={[styles.statValue, { color: isPositive ? colors.success : colors.error }]}>
                    {isPositive ? "+" : ""}{strategy.totalReturn}%
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>胜率</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{strategy.winRate}%</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>最大回撤</Text>
                  <Text style={[styles.statValue, { color: colors.error }]}>{strategy.maxDrawdown}%</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 回测数据 */}
          {backtestData && backtestData.length > 0 && (
            <View style={styles.section}>
              <EquityCurveChart data={backtestData} />
            </View>
          )}

          {/* 交易信息 - 紧凑横排 */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>交易信息</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>交易对</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{strategy.pairs}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>时间周期</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{strategy.timeframe}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 价格和操作 - 紧凑设计 */}
          <View style={styles.section}>
            <View style={[styles.actionCard, { backgroundColor: colors.surface }]}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={[styles.priceLabel, { color: colors.muted }]}>价格</Text>
                  {strategy.isFree ? (
                    <Text style={[styles.priceValue, { color: colors.success }]}>免费</Text>
                  ) : (
                    <Text style={[styles.priceValue, { color: "#F59E0B" }]}>¥{strategy.price}</Text>
                  )}
                </View>
                <View style={styles.priceRight}>
                  <Text style={[styles.downloadLabel, { color: colors.muted }]}>下载量</Text>
                  <Text style={[styles.downloadValue, { color: colors.foreground }]}>💾 {strategy.downloadCount}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleDownload}
                style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Text style={styles.downloadBtnText}>下载EA</Text>
              </TouchableOpacity>

              <View style={styles.contactRow}>
                {strategy.telegramGroup && (
                  <TouchableOpacity
                    onPress={() => handleContact("telegram")}
                    style={[styles.contactBtn, { backgroundColor: colors.primary + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.contactBtnText, { color: colors.primary }]}>Telegram</Text>
                  </TouchableOpacity>
                )}
                {strategy.qqGroup && (
                  <TouchableOpacity
                    onPress={() => handleContact("qq")}
                    style={[styles.contactBtn, { backgroundColor: colors.primary + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.contactBtnText, { color: colors.primary }]}>QQ群</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* 管理员备注区 */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>备注说明</Text>

            {isAdmin && (
              <View style={[styles.adminInput, { backgroundColor: colors.surface }]}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="添加备注或说明..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  style={[styles.textInput, { color: colors.foreground }]}
                />
                <TouchableOpacity
                  onPress={handleAddComment}
                  disabled={!commentText.trim() || createCommentMutation.isPending}
                  style={[styles.postBtn, { backgroundColor: commentText.trim() ? colors.primary : colors.border }]}
                  activeOpacity={0.8}
                >
                  {createCommentMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.postBtnText, { color: commentText.trim() ? "#fff" : colors.muted }]}>发布备注</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {comments && comments.length > 0 ? (
              comments.map((comment) => (
                <View key={comment.id} style={[styles.commentCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.commentHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.commentAuthor, { color: colors.foreground }]}>
                        {comment.user?.name || "管理员"}
                      </Text>
                      <Text style={[styles.commentDate, { color: colors.muted }]}>
                        {new Date(comment.createdAt).toLocaleDateString("zh-CN", {
                          year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => handleDeleteComment(comment.id)} style={{ marginLeft: 8 }}>
                        <IconSymbol name="trash" size={18} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.commentContent, { color: colors.foreground }]}>{comment.content}</Text>
                </View>
              ))
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.muted }}>暂无备注说明</Text>
              </View>
            )}
          </View>

          {/* 用户留言区 */}
          <View style={styles.section}>
            <CommentSection strategyId={strategyId} />
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  desktopContent: {
    width: "100%",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  subscribeTopText: {
    fontSize: 14,
    fontWeight: "600",
  },
  coverGradient: {
    marginHorizontal: 16,
    height: 140,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  coverDesktop: {
    height: 160,
  },
  coverEmoji: {
    fontSize: 48,
  },
  platformBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  platformText: {
    fontSize: 12,
    fontWeight: "700",
  },
  titleSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 32,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
  },
  statsCard: {
    borderRadius: 16,
    padding: 16,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionCard: {
    borderRadius: 16,
    padding: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  priceLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  priceRight: {
    alignItems: "flex-end",
  },
  downloadLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  downloadValue: {
    fontSize: 15,
  },
  downloadBtn: {
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  downloadBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  contactRow: {
    flexDirection: "row",
    gap: 10,
  },
  contactBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: "center",
  },
  contactBtnText: {
    fontWeight: "600",
    fontSize: 14,
  },
  adminInput: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  textInput: {
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  postBtn: {
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: "center",
  },
  postBtnText: {
    fontWeight: "600",
    fontSize: 14,
  },
  commentCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  commentDate: {
    fontSize: 12,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  emptyCard: {
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
  },
});
