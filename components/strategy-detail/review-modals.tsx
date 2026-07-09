import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { AppColors, StrategyReview } from "./types";
import { ReviewCard } from "./user-reviews-section";

type ReviewComposerModalProps = {
  visible: boolean;
  colors: AppColors;
  nickname: string;
  content: string;
  isSubmitting: boolean;
  showSuccess: boolean;
  onClose: () => void;
  onChangeNickname: (value: string) => void;
  onChangeContent: (value: string) => void;
  onSubmit: () => void;
};

export function ReviewComposerModal({
  visible,
  colors,
  nickname,
  content,
  isSubmitting,
  showSuccess,
  onClose,
  onChangeNickname,
  onChangeContent,
  onSubmit,
}: ReviewComposerModalProps) {
  const isDisabled = isSubmitting || !content.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.modalContent, { backgroundColor: colors.background }]}
        >
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>发表评价</Text>
          <Text style={[styles.modalSubtitle, { color: colors.muted }]}>匿名留言，无需登录</Text>

          {showSuccess && (
            <View style={[styles.successBanner, { backgroundColor: colors.success + "15" }]}>
              <Text style={[styles.successText, { color: colors.success }]}>
                评价已提交，审核通过后将显示
              </Text>
            </View>
          )}

          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            placeholder="昵称（可选，默认匿名）"
            placeholderTextColor={colors.muted}
            value={nickname}
            onChangeText={onChangeNickname}
            maxLength={100}
          />
          <TextInput
            style={[styles.modalTextarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            placeholder="分享你的使用体验..."
            placeholderTextColor={colors.muted}
            value={content}
            onChangeText={onChangeContent}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1000}
          />
          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: colors.muted }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={isDisabled}
              style={[
                styles.modalSubmitBtn,
                { backgroundColor: isDisabled ? colors.muted : colors.primary },
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSubmitText}>
                {isSubmitting ? "提交中..." : "发表评价"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

type AllReviewsModalProps = {
  visible: boolean;
  colors: AppColors;
  reviews?: StrategyReview[];
  formatDate: (dateString: string) => string;
  onClose: () => void;
};

export function AllReviewsModal({
  visible,
  colors,
  reviews,
  formatDate,
  onClose,
}: AllReviewsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.allCommentsModal, { backgroundColor: colors.background }]}
        >
          <View style={styles.modalHandle} />
          <View style={styles.allCommentsHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              全部评价 ({reviews?.length || 0})
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[{ fontSize: 18, color: colors.muted }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.allCommentsList} showsVerticalScrollIndicator={false}>
            {reviews && reviews.length > 0 ? (
              reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  colors={colors}
                  formatDate={formatDate}
                />
              ))
            ) : (
              <View style={styles.emptyReviews}>
                <Text style={{ color: colors.muted, textAlign: "center" }}>暂无评价</Text>
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  allCommentsModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    maxHeight: "80%",
  },
  allCommentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  allCommentsList: {
    flex: 1,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  modalTextarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
    minHeight: 100,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontWeight: "600",
    fontSize: 15,
  },
  modalSubmitBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSubmitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  successBanner: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  successText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyReviews: {
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
});
