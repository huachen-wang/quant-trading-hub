import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  Dimensions, Modal, Linking, ActivityIndicator, Animated, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isDesktop = SCREEN_WIDTH >= 768;
const CARD_WIDTH = isDesktop ? (Math.min(SCREEN_WIDTH, 1200) - 80) / 3 : SCREEN_WIDTH - 40;

// 分类
const CATEGORIES = [
  { key: "", label: "🔥 全部精选", icon: "diamond" },
  { key: "ea", label: "EA策略", icon: "trending-up" },
  { key: "indicator", label: "指标工具", icon: "analytics" },
  { key: "tool", label: "辅助工具", icon: "construct" },
  { key: "course", label: "实战教程", icon: "book" },
];

// 硬编码占位产品 - 更真实的数据
const PLACEHOLDER_PRODUCTS = [
  {
    id: -1, title: "Gold Scalper Pro 2026",
    description: "纽约时段黄金剥头皮EA · 3年实盘验证 · 年化120%+ · 最大回撤8.2%",
    platform: "MT5", category: "ea", originalPrice: "599", promoPrice: "199",
    promoLabel: "限时3折", promoEndTime: "2026-05-01 00:00:00", stock: 20, soldCount: 14,
    detailContent: "Gold Scalper Pro 是一款专注于纽约时段的黄金剥头皮策略。采用多重过滤机制，结合波动率自适应算法，在低点差环境下实现稳定盈利。\n\n核心优势：\n• 3年实盘验证，年化收益120%+\n• 最大回撤仅8.2%\n• 自适应点差过滤\n• 内置资金管理模块",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
    metrics: { winRate: "78%", profit: "120%", drawdown: "8.2%", trades: "3,200+" },
  },
  {
    id: -2, title: "Multi-Pair Hedge System",
    description: "28货币对冲套利 · 统计套利算法 · 适合$5000+账户 · 稳定月化5-8%",
    platform: "MT4", category: "ea", originalPrice: "1299", promoPrice: "499",
    promoLabel: "爆款直降", promoEndTime: "2026-04-30 00:00:00", stock: 15, soldCount: 9,
    detailContent: "Multi-Pair Hedge System 是一款专业级多货币对冲系统。同时监控28个主要货币对的价差关系，当价差偏离历史均值时自动建仓，等待价差回归获利。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
    metrics: { winRate: "85%", profit: "72%", drawdown: "12%", trades: "1,800+" },
  },
  {
    id: -3, title: "Trend Rider EA",
    description: "多时间框架趋势追踪 · H4+M15双重确认 · 动态止损 · 单边行情利润最大化",
    platform: "MT5", category: "ea", originalPrice: "899", promoPrice: "349",
    promoLabel: "新品首发", promoEndTime: "2026-05-15 00:00:00", stock: 30, soldCount: 7,
    detailContent: "Trend Rider EA 采用多时间框架趋势分析技术，在H4确认趋势方向后，在M15寻找最佳入场点。配合动态止损和移动止盈，最大化单边行情利润。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
    metrics: { winRate: "62%", profit: "180%", drawdown: "15%", trades: "960+" },
  },
  {
    id: -4, title: "Smart Grid Pro",
    description: "自适应网格交易 · ATR动态间距 · 震荡行情稳定收割 · 自动风控",
    platform: "MT4", category: "ea", originalPrice: "799", promoPrice: "299",
    promoLabel: "热卖中", promoEndTime: "2026-06-01 00:00:00", stock: 25, soldCount: 18,
    detailContent: "Smart Grid Pro 采用自适应网格间距算法，根据ATR动态调整网格密度。在震荡行情中稳定收割利润，遇到单边行情自动收缩仓位控制风险。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
    metrics: { winRate: "91%", profit: "96%", drawdown: "18%", trades: "5,400+" },
  },
  {
    id: -5, title: "Order Flow Indicator",
    description: "机构级订单流指标 · 大单方向实时解析 · 关键价位标注 · 流动性分布",
    platform: "MT5", category: "indicator", originalPrice: "399", promoPrice: "149",
    promoLabel: "独家", promoEndTime: "2026-05-20 00:00:00", stock: 50, soldCount: 23,
    detailContent: "Order Flow Indicator 是一款机构级订单流分析指标，实时解析市场微观结构，显示大单进出方向、关键支撑阻力位和流动性分布。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
    metrics: { winRate: "-", profit: "-", drawdown: "-", trades: "-" },
  },
  {
    id: -6, title: "Risk Manager Pro",
    description: "专业风控工具 · 自动监控回撤 · 超限自动平仓 · 每个交易者必备",
    platform: "MT4", category: "tool", originalPrice: "199", promoPrice: "79",
    promoLabel: "必备工具", promoEndTime: "2026-07-01 00:00:00", stock: 100, soldCount: 45,
    detailContent: "Risk Manager Pro 是每个交易者必备的风控工具。实时监控账户回撤、单笔亏损、日亏损上限等指标，超过预设阈值自动平仓，保护您的本金安全。",
    coverImage: null, galleryImages: null, paymentInfo: null, contactInfo: null, status: "active",
    metrics: { winRate: "-", profit: "-", drawdown: "-", trades: "-" },
  },
];

// 顶部滚动公告
const ANNOUNCEMENTS = [
  "🔥 Gold Scalper Pro 限时3折，仅剩6份",
  "⚡ 新品 Trend Rider EA 首发特惠",
  "💎 全网EA源码直供，价格低至1折",
  "🛡️ 正版授权 · 终身售后 · 源头直供",
];

export default function PromoPage() {
  const colors = useColors();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
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
        setAnnouncementIndex(prev => (prev + 1) % ANNOUNCEMENTS.length);
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

  // 倒计时组件
  const CountdownTimer = ({ endTime, large }: { endTime: string; large?: boolean }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0, ended: false });
    useEffect(() => {
      const timer = setInterval(() => {
        const diff = new Date(endTime).getTime() - Date.now();
        if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0, ended: true }); clearInterval(timer); return; }
        setTimeLeft({
          days: Math.floor(diff / 86400000),
          hours: Math.floor((diff % 86400000) / 3600000),
          mins: Math.floor((diff % 3600000) / 60000),
          secs: Math.floor((diff % 60000) / 1000),
          ended: false,
        });
      }, 1000);
      return () => clearInterval(timer);
    }, [endTime]);

    if (timeLeft.ended) return <Text style={[s.countdownEnded, large && { fontSize: 14 }]}>已结束</Text>;

    return (
      <View style={[s.countdownRow, large && { gap: 6 }]}>
        {timeLeft.days > 0 && (
          <>
            <View style={[s.countdownBlock, large && s.countdownBlockLg]}>
              <Text style={[s.countdownNum, large && { fontSize: 16 }]}>{timeLeft.days}</Text>
            </View>
            <Text style={s.countdownSep}>天</Text>
          </>
        )}
        <View style={[s.countdownBlock, large && s.countdownBlockLg]}>
          <Text style={[s.countdownNum, large && { fontSize: 16 }]}>{String(timeLeft.hours).padStart(2, "0")}</Text>
        </View>
        <Text style={s.countdownSep}>:</Text>
        <View style={[s.countdownBlock, large && s.countdownBlockLg]}>
          <Text style={[s.countdownNum, large && { fontSize: 16 }]}>{String(timeLeft.mins).padStart(2, "0")}</Text>
        </View>
        <Text style={s.countdownSep}>:</Text>
        <View style={[s.countdownBlock, large && s.countdownBlockLg]}>
          <Text style={[s.countdownNum, large && { fontSize: 16 }]}>{String(timeLeft.secs).padStart(2, "0")}</Text>
        </View>
      </View>
    );
  };

  // 产品卡片颜色主题
  const getCardTheme = (index: number) => {
    const themes = [
      { gradient: ["#7F1D1D", "#991B1B", "#B91C1C"] as const, accent: "#FCA5A5", badge: "#DC2626" },
      { gradient: ["#78350F", "#92400E", "#B45309"] as const, accent: "#E8CC97", badge: "#A8895A" },
      { gradient: ["#1E3A5F", "#1E40AF", "#2563EB"] as const, accent: "#93C5FD", badge: "#3B82F6" },
      { gradient: ["#14532D", "#166534", "#15803D"] as const, accent: "#86EFAC", badge: "#22C55E" },
      { gradient: ["#4C1D95", "#5B21B6", "#7C3AED"] as const, accent: "#C4B5FD", badge: "#8B5CF6" },
      { gradient: ["#831843", "#9D174D", "#BE185D"] as const, accent: "#F9A8D4", badge: "#EC4899" },
    ];
    return themes[index % themes.length];
  };

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
                {ANNOUNCEMENTS[announcementIndex]}
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
            {CATEGORIES.map((cat) => {
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
          <Text style={s.resultCount}>
            共 <Text style={{ color: "#A8895A", fontWeight: "900" }}>{products.length}</Text> 款精选
          </Text>
          <View style={s.resultTip}>
            <Ionicons name="pricetag" size={13} color="#10B981" />
            <Text style={s.resultTipText}>全部比官方价低 30-70%</Text>
          </View>
        </View>

        {/* ==================== 产品列表 ==================== */}
        <View style={s.productList}>
          {products.map((product: any, index: number) => {
            const discount = calcDiscount(product.originalPrice, product.promoPrice);
            const remaining = (product.stock || 0) - (product.soldCount || 0);
            const stockPercent = product.stock ? Math.max(5, (remaining / product.stock) * 100) : 100;
            const isUrgent = remaining > 0 && remaining <= 5;
            const theme = getCardTheme(index);
            const metrics = product.metrics || {};

            return (
              <TouchableOpacity
                key={product.id}
                style={[s.productCard]}
                onPress={() => setSelectedProduct(product)}
                activeOpacity={0.92}

              >
                {/* 卡片顶部 - 渐变色彩区 */}
                <LinearGradient
                  colors={[...theme.gradient] as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.cardHeader}
                >
                  {/* 折扣角标 */}
                  {discount > 0 && (
                    <View style={s.discountBadge}>
                      <Text style={s.discountBadgeText}>-{discount}%</Text>
                    </View>
                  )}

                  {/* 促销标签 */}
                  {product.promoLabel && (
                    <View style={[s.promoLabel, { backgroundColor: theme.badge }]}>
                      <Ionicons name="flash" size={11} color="#fff" />
                      <Text style={s.promoLabelText}>{product.promoLabel}</Text>
                    </View>
                  )}

                  {/* 封面图或图标 */}
                  <View style={s.cardHeaderContent}>
                    {product.coverImage ? (
                      <Image source={{ uri: product.coverImage }} style={s.cardCoverImage} resizeMode="cover" />
                    ) : (
                      <View style={s.cardIconWrap}>
                        <Ionicons
                          name={product.category === "indicator" ? "analytics" : product.category === "tool" ? "construct" : "cube"}
                          size={40}
                          color={theme.accent}
                        />
                      </View>
                    )}

                    <View style={s.cardHeaderInfo}>
                      <View style={s.cardPlatformBadge}>
                        <Text style={s.cardPlatformText}>{product.platform}</Text>
                      </View>
                      <Text style={s.cardHeaderTitle} numberOfLines={2}>{product.title}</Text>
                    </View>
                  </View>

                  {/* 价格区 */}
                  <View style={s.cardPriceArea}>
                    <View style={s.cardPriceLeft}>
                      <Text style={s.cardPromoPrice}>${product.promoPrice}</Text>
                      {product.originalPrice && (parseFloat(product.originalPrice) || 0) > (parseFloat(product.promoPrice) || 0) && (
                        <Text style={s.cardOriginalPrice}>${product.originalPrice}</Text>
                      )}
                    </View>
                    {discount > 0 && (
                      <View style={s.cardSaveBadge}>
                        <Text style={s.cardSaveText}>省 ${((parseFloat(product.originalPrice) || 0) - (parseFloat(product.promoPrice) || 0)).toFixed(0)}</Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>

                {/* 卡片底部 - 信息区 */}
                <View style={s.cardBody}>
                  <Text style={s.cardDesc} numberOfLines={2}>{product.description}</Text>

                  {/* 核心指标 - 仅EA类显示 */}
                  {metrics.winRate && metrics.winRate !== "-" && (
                    <View style={s.metricsRow}>
                      {[
                        { label: "胜率", value: metrics.winRate, color: "#22C55E" },
                        { label: "年化", value: metrics.profit, color: "#A8895A" },
                        { label: "回撤", value: metrics.drawdown, color: "#EF4444" },
                      ].map((m, i) => (
                        <View key={i} style={s.metricItem}>
                          <Text style={[s.metricValue, { color: m.color }]}>{m.value}</Text>
                          <Text style={s.metricLabel}>{m.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 倒计时 + 库存 */}
                  <View style={s.cardFooter}>
                    <View style={s.cardFooterLeft}>
                      {product.promoEndTime && <CountdownTimer endTime={product.promoEndTime} />}
                    </View>
                    {product.stock > 0 && (
                      <View style={s.stockInfo}>
                        <View style={s.stockBarOuter}>
                          <LinearGradient
                            colors={isUrgent ? ["#DC2626", "#EF4444"] : ["#A8895A", "#C9A96E"]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={[s.stockBarInner, { width: `${stockPercent}%` }]}
                          />
                        </View>
                        <Text style={[s.stockText, isUrgent && { color: "#EF4444" }]}>
                          {isUrgent ? `仅剩${remaining}份!` : `${product.soldCount || 0}人已购`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* 购买按钮 */}
                  <TouchableOpacity
                    style={[s.cardBuyBtn, { backgroundColor: theme.badge }]}
                    onPress={() => setSelectedProduct(product)}
                  >
                    <Ionicons name="cart" size={16} color="#fff" />
                    <Text style={s.cardBuyBtnText}>立即抢购</Text>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
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

      {/* ==================== 产品详情弹窗 ==================== */}
      {selectedProduct && <Modal visible={!!selectedProduct} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>{selectedProduct?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                <Ionicons name="close-circle" size={28} color="#F1F5F9" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {/* 封面 */}
              {selectedProduct?.coverImage ? (
                <Image source={{ uri: selectedProduct.coverImage }} style={s.modalCover} resizeMode="cover" />
              ) : (
                <LinearGradient
                  colors={[...getCardTheme(Math.abs((selectedProduct?.id || 0)) % 6).gradient] as [string, string, ...string[]]}
                  style={[s.modalCover, { justifyContent: "center", alignItems: "center" }]}
                >
                  <Ionicons name="cube" size={56} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              )}

              {/* 价格区 */}
              <LinearGradient colors={["#7F1D1D", "#991B1B"]} style={s.modalPriceBox}>
                <View style={s.modalPriceRow}>
                  <Text style={s.modalPromoPrice}>${selectedProduct?.promoPrice}</Text>
                  {selectedProduct?.originalPrice && (parseFloat(selectedProduct.originalPrice) || 0) > (parseFloat(selectedProduct.promoPrice) || 0) && (
                    <>
                      <Text style={s.modalOriginalPrice}>${selectedProduct?.originalPrice}</Text>
                      <View style={s.modalSaveBadge}>
                        <Text style={s.modalSaveText}>
                          省${((parseFloat(selectedProduct.originalPrice) || 0) - (parseFloat(selectedProduct.promoPrice) || 0)).toFixed(0)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
                {selectedProduct?.promoEndTime && (
                  <View style={{ marginTop: 8 }}>
                    <CountdownTimer endTime={selectedProduct.promoEndTime} large />
                  </View>
                )}
              </LinearGradient>

              {/* 标签 */}
              <View style={s.modalTags}>
                {selectedProduct?.platform && (
                  <View style={[s.modalTag, { backgroundColor: "#1E40AF" }]}>
                    <Text style={s.modalTagText}>{selectedProduct.platform}</Text>
                  </View>
                )}
                {selectedProduct?.category && (
                  <View style={[s.modalTag, { backgroundColor: "#475569" }]}>
                    <Text style={s.modalTagText}>{CATEGORIES.find(c => c.key === selectedProduct.category)?.label?.replace(/[^\u4e00-\u9fa5A-Za-z]/g, "") || selectedProduct.category}</Text>
                  </View>
                )}
                {selectedProduct?.promoLabel && (
                  <View style={[s.modalTag, { backgroundColor: "#A8895A" }]}>
                    <Text style={[s.modalTagText, { color: "#0A1628" }]}>{selectedProduct.promoLabel}</Text>
                  </View>
                )}
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
                  { num: "1", text: "点击下方「立即购买」联系客服", icon: "chatbubbles" },
                  { num: "2", text: "备注商品名称，确认库存与版本", icon: "document-text" },
                  { num: "3", text: "支付后即时发货 (USDT / 支付宝 / 微信)", icon: "checkmark-done-circle" },
                ].map((step) => (
                  <View key={step.num} style={s.buyStep}>
                    <View style={s.buyStepNum}><Text style={s.buyStepNumText}>{step.num}</Text></View>
                    <Text style={s.buyStepText}>{step.text}</Text>
                  </View>
                ))}
              </View>

              {/* 购买按钮 */}
              <TouchableOpacity style={s.buyBtn} onPress={() => { setSelectedProduct(null); setShowContact(true); }}>
                <LinearGradient colors={["#DC2626", "#EF4444"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.buyBtnGradient}>
                  <Ionicons name="flash" size={20} color="#fff" />
                  <Text style={s.buyBtnText}>立即购买</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={s.safetyNote}>
                <Ionicons name="shield-checkmark" size={14} color="#F1F5F9" />
                <Text style={s.safetyNoteText}>源头直供 · 正版授权 · 终身售后</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>}

      {/* ==================== 联系方式弹窗 ==================== */}
      <Modal visible={showContact} animationType="fade" transparent>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowContact(false)}>
          <View style={s.contactModal}>
            <LinearGradient colors={["#1E293B", "#0A1628"]} style={s.contactModalInner}>
              <View style={s.contactHeader}>
                <View style={s.contactIconWrap}>
                  <Ionicons name="cart" size={28} color="#A8895A" />
                </View>
                <Text style={s.contactTitle}>联系客服购买</Text>
                <Text style={s.contactDesc}>备注商品名称，客服确认库存后即时发货</Text>
              </View>

              <View style={s.contactMethods}>
                {/* 微信 */}
                <View style={[s.contactMethod, { backgroundColor: "#07C160" }]}>
                  <Ionicons name="logo-wechat" size={22} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.contactMethodLabel}>微信</Text>
                    <Text style={s.contactMethodValue}>1号: {wechat1}</Text>
                    <Text style={[s.contactMethodValue, { fontSize: 13, marginTop: 2 }]}>2号: {wechat2}</Text>
                  </View>
                </View>
                {/* QQ */}
                <View style={[s.contactMethod, { backgroundColor: "#12B7F5" }]}>
                  <Ionicons name="chatbox" size={22} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.contactMethodLabel}>QQ</Text>
                    <Text style={s.contactMethodValue}>1号: {qq1}</Text>
                    <Text style={[s.contactMethodValue, { fontSize: 13, marginTop: 2 }]}>2号: {qq2}</Text>
                  </View>
                </View>
                {/* Telegram */}
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
  page: { flex: 1, backgroundColor: "#0A1628" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A1628" },
  backBtn: { position: "absolute", top: 16, left: 16, zIndex: 10, padding: 8, backgroundColor: "rgba(15,23,42,0.8)", borderRadius: 20, borderWidth: 1, borderColor: "#475569" },

  // Hero
  hero: { paddingTop: 70, paddingBottom: 28, paddingHorizontal: 20, alignItems: "center" },

  // Announcement
  announcementBar: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(220,38,38,0.15)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 8, marginBottom: 24, borderWidth: 1, borderColor: "rgba(220,38,38,0.3)", maxWidth: 500, width: "100%" },
  announceLive: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DC2626", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  announceText: { color: "#FCA5A5", fontSize: 12, fontWeight: "600", flex: 1 },

  heroTitle: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", textAlign: "center", letterSpacing: 4 },
  heroTitleLine: { width: 60, height: 3, backgroundColor: "#A8895A", borderRadius: 2, marginVertical: 12 },
  heroSubtitle: { color: "#A8895A", fontSize: 13, fontWeight: "700", letterSpacing: 6, marginBottom: 16, textAlign: "center" },
  heroDesc: { color: "#F1F5F9", fontSize: 13, lineHeight: 22, textAlign: "center", marginBottom: 20, maxWidth: 440 },

  // Hero Stats
  heroStats: { flexDirection: "row", gap: 4, marginBottom: 16, width: "100%", maxWidth: 500 },
  heroStatItem: { flex: 1, alignItems: "center", backgroundColor: "#1E293B", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#475569", gap: 4 },
  heroStatNum: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  heroStatLabel: { color: "#F1F5F9", fontSize: 10 },

  // Authority Strip
  authorityStrip: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  authorityTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(217,119,6,0.1)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: "rgba(217,119,6,0.2)" },
  authorityTagText: { color: "#A8895A", fontSize: 11, fontWeight: "700" },

  // Category
  categorySection: { paddingVertical: 14, backgroundColor: "#0A1628", borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  categoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, backgroundColor: "#1E293B", borderWidth: 1, borderColor: "#475569" },
  categoryChipActive: { backgroundColor: "#A8895A", borderColor: "#A8895A" },
  categoryChipText: { color: "#F1F5F9", fontSize: 13, fontWeight: "600" },
  categoryChipTextActive: { color: "#0A1628", fontWeight: "800" },

  // Result
  resultBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
  resultCount: { color: "#F1F5F9", fontSize: 13 },
  resultTip: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultTipText: { color: "#10B981", fontSize: 12, fontWeight: "700" },

  // Product List
  productList: { paddingHorizontal: 20, gap: 16, ...(isDesktop ? { flexDirection: "row" as any, flexWrap: "wrap" as any, justifyContent: "center" as any } : {}) },
  productCard: { width: isDesktop ? CARD_WIDTH : "100%", backgroundColor: "#1E293B", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(148,163,184,0.12)" },

  // Card Header
  cardHeader: { padding: 16, position: "relative" },
  discountBadge: { position: "absolute", top: 0, right: 0, backgroundColor: "#DC2626", paddingHorizontal: 14, paddingVertical: 8, borderBottomLeftRadius: 16, zIndex: 2 },
  discountBadgeText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  promoLabel: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, zIndex: 2 },
  promoLabelText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  cardHeaderContent: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 20, marginBottom: 14 },
  cardCoverImage: { width: 64, height: 64, borderRadius: 12 },
  cardIconWrap: { width: 64, height: 64, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  cardHeaderInfo: { flex: 1 },
  cardPlatformBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginBottom: 6 },
  cardPlatformText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cardHeaderTitle: { color: "#fff", fontSize: 17, fontWeight: "900", lineHeight: 22 },

  cardPriceArea: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 10 },
  cardPriceLeft: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  cardPromoPrice: { color: "#fff", fontSize: 28, fontWeight: "900" },
  cardOriginalPrice: { color: "rgba(255,255,255,0.85)", fontSize: 14, textDecorationLine: "line-through" },
  cardSaveBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cardSaveText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Card Body
  cardBody: { padding: 16 },
  cardDesc: { color: "#F1F5F9", fontSize: 12, lineHeight: 18, marginBottom: 12 },

  // Metrics
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metricItem: { flex: 1, backgroundColor: "#0A1628", borderRadius: 8, padding: 8, alignItems: "center", borderWidth: 1, borderColor: "#475569" },
  metricValue: { fontSize: 15, fontWeight: "900", marginBottom: 2 },
  metricLabel: { color: "#F1F5F9", fontSize: 10 },

  // Card Footer
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardFooterLeft: { flex: 1 },

  // Stock
  stockInfo: { alignItems: "flex-end" },
  stockBarOuter: { width: 80, height: 4, backgroundColor: "#475569", borderRadius: 2, overflow: "hidden", marginBottom: 3 },
  stockBarInner: { height: "100%", borderRadius: 2 },
  stockText: { color: "#F1F5F9", fontSize: 10, fontWeight: "600" },

  // Countdown
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  countdownBlock: { backgroundColor: "#0A1628", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: "#475569", minWidth: 26, alignItems: "center" },
  countdownBlockLg: { paddingHorizontal: 8, paddingVertical: 5, minWidth: 32 },
  countdownNum: { color: "#EF4444", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  countdownSep: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
  countdownEnded: { color: "#F1F5F9", fontSize: 12, fontWeight: "600" },

  // Card Buy Button
  cardBuyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  cardBuyBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { color: "#F1F5F9", fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySubtext: { color: "#F1F5F9", fontSize: 13, marginTop: 4 },

  // Why Section
  whySection: { marginTop: 32, paddingHorizontal: 20, paddingVertical: 28, borderTopWidth: 1, borderTopColor: "#1E293B" },
  whySectionTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", textAlign: "center", marginBottom: 20 },
  whyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  whyItem: { width: isDesktop ? "31%" : "47%", flexGrow: 1, backgroundColor: "#1E293B", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#475569", alignItems: "center" },
  whyIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  whyItemTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  whyItemDesc: { color: "#F1F5F9", fontSize: 11, lineHeight: 16, textAlign: "center" },

  // Bottom CTA
  bottomCta: { marginHorizontal: 20, marginTop: 24, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#A8895A" },
  bottomCtaInner: { padding: 28, alignItems: "center" },
  bottomCtaTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginTop: 12, marginBottom: 6 },
  bottomCtaDesc: { color: "#F1F5F9", fontSize: 13, marginBottom: 20, textAlign: "center", lineHeight: 20 },
  bottomCtaBtn: { backgroundColor: "#A8895A", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 24 },
  bottomCtaBtnText: { color: "#0A1628", fontSize: 15, fontWeight: "800" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "92%", backgroundColor: "#1E293B", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#475569" },
  modalTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", flex: 1, marginRight: 12 },
  modalBody: { padding: 20 },
  modalCover: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16 },

  modalPriceBox: { padding: 16, borderRadius: 12, marginBottom: 16 },
  modalPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  modalPromoPrice: { color: "#fff", fontSize: 32, fontWeight: "900" },
  modalOriginalPrice: { color: "rgba(255,255,255,0.9)", fontSize: 16, textDecorationLine: "line-through" },
  modalSaveBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modalSaveText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  modalTags: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  modalTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  modalTagText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  modalDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginBottom: 16 },

  modalDetailSection: { marginBottom: 16 },
  modalSectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  modalDetailContent: { color: "#F1F5F9", fontSize: 13, lineHeight: 22 },

  modalGallerySection: { marginBottom: 16 },
  galleryThumb: { width: 120, height: 80, borderRadius: 8, marginRight: 10 },

  buyProcessSection: { marginBottom: 20 },
  buyStep: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  buyStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#A8895A", justifyContent: "center", alignItems: "center" },
  buyStepNumText: { color: "#0A1628", fontSize: 14, fontWeight: "800" },
  buyStepText: { color: "#CBD5E1", fontSize: 13, flex: 1 },

  buyBtn: { marginBottom: 12 },
  buyBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 12 },
  buyBtnText: { color: "#fff", fontSize: 17, fontWeight: "900" },

  safetyNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  safetyNoteText: { color: "#F1F5F9", fontSize: 12 },

  // Contact Modal
  contactModal: { marginHorizontal: 20, borderRadius: 20, overflow: "hidden" },
  contactModalInner: { padding: 24 },
  contactHeader: { alignItems: "center", marginBottom: 20 },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(217,119,6,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  contactTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 6 },
  contactDesc: { color: "#F1F5F9", fontSize: 13, textAlign: "center" },
  contactMethods: { gap: 10, marginBottom: 16 },
  contactMethod: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 12 },
  contactMethodLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  contactMethodValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
  payMethods: { marginBottom: 16 },
  payMethodsTitle: { color: "#F1F5F9", fontSize: 12, marginBottom: 8, textAlign: "center" },
  payMethodsRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  payMethodChip: { backgroundColor: "#475569", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  payMethodChipText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  contactCloseBtn: { alignItems: "center", paddingVertical: 12 },
  contactCloseBtnText: { color: "#F1F5F9", fontSize: 14 },

  // Gallery Modal
  galleryModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  galleryClose: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  galleryFullImage: { width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40, borderRadius: 8 },
  galleryNav: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 20 },
  galleryCounter: { color: "#fff", fontSize: 14 },
});
