import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { AppColors, StrategyComment } from "./types";

type AdminNotesSectionProps = {
  colors: AppColors;
  comments?: StrategyComment[];
  isAdmin: boolean;
  commentText: string;
  isPosting: boolean;
  onChangeCommentText: (value: string) => void;
  onAddComment: () => void;
  onDeleteComment: (commentId: number) => void;
};

export function AdminNotesSection({
  colors,
  comments,
  isAdmin,
  commentText,
  isPosting,
  onChangeCommentText,
  onAddComment,
  onDeleteComment,
}: AdminNotesSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>备注说明</Text>

      {isAdmin && (
        <View style={[styles.adminInput, { backgroundColor: colors.surface }]}>
          <TextInput
            value={commentText}
            onChangeText={onChangeCommentText}
            placeholder="添加备注或说明..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            style={[styles.textInput, { color: colors.foreground }]}
          />
          <TouchableOpacity
            onPress={onAddComment}
            disabled={!commentText.trim() || isPosting}
            style={[styles.postBtn, { backgroundColor: commentText.trim() ? colors.primary : colors.border }]}
            activeOpacity={0.8}
          >
            {isPosting ? (
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
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              {isAdmin && (
                <TouchableOpacity onPress={() => onDeleteComment(comment.id)} style={{ marginLeft: 8 }}>
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
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
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
