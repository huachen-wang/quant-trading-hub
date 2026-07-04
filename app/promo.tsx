import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { PromoContactModal } from "@/components/promo/contact-modal";
import { PLACEHOLDER_PROMO_PRODUCTS, PROMO_ANNOUNCEMENTS, PROMO_CATEGORIES } from "@/components/promo/data";
import { PromoGalleryModal } from "@/components/promo/gallery-modal";
import { PromoProductCard } from "@/components/promo/product-card";
import { PromoProductDetailModal } from "@/components/promo/product-detail-modal";
import { createPromoStyles } from "@/components/promo/styles";
import type { PromoCategoryKey, PromoContactInfo, PromoProduct } from "@/components/promo/types";
import { trpc } from "@/lib/trpc";

export default function PromoPage() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;
  const cardWidth = isDesktop ? (Math.min(screenWidth, 1200) - 80) / 3 : "100%";
  const s = useMemo(
    () => createPromoStyles({ screenWidth, isDesktop, cardWidth }),
    [cardWidth, isDesktop, screenWidth],
  );

  const [activeCategory, setActiveCategory] = useState<PromoCategoryKey>("");
  const [selectedProduct, setSelectedProduct] = useState<PromoProduct | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [announcementIndex, setAnnouncementIndex] = useState(0);

  // 动画
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const announceFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    // 脉冲动画
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // 公告轮播
  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(announceFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setAnnouncementIndex(prev => (prev + 1) % PROMO_ANNOUNCEMENTS.length);
        Animated.timing(announceFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const { data: backendProducts, isLoading } = trpc.promo.list.useQuery({ category: activeCategory || undefined });
  const { data: contactSettings } = trpc.siteSettings.getContact.useQuery();

  const telegram = contactSettings?.telegram || "@xau6000";
  const qq1 = "1226426670";
  const qq2 = contactSettings?.qq || "3832001817";
  const wechat1 = "oooiniooo0624";
  const wechat2 = "xau6000";
  const contactInfo = useMemo<PromoContactInfo>(
    () => ({ telegram, qq1, qq2, wechat1, wechat2 }),
    [qq1, qq2, telegram, wechat1, wechat2],
  );

  const products = useMemo<PromoProduct[]>(
    () =>
      backendProducts && backendProducts.length > 0
        ? backendProducts
        : PLACEHOLDER_PROMO_PRODUCTS.filter((product) => !activeCategory || product.category === activeCategory),
    [activeCategory, backendProducts],
  );

  const openProductDetail = useCallback((product: PromoProduct) => {
    setSelectedProduct(product);
  }, []);

  const closeProductDetail = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  const openGallery = useCallback((index: number) => {
    setGalleryIndex(index);
    setShowGallery(true);
  }, []);

  const buySelectedProduct = useCallback(() => {
    setSelectedProduct(null);
    setShowContact(true);
  }, []);

  const closeContact = useCallback(() => setShowContact(false), []);
  const closeGallery = useCallback(() => setShowGallery(false), []);

  if (isLoading) {
    return <ScreenContainer><View style={s.loadingWrap}><ActivityIndicator size="large" color="#A8895A" /></View></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView style={s.page} showsVerticalScrollIndicator={false}>
        {/* 返回按钮 */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* ==================== 顶部 Hero ==================== */}
        <LinearGradient colors={["#0A1628", "#1a0a00", "#0A1628"]} style={s.hero}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: "center", width: "100%" }}>
            {/* 滚动公告条 */}
            <View style={s.announcementBar}>
              <View style={s.announceLive}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
              <Animated.Text style={[s.announceText, { opacity: announceFade }]}>
                {PROMO_ANNOUNCEMENTS[announcementIndex]}
              </Animated.Text>
            </View>

            {/* 主标题 */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={s.heroTitle}>全网EA源头提货</Text>
            </Animated.View>
            <View style={s.heroTitleLine} />
            <Text style={s.heroSubtitle}>SOURCE DIRECT · BEST PRICE</Text>

            <Text style={s.heroDesc}>
              我们不是中间商 —— 我们就是源头{"\n"}
              全网所有主流EA，我们均持有源码或具备独家优化能力
            </Text>

            {/* 核心数据 */}
            <View style={s.heroStats}>
              {[
                { num: "200+", label: "EA源码库", icon: "code-slash" },
                { num: "50+", label: "独家优化", icon: "flash" },
                { num: "1000+", label: "服务客户", icon: "people" },
                { num: "24h", label: "极速发货", icon: "rocket" },
              ].map((stat, i) => (
                <View key={i} style={s.heroStatItem}>
                  <Ionicons name={stat.icon as any} size={16} color="#A8895A" />
                  <Text style={s.heroStatNum}>{stat.num}</Text>
                  <Text style={s.heroStatLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* 权威标签条 */}
            <View style={s.authorityStrip}>
              {["源码级掌控", "正版授权", "独家优化", "全网最低价"].map((tag, i) => (
                <View key={i} style={s.authorityTag}>
                  <Ionicons name="checkmark-circle" size={12} color="#A8895A" />
                  <Text style={s.authorityTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ==================== 分类筛选 ==================== */}
        <View style={s.categorySection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryScroll}>
            {PROMO_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[s.categoryChip, isActive && s.categoryChipActive]}
                  onPress={() => setActiveCategory(cat.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={cat.icon as any} size={15} color={isActive ? "#0A1628" : "#F1F5F9"} />
                  <Text style={[s.categoryChipText, isActive && s.categoryChipTextActive]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 结果提示 */}
        <View style={s.resultBar}>
          <View style={s.resultCountRow}>
            <Text style={s.resultCount}>共</Text>
            <Text style={s.resultCountNum}>{products.length}</Text>
            <Text style={s.resultCount}>款精选</Text>
          </View>
          <View style={s.resultTip}>
            <Ionicons name="pricetag" size={13} color="#10B981" />
            <Text style={s.resultTipText}>全部比官方价低 30-70%</Text>
          </View>
        </View>

        {/* ==================== 产品列表 ==================== */}
        <View style={s.productList}>
          {products.map((product, index) => (
            <PromoProductCard
              key={product.id}
              product={product}
              index={index}
              styles={s}
              onPress={openProductDetail}
            />
          ))}
        </View>

        {/* 空状态 */}
        {products.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="search" size={48} color="#475569" />
            <Text style={s.emptyText}>该分类暂无商品</Text>
            <Text style={s.emptySubtext}>切换其他分类查看更多</Text>
          </View>
        )}

        {/* ==================== 为什么选择我们 ==================== */}
        <View style={s.whySection}>
          <Text style={s.whySectionTitle}>为什么在这里提货？</Text>
          <View style={s.whyGrid}>
            {[
              { icon: "diamond", title: "源头直供", desc: "持有全网主流EA源码\n非二手倒卖", color: "#A8895A" },
              { icon: "shield-checkmark", title: "正版保障", desc: "官方授权或源码编译\n杜绝后门木马", color: "#22C55E" },
              { icon: "rocket", title: "极速发货", desc: "付款后即时交付\n紧急需求可加急", color: "#3B82F6" },
              { icon: "build", title: "专属EA定制", desc: "自定义名称与调优模式\n无限授权 · 版权归属工作室", color: "#8B5CF6" },
              { icon: "headset", title: "终身售后", desc: "免费更新迭代\n技术问题随时响应", color: "#EC4899" },
              { icon: "cash", title: "全网最低", desc: "源头价格\n比任何渠道都便宜", color: "#EF4444" },
            ].map((item, i) => (
              <View key={i} style={s.whyItem}>
                <View style={[s.whyIconWrap, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={s.whyItemTitle}>{item.title}</Text>
                <Text style={s.whyItemDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ==================== 底部CTA ==================== */}
        <View style={s.bottomCta}>
          <LinearGradient colors={["#1E293B", "#0A1628"]} style={s.bottomCtaInner}>
            <Ionicons name="search" size={32} color="#A8895A" />
            <Text style={s.bottomCtaTitle}>没找到想要的EA？</Text>
            <Text style={s.bottomCtaDesc}>告诉我们名字，全网EA我们都能搞到源码{"\n"}支持专属EA定制：自定义策略名称与调优模式{"\n"}无限授权不受限 · 版权与联系方式替换为工作室品牌</Text>
            <TouchableOpacity style={s.bottomCtaBtn} onPress={() => setShowContact(true)}>
              <Ionicons name="chatbubbles" size={18} color="#0A1628" />
              <Text style={s.bottomCtaBtnText}>联系客服定制</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <PromoProductDetailModal
        product={selectedProduct}
        styles={s}
        onClose={closeProductDetail}
        onBuy={buySelectedProduct}
        onOpenGallery={openGallery}
      />
      <PromoContactModal
        visible={showContact}
        contact={contactInfo}
        styles={s}
        onClose={closeContact}
      />
      <PromoGalleryModal
        visible={showGallery}
        product={selectedProduct}
        galleryIndex={galleryIndex}
        styles={s}
        onClose={closeGallery}
        onIndexChange={setGalleryIndex}
      />
    </ScreenContainer>
  );
}
