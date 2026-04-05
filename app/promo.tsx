import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isDesktop = SCREEN_WIDTH >= 768;

// 分类标签
const CATEGORIES = [
  { key: "", label: "全部", icon: "grid" },
  { key: "ea", label: "EA策略", icon: "trending-up" },
  { key: "indicator", label: "指标", icon: "analytics" },
  { key: "tool", label: "工具", icon: "construct" },
  { key: "course", label: "教程", icon: "book" },
];

export default function PromoPage() {
  const colors = useColors();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showContact, setShowContact] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);

  const { data: products, isLoading } = trpc.promo.list.useQuery({ category: activeCategory || undefined });
  const { data: contactSettings } = trpc.siteSettings.getContact.useQuery();

  const telegram = contactSettings?.telegram || "@quantarsenal";
  const qq = contactSettings?.qq || "3832001817";

  const parseGallery = (gallery?: string | null): string[] => {
    if (!gallery) return [];
    try { return JSON.parse(gallery); } catch { return []; }
  };

  const calcDiscount = (original: string, promo: string): number => {
    const o = parseFloat(original);
    const p = parseFloat(promo);
    if (!o || !p || o <= p) return 0;
    return Math.round((1 - p / o) * 100);
  };

  // 倒计时 Hook
  const CountdownTimer = ({ endTime }: { endTime: string }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(endTime).getTime();
        const diff = end - now;
        if (diff <= 0) {
          setTimeLeft("已结束");
          clearInterval(timer);
          return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        if (days > 0) {
          setTimeLeft(`${days}天 ${hours}时 ${mins}分`);
        } else {
          setTimeLeft(`${hours}时 ${mins}分 ${secs}秒`);
        }
      }, 1000);
      return () => clearInterval(timer);
    }, [endTime]);

    return (
      <View style={styles.countdown}>
        <Ionicons name="time" size={14} color="#EF4444" />
        <Text style={styles.countdownText}>{timeLeft}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>加载中...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={[styles.container, { backgroundColor: "#0F172A" }]} showsVerticalScrollIndicator={false}>
        {/* 返回按钮 */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F1F5F9" />
        </TouchableOpacity>

        {/* 顶部 Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerContent}>
            <View style={styles.bannerBadge}>
              <Ionicons name="flash" size={14} color="#DC2626" />
              <Text style={styles.bannerBadgeText}>限时特惠</Text>
            </View>
            <Text style={styles.bannerTitle}>EA 跳蚤市场</Text>
            <Text style={styles.bannerSubtitle}>精选 EA 策略 · 限时折扣 · 先到先得</Text>
          </View>
        </View>

        {/* 分类筛选 */}
        <View style={styles.categoryBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryChip,
                  activeCategory === cat.key && styles.categoryChipActive,
                ]}
                onPress={() => setActiveCategory(cat.key)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={activeCategory === cat.key ? "#0F172A" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    activeCategory === cat.key && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 产品数量 */}
        <View style={styles.resultBar}>
          <Text style={styles.resultText}>
            共 <Text style={{ color: "#D97706", fontWeight: "700" }}>{products?.length || 0}</Text> 款促销商品
          </Text>
        </View>

        {/* 产品网格 */}
        <View style={styles.productsGrid}>
          {(products || []).map((product: any) => {
            const discount = calcDiscount(product.originalPrice, product.promoPrice);
            return (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                onPress={() => setSelectedProduct(product)}
                activeOpacity={0.85}
              >
                {/* 封面图 */}
                <View style={styles.productImageWrap}>
                  {product.coverImage ? (
                    <Image source={{ uri: product.coverImage }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder]}>
                      <Ionicons name="cube" size={32} color="#475569" />
                    </View>
                  )}
                  {/* 折扣标签 */}
                  {discount > 0 && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>-{discount}%</Text>
                    </View>
                  )}
                  {/* 促销标签 */}
                  {product.promoLabel && (
                    <View style={styles.promoLabel}>
                      <Text style={styles.promoLabelText}>{product.promoLabel}</Text>
                    </View>
                  )}
                  {/* 平台标签 */}
                  {product.platform && (
                    <View style={styles.platformBadge}>
                      <Text style={styles.platformBadgeText}>{product.platform}</Text>
                    </View>
                  )}
                </View>

                {/* 产品信息 */}
                <View style={styles.productInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
                  {product.description && (
                    <Text style={styles.productDesc} numberOfLines={2}>{product.description}</Text>
                  )}

                  {/* 价格区域 */}
                  <View style={styles.priceArea}>
                    <Text style={styles.promoPrice}>${product.promoPrice}</Text>
                    {product.originalPrice && parseFloat(product.originalPrice) > parseFloat(product.promoPrice) && (
                      <Text style={styles.originalPrice}>${product.originalPrice}</Text>
                    )}
                  </View>

                  {/* 倒计时 */}
                  {product.promoEndTime && (
                    <CountdownTimer endTime={product.promoEndTime} />
                  )}

                  {/* 库存信息 */}
                  {product.stock !== null && product.stock !== undefined && (
                    <View style={styles.stockInfo}>
                      <View style={styles.stockBar}>
                        <View style={[styles.stockBarFill, { width: `${Math.max(10, ((product.stock - (product.soldCount || 0)) / product.stock) * 100)}%` }]} />
                      </View>
                      <Text style={styles.stockText}>
                        剩余 {product.stock - (product.soldCount || 0)} 份
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 空状态 */}
        {(!products || products.length === 0) && (
          <View style={styles.emptyState}>
            <Ionicons name="pricetag" size={48} color="#475569" />
            <Text style={styles.emptyText}>暂无促销商品</Text>
            <Text style={styles.emptySubtext}>敬请期待，更多优惠即将上线</Text>
          </View>
        )}

        {/* 底部说明 */}
        <View style={styles.footerNote}>
          <View style={styles.footerNoteItem}>
            <Ionicons name="shield-checkmark" size={16} color="#D97706" />
            <Text style={styles.footerNoteText}>正版授权 · 安全可靠</Text>
          </View>
          <View style={styles.footerNoteItem}>
            <Ionicons name="headset" size={16} color="#D97706" />
            <Text style={styles.footerNoteText}>售后支持 · 技术指导</Text>
          </View>
          <View style={styles.footerNoteItem}>
            <Ionicons name="refresh" size={16} color="#D97706" />
            <Text style={styles.footerNoteText}>持续更新 · 终身使用</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 产品详情弹窗 */}
      <Modal visible={!!selectedProduct} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 头部 */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedProduct?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                <Ionicons name="close" size={24} color="#F1F5F9" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 封面图 */}
              {selectedProduct?.coverImage && (
                <Image source={{ uri: selectedProduct.coverImage }} style={styles.modalCover} resizeMode="cover" />
              )}

              {/* 价格区域 */}
              <View style={styles.modalPriceArea}>
                <View style={styles.modalPriceRow}>
                  <Text style={styles.modalPromoPrice}>${selectedProduct?.promoPrice}</Text>
                  {selectedProduct?.originalPrice && parseFloat(selectedProduct.originalPrice) > parseFloat(selectedProduct.promoPrice) && (
                    <>
                      <Text style={styles.modalOriginalPrice}>${selectedProduct?.originalPrice}</Text>
                      <View style={styles.modalDiscountBadge}>
                        <Text style={styles.modalDiscountText}>
                          省 ${(parseFloat(selectedProduct.originalPrice) - parseFloat(selectedProduct.promoPrice)).toFixed(0)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
                {selectedProduct?.promoEndTime && (
                  <CountdownTimer endTime={selectedProduct.promoEndTime} />
                )}
              </View>

              {/* 标签 */}
              <View style={styles.modalTags}>
                {selectedProduct?.platform && (
                  <View style={[styles.modalTag, { backgroundColor: "#1E40AF" }]}>
                    <Text style={styles.modalTagText}>{selectedProduct.platform}</Text>
                  </View>
                )}
                {selectedProduct?.category && (
                  <View style={[styles.modalTag, { backgroundColor: "#334155" }]}>
                    <Text style={styles.modalTagText}>
                      {CATEGORIES.find(c => c.key === selectedProduct.category)?.label || selectedProduct.category}
                    </Text>
                  </View>
                )}
                {selectedProduct?.promoLabel && (
                  <View style={[styles.modalTag, { backgroundColor: "#DC2626" }]}>
                    <Text style={styles.modalTagText}>{selectedProduct.promoLabel}</Text>
                  </View>
                )}
              </View>

              {/* 描述 */}
              {selectedProduct?.description && (
                <Text style={styles.modalDesc}>{selectedProduct.description}</Text>
              )}

              {/* 详细内容 */}
              {selectedProduct?.detailContent && (
                <View style={styles.modalDetail}>
                  <Text style={styles.modalDetailTitle}>产品详情</Text>
                  <Text style={styles.modalDetailContent}>{selectedProduct.detailContent}</Text>
                </View>
              )}

              {/* 截图画廊 */}
              {parseGallery(selectedProduct?.galleryImages).length > 0 && (
                <View style={styles.modalGallery}>
                  <Text style={styles.modalDetailTitle}>产品截图</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {parseGallery(selectedProduct?.galleryImages).map((img: string, i: number) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => { setGalleryIndex(i); setShowGallery(true); }}
                      >
                        <Image source={{ uri: img }} style={styles.galleryThumb} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 支付说明 */}
              <View style={styles.paymentSection}>
                <Text style={styles.modalDetailTitle}>购买方式</Text>
                {selectedProduct?.paymentInfo ? (
                  <Text style={styles.paymentText}>{selectedProduct.paymentInfo}</Text>
                ) : (
                  <View style={styles.paymentSteps}>
                    <View style={styles.paymentStep}>
                      <View style={styles.paymentStepNum}><Text style={styles.paymentStepNumText}>1</Text></View>
                      <Text style={styles.paymentStepText}>点击下方按钮联系客服</Text>
                    </View>
                    <View style={styles.paymentStep}>
                      <View style={styles.paymentStepNum}><Text style={styles.paymentStepNumText}>2</Text></View>
                      <Text style={styles.paymentStepText}>备注商品名称，确认库存</Text>
                    </View>
                    <View style={styles.paymentStep}>
                      <View style={styles.paymentStepNum}><Text style={styles.paymentStepNumText}>3</Text></View>
                      <Text style={styles.paymentStepText}>支付后即时发货，支持 USDT / 支付宝 / 微信</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 购买按钮 */}
              <TouchableOpacity
                style={styles.buyButton}
                onPress={() => { setSelectedProduct(null); setShowContact(true); }}
              >
                <Ionicons name="cart" size={18} color="#0F172A" />
                <Text style={styles.buyButtonText}>立即购买</Text>
              </TouchableOpacity>

              {/* 安全提示 */}
              <View style={styles.safetyNote}>
                <Ionicons name="information-circle" size={16} color="#64748B" />
                <Text style={styles.safetyNoteText}>
                  所有商品均为正版授权，支持售后。如有疑问请联系客服咨询。
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 联系方式弹窗 */}
      <Modal visible={showContact} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowContact(false)}>
          <View style={styles.contactModal}>
            <View style={styles.contactHeader}>
              <Ionicons name="cart" size={28} color="#D97706" />
              <Text style={styles.contactTitle}>联系客服购买</Text>
            </View>
            <Text style={styles.contactDesc}>
              请备注商品名称，客服将为您确认库存并安排发货
            </Text>
            <View style={styles.contactMethods}>
              <TouchableOpacity
                style={[styles.contactMethod, { backgroundColor: "#0088cc" }]}
                onPress={() => Linking.openURL(`https://t.me/${telegram.replace("@", "")}`)}
              >
                <Ionicons name="paper-plane" size={20} color="#fff" />
                <View>
                  <Text style={styles.contactMethodLabel}>Telegram</Text>
                  <Text style={styles.contactMethodValue}>{telegram}</Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.contactMethod, { backgroundColor: "#12B7F5" }]}>
                <Ionicons name="chatbox" size={20} color="#fff" />
                <View>
                  <Text style={styles.contactMethodLabel}>QQ</Text>
                  <Text style={styles.contactMethodValue}>{qq}</Text>
                </View>
              </View>
            </View>
            <View style={styles.paymentMethods}>
              <Text style={styles.paymentMethodsTitle}>支持的支付方式</Text>
              <View style={styles.paymentMethodsRow}>
                {["USDT", "支付宝", "微信"].map((method) => (
                  <View key={method} style={styles.paymentMethodChip}>
                    <Text style={styles.paymentMethodChipText}>{method}</Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.contactCloseBtn} onPress={() => setShowContact(false)}>
              <Text style={styles.contactCloseBtnText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 全屏图片查看 */}
      <Modal visible={showGallery} animationType="fade" transparent>
        <View style={styles.galleryModal}>
          <TouchableOpacity style={styles.galleryClose} onPress={() => setShowGallery(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedProduct && parseGallery(selectedProduct.galleryImages)[galleryIndex] && (
            <Image
              source={{ uri: parseGallery(selectedProduct.galleryImages)[galleryIndex] }}
              style={styles.galleryFullImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.galleryNav}>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.max(0, galleryIndex - 1))}>
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.galleryCounter}>
              {galleryIndex + 1} / {parseGallery(selectedProduct?.galleryImages).length}
            </Text>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.min(parseGallery(selectedProduct?.galleryImages).length - 1, galleryIndex + 1))}>
              <Ionicons name="chevron-forward" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  backButton: { position: "absolute", top: 16, left: 16, zIndex: 10, padding: 8 },

  // Banner
  banner: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20, backgroundColor: "#0F172A" },
  bannerContent: { alignItems: "center" },
  bannerBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(220,38,38,0.15)", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, gap: 6, marginBottom: 12 },
  bannerBadgeText: { color: "#EF4444", fontSize: 13, fontWeight: "700" },
  bannerTitle: { color: "#F1F5F9", fontSize: 28, fontWeight: "800", marginBottom: 8 },
  bannerSubtitle: { color: "#94A3B8", fontSize: 14 },

  // Category
  categoryBar: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  categoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1E293B" },
  categoryChipActive: { backgroundColor: "#D97706" },
  categoryChipText: { color: "#94A3B8", fontSize: 13, fontWeight: "500" },
  categoryChipTextActive: { color: "#0F172A", fontWeight: "700" },

  // Result
  resultBar: { paddingHorizontal: 20, paddingVertical: 12 },
  resultText: { color: "#94A3B8", fontSize: 13 },

  // Products Grid
  productsGrid: { paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  productCard: { width: isDesktop ? (SCREEN_WIDTH - 64) / 3 : (SCREEN_WIDTH - 44) / 2, backgroundColor: "#1E293B", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#334155" },
  productImageWrap: { position: "relative" },
  productImage: { width: "100%", height: 130 },
  productImagePlaceholder: { backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
  discountBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "#DC2626", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  discountBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  promoLabel: { position: "absolute", top: 8, left: 8, backgroundColor: "#D97706", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  promoLabelText: { color: "#0F172A", fontSize: 11, fontWeight: "700" },
  platformBadge: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(30,64,175,0.9)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  platformBadgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },

  productInfo: { padding: 12 },
  productTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  productDesc: { color: "#94A3B8", fontSize: 11, lineHeight: 16, marginBottom: 8 },

  priceArea: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 6 },
  promoPrice: { color: "#EF4444", fontSize: 18, fontWeight: "800" },
  originalPrice: { color: "#64748B", fontSize: 13, textDecorationLine: "line-through" },

  countdown: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  countdownText: { color: "#EF4444", fontSize: 11, fontWeight: "600" },

  stockInfo: { marginTop: 4 },
  stockBar: { height: 4, backgroundColor: "#334155", borderRadius: 2, overflow: "hidden" },
  stockBarFill: { height: "100%", backgroundColor: "#D97706", borderRadius: 2 },
  stockText: { color: "#94A3B8", fontSize: 10, marginTop: 3 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { color: "#94A3B8", fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySubtext: { color: "#64748B", fontSize: 13, marginTop: 4 },

  // Footer Note
  footerNote: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 20, paddingVertical: 24, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: "#1E293B", marginTop: 20 },
  footerNoteItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerNoteText: { color: "#94A3B8", fontSize: 12 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "90%", backgroundColor: "#1E293B", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#334155" },
  modalTitle: { color: "#F1F5F9", fontSize: 18, fontWeight: "700", flex: 1, marginRight: 12 },
  modalBody: { padding: 20 },
  modalCover: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16 },

  modalPriceArea: { backgroundColor: "#0F172A", padding: 16, borderRadius: 12, marginBottom: 16 },
  modalPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  modalPromoPrice: { color: "#EF4444", fontSize: 28, fontWeight: "800" },
  modalOriginalPrice: { color: "#64748B", fontSize: 16, textDecorationLine: "line-through" },
  modalDiscountBadge: { backgroundColor: "rgba(220,38,38,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modalDiscountText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },

  modalTags: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  modalTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  modalTagText: { color: "#F1F5F9", fontSize: 12, fontWeight: "600" },

  modalDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginBottom: 16 },

  modalDetail: { marginBottom: 16 },
  modalDetailTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  modalDetailContent: { color: "#CBD5E1", fontSize: 13, lineHeight: 22 },

  modalGallery: { marginBottom: 16 },
  galleryThumb: { width: 180, height: 120, borderRadius: 8, marginRight: 10, backgroundColor: "#334155" },

  paymentSection: { marginBottom: 20 },
  paymentText: { color: "#CBD5E1", fontSize: 13, lineHeight: 22 },
  paymentSteps: { gap: 12 },
  paymentStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  paymentStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#D97706", justifyContent: "center", alignItems: "center" },
  paymentStepNumText: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
  paymentStepText: { color: "#CBD5E1", fontSize: 13, flex: 1 },

  buyButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#D97706", paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  buyButtonText: { color: "#0F172A", fontSize: 16, fontWeight: "700" },

  safetyNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 8 },
  safetyNoteText: { color: "#64748B", fontSize: 11, flex: 1, lineHeight: 16 },

  // Contact Modal
  contactModal: { margin: 24, backgroundColor: "#1E293B", borderRadius: 16, padding: 24 },
  contactHeader: { alignItems: "center", marginBottom: 12 },
  contactTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "700", marginTop: 8 },
  contactDesc: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 20 },
  contactMethods: { gap: 10, marginBottom: 16 },
  contactMethod: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 10 },
  contactMethodLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  contactMethodValue: { color: "#fff", fontSize: 15, fontWeight: "700" },
  paymentMethods: { marginBottom: 16 },
  paymentMethodsTitle: { color: "#94A3B8", fontSize: 12, marginBottom: 8 },
  paymentMethodsRow: { flexDirection: "row", gap: 8 },
  paymentMethodChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: "#334155" },
  paymentMethodChipText: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  contactCloseBtn: { alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: "#334155" },
  contactCloseBtnText: { color: "#F1F5F9", fontSize: 15, fontWeight: "600" },

  // Gallery Modal
  galleryModal: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  galleryClose: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 },
  galleryFullImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 },
  galleryNav: { flexDirection: "row", alignItems: "center", gap: 30, marginTop: 20 },
  galleryCounter: { color: "#fff", fontSize: 16 },
});
