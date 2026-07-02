import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AppColors, StrategyReview } from "./types";

type UserReviewsSectionProps = {
  colors: AppColors;
  reviews?: StrategyReview[];
  displayReviews: StrategyReview[];
  hasMoreReviews: boolean;
  showReviewSuccess: boolean;
  formatDate: (dateString: string) => string;
  onOpenReview: () => void;
  onOpenAllReviews: () => void;
};

export function UserReviewsSection({
  colors,
  reviews,
  displayReviews,
  hasMoreReviews,
  showReviewSuccess,
  formatDate,
  onOpenReview,
  onOpenAllReviews,
}: UserReviewsSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.reviewSectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
          💬 用户评价 {reviews && reviews.length > 0 ? `(${reviews.length})` : ""}
        </Text>
        <TouchableOpacity
          onPress={onOpenReview}
          style={[styles.writeReviewBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.writeReviewBtnText}>写评价</Text>
        </TouchableOpacity>
      </View>

      {showReviewSuccess && (
        <View style={[styles.successBanner, { backgroundColor: colors.success + "15", marginBottom: 10 }]}>
          <Text style={[styles.successText, { color: colors.success }]}>
            ✅ 评价已提交，审核通过后将显示
          </Text>
        </View>
      )}

      {displayReviews.length > 0 ? (
        <>
          {displayReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              colors={colors}
              formatDate={formatDate}
              numberOfLines={3}
            />
          ))}

          {hasMoreReviews && (
            <TouchableOpacity
              onPress={onOpenAllReviews}
              style={[styles.viewAllBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                查看全部 {reviews?.length} 条评价 →
              </Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={[styles.emptyReviews, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.muted, textAlign: "center", fontSize: 14 }}>
            暂无评价，快来抢沙发吧~
          </Text>
        </View>
      )}
    </View>
  );
}

export function ReviewCard({
  review,
  colors,
  formatDate,
  numberOfLines,
}: {
  review: StrategyReview;
  colors: AppColors;
  formatDate: (dateString: string) => string;
  numberOfLines?: number;
}) {
  return (
    <View style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + "15" }]}>
          <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>
            {(review.nickname || "匿名")[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reviewNickname, { color: colors.foreground }]}>
            {review.nickname || "匿名用户"}
          </Text>
          <Text style={[styles.reviewTime, { color: colors.muted }]}>
            {formatDate(String(review.createdAt))}
          </Text>
        </View>
      </View>
      <Text style={[styles.reviewContent, { color: colors.foreground }]} numberOfLines={numberOfLines}>
        {review.content}
      </Text>
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
  reviewSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  writeReviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  writeReviewBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  reviewCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    fontSize: 16,
    fontWeight: "700",
  },
  reviewNickname: {
    fontSize: 14,
    fontWeight: "600",
  },
  reviewTime: {
    fontSize: 11,
    marginTop: 1,
  },
  reviewContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  viewAllBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyReviews: {
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
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
});
