import { useState, useRef } from "react";
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
  Modal,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { ContactModal } from "@/components/contact-modal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { SubscribeModal } from "@/components/subscribe-modal";

export default function StrategyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [commentText, setCommentText] = useState("");
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  // 用户评价弹窗
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNickname, setReviewNickname] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewSuccess, setShowReviewSuccess] = useState(false);
  // 图片画廊
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const galleryScrollRef = useRef<ScrollView>(null);

  const strategyId = parseInt(id || "0");
  const isDesktop = Platform.OS === "web" && width >= 768;
  const maxContentWidth = isDesktop ? 720 : width;

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

  const handleContact = (type: "telegram" | "qq") => {
    if (type === "telegram" && strategy?.telegramGroup) {
      Linking.openURL(strategy.telegramGroup);
    } else if (type === "qq" && strategy?.qqGroup) {
      Alert.alert("QQ群", `QQ群号: ${strategy.qqGroup}`, [{ text: "确定" }]);
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
    (strategy as any).isFeatured
      ? ["#92400E", "#D97706"]
      : strategy.platform === "MT4" ? ["#1E3A8A", "#3B82F6"] : ["#7C3AED", "#A78BFA"];

  const returnValue = parseFloat(strategy.totalReturn || "0");
  const isPositive = returnValue >= 0;
  const isAdmin = user?.role === "admin";

  const hasDownloadUrl = !!strategy.downloadUrl;
  const hasTelegram = !!strategy.telegramGroup;
  const hasQQ = !!strategy.qqGroup;

  // 新字段（安全取值）
  const originalPrice = (strategy as any).originalPrice;
  const tags = (strategy as any).tags;
  const productType = (strategy as any).productType;
  const galleryImagesRaw = (strategy as any).galleryImages;
  const isFeatured = (strategy as any).isFeatured;
  const featuredLink = (strategy as any).featuredLink;

  // 解析画廊图片
  let galleryImages: string[] = [];
  try {
    if (galleryImagesRaw) {
      galleryImages = JSON.parse(galleryImagesRaw);
    }
  } catch {}
  // 如果有封面图，也加入画廊
  const allImages = strategy.coverImage
    ? [strategy.coverImage, ...galleryImages.filter(img => img !== strategy.coverImage)]
    : galleryImages;

  // 解析标签
  const tagList = tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];

  // 价格锚点
  const priceNum = parseFloat(strategy.price || "0");
  const originalPriceNum = parseFloat(originalPrice || "0");
  const hasDiscount = !strategy.isFree && originalPriceNum > 0 && originalPriceNum > priceNum;
  const discountPercent = hasDiscount ? Math.round((1 - priceNum / originalPriceNum) * 100) : 0;

  // 产品类型
  const productTypeLabel = productType === "indicator" ? "指标" : productType === "tool" ? "工具" : "EA";

  // 用户评价最多显示3条
  const displayReviews = userReviews ? userReviews.slice(0, 3) : [];
  const hasMoreReviews = userReviews && userReviews.length > 3;

  const galleryWidth = Math.min(width - 32, 688);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <SubscribeModal
        visible={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        strategyTitle={strategy.title}
      />

      {/* 用户评价弹窗 */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowReviewModal(false)}
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

            {showReviewSuccess && (
              <View style={[styles.successBanner, { backgroundColor: colors.success + "15" }]}>
                <Text style={[styles.successText, { color: colors.success }]}>
                  ✅ 评价已提交，审核通过后将显示
                </Text>
              </View>
            )}

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="昵称（可选，默认匿名）"
              placeholderTextColor={colors.muted}
              value={reviewNickname}
              onChangeText={setReviewNickname}
              maxLength={100}
            />
            <TextInput
              style={[styles.modalTextarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="分享你的使用体验..."
              placeholderTextColor={colors.muted}
              value={reviewContent}
              onChangeText={setReviewContent}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setShowReviewModal(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: colors.muted }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitReview}
                disabled={isSubmittingReview || !reviewContent.trim()}
                style={[
                  styles.modalSubmitBtn,
                  { backgroundColor: isSubmittingReview || !reviewContent.trim() ? colors.muted : colors.primary },
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSubmitText}>
                  {isSubmittingReview ? "提交中..." : "发表评价"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 查看全部评价弹窗 */}
      <Modal
        visible={showAllComments}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllComments(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowAllComments(false)}
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
                全部评价 ({userReviews?.length || 0})
              </Text>
              <TouchableOpacity onPress={() => setShowAllComments(false)}>
                <Text style={[{ fontSize: 18, color: colors.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.allCommentsList} showsVerticalScrollIndicator={false}>
              {userReviews && userReviews.length > 0 ? (
                userReviews.map((review: any) => (
                  <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
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
                    <Text style={[styles.reviewContent, { color: colors.foreground }]}>
                      {review.content}
                    </Text>
                  </View>
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

      {/* 图片画廊全屏弹窗 */}
      <Modal
        visible={showGalleryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGalleryModal(false)}
      >
        <View style={styles.galleryModalOverlay}>
          <TouchableOpacity
            onPress={() => setShowGalleryModal(false)}
            style={styles.galleryCloseBtn}
          >
            <Text style={styles.galleryCloseText}>✕</Text>
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * width, y: 0 }}
          >
            {allImages.map((img, i) => (
              <View key={i} style={{ width, justifyContent: "center", alignItems: "center" }}>
                <Image
                  source={{ uri: img }}
                  style={{ width: width - 40, height: width - 40 }}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            ))}
          </ScrollView>
          <Text style={styles.galleryCounter}>{galleryIndex + 1} / {allImages.length}</Text>
        </View>
      </Modal>

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

          {/* 封面 / 图片画廊 */}
          {allImages.length > 1 ? (
            <View style={[styles.galleryContainer, isDesktop && styles.coverDesktop]}>
              <ScrollView
                ref={galleryScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / galleryWidth);
                  setGalleryIndex(idx);
                }}
                style={{ width: galleryWidth }}
              >
                {allImages.map((img, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setGalleryIndex(i); setShowGalleryModal(true); }}
                    activeOpacity={0.9}
                    style={{ width: galleryWidth }}
                  >
                    <Image
                      source={{ uri: img }}
                      style={{ width: galleryWidth, height: isDesktop ? 220 : 180, borderRadius: 20 }}
                      contentFit="cover"
                      transition={300}
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* 画廊指示器 */}
              <View style={styles.galleryIndicatorRow}>
                {allImages.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.galleryIndicator,
                      {
                        backgroundColor: i === galleryIndex ? "#fff" : "rgba(255,255,255,0.4)",
                        width: i === galleryIndex ? 16 : 6,
                      },
                    ]}
                  />
                ))}
              </View>
              {/* 平台标签 */}
              <View style={[styles.platformBadge, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                <Text style={[styles.platformText, { color: gradientColors[1] }]}>{strategy.platform} · {productTypeLabel}</Text>
              </View>
              {/* 旗舰标签 */}
              {isFeatured && (
                <View style={styles.featuredDetailBadge}>
                  <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.featuredDetailGradient}>
                    <Text style={styles.featuredDetailText}>⭐ 官方旗舰</Text>
                  </LinearGradient>
                </View>
              )}
            </View>
          ) : strategy.coverImage ? (
            <View style={[styles.coverGradient, isDesktop && styles.coverDesktop, { overflow: 'hidden' }]}>
              <TouchableOpacity
                onPress={() => { setGalleryIndex(0); setShowGalleryModal(true); }}
                activeOpacity={0.9}
                style={{ width: '100%', height: '100%' }}
              >
                <Image
                  source={{ uri: strategy.coverImage }}
                  style={{ width: '100%', height: '100%' }}
                  placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                />
              </TouchableOpacity>
              <View style={[styles.platformBadge, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                <Text style={[styles.platformText, { color: gradientColors[1] }]}>{strategy.platform} · {productTypeLabel}</Text>
              </View>
              {isFeatured && (
                <View style={styles.featuredDetailBadge}>
                  <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.featuredDetailGradient}>
                    <Text style={styles.featuredDetailText}>⭐ 官方旗舰</Text>
                  </LinearGradient>
                </View>
              )}
            </View>
          ) : (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.coverGradient, isDesktop && styles.coverDesktop]}
            >
              <Text style={styles.coverEmoji}>📈</Text>
              <View style={[styles.platformBadge, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                <Text style={[styles.platformText, { color: gradientColors[1] }]}>{strategy.platform} · {productTypeLabel}</Text>
              </View>
            </LinearGradient>
          )}

          {/* 标题和描述 */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: isFeatured ? "#D97706" : colors.foreground, flex: 1 }]}>{strategy.title}</Text>
            </View>
            {/* 标签 */}
            {tagList.length > 0 && (
              <View style={styles.tagRow}>
                {tagList.map((tag: string, i: number) => (
                  <View key={i} style={[styles.tagChip, { backgroundColor: colors.primary + "15" }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={[styles.description, { color: colors.muted }]}>{strategy.description}</Text>
          </View>

          {/* 核心数据 */}
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

          {/* 交易信息 */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>交易信息</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>交易对</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{strategy.pairs || "—"}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>时间周期</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{strategy.timeframe || "—"}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 价格和操作 */}
          <View style={styles.section}>
            <View style={[styles.actionCard, { backgroundColor: colors.surface }]}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={[styles.priceLabel, { color: colors.muted }]}>价格</Text>
                  {strategy.isFree ? (
                    <Text style={[styles.priceValue, { color: colors.success }]}>免费</Text>
                  ) : (
                    <View style={styles.priceDisplayRow}>
                      <Text style={[styles.priceValue, { color: "#F59E0B" }]}>¥{strategy.price}</Text>
                      {hasDiscount && (
                        <View style={styles.priceAnchor}>
                          <Text style={[styles.originalPriceText, { color: colors.muted }]}>¥{originalPrice}</Text>
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountText}>-{discountPercent}%</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <View style={styles.priceRight}>
                  <Text style={[styles.downloadLabel, { color: colors.muted }]}>下载量</Text>
                  <Text style={[styles.downloadValue, { color: colors.foreground }]}>💾 {(strategy.downloadCount || 0) + (strategy.virtualDownloads || 0)}</Text>
                </View>
              </View>

              {/* 旗舰产品跳转按钮 */}
              {isFeatured && featuredLink ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(featuredLink)}
                  style={[styles.downloadBtn, { backgroundColor: "#D97706" }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.downloadBtnText}>⭐ 前往官网了解详情</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={hasDownloadUrl ? handleDownload : undefined}
                  disabled={!hasDownloadUrl}
                  style={[
                    styles.downloadBtn,
                    { backgroundColor: hasDownloadUrl ? colors.primary : colors.muted + "40" },
                  ]}
                  activeOpacity={hasDownloadUrl ? 0.8 : 1}
                >
                  <Text style={[
                    styles.downloadBtnText,
                    { color: hasDownloadUrl ? "#fff" : colors.muted },
                  ]}>
                    {hasDownloadUrl ? "下载EA" : "暂无下载链接"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 联系按钮 */}
              <View style={styles.contactRow}>
                <TouchableOpacity
                  onPress={hasTelegram ? () => handleContact("telegram") : undefined}
                  disabled={!hasTelegram}
                  style={[
                    styles.contactBtn,
                    {
                      backgroundColor: hasTelegram ? colors.primary + "12" : colors.muted + "10",
                      borderWidth: hasTelegram ? 0 : 0.5,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={hasTelegram ? 0.7 : 1}
                >
                  <Text style={[
                    styles.contactBtnText,
                    { color: hasTelegram ? colors.primary : colors.muted },
                  ]}>
                    {hasTelegram ? "Telegram" : "Telegram —"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={hasQQ ? () => handleContact("qq") : undefined}
                  disabled={!hasQQ}
                  style={[
                    styles.contactBtn,
                    {
                      backgroundColor: hasQQ ? colors.primary + "12" : colors.muted + "10",
                      borderWidth: hasQQ ? 0 : 0.5,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={hasQQ ? 0.7 : 1}
                >
                  <Text style={[
                    styles.contactBtnText,
                    { color: hasQQ ? colors.primary : colors.muted },
                  ]}>
                    {hasQQ ? "QQ群" : "QQ群 —"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 推荐经纪商 & VPS */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>推荐交易环境</Text>
            <View style={styles.recommendRow}>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://www.blueberrymarkets.com/?ref=quantarsenal")}
                style={[styles.recommendCard, { backgroundColor: colors.surface }]}
                activeOpacity={0.8}
              >
                <Text style={styles.recommendEmoji}>🏦</Text>
                <Text style={[styles.recommendTitle, { color: colors.foreground }]}>Blueberry Markets</Text>
                <Text style={[styles.recommendDesc, { color: colors.muted }]}>推荐经纪商 · 低点差</Text>
                <View style={[styles.recommendBadge, { backgroundColor: colors.success + "15" }]}>
                  <Text style={[styles.recommendBadgeText, { color: colors.success }]}>官方合作</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://www.fxvm.net/?ref=quantarsenal")}
                style={[styles.recommendCard, { backgroundColor: colors.surface }]}
                activeOpacity={0.8}
              >
                <Text style={styles.recommendEmoji}>🖥️</Text>
                <Text style={[styles.recommendTitle, { color: colors.foreground }]}>FXVM</Text>
                <Text style={[styles.recommendDesc, { color: colors.muted }]}>推荐VPS · 低延迟</Text>
                <View style={[styles.recommendBadge, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.recommendBadgeText, { color: colors.primary }]}>稳定可靠</Text>
                </View>
              </TouchableOpacity>
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
              comments.map((comment: { id: number; user?: { name?: string }; content: string; createdAt: Date }) => (
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

          {/* 用户评价区 */}
          <View style={styles.section}>
            <View style={styles.reviewSectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                💬 用户评价 {userReviews && userReviews.length > 0 ? `(${userReviews.length})` : ""}
              </Text>
              <TouchableOpacity
                onPress={() => setShowReviewModal(true)}
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
                {displayReviews.map((review: any) => (
                  <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
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
                    <Text style={[styles.reviewContent, { color: colors.foreground }]} numberOfLines={3}>
                      {review.content}
                    </Text>
                  </View>
                ))}

                {hasMoreReviews && (
                  <TouchableOpacity
                    onPress={() => setShowAllComments(true)}
                    style={[styles.viewAllBtn, { borderColor: colors.border }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.viewAllText, { color: colors.primary }]}>
                      查看全部 {userReviews?.length} 条评价 →
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

          {/* 平台匹配引导 */}
          <View style={styles.section}>
            <TouchableOpacity
              onPress={() => setShowContactModal(true)}
              activeOpacity={0.85}
              style={[styles.platformGuide, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}
            >
              <View style={styles.platformGuideContent}>
                <Text style={styles.platformGuideEmoji}>🎯</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.platformGuideTitle, { color: colors.foreground }]}>需要交易环境支持？</Text>
                  <Text style={[styles.platformGuideDesc, { color: colors.muted }]}>
                    量化军火库帮你匹配最适合这款EA的合规交易平台，让策略发挥最大价值
                  </Text>
                </View>
                <Text style={[styles.platformGuideArrow, { color: colors.primary }]}>→</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
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
    height: 180,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  coverDesktop: {
    height: 220,
  },
  coverEmoji: {
    fontSize: 48,
  },
  // 画廊容器
  galleryContainer: {
    marginHorizontal: 16,
    height: 180,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  galleryIndicatorRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  galleryIndicator: {
    height: 4,
    borderRadius: 2,
  },
  // 画廊全屏弹窗
  galleryModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryCloseBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryCloseText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  galleryCounter: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "600",
  },
  // 旗舰标签
  featuredDetailBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  featuredDetailGradient: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  featuredDetailText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
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
  priceDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceAnchor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  originalPriceText: {
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: "#fff",
    fontSize: 11,
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
    fontWeight: "700",
    fontSize: 16,
    color: "#fff",
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
  // 推荐交易环境
  recommendRow: {
    flexDirection: "row",
    gap: 10,
  },
  recommendCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  recommendEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  recommendTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  recommendDesc: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 8,
  },
  recommendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  recommendBadgeText: {
    fontSize: 10,
    fontWeight: "700",
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
  // 用户评价区
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
  // 弹窗
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
  // 平台匹配引导
  platformGuide: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  platformGuideContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  platformGuideEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  platformGuideTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  platformGuideDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  platformGuideArrow: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
});
