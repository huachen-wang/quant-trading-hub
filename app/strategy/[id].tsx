import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { ContactModal } from "@/components/contact-modal";
import { PcTopNav } from "@/components/pc-top-nav";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { SubscribeModal } from "@/components/subscribe-modal";
import { AdminNotesSection } from "@/components/strategy-detail/admin-notes-section";
import { PlatformGuideSection } from "@/components/strategy-detail/platform-guide-section";
import { BrokerRecommendationModal, VpsRecommendationModal } from "@/components/strategy-detail/recommendation-modals";
import { AllReviewsModal, ReviewComposerModal } from "@/components/strategy-detail/review-modals";
import { StrategyHeader } from "@/components/strategy-detail/strategy-header";
import { StrategyMedia } from "@/components/strategy-detail/strategy-media";
import { StrategyMetrics } from "@/components/strategy-detail/strategy-metrics";
import { StrategyPurchasePanel } from "@/components/strategy-detail/strategy-purchase-panel";
import { TradingEnvironmentSection } from "@/components/strategy-detail/trading-environment-section";
import { UserReviewsSection } from "@/components/strategy-detail/user-reviews-section";
import type { StrategyComment, StrategyReview } from "@/components/strategy-detail/types";

export default function StrategyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [commentText, setCommentText] = useState("");
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showVpsModal, setShowVpsModal] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNickname, setReviewNickname] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewSuccess, setShowReviewSuccess] = useState(false);

  const strategyId = parseInt(id || "0");
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const maxContentWidth = isDesktop ? Math.min(width - 56, 1320) : width;

  const { data: strategy, isLoading } = trpc.strategies.detail.useQuery({ id: strategyId });
  const { data: comments, refetch: refetchComments } = trpc.comments.list.useQuery({ strategyId });
  const { data: userReviews, refetch: refetchReviews } = trpc.anonymousComments.list.useQuery({
    strategyId,
    limit: 50,
  });

  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      refetchComments();
    },
  });

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => refetchComments(),
  });

  const createReviewMutation = trpc.anonymousComments.create.useMutation({
    onSuccess: () => {
      setReviewNickname("");
      setReviewContent("");
      setShowReviewSuccess(true);
      setTimeout(() => setShowReviewSuccess(false), 5000);
      refetchReviews();
    },
    onError: (error: any) => {
      Alert.alert("提交失败", error.message);
    },
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

  const handleSubmitReview = async () => {
    if (!reviewContent.trim()) {
      Alert.alert("提示", "请输入评价内容");
      return;
    }
    setIsSubmittingReview(true);
    try {
      await createReviewMutation.mutateAsync({
        strategyId,
        nickname: reviewNickname.trim() || undefined,
        content: reviewContent.trim(),
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDownload = () => {
    if (strategy?.downloadUrl) {
      Linking.openURL(strategy.downloadUrl);
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
    strategy.isFeatured
      ? ["#0A0E1A", "#1E293B", "#A8895A"]
      : strategy.platform === "MT4" ? ["#06101D", "#11233A", "#41607A"] : ["#06140F", "#12382B", "#34D399"];

  const returnValue = parseFloat(strategy.totalReturn) || 0;
  const isPositive = returnValue >= 0;
  const isAdmin = user?.role === "admin";
  const hasDownloadUrl = !!strategy.downloadUrl;

  const originalPrice = strategy.originalPrice;
  const tags = strategy.tags;
  const productType = strategy.productType;
  const galleryImagesRaw = strategy.galleryImages;
  const isFeatured = !!strategy.isFeatured;
  const featuredLink = strategy.featuredLink;

  let galleryImages: string[] = [];
  try {
    const parsed = typeof galleryImagesRaw === "string"
      ? JSON.parse(galleryImagesRaw)
      : galleryImagesRaw;
    if (Array.isArray(parsed)) {
      galleryImages = parsed.filter((img): img is string => typeof img === "string" && img.length > 0);
    }
  } catch {}

  const allImages = strategy.coverImage
    ? [strategy.coverImage, ...galleryImages.filter((img) => img !== strategy.coverImage)]
    : galleryImages;

  const tagList = typeof tags === "string"
    ? tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];

  const priceNum = parseFloat(strategy.price) || 0;
  const originalPriceNum = parseFloat(originalPrice || "") || 0;
  const hasDiscount = !strategy.isFree && originalPriceNum > 0 && originalPriceNum > priceNum;
  const discountPercent = hasDiscount ? Math.round((1 - priceNum / originalPriceNum) * 100) : 0;
  const productTypeLabel = productType === "indicator" ? "指标" : productType === "tool" ? "工具" : "EA";
  const reviews = (userReviews || []) as StrategyReview[];
  const displayReviews = reviews.slice(0, 3);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <PcTopNav />
      <SubscribeModal
        visible={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        strategyTitle={strategy.title}
      />
      <ReviewComposerModal
        visible={showReviewModal}
        colors={colors}
        nickname={reviewNickname}
        content={reviewContent}
        isSubmitting={isSubmittingReview}
        showSuccess={showReviewSuccess}
        onClose={() => setShowReviewModal(false)}
        onChangeNickname={setReviewNickname}
        onChangeContent={setReviewContent}
        onSubmit={handleSubmitReview}
      />
      <AllReviewsModal
        visible={showAllComments}
        colors={colors}
        reviews={reviews}
        formatDate={formatDate}
        onClose={() => setShowAllComments(false)}
      />

      <ScrollView className="flex-1" contentContainerStyle={isDesktop ? styles.desktopContainer : undefined}>
        <View style={isDesktop ? [styles.desktopContent, { maxWidth: maxContentWidth }] : undefined}>
          <View style={[styles.topBar, isDesktop && styles.topBarDesktop]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backBtn, isDesktop && styles.backBtnDesktopHidden, { backgroundColor: colors.surface }]}
              activeOpacity={0.7}
            >
              <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSubscribeModal(true)}
              style={[styles.subscribeTopBtn, { backgroundColor: colors.primary + "15" }]}
              activeOpacity={0.7}
            >
              <Text style={styles.subscribeTopCode}>SUP</Text>
              <Text style={[styles.subscribeTopText, { color: colors.primary }]}>获取支持</Text>
            </TouchableOpacity>
          </View>

          {isDesktop ? (
            <View style={styles.desktopHeroGrid}>
              <View style={styles.desktopHeroMain}>
                <StrategyMedia
                  strategy={strategy}
                  allImages={allImages}
                  gradientColors={gradientColors}
                  productTypeLabel={productTypeLabel}
                  isFeatured={isFeatured}
                  isDesktop={isDesktop}
                  width={width}
                />
                <StrategyHeader
                  strategy={strategy}
                  colors={colors}
                  isFeatured={isFeatured}
                  tagList={tagList}
                />
                <StrategyMetrics
                  strategy={strategy}
                  colors={colors}
                  isPositive={isPositive}
                />
              </View>
              <View style={styles.desktopHeroSide}>
                <StrategyPurchasePanel
                  strategy={strategy}
                  colors={colors}
                  originalPrice={originalPrice}
                  hasDiscount={hasDiscount}
                  discountPercent={discountPercent}
                  hasDownloadUrl={hasDownloadUrl}
                  isFeatured={isFeatured}
                  featuredLink={featuredLink}
                  onDownload={handleDownload}
                />
                <TradingEnvironmentSection
                  colors={colors}
                  onOpenBroker={() => setShowBrokerModal(true)}
                  onOpenVps={() => setShowVpsModal(true)}
                />
              </View>
            </View>
          ) : (
            <>
              <StrategyMedia
                strategy={strategy}
                allImages={allImages}
                gradientColors={gradientColors}
                productTypeLabel={productTypeLabel}
                isFeatured={isFeatured}
                isDesktop={isDesktop}
                width={width}
              />
              <StrategyHeader
                strategy={strategy}
                colors={colors}
                isFeatured={isFeatured}
                tagList={tagList}
              />
              <StrategyMetrics
                strategy={strategy}
                colors={colors}
                isPositive={isPositive}
              />
              <StrategyPurchasePanel
                strategy={strategy}
                colors={colors}
                originalPrice={originalPrice}
                hasDiscount={hasDiscount}
                discountPercent={discountPercent}
                hasDownloadUrl={hasDownloadUrl}
                isFeatured={isFeatured}
                featuredLink={featuredLink}
                onDownload={handleDownload}
              />
              <TradingEnvironmentSection
                colors={colors}
                onOpenBroker={() => setShowBrokerModal(true)}
                onOpenVps={() => setShowVpsModal(true)}
              />
            </>
          )}
          <AdminNotesSection
            colors={colors}
            comments={comments as StrategyComment[] | undefined}
            isAdmin={isAdmin}
            commentText={commentText}
            isPosting={createCommentMutation.isPending}
            onChangeCommentText={setCommentText}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
          />
          <UserReviewsSection
            colors={colors}
            reviews={reviews}
            displayReviews={displayReviews}
            hasMoreReviews={reviews.length > 3}
            showReviewSuccess={showReviewSuccess}
            formatDate={formatDate}
            onOpenReview={() => setShowReviewModal(true)}
            onOpenAllReviews={() => setShowAllComments(true)}
          />
          <PlatformGuideSection
            colors={colors}
            onPress={() => setShowContactModal(true)}
          />

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <BrokerRecommendationModal
        visible={showBrokerModal}
        colors={colors}
        onClose={() => setShowBrokerModal(false)}
      />
      <VpsRecommendationModal
        visible={showVpsModal}
        colors={colors}
        onClose={() => setShowVpsModal(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  desktopContent: {
    width: "100%",
  },
  desktopHeroGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  desktopHeroMain: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    paddingTop: 2,
    backgroundColor: "rgba(15,23,42,0.42)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
  },
  desktopHeroSide: {
    width: 372,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topBarDesktop: {
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnDesktopHidden: {
    display: "none",
  },
  subscribeTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  subscribeTopCode: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
  },
  subscribeTopText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
