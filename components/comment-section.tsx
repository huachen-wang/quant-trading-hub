import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

interface CommentSectionProps {
  strategyId: number;
}

export function CommentSection({ strategyId }: CommentSectionProps) {
  const colors = useColors();
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: comments, isLoading, refetch } = trpc.anonymousComments.list.useQuery({
    strategyId,
    limit: 50,
  });

  const createCommentMutation = trpc.anonymousComments.create.useMutation({
    onSuccess: () => {
      setNickname("");
      setContent("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
      refetch();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      Alert.alert("提交失败", error.message);
    },
  });

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert("提示", "请输入留言内容");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setIsSubmitting(true);
    try {
      await createCommentMutation.mutateAsync({
        strategyId,
        nickname: nickname.trim() || undefined,
        content: content.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  return (
    <View style={styles.container}>
      {/* 标题 */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>💬 用户评价</Text>

      {/* 审核成功提示 */}
      {showSuccess && (
        <View style={[styles.successBanner, { backgroundColor: colors.success + "15" }]}>
          <Text style={[styles.successText, { color: colors.success }]}>
            ✅ 留言已提交，审核通过后将显示在评论区
          </Text>
        </View>
      )}

      {/* 发表留言 - 无需登录 */}
      <View style={[styles.inputCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.inputHint, { color: colors.muted }]}>匿名留言，无需登录</Text>
        <TextInput
          style={[styles.nicknameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          placeholder="昵称（可选，默认匿名）"
          placeholderTextColor={colors.muted}
          value={nickname}
          onChangeText={setNickname}
          maxLength={100}
        />
        <TextInput
          style={[styles.contentInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          placeholder="分享你的使用体验..."
          placeholderTextColor={colors.muted}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !content.trim()}
          activeOpacity={0.8}
          style={[
            styles.submitBtn,
            { backgroundColor: isSubmitting || !content.trim() ? colors.muted : colors.primary },
          ]}
        >
          <Text style={styles.submitBtnText}>
            {isSubmitting ? "提交中..." : "发表评价"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 留言列表 */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : comments && comments.length > 0 ? (
        <FlatList
          data={comments}
          scrollEnabled={false}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.commentCard, { backgroundColor: colors.surface }]}>
              <View style={styles.commentHeader}>
                <Text style={[styles.commentNickname, { color: colors.foreground }]}>
                  {item.nickname || "匿名用户"}
                </Text>
                <Text style={[styles.commentTime, { color: colors.muted }]}>
                  {formatDate(String(item.createdAt))}
                </Text>
              </View>
              <Text style={[styles.commentContent, { color: colors.foreground }]}>
                {item.content}
              </Text>
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>暂无评价，快来抢沙发吧~</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
  successBanner: { borderRadius: 12, padding: 12, marginBottom: 12 },
  successText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  inputCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  inputHint: { fontSize: 12, marginBottom: 10 },
  nicknameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  contentInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
    minHeight: 80,
  },
  submitBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  loadingBox: { paddingVertical: 32 },
  commentCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  commentNickname: { fontSize: 15, fontWeight: "600" },
  commentTime: { fontSize: 12 },
  commentContent: { fontSize: 15, lineHeight: 22 },
  emptyBox: { paddingVertical: 32 },
  emptyText: { textAlign: "center", fontSize: 15 },
});
