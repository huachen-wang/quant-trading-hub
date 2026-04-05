import React, { useState, useEffect } from "react";
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

const CATEGORIES = [
  { key: "", label: "全部", icon: "grid" },
  { key: "ea", label: "EA策略", icon: "trending-up" },
  { key: "indicator", label: "指标", icon: "analytics" },
  { key: "tool", label: "工具", icon: "construct" },
  { key: "course", label: "教程", icon: "book" },
];

// 占位产品数据（后台没有数据时展示）
const PLACEHOLDER_PRODUCTS = [
  {
    id: "p1", title: "Quantum Emperor MT5", description: "2024年度最佳黄金EA，AI驱动量化策略，回撤极低",
    originalPrice: "999", promoPrice: "199", platform: "MT5", category: "ea",
    promoLabel: "爆款", promoEndTime: new Date(Date.now() + 3 * 86400000).toISOString(),
    stock: 50, soldCount: 37, coverImage: null,
  },
  {
    id: "p2", title: "Waka Waka EA", description: "网格对冲策略鼻祖，7年实盘验证，稳定如老狗",
    originalPrice: "1299", promoPrice: "249", platform: "MT4/MT5", category: "ea",
    promoLabel: "经典", promoEndTime: new Date(Date.now() + 5 * 86400000).toISOString(),
    stock: 30, soldCount: 22, coverImage: null,
  },
  {
    id: "p3", title: "The Gold Reaper", description: "黄金收割机，趋势跟踪+动态止损，月化15-25%",
    originalPrice: "799", promoPrice: "159", platform: "MT5", category: "ea",
    promoLabel: "热销", promoEndTime: new Date(Date.now() + 2 * 86400000).toISOString(),
    stock: 20, soldCount: 15, coverImage: null,
  },
  {
    id: "p4", title: "Dark Algo V3", description: "暗黑算法，多品种对冲，适合大资金稳健运行",
    originalPrice: "1599", promoPrice: "329", platform: "MT5", category: "ea",
    promoLabel: "源头价", promoEndTime: new Date(Date.now() + 7 * 86400000).toISOString(),
    stock: 15, soldCount: 8, coverImage: null,
  },
  {
    id: "p5", title: "Night Hunter Pro", description: "亚盘剥头皮之王，低风险高频策略，适合Prop Firm",
    originalPrice: "699", promoPrice: "139", platform: "MT4/MT5", category: "ea",
    promoLabel: "限时", promoEndTime: new Date(Date.now() + 1 * 86400000).toISOString(),
    stock: 40, soldCount: 31, coverImage: null,
  },
  {
    id: "p6", title: "Gold Trade Pro", description: "黄金专属趋势EA，自动识别趋势方向，智能加仓",
    originalPrice: "899", promoPrice: "179", platform: "MT5", category: "ea",
    promoLabel: "新品", promoEndTime: new Date(Date.now() + 4 * 86400000).toISOString(),
    stock: 25, soldCount: 10, coverImage: null,
  },
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

  // 使用后台数据，如果没有则用占位数据
  const displayProducts = (products && products.length > 0) ? products : PLACEHOLDER_PRODUCTS;

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
          setTimeLeft(`${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
        }
      }, 1000);
      return () => clearInterval(timer);
    }, [endTime]);

    return (
      <View style={s.countdownWrap}>
        <View style={s.countdownDot} />
        <Text style={s.countdownLabel}>限时</Text>
        <View style={s.countdownBox}>
          <Text style={s.countdownText}>{timeLeft}</Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={[s.loadingContainer, { backgroundColor: "#0A0E1A" }]}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={s.loadingText}>加载中...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={[s.container, { backgroundColor: "#0A0E1A" }]} showsVerticalScrollIndicator={false}>
        {/* 返回按钮 */}
        <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
          <View style={s.backButtonInner}>
            <Ionicons name="arrow-back" size={20} color="#F1F5F9" />
          </View>
        </TouchableOpacity>

        {/* 顶部 Hero Banner */}
        <View style={s.heroBanner}>
          {/* 背景装饰 */}
          <View style={s.heroGlow} />
          <View style={s.heroGlow2} />

          <View style={s.heroContent}>
            {/* 源头标识 */}
            <View style={s.sourceTag}>
              <View style={s.sourceTagDot} />
              <Text style={s.sourceTagText}>源头直供 · 全网最低</Text>
            </View>

            <Text style={s.heroTitle}>全网EA源头提货</Text>
            <Text style={s.heroSubtitle}>
              所有策略均有源码 · 可破解 · 可独家优化{"\n"}
              市面上能买到的EA，我们这里都是源头价
            </Text>

            {/* 核心数据 */}
            <View style={s.heroStats}>
              <View style={s.heroStatItem}>
                <Text style={s.heroStatNum}>117+</Text>
                <Text style={s.heroStatLabel}>已测试EA</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStatItem}>
                <Text style={s.heroStatNum}>80%</Text>
                <Text style={s.heroStatLabel}>低于市场价</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStatItem}>
                <Text style={s.heroStatNum}>24h</Text>
                <Text style={s.heroStatLabel}>极速发货</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 权威能力条 */}
        <View style={s.authorityBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.authorityScroll}>
            {[
              { icon: "code-slash", text: "源码级掌控" },
              { icon: "key", text: "破解能力" },
              { icon: "diamond", text: "独家优化" },
              { icon: "shield-checkmark", text: "正版授权" },
              { icon: "flash", text: "即买即用" },
            ].map((item, i) => (
              <View key={i} style={s.authorityItem}>
                <Ionicons name={item.icon as any} size={14} color="#F59E0B" />
                <Text style={s.authorityText}>{item.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 分类筛选 */}
        <View style={s.categoryBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  s.categoryChip,
                  activeCategory === cat.key && s.categoryChipActive,
                ]}
                onPress={() => setActiveCategory(cat.key)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={activeCategory === cat.key ? "#0A0E1A" : "#94A3B8"}
                />
                <Text
                  style={[
                    s.categoryChipText,
                    activeCategory === cat.key && s.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 产品数量 + 促销提示 */}
        <View style={s.resultBar}>
          <Text style={s.resultText}>
            共 <Text style={{ color: "#F59E0B", fontWeight: "800" }}>{displayProducts.length}</Text> 款源头好货
          </Text>
          <View style={s.resultBadge}>
            <Ionicons name="pricetag" size={12} color="#EF4444" />
            <Text style={s.resultBadgeText}>限时特惠中</Text>
          </View>
        </View>

        {/* 产品网格 */}
        <View style={s.productsGrid}>
          {displayProducts.map((product: any) => {
            const discount = calcDiscount(product.originalPrice, product.promoPrice);
            const remaining = product.stock ? product.stock - (product.soldCount || 0) : null;
            const soldPercent = product.stock ? ((product.soldCount || 0) / product.stock) * 100 : 0;

            return (
              <TouchableOpacity
                key={product.id}
                style={s.productCard}
                onPress={() => setSelectedProduct(product)}
                activeOpacity={0.85}
              >
                {/* 封面区域 */}
                <View style={s.productImageWrap}>
                  {product.coverImage ? (
                    <Image source={{ uri: product.coverImage }} style={s.productImage} resizeMode="cover" />
                  ) : (
                    <View style={[s.productImage, s.productImagePlaceholder]}>
                      <View style={s.placeholderIcon}>
                        <Ionicons name="cube" size={28} color="#F59E0B" />
                      </View>
                      <Text style={s.placeholderText}>{product.title?.substring(0, 2)}</Text>
                    </View>
                  )}

                  {/* 折扣角标 */}
                  {discount > 0 && (
                    <View style={s.discountBadge}>
                      <Text style={s.discountBadgeText}>-{discount}%</Text>
                    </View>
                  )}

                  {/* 促销标签 */}
                  {product.promoLabel && (
                    <View style={s.promoLabel}>
                      <Ionicons name="flash" size={10} color="#0A0E1A" />
                      <Text style={s.promoLabelText}>{product.promoLabel}</Text>
                    </View>
                  )}

                  {/* 平台标签 */}
                  {product.platform && (
                    <View style={s.platformBadge}>
                      <Text style={s.platformBadgeText}>{product.platform}</Text>
                    </View>
                  )}
                </View>

                {/* 产品信息 */}
                <View style={s.productInfo}>
                  <Text style={s.productTitle} numberOfLines={2}>{product.title}</Text>
                  {product.description && (
                    <Text style={s.productDesc} numberOfLines={2}>{product.description}</Text>
                  )}

                  {/* 价格区域 */}
                  <View style={s.priceArea}>
                    <Text style={s.priceSymbol}>$</Text>
                    <Text style={s.promoPrice}>{product.promoPrice}</Text>
                    {product.originalPrice && parseFloat(product.originalPrice) > parseFloat(product.promoPrice) && (
                      <Text style={s.originalPrice}>${product.originalPrice}</Text>
                    )}
                  </View>

                  {/* 倒计时 */}
                  {product.promoEndTime && (
                    <CountdownTimer endTime={product.promoEndTime} />
                  )}

                  {/* 库存进度条 */}
                  {remaining !== null && (
                    <View style={s.stockInfo}>
                      <View style={s.stockBar}>
                        <View style={[s.stockBarFill, {
                          width: `${Math.min(100, soldPercent)}%`,
                          backgroundColor: soldPercent > 80 ? "#EF4444" : soldPercent > 50 ? "#F59E0B" : "#10B981",
                        }]} />
                      </View>
                      <Text style={s.stockText}>
                        {remaining <= 5 ? `仅剩 ${remaining} 份!` : `已售 ${product.soldCount || 0}/${product.stock}`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 底部按钮 */}
                <View style={s.cardFooter}>
                  <TouchableOpacity
                    style={s.cardBuyBtn}
                    onPress={() => { setSelectedProduct(product); }}
                  >
                    <Ionicons name="cart" size={14} color="#0A0E1A" />
                    <Text style={s.cardBuyBtnText}>立即抢购</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 空状态 */}
        {displayProducts.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="pricetag" size={48} color="#475569" />
            <Text style={s.emptyText}>暂无促销商品</Text>
            <Text style={s.emptySubtext}>敬请期待，更多源头好货即将上线</Text>
          </View>
        )}

        {/* 底部权威保障 */}
        <View style={s.guaranteeSection}>
          <Text style={s.guaranteeSectionTitle}>源头保障</Text>
          <View style={s.guaranteeGrid}>
            {[
              { icon: "code-slash", title: "源码可查", desc: "所有EA均提供源码级验证，杜绝后门" },
              { icon: "shield-checkmark", title: "正版授权", desc: "官方渠道直供，终身授权无忧" },
              { icon: "headset", title: "技术支持", desc: "专业团队1对1指导安装与参数配置" },
              { icon: "refresh", title: "持续更新", desc: "策略持续迭代优化，免费享受升级" },
            ].map((item, i) => (
              <View key={i} style={s.guaranteeCard}>
                <View style={s.guaranteeIconWrap}>
                  <Ionicons name={item.icon as any} size={20} color="#F59E0B" />
                </View>
                <Text style={s.guaranteeCardTitle}>{item.title}</Text>
                <Text style={s.guaranteeCardDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 底部CTA */}
        <View style={s.bottomCTA}>
          <Text style={s.bottomCTATitle}>找不到想要的EA？</Text>
          <Text style={s.bottomCTADesc}>告诉我们你需要什么，全网EA我们都能搞到源头价</Text>
          <TouchableOpacity style={s.bottomCTABtn} onPress={() => setShowContact(true)}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#0A0E1A" />
            <Text style={s.bottomCTABtnText}>联系客服定制</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 产品详情弹窗 */}
      <Modal visible={!!selectedProduct} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>{selectedProduct?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                <Ionicons name="close" size={24} color="#F1F5F9" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {selectedProduct?.coverImage && (
                <Image source={{ uri: selectedProduct.coverImage }} style={s.modalCover} resizeMode="cover" />
              )}

              {/* 价格区域 */}
              <View style={s.modalPriceArea}>
                <View style={s.modalPriceRow}>
                  <Text style={s.modalPromoPrice}>${selectedProduct?.promoPrice}</Text>
                  {selectedProduct?.originalPrice && parseFloat(selectedProduct.originalPrice) > parseFloat(selectedProduct.promoPrice) && (
                    <>
                      <Text style={s.modalOriginalPrice}>${selectedProduct?.originalPrice}</Text>
                      <View style={s.modalDiscountBadge}>
                        <Text style={s.modalDiscountText}>
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
              <View style={s.modalTags}>
                {selectedProduct?.platform && (
                  <View style={[s.modalTag, { backgroundColor: "#1E40AF" }]}>
                    <Text style={s.modalTagText}>{selectedProduct.platform}</Text>
                  </View>
                )}
                {selectedProduct?.category && (
                  <View style={[s.modalTag, { backgroundColor: "#334155" }]}>
                    <Text style={s.modalTagText}>
                      {CATEGORIES.find(c => c.key === selectedProduct.category)?.label || selectedProduct.category}
                    </Text>
                  </View>
                )}
                {selectedProduct?.promoLabel && (
                  <View style={[s.modalTag, { backgroundColor: "#DC2626" }]}>
                    <Text style={s.modalTagText}>{selectedProduct.promoLabel}</Text>
                  </View>
                )}
                <View style={[s.modalTag, { backgroundColor: "rgba(245,158,11,0.2)" }]}>
                  <Text style={[s.modalTagText, { color: "#F59E0B" }]}>源头直供</Text>
                </View>
              </View>

              {selectedProduct?.description && (
                <Text style={s.modalDesc}>{selectedProduct.description}</Text>
              )}

              {selectedProduct?.detailContent && (
                <View style={s.modalDetail}>
                  <Text style={s.modalDetailTitle}>产品详情</Text>
                  <Text style={s.modalDetailContent}>{selectedProduct.detailContent}</Text>
                </View>
              )}

              {/* 截图画廊 */}
              {parseGallery(selectedProduct?.galleryImages).length > 0 && (
                <View style={s.modalGallery}>
                  <Text style={s.modalDetailTitle}>产品截图</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {parseGallery(selectedProduct?.galleryImages).map((img: string, i: number) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => { setGalleryIndex(i); setShowGallery(true); }}
                      >
                        <Image source={{ uri: img }} style={s.galleryThumb} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 购买方式 */}
              <View style={s.paymentSection}>
                <Text style={s.modalDetailTitle}>购买方式</Text>
                {selectedProduct?.paymentInfo ? (
                  <Text style={s.paymentText}>{selectedProduct.paymentInfo}</Text>
                ) : (
                  <View style={s.paymentSteps}>
                    {[
                      { num: "1", text: "点击下方按钮联系客服" },
                      { num: "2", text: "备注商品名称，确认库存" },
                      { num: "3", text: "支付后即时发货，支持 USDT / 支付宝 / 微信" },
                    ].map((step, i) => (
                      <View key={i} style={s.paymentStep}>
                        <View style={s.paymentStepNum}><Text style={s.paymentStepNumText}>{step.num}</Text></View>
                        <Text style={s.paymentStepText}>{step.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={s.buyButton}
                onPress={() => { setSelectedProduct(null); setShowContact(true); }}
              >
                <Ionicons name="cart" size={18} color="#0A0E1A" />
                <Text style={s.buyButtonText}>立即购买</Text>
              </TouchableOpacity>

              <View style={s.safetyNote}>
                <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                <Text style={s.safetyNoteText}>
                  源头直供 · 正版授权 · 源码可查 · 售后无忧
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 联系方式弹窗 */}
      <Modal visible={showContact} animationType="fade" transparent>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowContact(false)}>
          <View style={s.contactModal}>
            <View style={s.contactHeader}>
              <View style={s.contactIconWrap}>
                <Ionicons name="cart" size={28} color="#F59E0B" />
              </View>
              <Text style={s.contactTitle}>联系客服购买</Text>
            </View>
            <Text style={s.contactDesc}>
              备注商品名称，客服确认库存后即时发货
            </Text>
            <View style={s.contactMethods}>
              <TouchableOpacity
                style={[s.contactMethod, { backgroundColor: "#0088cc" }]}
                onPress={() => Linking.openURL(`https://t.me/${telegram.replace("@", "")}`)}
              >
                <Ionicons name="paper-plane" size={20} color="#fff" />
                <View>
                  <Text style={s.contactMethodLabel}>Telegram</Text>
                  <Text style={s.contactMethodValue}>{telegram}</Text>
                </View>
              </TouchableOpacity>
              <View style={[s.contactMethod, { backgroundColor: "#12B7F5" }]}>
                <Ionicons name="chatbox" size={20} color="#fff" />
                <View>
                  <Text style={s.contactMethodLabel}>QQ</Text>
                  <Text style={s.contactMethodValue}>{qq}</Text>
                </View>
              </View>
            </View>
            <View style={s.paymentMethods}>
              <Text style={s.paymentMethodsTitle}>支持的支付方式</Text>
              <View style={s.paymentMethodsRow}>
                {["USDT", "支付宝", "微信"].map((method) => (
                  <View key={method} style={s.paymentMethodChip}>
                    <Text style={s.paymentMethodChipText}>{method}</Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity style={s.contactCloseBtn} onPress={() => setShowContact(false)}>
              <Text style={s.contactCloseBtnText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 全屏图片查看 */}
      <Modal visible={showGallery} animationType="fade" transparent>
        <View style={s.galleryModal}>
          <TouchableOpacity style={s.galleryClose} onPress={() => setShowGallery(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedProduct && parseGallery(selectedProduct.galleryImages)[galleryIndex] && (
            <Image
              source={{ uri: parseGallery(selectedProduct.galleryImages)[galleryIndex] }}
              style={s.galleryFullImage}
              resizeMode="contain"
            />
          )}
          <View style={s.galleryNav}>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.max(0, galleryIndex - 1))}>
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={s.galleryCounter}>
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

const s = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#94A3B8" },

  // Back Button
  backButton: { position: "absolute", top: 16, left: 16, zIndex: 10 },
  backButtonInner: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },

  // Hero Banner
  heroBanner: { paddingTop: 60, paddingBottom: 32, paddingHorizontal: 20, backgroundColor: "#0A0E1A", position: "relative", overflow: "hidden" },
  heroGlow: { position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(245,158,11,0.08)" },
  heroGlow2: { position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(239,68,68,0.06)" },
  heroContent: { alignItems: "center", position: "relative", zIndex: 1 },
  sourceTag: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", marginBottom: 16 },
  sourceTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F59E0B", marginRight: 8 },
  sourceTagText: { color: "#F59E0B", fontSize: 13, fontWeight: "700" },
  heroTitle: { color: "#F1F5F9", fontSize: 32, fontWeight: "900", marginBottom: 12, textAlign: "center", letterSpacing: 1 },
  heroSubtitle: { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Hero Stats
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: 24, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", paddingVertical: 16, paddingHorizontal: 24 },
  heroStatItem: { flex: 1, alignItems: "center" },
  heroStatNum: { color: "#F59E0B", fontSize: 24, fontWeight: "900" },
  heroStatLabel: { color: "#94A3B8", fontSize: 11, marginTop: 4 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.08)" },

  // Authority Bar
  authorityBar: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", paddingVertical: 12 },
  authorityScroll: { paddingHorizontal: 16, gap: 16 },
  authorityItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorityText: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },

  // Category
  categoryBar: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  categoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  categoryChipActive: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  categoryChipText: { color: "#94A3B8", fontSize: 13, fontWeight: "500" },
  categoryChipTextActive: { color: "#0A0E1A", fontWeight: "700" },

  // Result Bar
  resultBar: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultText: { color: "#94A3B8", fontSize: 13 },
  resultBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(239,68,68,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  resultBadgeText: { color: "#EF4444", fontSize: 11, fontWeight: "700" },

  // Products Grid
  productsGrid: { paddingHorizontal: 12, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  productCard: {
    width: isDesktop ? (SCREEN_WIDTH - 60) / 3 : (SCREEN_WIDTH - 36) / 2,
    backgroundColor: "#111827",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.15)",
  },
  productImageWrap: { position: "relative" },
  productImage: { width: "100%", height: 140 },
  productImagePlaceholder: { backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center" },
  placeholderIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(245,158,11,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  placeholderText: { color: "#475569", fontSize: 10, fontWeight: "600" },
  discountBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "#EF4444", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  discountBadgeText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  promoLabel: { position: "absolute", top: 8, left: 8, backgroundColor: "#F59E0B", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 3 },
  promoLabelText: { color: "#0A0E1A", fontSize: 11, fontWeight: "800" },
  platformBadge: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(30,64,175,0.9)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  platformBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  productInfo: { padding: 12 },
  productTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "700", marginBottom: 4, lineHeight: 20 },
  productDesc: { color: "#64748B", fontSize: 11, lineHeight: 16, marginBottom: 8 },

  priceArea: { flexDirection: "row", alignItems: "baseline", gap: 2, marginBottom: 6 },
  priceSymbol: { color: "#EF4444", fontSize: 13, fontWeight: "800" },
  promoPrice: { color: "#EF4444", fontSize: 22, fontWeight: "900" },
  originalPrice: { color: "#475569", fontSize: 12, textDecorationLine: "line-through", marginLeft: 6 },

  // Countdown
  countdownWrap: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  countdownDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  countdownLabel: { color: "#EF4444", fontSize: 10, fontWeight: "700" },
  countdownBox: { backgroundColor: "rgba(239,68,68,0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  countdownText: { color: "#EF4444", fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] as any },

  // Stock
  stockInfo: { marginTop: 4 },
  stockBar: { height: 4, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" },
  stockBarFill: { height: "100%", borderRadius: 2 },
  stockText: { color: "#94A3B8", fontSize: 10, marginTop: 3, fontWeight: "600" },

  // Card Footer
  cardFooter: { paddingHorizontal: 12, paddingBottom: 12 },
  cardBuyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F59E0B", paddingVertical: 8, borderRadius: 8 },
  cardBuyBtnText: { color: "#0A0E1A", fontSize: 13, fontWeight: "800" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { color: "#94A3B8", fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySubtext: { color: "#64748B", fontSize: 13, marginTop: 4 },

  // Guarantee Section
  guaranteeSection: { paddingVertical: 32, paddingHorizontal: 16 },
  guaranteeSectionTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 20 },
  guaranteeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  guaranteeCard: { width: isDesktop ? (SCREEN_WIDTH - 80) / 4 : (SCREEN_WIDTH - 44) / 2, backgroundColor: "#111827", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(245,158,11,0.1)", alignItems: "center" },
  guaranteeIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(245,158,11,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  guaranteeCardTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  guaranteeCardDesc: { color: "#64748B", fontSize: 11, textAlign: "center", lineHeight: 16 },

  // Bottom CTA
  bottomCTA: { marginHorizontal: 16, marginTop: 8, padding: 24, borderRadius: 16, backgroundColor: "#111827", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)", alignItems: "center" },
  bottomCTATitle: { color: "#F1F5F9", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  bottomCTADesc: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 16 },
  bottomCTABtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F59E0B", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  bottomCTABtnText: { color: "#0A0E1A", fontSize: 15, fontWeight: "800" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "90%", backgroundColor: "#111827", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  modalTitle: { color: "#F1F5F9", fontSize: 18, fontWeight: "700", flex: 1, marginRight: 12 },
  modalBody: { padding: 20 },
  modalCover: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16 },

  modalPriceArea: { backgroundColor: "#0A0E1A", padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(245,158,11,0.15)" },
  modalPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  modalPromoPrice: { color: "#EF4444", fontSize: 28, fontWeight: "900" },
  modalOriginalPrice: { color: "#64748B", fontSize: 16, textDecorationLine: "line-through" },
  modalDiscountBadge: { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modalDiscountText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },

  modalTags: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  modalTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  modalTagText: { color: "#F1F5F9", fontSize: 12, fontWeight: "600" },

  modalDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginBottom: 16 },

  modalDetail: { marginBottom: 16 },
  modalDetailTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  modalDetailContent: { color: "#CBD5E1", fontSize: 13, lineHeight: 22 },

  modalGallery: { marginBottom: 16 },
  galleryThumb: { width: 180, height: 120, borderRadius: 8, marginRight: 10, backgroundColor: "#1E293B" },

  paymentSection: { marginBottom: 20 },
  paymentText: { color: "#CBD5E1", fontSize: 13, lineHeight: 22 },
  paymentSteps: { gap: 12 },
  paymentStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  paymentStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F59E0B", justifyContent: "center", alignItems: "center" },
  paymentStepNumText: { color: "#0A0E1A", fontSize: 14, fontWeight: "800" },
  paymentStepText: { color: "#CBD5E1", fontSize: 13, flex: 1 },

  buyButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F59E0B", paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  buyButtonText: { color: "#0A0E1A", fontSize: 16, fontWeight: "800" },

  safetyNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 8 },
  safetyNoteText: { color: "#F59E0B", fontSize: 12, fontWeight: "600" },

  // Contact Modal
  contactModal: { margin: 24, backgroundColor: "#111827", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" },
  contactHeader: { alignItems: "center", marginBottom: 12 },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(245,158,11,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  contactTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "700" },
  contactDesc: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 20 },
  contactMethods: { gap: 10, marginBottom: 16 },
  contactMethod: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 10 },
  contactMethodLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  contactMethodValue: { color: "#fff", fontSize: 15, fontWeight: "700" },
  paymentMethods: { marginBottom: 16 },
  paymentMethodsTitle: { color: "#94A3B8", fontSize: 12, marginBottom: 8 },
  paymentMethodsRow: { flexDirection: "row", gap: 8 },
  paymentMethodChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  paymentMethodChipText: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  contactCloseBtn: { alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)" },
  contactCloseBtnText: { color: "#F1F5F9", fontSize: 15, fontWeight: "600" },

  // Gallery Modal
  galleryModal: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  galleryClose: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 },
  galleryFullImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 },
  galleryNav: { flexDirection: "row", alignItems: "center", gap: 30, marginTop: 20 },
  galleryCounter: { color: "#fff", fontSize: 16 },
});
