import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  Dimensions, Modal, Linking, ActivityIndicator, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isDesktop = SCREEN_WIDTH >= 768;
const CARD_WIDTH = isDesktop ? (Math.min(SCREEN_WIDTH, 1200) - 64) / 3 : (SCREEN_WIDTH - 44) / 2;

// 分类
const CATEGORIES = [
  { key: "", label: "全部精选", icon: "diamond" },
  { key: "ea", label: "EA策略", icon: "trending-up" },
  { key: "indicator", label: "指标工具", icon: "analytics" },
  { key: "tool", label: "辅助工具", icon: "construct" },
  { key: "course", label: "实战教程", icon: "book" },
];

// 硬编码占位产品（当后台无数据时展示）
const PLACEHOLDER_PRODUCTS = [
  {
    id: -1, title: "Gold Scalper Pro 2026", description: "专业黄金剥头皮EA，纽约时段精准入场。经过3年实盘验证，最大回撤仅8.2%。",
    platform: "MT5", category: "ea", originalPrice: "599", promoPrice: "199",
    promoLabel: "限时3折", promoEndTime: "2026-05-01 00:00:00", stock: 20, soldCount: 14,
    detailContent: "Gold Scalper Pro 是一款专注于纽约时段的黄金剥头皮策略。采用多重过滤机制，结合波动率自适应算法，在低点差环境下实现稳定盈利。\n\n核心优势：\n• 3年实盘验证，年化收益120%+\n• 最大回撤仅8.2%\n• 自适应点差过滤，避免高点差时段\n• 内置资金管理模块",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
  },
  {
    id: -2, title: "Multi-Pair Hedge System", description: "多货币对冲套利系统，同时监控28个货币对，捕捉价差回归机会。",
    platform: "MT4", category: "ea", originalPrice: "1299", promoPrice: "499",
    promoLabel: "爆款直降", promoEndTime: "2026-04-30 00:00:00", stock: 15, soldCount: 9,
    detailContent: "Multi-Pair Hedge System 是一款专业级多货币对冲系统。同时监控28个主要货币对的价差关系，当价差偏离历史均值时自动建仓，等待价差回归获利。\n\n核心优势：\n• 28货币对实时监控\n• 统计套利算法\n• 自动风控与仓位管理\n• 适合$5000+账户",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
  },
  {
    id: -3, title: "Trend Rider EA", description: "趋势追踪型EA，大周期趋势判断+小周期精准入场，单边行情利润最大化。",
    platform: "MT5", category: "ea", originalPrice: "899", promoPrice: "349",
    promoLabel: "新品首发", promoEndTime: "2026-05-15 00:00:00", stock: 30, soldCount: 7,
    detailContent: "Trend Rider EA 采用多时间框架趋势分析技术，在H4确认趋势方向后，在M15寻找最佳入场点。配合动态止损和移动止盈，最大化单边行情利润。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
  },
  {
    id: -4, title: "Smart Grid Pro", description: "智能网格交易系统，自适应网格间距，震荡行情稳定收割。",
    platform: "MT4", category: "ea", originalPrice: "799", promoPrice: "299",
    promoLabel: "热卖中", promoEndTime: "2026-06-01 00:00:00", stock: 25, soldCount: 18,
    detailContent: "Smart Grid Pro 采用自适应网格间距算法，根据ATR动态调整网格密度。在震荡行情中稳定收割利润，遇到单边行情自动收缩仓位控制风险。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
  },
  {
    id: -5, title: "Order Flow Indicator", description: "机构级订单流指标，实时显示大单方向和关键价位。",
    platform: "MT5", category: "indicator", originalPrice: "399", promoPrice: "149",
    promoLabel: "独家", promoEndTime: "2026-05-20 00:00:00", stock: 50, soldCount: 23,
    detailContent: "Order Flow Indicator 是一款机构级订单流分析指标，实时解析市场微观结构，显示大单进出方向、关键支撑阻力位和流动性分布。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
  },
  {
    id: -6, title: "Risk Manager Pro", description: "专业风控工具，自动监控账户风险，超限自动平仓保护本金。",
    platform: "MT4", category: "tool", originalPrice: "199", promoPrice: "79",
    promoLabel: "必备工具", promoEndTime: "2026-07-01 00:00:00", stock: 100, soldCount: 45,
    detailContent: "Risk Manager Pro 是每个交易者必备的风控工具。实时监控账户回撤、单笔亏损、日亏损上限等指标，超过预设阈值自动平仓，保护您的本金安全。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
  },
];

// 权威能力标签
const AUTHORITY_BADGES = [
  { icon: "code-slash", text: "源码级掌控", desc: "全网EA源码库" },
  { icon: "shield-checkmark", text: "正版授权", desc: "官方渠道直供" },
  { icon: "flash", text: "独家优化", desc: "性能深度调优" },
  { icon: "lock-open", text: "破解能力", desc: "技术实力保障" },
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

  // 入场动画
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: backendProducts, isLoading } = trpc.promo.list.useQuery({ category: activeCategory || undefined });
  const { data: contactSettings } = trpc.siteSettings.getContact.useQuery();

  const telegram = contactSettings?.telegram || "@quantarsenal";
  const qq = contactSettings?.qq || "3832001817";

  // 合并后台数据和占位数据
  const products = (backendProducts && backendProducts.length > 0)
    ? backendProducts
    : PLACEHOLDER_PRODUCTS.filter(p => !activeCategory || p.category === activeCategory);

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

  // 倒计时
  const CountdownTimer = ({ endTime }: { endTime: string }) => {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(endTime).getTime();
        const diff = end - now;
        if (diff <= 0) { setTimeLeft("已结束"); clearInterval(timer); return; }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(days > 0 ? `${days}天${hours}时${mins}分` : `${hours}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`);
      }, 1000);
      return () => clearInterval(timer);
    }, [endTime]);
    return (
      <View style={s.countdownWrap}>
        <Ionicons name="time" size={12} color="#EF4444" />
        <Text style={s.countdownText}>{timeLeft}</Text>
      </View>
    );
  };

  if (isLoading) {
    return <ScreenContainer><View style={s.loadingWrap}><ActivityIndicator size="large" color="#D97706" /></View></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView style={s.page} showsVerticalScrollIndicator={false}>
        {/* 返回按钮 */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F1F5F9" />
        </TouchableOpacity>

        {/* ==================== 顶部 Hero ==================== */}
        <LinearGradient colors={["#0F172A", "#1E293B", "#0F172A"]} style={s.hero}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: "center" }}>
            {/* 顶部光效装饰线 */}
            <View style={s.heroGlow} />

            <View style={s.heroBadge}>
              <Ionicons name="flash" size={14} color="#D97706" />
              <Text style={s.heroBadgeText}>源头直供 · 全网最低</Text>
            </View>

            <Text style={s.heroTitle}>全网EA源头提货</Text>
            <Text style={s.heroSubtitle}>
              我们不是中间商 —— 我们是源头
            </Text>
            <Text style={s.heroDesc}>
              全网所有主流EA策略，我们均持有源码或具备破解/独家优化能力{"\n"}
              在这里提货，价格最低，版本最新，售后最强
            </Text>

            {/* 权威能力标签 */}
            <View style={s.authorityRow}>
              {AUTHORITY_BADGES.map((badge, i) => (
                <View key={i} style={s.authorityItem}>
                  <View style={s.authorityIconWrap}>
                    <Ionicons name={badge.icon as any} size={18} color="#D97706" />
                  </View>
                  <Text style={s.authorityText}>{badge.text}</Text>
                  <Text style={s.authorityDesc}>{badge.desc}</Text>
                </View>
              ))}
            </View>

            {/* 统计数据 */}
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statNum}>200+</Text>
                <Text style={s.statLabel}>EA源码库</Text>
              </View>
              <View style={[s.statItem, s.statDivider]}>
                <Text style={s.statNum}>50+</Text>
                <Text style={s.statLabel}>独家优化版</Text>
              </View>
              <View style={[s.statItem, s.statDivider]}>
                <Text style={s.statNum}>1000+</Text>
                <Text style={s.statLabel}>服务客户</Text>
              </View>
              <View style={[s.statItem, s.statDivider]}>
                <Text style={s.statNum}>24h</Text>
                <Text style={s.statLabel}>极速发货</Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ==================== 分类筛选 ==================== */}
        <View style={s.categorySection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[s.categoryChip, activeCategory === cat.key && s.categoryChipActive]}
                onPress={() => setActiveCategory(cat.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={cat.icon as any} size={14} color={activeCategory === cat.key ? "#0F172A" : "#94A3B8"} />
                <Text style={[s.categoryChipText, activeCategory === cat.key && s.categoryChipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 结果数量 + 提示 */}
        <View style={s.resultBar}>
          <Text style={s.resultCount}>
            <Text style={{ color: "#D97706", fontWeight: "800" }}>{products.length}</Text> 款精选商品
          </Text>
          <View style={s.resultTip}>
            <Ionicons name="pricetag" size={12} color="#10B981" />
            <Text style={s.resultTipText}>全部比官方价低30-70%</Text>
          </View>
        </View>

        {/* ==================== 产品网格 ==================== */}
        <View style={s.grid}>
          {products.map((product: any) => {
            const discount = calcDiscount(product.originalPrice, product.promoPrice);
            const remaining = (product.stock || 0) - (product.soldCount || 0);
            const stockPercent = product.stock ? Math.max(5, (remaining / product.stock) * 100) : 100;
            const isUrgent = remaining > 0 && remaining <= 5;

            return (
              <TouchableOpacity
                key={product.id}
                style={s.card}
                onPress={() => setSelectedProduct(product)}
                activeOpacity={0.88}
              >
                {/* 封面区域 */}
                <View style={s.cardCoverWrap}>
                  {product.coverImage ? (
                    <Image source={{ uri: product.coverImage }} style={s.cardCover} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={["#1E293B", "#334155"]} style={s.cardCoverPlaceholder}>
                      <Ionicons name="cube" size={36} color="#475569" />
                      <Text style={s.cardCoverPlaceholderText}>{product.platform || "EA"}</Text>
                    </LinearGradient>
                  )}

                  {/* 折扣角标 */}
                  {discount > 0 && (
                    <View style={s.discountCorner}>
                      <Text style={s.discountCornerText}>-{discount}%</Text>
                    </View>
                  )}

                  {/* 促销标签 */}
                  {product.promoLabel && (
                    <View style={s.promoTag}>
                      <Ionicons name="flash" size={10} color="#0F172A" />
                      <Text style={s.promoTagText}>{product.promoLabel}</Text>
                    </View>
                  )}

                  {/* 平台标签 */}
                  {product.platform && (
                    <View style={s.platformTag}>
                      <Text style={s.platformTagText}>{product.platform}</Text>
                    </View>
                  )}
                </View>

                {/* 信息区域 */}
                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={2}>{product.title}</Text>
                  {product.description && (
                    <Text style={s.cardDesc} numberOfLines={2}>{product.description}</Text>
                  )}

                  {/* 价格 */}
                  <View style={s.priceRow}>
                    <Text style={s.promoPrice}>${product.promoPrice}</Text>
                    {product.originalPrice && parseFloat(product.originalPrice) > parseFloat(product.promoPrice) && (
                      <Text style={s.originalPrice}>${product.originalPrice}</Text>
                    )}
                  </View>

                  {/* 倒计时 */}
                  {product.promoEndTime && <CountdownTimer endTime={product.promoEndTime} />}

                  {/* 库存进度条 */}
                  {product.stock > 0 && (
                    <View style={s.stockSection}>
                      <View style={s.stockBar}>
                        <LinearGradient
                          colors={isUrgent ? ["#DC2626", "#EF4444"] : ["#D97706", "#F59E0B"]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={[s.stockBarFill, { width: `${stockPercent}%` }]}
                        />
                      </View>
                      <Text style={[s.stockText, isUrgent && { color: "#EF4444" }]}>
                        {isUrgent ? `仅剩${remaining}份!` : `剩余${remaining}/${product.stock}`}
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
        {products.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="search" size={48} color="#475569" />
            <Text style={s.emptyText}>该分类暂无商品</Text>
            <Text style={s.emptySubtext}>切换其他分类查看更多</Text>
          </View>
        )}

        {/* ==================== 底部信任区 ==================== */}
        <View style={s.trustSection}>
          <Text style={s.trustTitle}>为什么选择我们提货？</Text>
          <View style={s.trustGrid}>
            {[
              { icon: "diamond", title: "源头直供", desc: "持有全网主流EA源码，非二手倒卖" },
              { icon: "shield-checkmark", title: "正版保障", desc: "官方授权或源码编译，杜绝后门" },
              { icon: "rocket", title: "极速发货", desc: "付款后24小时内交付，紧急可加急" },
              { icon: "build", title: "独家调优", desc: "可根据需求定制参数，深度优化" },
              { icon: "headset", title: "终身售后", desc: "免费更新迭代，技术问题随时响应" },
              { icon: "cash", title: "全网最低", desc: "源头价格，比任何渠道都便宜30%+" },
            ].map((item, i) => (
              <View key={i} style={s.trustItem}>
                <View style={s.trustIconWrap}>
                  <Ionicons name={item.icon as any} size={20} color="#D97706" />
                </View>
                <Text style={s.trustItemTitle}>{item.title}</Text>
                <Text style={s.trustItemDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 底部CTA */}
        <View style={s.bottomCta}>
          <Text style={s.bottomCtaTitle}>没找到想要的EA？</Text>
          <Text style={s.bottomCtaDesc}>告诉我们名字，全网EA我们都能搞到源码</Text>
          <TouchableOpacity style={s.bottomCtaBtn} onPress={() => setShowContact(true)}>
            <Ionicons name="chatbubbles" size={18} color="#0F172A" />
            <Text style={s.bottomCtaBtnText}>联系客服定制</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ==================== 产品详情弹窗 ==================== */}
      <Modal visible={!!selectedProduct} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>{selectedProduct?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {/* 封面 */}
              {selectedProduct?.coverImage ? (
                <Image source={{ uri: selectedProduct.coverImage }} style={s.modalCover} resizeMode="cover" />
              ) : (
                <LinearGradient colors={["#1E293B", "#334155"]} style={[s.modalCover, { justifyContent: "center", alignItems: "center" }]}>
                  <Ionicons name="cube" size={48} color="#475569" />
                </LinearGradient>
              )}

              {/* 价格区 */}
              <LinearGradient colors={["#7F1D1D", "#991B1B"]} style={s.modalPriceBox}>
                <View style={s.modalPriceRow}>
                  <Text style={s.modalPromoPrice}>${selectedProduct?.promoPrice}</Text>
                  {selectedProduct?.originalPrice && parseFloat(selectedProduct.originalPrice) > parseFloat(selectedProduct.promoPrice) && (
                    <>
                      <Text style={s.modalOriginalPrice}>${selectedProduct?.originalPrice}</Text>
                      <View style={s.modalSaveBadge}>
                        <Text style={s.modalSaveText}>
                          省${(parseFloat(selectedProduct.originalPrice) - parseFloat(selectedProduct.promoPrice)).toFixed(0)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
                {selectedProduct?.promoEndTime && <CountdownTimer endTime={selectedProduct.promoEndTime} />}
              </LinearGradient>

              {/* 标签 */}
              <View style={s.modalTags}>
                {selectedProduct?.platform && (
                  <View style={[s.modalTag, { backgroundColor: "#1E40AF" }]}>
                    <Text style={s.modalTagText}>{selectedProduct.platform}</Text>
                  </View>
                )}
                {selectedProduct?.category && (
                  <View style={[s.modalTag, { backgroundColor: "#334155" }]}>
                    <Text style={s.modalTagText}>{CATEGORIES.find(c => c.key === selectedProduct.category)?.label || selectedProduct.category}</Text>
                  </View>
                )}
                {selectedProduct?.promoLabel && (
                  <View style={[s.modalTag, { backgroundColor: "#D97706" }]}>
                    <Text style={[s.modalTagText, { color: "#0F172A" }]}>{selectedProduct.promoLabel}</Text>
                  </View>
                )}
                <View style={[s.modalTag, { backgroundColor: "rgba(245,158,11,0.2)" }]}>
                  <Text style={[s.modalTagText, { color: "#F59E0B" }]}>源头直供</Text>
                </View>
              </View>

              {/* 描述 */}
              {selectedProduct?.description && <Text style={s.modalDesc}>{selectedProduct.description}</Text>}

              {/* 详情 */}
              {selectedProduct?.detailContent && (
                <View style={s.modalDetailSection}>
                  <Text style={s.modalSectionTitle}>产品详情</Text>
                  <Text style={s.modalDetailContent}>{selectedProduct.detailContent}</Text>
                </View>
              )}

              {/* 截图画廊 */}
              {parseGallery(selectedProduct?.galleryImages).length > 0 && (
                <View style={s.modalGallerySection}>
                  <Text style={s.modalSectionTitle}>实盘截图</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {parseGallery(selectedProduct?.galleryImages).map((img: string, i: number) => (
                      <TouchableOpacity key={i} onPress={() => { setGalleryIndex(i); setShowGallery(true); }}>
                        <Image source={{ uri: img }} style={s.galleryThumb} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 购买流程 */}
              <View style={s.buyProcessSection}>
                <Text style={s.modalSectionTitle}>购买流程</Text>
                {[
                  { num: "1", text: "点击下方「立即购买」联系客服" },
                  { num: "2", text: "备注商品名称，确认库存与版本" },
                  { num: "3", text: "支付后即时发货 (USDT / 支付宝 / 微信)" },
                ].map((step) => (
                  <View key={step.num} style={s.buyStep}>
                    <View style={s.buyStepNum}><Text style={s.buyStepNumText}>{step.num}</Text></View>
                    <Text style={s.buyStepText}>{step.text}</Text>
                  </View>
                ))}
              </View>

              {/* 购买按钮 */}
              <TouchableOpacity style={s.buyBtn} onPress={() => { setSelectedProduct(null); setShowContact(true); }}>
                <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.buyBtnGradient}>
                  <Ionicons name="cart" size={20} color="#0F172A" />
                  <Text style={s.buyBtnText}>立即购买</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={s.safetyNote}>
                <Ionicons name="shield-checkmark" size={14} color="#64748B" />
                <Text style={s.safetyNoteText}>源头直供 · 正版授权 · 终身售后</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== 联系方式弹窗 ==================== */}
      <Modal visible={showContact} animationType="fade" transparent>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowContact(false)}>
          <View style={s.contactModal}>
            <LinearGradient colors={["#1E293B", "#0F172A"]} style={s.contactModalInner}>
              <View style={s.contactHeader}>
                <View style={s.contactIconWrap}>
                  <Ionicons name="cart" size={28} color="#D97706" />
                </View>
                <Text style={s.contactTitle}>联系客服购买</Text>
                <Text style={s.contactDesc}>备注商品名称，客服确认库存后即时发货</Text>
              </View>

              <View style={s.contactMethods}>
                <TouchableOpacity
                  style={[s.contactMethod, { backgroundColor: "#0088cc" }]}
                  onPress={() => Linking.openURL(`https://t.me/${telegram.replace("@", "")}`)}
                >
                  <Ionicons name="paper-plane" size={22} color="#fff" />
                  <View>
                    <Text style={s.contactMethodLabel}>Telegram</Text>
                    <Text style={s.contactMethodValue}>{telegram}</Text>
                  </View>
                </TouchableOpacity>
                <View style={[s.contactMethod, { backgroundColor: "#12B7F5" }]}>
                  <Ionicons name="chatbox" size={22} color="#fff" />
                  <View>
                    <Text style={s.contactMethodLabel}>QQ</Text>
                    <Text style={s.contactMethodValue}>{qq}</Text>
                  </View>
                </View>
              </View>

              <View style={s.payMethods}>
                <Text style={s.payMethodsTitle}>支持的支付方式</Text>
                <View style={s.payMethodsRow}>
                  {["USDT", "支付宝", "微信", "银行卡"].map((m) => (
                    <View key={m} style={s.payMethodChip}>
                      <Text style={s.payMethodChipText}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={s.contactCloseBtn} onPress={() => setShowContact(false)}>
                <Text style={s.contactCloseBtnText}>关闭</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 全屏图片 */}
      <Modal visible={showGallery} animationType="fade" transparent>
        <View style={s.galleryModal}>
          <TouchableOpacity style={s.galleryClose} onPress={() => setShowGallery(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedProduct && parseGallery(selectedProduct.galleryImages)[galleryIndex] && (
            <Image source={{ uri: parseGallery(selectedProduct.galleryImages)[galleryIndex] }} style={s.galleryFullImage} resizeMode="contain" />
          )}
          <View style={s.galleryNav}>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.max(0, galleryIndex - 1))}>
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={s.galleryCounter}>{galleryIndex + 1} / {parseGallery(selectedProduct?.galleryImages).length}</Text>
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
  page: { flex: 1, backgroundColor: "#0F172A" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  backBtn: { position: "absolute", top: 16, left: 16, zIndex: 10, padding: 8, backgroundColor: "rgba(15,23,42,0.6)", borderRadius: 20 },

  // Hero
  hero: { paddingTop: 70, paddingBottom: 32, paddingHorizontal: 20 },
  heroGlow: { width: 120, height: 3, backgroundColor: "#D97706", borderRadius: 2, marginBottom: 20, opacity: 0.8 },
  heroBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(217,119,6,0.15)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, gap: 6, marginBottom: 16, borderWidth: 1, borderColor: "rgba(217,119,6,0.3)" },
  heroBadgeText: { color: "#D97706", fontSize: 13, fontWeight: "700" },
  heroTitle: { color: "#F1F5F9", fontSize: 32, fontWeight: "900", marginBottom: 8, textAlign: "center", letterSpacing: 2 },
  heroSubtitle: { color: "#D97706", fontSize: 16, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  heroDesc: { color: "#94A3B8", fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 24, maxWidth: 500 },

  // Authority
  authorityRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: 24, width: "100%" },
  authorityItem: { alignItems: "center", width: isDesktop ? 120 : 72 },
  authorityIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(217,119,6,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 6, borderWidth: 1, borderColor: "rgba(217,119,6,0.3)" },
  authorityText: { color: "#F1F5F9", fontSize: 11, fontWeight: "700", textAlign: "center" },
  authorityDesc: { color: "#64748B", fontSize: 9, textAlign: "center", marginTop: 2 },

  // Stats
  statsRow: { flexDirection: "row", backgroundColor: "rgba(30,41,59,0.8)", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 8, width: "100%", maxWidth: 500, borderWidth: 1, borderColor: "#334155" },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { borderLeftWidth: 1, borderLeftColor: "#334155" },
  statNum: { color: "#D97706", fontSize: 20, fontWeight: "900", marginBottom: 2 },
  statLabel: { color: "#94A3B8", fontSize: 10 },

  // Category
  categorySection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  categoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: "#1E293B", borderWidth: 1, borderColor: "#334155" },
  categoryChipActive: { backgroundColor: "#D97706", borderColor: "#D97706" },
  categoryChipText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  categoryChipTextActive: { color: "#0F172A", fontWeight: "800" },

  // Result
  resultBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
  resultCount: { color: "#94A3B8", fontSize: 13 },
  resultTip: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultTipText: { color: "#10B981", fontSize: 11, fontWeight: "600" },

  // Grid
  grid: { paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: CARD_WIDTH, backgroundColor: "#1E293B", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#334155" },
  cardCoverWrap: { position: "relative" },
  cardCover: { width: "100%", height: 140 },
  cardCoverPlaceholder: { width: "100%", height: 140, justifyContent: "center", alignItems: "center" },
  cardCoverPlaceholderText: { color: "#475569", fontSize: 10, fontWeight: "700", marginTop: 4 },

  discountCorner: { position: "absolute", top: 0, right: 0, backgroundColor: "#DC2626", paddingHorizontal: 10, paddingVertical: 5, borderBottomLeftRadius: 12 },
  discountCornerText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  promoTag: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#D97706", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  promoTagText: { color: "#0F172A", fontSize: 10, fontWeight: "800" },
  platformTag: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(30,64,175,0.9)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  platformTagText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  cardBody: { padding: 12 },
  cardTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "800", marginBottom: 4, lineHeight: 20 },
  cardDesc: { color: "#94A3B8", fontSize: 11, lineHeight: 16, marginBottom: 8 },

  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 6 },
  promoPrice: { color: "#EF4444", fontSize: 20, fontWeight: "900" },
  originalPrice: { color: "#64748B", fontSize: 13, textDecorationLine: "line-through" },

  countdownWrap: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6, backgroundColor: "rgba(239,68,68,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  countdownText: { color: "#EF4444", fontSize: 11, fontWeight: "700" },

  stockSection: { marginTop: 4 },
  stockBar: { height: 4, backgroundColor: "#334155", borderRadius: 2, overflow: "hidden" },
  stockBarFill: { height: "100%", borderRadius: 2 },
  stockText: { color: "#94A3B8", fontSize: 10, marginTop: 3, fontWeight: "600" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { color: "#94A3B8", fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySubtext: { color: "#64748B", fontSize: 13, marginTop: 4 },

  // Trust
  trustSection: { marginTop: 32, paddingHorizontal: 20, paddingVertical: 24, borderTopWidth: 1, borderTopColor: "#1E293B" },
  trustTitle: { color: "#F1F5F9", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 20 },
  trustGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  trustItem: { width: isDesktop ? "31%" : "47%", flexGrow: 1, backgroundColor: "#1E293B", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155" },
  trustIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(217,119,6,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  trustItemTitle: { color: "#F1F5F9", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  trustItemDesc: { color: "#94A3B8", fontSize: 11, lineHeight: 16 },

  // Bottom CTA
  bottomCta: { marginHorizontal: 20, marginTop: 24, backgroundColor: "#1E293B", borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#D97706", borderStyle: "dashed" as any },
  bottomCtaTitle: { color: "#F1F5F9", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  bottomCtaDesc: { color: "#94A3B8", fontSize: 13, marginBottom: 16, textAlign: "center" },
  bottomCtaBtn: { backgroundColor: "#D97706", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  bottomCtaBtnText: { color: "#0F172A", fontSize: 15, fontWeight: "800" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "92%", backgroundColor: "#1E293B", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#334155" },
  modalTitle: { color: "#F1F5F9", fontSize: 18, fontWeight: "800", flex: 1, marginRight: 12 },
  modalBody: { padding: 20 },
  modalCover: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16 },

  modalPriceBox: { padding: 16, borderRadius: 12, marginBottom: 16 },
  modalPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  modalPromoPrice: { color: "#fff", fontSize: 32, fontWeight: "900" },
  modalOriginalPrice: { color: "rgba(255,255,255,0.5)", fontSize: 16, textDecorationLine: "line-through" },
  modalSaveBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modalSaveText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  modalTags: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  modalTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  modalTagText: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },

  modalDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginBottom: 16 },

  modalDetailSection: { marginBottom: 16 },
  modalSectionTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  modalDetailContent: { color: "#94A3B8", fontSize: 13, lineHeight: 22 },

  modalGallerySection: { marginBottom: 16 },
  galleryThumb: { width: 120, height: 80, borderRadius: 8, marginRight: 10 },

  buyProcessSection: { marginBottom: 20 },
  buyStep: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  buyStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#D97706", justifyContent: "center", alignItems: "center" },
  buyStepNumText: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
  buyStepText: { color: "#CBD5E1", fontSize: 13, flex: 1 },

  buyBtn: { marginBottom: 12 },
  buyBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  buyBtnText: { color: "#0F172A", fontSize: 16, fontWeight: "900" },

  safetyNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  safetyNoteText: { color: "#64748B", fontSize: 12 },

  // Contact Modal
  contactModal: { marginHorizontal: 20, borderRadius: 20, overflow: "hidden" },
  contactModalInner: { padding: 24 },
  contactHeader: { alignItems: "center", marginBottom: 20 },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(217,119,6,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  contactTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "800", marginBottom: 6 },
  contactDesc: { color: "#94A3B8", fontSize: 13, textAlign: "center" },
  contactMethods: { gap: 10, marginBottom: 16 },
  contactMethod: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 12 },
  contactMethodLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  contactMethodValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
  payMethods: { marginBottom: 16 },
  payMethodsTitle: { color: "#94A3B8", fontSize: 12, marginBottom: 8, textAlign: "center" },
  payMethodsRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  payMethodChip: { backgroundColor: "#334155", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  payMethodChipText: { color: "#F1F5F9", fontSize: 12, fontWeight: "600" },
  contactCloseBtn: { alignItems: "center", paddingVertical: 12 },
  contactCloseBtnText: { color: "#94A3B8", fontSize: 14 },

  // Gallery Modal
  galleryModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  galleryClose: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  galleryFullImage: { width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40, borderRadius: 8 },
  galleryNav: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 20 },
  galleryCounter: { color: "#fff", fontSize: 14 },
});
