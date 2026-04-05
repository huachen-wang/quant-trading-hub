import React, { useState, useEffect, useRef } from "react";
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

// 硬编码策略卡片（当后台无数据时展示）
const DEFAULT_CARDS = [
  {
    id: -1, title: "极限黄金对冲 Pro", subtitle: "日均几百~几千单 · 回撤稳定",
    description: "专业级对冲策略，多账户分散风险，回撤可控。适合追求稳定收益的工作室，已有多个工作室实盘运行超过6个月。",
    badge: "热门", badgeColor: "red", strategyType: "对冲策略", platform: "MT4",
    observeNote: "私聊备注「极限对冲」获取观摩账户", coverImage: null, galleryImages: null,
    highlights: ["日均交易量大", "回撤控制优秀", "多账户分散风险", "6个月+实盘验证"],
    riskLevel: "中低风险", minCapital: "$3,000",
  },
  {
    id: -2, title: "多空双开策略（小艺）", subtitle: "日均几千单 · 500U美分即可启动",
    description: "低门槛网格策略，美分账户即可运行。适合小资金起步的工作室，快速验证策略可行性。",
    badge: "低门槛", badgeColor: "green", strategyType: "网格策略", platform: "MT5",
    observeNote: "私聊备注「多空双开」获取观摩账户", coverImage: null, galleryImages: null,
    highlights: ["500U美分即可启动", "日均交易量大", "适合小资金起步", "快速验证可行性"],
    riskLevel: "中风险", minCapital: "$500",
  },
  {
    id: -3, title: "一单一结（武汉小艺）", subtitle: "日均20-80单 · 历史零爆仓",
    description: "极致安全的一次一单策略，历史零爆仓记录。适合风险厌恶型客户和保守型工作室。",
    badge: "零爆仓", badgeColor: "green", strategyType: "一次一单", platform: "MT5",
    observeNote: "私聊备注「一单一结」获取观摩账户", coverImage: null, galleryImages: null,
    highlights: ["历史零爆仓", "一次一单极致安全", "适合保守型客户", "稳定收益"],
    riskLevel: "低风险", minCapital: "$1,000",
  },
  {
    id: -4, title: "超级黄金调优 2026", subtitle: "两个月战绩600%",
    description: "主力网格策略，经过深度调优。高收益高风险，适合激进型工作室。已有多个实盘账户验证。",
    badge: "主力", badgeColor: "gold", strategyType: "网格策略", platform: "MT4",
    observeNote: "私聊备注「超级调优」获取观摩账户", coverImage: null, galleryImages: null,
    highlights: ["两个月600%收益", "深度参数调优", "多实盘验证", "适合激进型"],
    riskLevel: "高风险", minCapital: "$2,000",
  },
  {
    id: -5, title: "趋势刷单 · 军火库独家版", subtitle: "单边1000点暴跌不爆仓",
    description: "趋势马丁策略，抗单能力极强。独家调优版本，市面无同款。经过极端行情验证。",
    badge: "独家", badgeColor: "gold", strategyType: "趋势马丁", platform: "MT4",
    observeNote: "私聊备注「趋势刷单」获取观摩账户", coverImage: null, galleryImages: null,
    highlights: ["1000点暴跌不爆仓", "独家调优版本", "极端行情验证", "市面无同款"],
    riskLevel: "中风险", minCapital: "$3,000",
  },
  {
    id: -6, title: "智能趋势追踪", subtitle: "趋势追踪 · 节奏清晰",
    description: "一次一单趋势追踪策略，信号清晰，适合手动+自动结合使用。适合有一定交易经验的用户。",
    badge: null, badgeColor: "gold", strategyType: "一次一单", platform: "MT4/MT5",
    observeNote: "私聊备注「趋势追踪」获取观摩账户", coverImage: null, galleryImages: null,
    highlights: ["信号清晰", "手动+自动结合", "趋势追踪", "适合有经验用户"],
    riskLevel: "中低风险", minCapital: "$1,000",
  },
  {
    id: -7, title: "暴利引擎 Pro", subtitle: "全网月收益第一",
    description: "暴力策略，追求极致收益。适合有风险承受能力的专业交易者和激进型工作室。",
    badge: "月收益第一", badgeColor: "red", strategyType: "暴力策略", platform: "MT4",
    observeNote: "私聊备注「暴利引擎」获取观摩账户", coverImage: null, galleryImages: null,
    highlights: ["全网月收益第一", "极致收益追求", "适合专业交易者", "高风险高回报"],
    riskLevel: "高风险", minCapital: "$5,000",
  },
  {
    id: -8, title: "点金订单流", subtitle: "四维共振 · 专业机构选择",
    description: "机构级订单流分析系统，四维共振信号。适合专业交易团队和工作室，是我们的旗舰产品。",
    badge: "机构级", badgeColor: "gold", strategyType: "一次一单", platform: "MT4/MT5",
    observeNote: "私聊备注「点金订单流」获取观摩账户", coverImage: null, galleryImages: null,
    highlights: ["四维共振信号", "机构级分析", "专业团队首选", "旗舰产品"],
    riskLevel: "中风险", minCapital: "$3,000",
  },
];

export default function CooperationPage() {
  const colors = useColors();
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showContact, setShowContact] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: backendCards, isLoading: cardsLoading } = trpc.cooperation.cards.useQuery();
  const { data: plans, isLoading: plansLoading } = trpc.cooperation.plans.useQuery();
  const { data: contactSettings } = trpc.siteSettings.getContact.useQuery();

  const telegram = contactSettings?.telegram || "@quantarsenal";
  const qq = contactSettings?.qq || "3832001817";

  const cards = (backendCards && backendCards.length > 0) ? backendCards : DEFAULT_CARDS;
  const isLoading = cardsLoading || plansLoading;

  const getBadgeColors = (color?: string) => {
    switch (color) {
      case "red": return { bg: "#DC2626", text: "#fff" };
      case "green": return { bg: "#059669", text: "#fff" };
      case "blue": return { bg: "#2563EB", text: "#fff" };
      default: return { bg: "#D97706", text: "#0F172A" };
    }
  };

  const getRiskColor = (level?: string) => {
    if (level?.includes("低")) return "#10B981";
    if (level?.includes("高")) return "#EF4444";
    return "#F59E0B";
  };

  const parseFeatures = (f?: string | null): string[] => {
    if (!f) return []; try { return JSON.parse(f); } catch { return []; }
  };
  const parseGallery = (g?: string | null): string[] => {
    if (!g) return []; try { return JSON.parse(g); } catch { return []; }
  };

  if (isLoading) {
    return <ScreenContainer><View style={s.loadingWrap}><ActivityIndicator size="large" color="#D97706" /></View></ScreenContainer>;
  }

  const renderStrategyCard = (card: any, isFeatured: boolean = false) => {
    const badgeStyle = getBadgeStyle(card.badgeColor);
    const gallery = parseGallery(card.galleryImages);

    return (
      <TouchableOpacity
        key={card.id}
        style={[
          s.strategyCard,
          isFeatured && s.strategyCardFeatured,
        ]}
        onPress={() => setSelectedCard(card)}
        activeOpacity={0.85}
      >
        {/* 封面 */}
        <View style={s.strategyImageWrap}>
          {card.coverImage ? (
            <Image source={{ uri: card.coverImage }} style={s.strategyImage} resizeMode="cover" />
          ) : (
            <View style={[s.strategyImage, s.strategyImagePlaceholder]}>
              <View style={[s.strategyPlaceholderIcon, isFeatured && { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                <Ionicons name="trending-up" size={24} color={isFeatured ? "#EF4444" : "#F59E0B"} />
              </View>
            </View>
          )}

          {/* 角标 */}
          {card.badge && (
            <View style={[s.strategyBadge, { backgroundColor: badgeStyle.bg }]}>
              {isFeatured && <Ionicons name="star" size={10} color={badgeStyle.text} />}
              <Text style={[s.strategyBadgeText, { color: badgeStyle.text }]}>{card.badge}</Text>
            </View>
          )}

          {/* 平台 */}
          {card.platform && (
            <View style={s.strategyPlatform}>
              <Text style={s.strategyPlatformText}>{card.platform}</Text>
            </View>
          )}

          {/* 策略类型 */}
          {card.strategyType && (
            <View style={s.strategyType}>
              <Text style={s.strategyTypeText}>{card.strategyType}</Text>
            </View>
          )}
        </View>

        {/* 内容 */}
        <View style={s.strategyContent}>
          <Text style={s.strategyTitle} numberOfLines={1}>{card.title}</Text>
          {card.subtitle && (
            <Text style={s.strategySubtitle} numberOfLines={1}>{card.subtitle}</Text>
          )}
          {card.description && (
            <Text style={s.strategyDesc} numberOfLines={isFeatured ? 3 : 2}>{card.description}</Text>
          )}

          {/* 底部信息 */}
          <View style={s.strategyFooter}>
            {gallery.length > 0 && (
              <View style={s.galleryHint}>
                <Ionicons name="images" size={12} color="#94A3B8" />
                <Text style={s.galleryHintText}>{gallery.length}张观摩</Text>
              </View>
            )}
            <View style={s.strategyViewBtn}>
              <Text style={s.strategyViewBtnText}>查看详情</Text>
              <Ionicons name="chevron-forward" size={12} color="#F59E0B" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView style={s.page} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F1F5F9" />
        </TouchableOpacity>

        {/* ==================== HERO: 源头权威定位 ==================== */}
        <LinearGradient colors={["#0F172A", "#1E293B", "#0F172A"]} style={s.hero}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: "center" }}>
            <View style={s.heroGlow} />

            <View style={s.heroBadge}>
              <View style={s.heroDot} />
              <Text style={s.heroBadgeText}>量化军火库 · 策略源头</Text>
            </View>

            <Text style={s.heroTitle}>工作室合作方案</Text>
            <Text style={s.heroSubtitle}>
              全网EA策略的源头供应商
            </Text>
            <Text style={s.heroDesc}>
              我们持有全网主流EA的源码，具备破解与独家优化能力{"\n"}
              与我们合作 = 拿到源头价 + 独家调优版 + 终身技术支持
            </Text>

            {/* 源头能力矩阵 */}
            <View style={s.capabilityRow}>
              {[
                { icon: "code-slash", title: "源码掌控", num: "200+", desc: "EA源码库" },
                { icon: "lock-open", title: "破解能力", num: "100%", desc: "技术覆盖" },
                { icon: "flash", title: "独家优化", num: "50+", desc: "调优版本" },
                { icon: "people", title: "工作室", num: "30+", desc: "深度合作" },
              ].map((item, i) => (
                <View key={i} style={s.capabilityItem}>
                  <View style={s.capabilityIconWrap}>
                    <Ionicons name={item.icon as any} size={20} color="#D97706" />
                  </View>
                  <Text style={s.capabilityNum}>{item.num}</Text>
                  <Text style={s.capabilityTitle}>{item.title}</Text>
                  <Text style={s.capabilityDesc}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ==================== 工作室扶持专区 ==================== */}
        <View style={s.studioSection}>
          <View style={s.sectionHeader}>
            <View style={s.sectionBadge}>
              <Ionicons name="rocket" size={14} color="#D97706" />
              <Text style={s.sectionBadgeText}>核心服务</Text>
            </View>
            <Text style={s.sectionTitle}>工作室扶持计划</Text>
            <Text style={s.sectionSubtitle}>从策略选型到运营落地，一站式深度扶持</Text>
          </View>

          <View style={s.studioGrid}>
            {[
              { icon: "diamond", title: "策略选型", desc: "根据工作室资金量、风险偏好、客户类型，精准推荐最适合的策略组合", gradient: ["#92400E", "#D97706"] },
              { icon: "construct", title: "参数调优", desc: "针对合作平台的点差、杠杆、延迟进行深度参数优化，确保最佳表现", gradient: ["#1E3A8A", "#3B82F6"] },
              { icon: "analytics", title: "实盘观摩", desc: "所有策略均提供实盘观摩账户，数据透明可查，眼见为实", gradient: ["#064E3B", "#10B981"] },
              { icon: "headset", title: "1对1支持", desc: "专属技术顾问，7×24小时响应，从部署到运维全程陪跑", gradient: ["#7F1D1D", "#DC2626"] },
              { icon: "cash", title: "成本直降80%", desc: "源头直供价格，比市面任何渠道都便宜。手里款式多，发我对比给你更优价", gradient: ["#581C87", "#9333EA"] },
              { icon: "infinite", title: "无限授权", desc: "有效期内不限窗口数量、不限账户数量，一个价格覆盖所有需求", gradient: ["#0F4C75", "#3282B8"] },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={s.studioCard} activeOpacity={0.9}>
                <LinearGradient colors={item.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.studioCardGradient}>
                  <Ionicons name={item.icon as any} size={28} color="#fff" />
                  <Text style={s.studioCardTitle}>{item.title}</Text>
                  <Text style={s.studioCardDesc}>{item.desc}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ==================== 策略矩阵 ==================== */}
        <View style={s.strategiesSection}>
          <View style={s.sectionHeader}>
            <View style={s.sectionBadge}>
              <Ionicons name="grid" size={14} color="#D97706" />
              <Text style={s.sectionBadgeText}>策略矩阵</Text>
            </View>
            <Text style={s.sectionTitle}>可用策略一览</Text>
            <Text style={s.sectionSubtitle}>点击卡片查看详情 · 私聊获取观摩账户</Text>
          </View>

          <View style={s.cardsGrid}>
            {cards.map((card: any) => {
              const badgeStyle = getBadgeColors(card.badgeColor);
              const gallery = parseGallery(card.galleryImages);
              const highlights = card.highlights || [];
              const riskColor = getRiskColor(card.riskLevel);

              return (
                <TouchableOpacity
                  key={card.id}
                  style={s.strategyCard}
                  onPress={() => setSelectedCard(card)}
                  activeOpacity={0.88}
                >
                  {/* 封面 */}
                  <View style={s.cardCoverWrap}>
                    {card.coverImage ? (
                      <Image source={{ uri: card.coverImage }} style={s.cardCover} resizeMode="cover" />
                    ) : (
                      <LinearGradient colors={["#1E293B", "#334155"]} style={s.cardCoverPlaceholder}>
                        <Ionicons name="trending-up" size={32} color="#475569" />
                      </LinearGradient>
                    )}

                    {/* 角标 */}
                    {card.badge && (
                      <View style={[s.cardBadge, { backgroundColor: badgeStyle.bg }]}>
                        <Text style={[s.cardBadgeText, { color: badgeStyle.text }]}>{card.badge}</Text>
                      </View>
                    )}

                    {/* 平台 */}
                    {card.platform && (
                      <View style={s.cardPlatform}>
                        <Text style={s.cardPlatformText}>{card.platform}</Text>
                      </View>
                    )}
                  </View>

                  {/* 信息 */}
                  <View style={s.cardBody}>
                    <Text style={s.cardTitle} numberOfLines={1}>{card.title}</Text>
                    {card.subtitle && <Text style={s.cardSubtitle} numberOfLines={1}>{card.subtitle}</Text>}

                    {/* 策略类型 + 风险等级 */}
                    <View style={s.cardMetaRow}>
                      {card.strategyType && (
                        <View style={s.cardTag}>
                          <Text style={s.cardTagText}>{card.strategyType}</Text>
                        </View>
                      )}
                      {card.riskLevel && (
                        <View style={[s.cardTag, { borderColor: riskColor }]}>
                          <View style={[s.riskDot, { backgroundColor: riskColor }]} />
                          <Text style={[s.cardTagText, { color: riskColor }]}>{card.riskLevel}</Text>
                        </View>
                      )}
                    </View>

                    {/* 亮点 */}
                    {highlights.length > 0 && (
                      <View style={s.highlightsWrap}>
                        {highlights.slice(0, 2).map((h: string, i: number) => (
                          <View key={i} style={s.highlightItem}>
                            <Ionicons name="checkmark-circle" size={12} color="#D97706" />
                            <Text style={s.highlightText} numberOfLines={1}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* 观摩提示 */}
                    <View style={s.observeHint}>
                      <Ionicons name="eye" size={12} color="#94A3B8" />
                      <Text style={s.observeHintText}>
                        {gallery.length > 0 ? `${gallery.length}张观摩截图` : "可获取观摩账户"}
                      </Text>
                    </View>
                  </View>
                  <View style={s.planDivider} />
                  <View style={s.planFeatures}>
                    {parseFeatures(plan.features).map((feature: string, fi: number) => (
                      <View key={fi} style={s.planFeatureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={isRecommended ? "#F59E0B" : "#10B981"} />
                        <Text style={s.planFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[s.planCTA, isRecommended && s.planCTARecommended]}
                    onPress={() => setShowContact(true)}
                  >
                    <Text style={[s.planCTAText, isRecommended && { color: "#0A0E1A" }]}>立即咨询</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* ==================== 合作模式（放最后） ==================== */}
        <View style={s.plansSection}>
          <View style={s.sectionHeader}>
            <View style={s.sectionBadge}>
              <Ionicons name="document-text" size={14} color="#D97706" />
              <Text style={s.sectionBadgeText}>合作模式</Text>
            </View>
            <Text style={s.sectionTitle}>灵活的合作方案</Text>
            <Text style={s.sectionSubtitle}>从零门槛试用到源码买断，总有适合你的方案</Text>
          </View>

          <View style={s.plansGrid}>
            {(plans && plans.length > 0 ? plans : [
              { id: -1, title: "试用合作", badge: "零门槛", price: "免费", priceNote: "体验", features: '["可选一款策略实盘测试","无资金量要求","不拿佣金","指定合作平台账户授权"]' },
              { id: -2, title: "策略授权", badge: "推荐", price: "¥1,000/月", priceNote: "¥2,500/年", features: '["有效期内无限开窗口/授权","永久免费更新迭代","不需要分成"]' },
              { id: -3, title: "源码买断", badge: null, price: "¥9,800起", priceNote: null, features: '["完整源码交付·支持二次开发","终身技术支持","不限平台·无限开窗口/授权"]' },
            ]).map((plan: any, index: number) => {
              const isRecommended = index === 1 || plan.badge === "推荐";
              return (
                <View key={plan.id} style={[s.planCard, isRecommended && s.planCardRecommended]}>
                  {isRecommended && (
                    <LinearGradient colors={["#D97706", "#F59E0B"]} style={s.planRecommendedTag}>
                      <Text style={s.planRecommendedTagText}>推荐</Text>
                    </LinearGradient>
                  )}
                  <Text style={s.planTitle}>{plan.title}</Text>
                  {plan.badge && plan.badge !== "推荐" && (
                    <View style={s.planBadge}><Text style={s.planBadgeText}>{plan.badge}</Text></View>
                  )}
                  <View style={s.planPriceArea}>
                    <Text style={[s.planPrice, isRecommended && { color: "#D97706" }]}>{plan.price}</Text>
                    {plan.priceNote && <Text style={s.planPriceNote}>{plan.priceNote}</Text>}
                  </View>
                  <View style={s.planDivider} />
                  <View style={s.planFeatures}>
                    {parseFeatures(plan.features).map((f: string, fi: number) => (
                      <View key={fi} style={s.planFeatureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={isRecommended ? "#D97706" : "#64748B"} />
                        <Text style={s.planFeatureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[s.planCTA, isRecommended && s.planCTARecommended]}
                    onPress={() => setShowContact(true)}
                  >
                    <Text style={[s.planCTAText, isRecommended && { color: "#0F172A" }]}>立即咨询</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* ==================== 服务保障 ==================== */}
        <View style={s.serviceSection}>
          <View style={s.serviceGrid}>
            {[
              { icon: "business", title: "合作平台", desc: "直接对接合作平台，拿到最优条件。杠杆500即可，美刀美分均可。" },
              { icon: "wallet", title: "专属返佣", desc: "深度合作客户免费获得全额返佣渠道，无抽成，无截留。" },
              { icon: "sync", title: "持续更新", desc: "每月持续更新迭代，确保策略始终处于最优状态。" },
            ].map((item, i) => (
              <View key={i} style={s.serviceCard}>
                <Ionicons name={item.icon as any} size={22} color="#D97706" />
                <Text style={s.serviceCardTitle}>{item.title}</Text>
                <Text style={s.serviceCardDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ==================== 底部 CTA ==================== */}
        <View style={s.bottomCta}>
          <Text style={s.bottomCtaTitle}>准备好开始合作了吗？</Text>
          <Text style={s.bottomCtaDesc}>
            私聊备注「策略名称」获取观摩账户 & 专属报价
          </Text>
          <TouchableOpacity style={s.bottomCtaBtn} onPress={() => setShowContact(true)}>
            <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bottomCtaBtnGradient}>
              <Ionicons name="chatbubbles" size={20} color="#0F172A" />
              <Text style={s.bottomCtaBtnText}>立即联系</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 底部品牌 + 免责 */}
        <View style={s.footer}>
          <View style={s.footerBrand}>
            <View style={s.heroDot} />
            <Text style={s.footerBrandText}>量化军火库</Text>
          </View>
          <Text style={s.footerSlogan}>源头价直供 · 策略持续更新 · 全方位技术支持</Text>
          <Text style={s.footerDisclaimer}>
            免责声明：不同平台行情、点差、延迟存在差异，策略表现因此可能不同环境而变。我们不作收益保证，不做本金承诺，仅提供优质工具。
          </Text>
        </View>
      </ScrollView>

      {/* ==================== 策略详情弹窗 ==================== */}
      <Modal visible={!!selectedCard} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{selectedCard?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedCard(null)}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {/* 封面 */}
              {selectedCard?.coverImage ? (
                <Image source={{ uri: selectedCard.coverImage }} style={s.modalCover} resizeMode="cover" />
              ) : (
                <LinearGradient colors={["#1E293B", "#334155"]} style={[s.modalCover, { justifyContent: "center", alignItems: "center" }]}>
                  <Ionicons name="trending-up" size={48} color="#475569" />
                </LinearGradient>
              )}

              {/* 副标题 */}
              {selectedCard?.subtitle && (
                <Text style={s.modalSubtitle}>{selectedCard.subtitle}</Text>
              )}

              {/* 标签行 */}
              <View style={s.modalMetaRow}>
                {selectedCard?.strategyType && (
                  <View style={[s.modalTag, { backgroundColor: "#334155" }]}>
                    <Text style={s.modalTagText}>{selectedCard.strategyType}</Text>
                  </View>
                )}
                {selectedCard?.platform && (
                  <View style={[s.modalTag, { backgroundColor: "#1E40AF" }]}>
                    <Text style={s.modalTagText}>{selectedCard.platform}</Text>
                  </View>
                )}
                {selectedCard?.badge && (
                  <View style={[s.modalTag, { backgroundColor: getBadgeColors(selectedCard.badgeColor).bg }]}>
                    <Text style={[s.modalTagText, { color: getBadgeColors(selectedCard.badgeColor).text }]}>{selectedCard.badge}</Text>
                  </View>
                )}
                {selectedCard?.riskLevel && (
                  <View style={[s.modalTag, { backgroundColor: "transparent", borderWidth: 1, borderColor: getRiskColor(selectedCard.riskLevel) }]}>
                    <Text style={[s.modalTagText, { color: getRiskColor(selectedCard.riskLevel) }]}>{selectedCard.riskLevel}</Text>
                  </View>
                )}
                <View style={[s.modalMetaTag, { backgroundColor: "rgba(245,158,11,0.1)" }]}>
                  <Ionicons name="code-slash" size={12} color="#F59E0B" />
                  <Text style={[s.modalMetaTagText, { color: "#F59E0B" }]}>源码可查</Text>
                </View>
              </View>

              {/* 核心数据 */}
              {(selectedCard?.minCapital || selectedCard?.riskLevel) && (
                <View style={s.modalDataRow}>
                  {selectedCard?.minCapital && (
                    <View style={s.modalDataItem}>
                      <Text style={s.modalDataLabel}>最低资金</Text>
                      <Text style={s.modalDataValue}>{selectedCard.minCapital}</Text>
                    </View>
                  )}
                  {selectedCard?.riskLevel && (
                    <View style={s.modalDataItem}>
                      <Text style={s.modalDataLabel}>风险等级</Text>
                      <Text style={[s.modalDataValue, { color: getRiskColor(selectedCard.riskLevel) }]}>{selectedCard.riskLevel}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* 描述 */}
              {selectedCard?.description && (
                <Text style={s.modalDesc}>{selectedCard.description}</Text>
              )}

              {/* 亮点 */}
              {selectedCard?.highlights && selectedCard.highlights.length > 0 && (
                <View style={s.modalHighlights}>
                  <Text style={s.modalSectionTitle}>核心亮点</Text>
                  {selectedCard.highlights.map((h: string, i: number) => (
                    <View key={i} style={s.modalHighlightItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#D97706" />
                      <Text style={s.modalHighlightText}>{h}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 截图画廊 */}
              {parseGallery(selectedCard?.galleryImages).length > 0 && (
                <View style={s.modalGallery}>
                  <Text style={s.modalSectionTitle}>实盘观摩截图</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {parseGallery(selectedCard?.galleryImages).map((img: string, i: number) => (
                      <TouchableOpacity key={i} onPress={() => { setGalleryIndex(i); setShowGallery(true); }}>
                        <Image source={{ uri: img }} style={s.galleryThumb} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {selectedCard?.observeNote && (
                <View style={s.observeNote}>
                  <Ionicons name="eye" size={18} color="#D97706" />
                  <Text style={s.observeNoteText}>{selectedCard.observeNote}</Text>
                </View>
              )}

              {/* CTA */}
              <TouchableOpacity style={s.modalCTA} onPress={() => { setSelectedCard(null); setShowContact(true); }}>
                <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.modalCTAGradient}>
                  <Ionicons name="chatbubble-ellipses" size={18} color="#0F172A" />
                  <Text style={s.modalCTAText}>立即咨询获取观摩账户</Text>
                </LinearGradient>
              </TouchableOpacity>
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
                  <Ionicons name="chatbubbles" size={28} color="#D97706" />
                </View>
                <Text style={s.contactTitle}>联系我们</Text>
                <Text style={s.contactDesc}>私聊备注「策略名称」获取观摩账户 & 专属报价</Text>
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
              <TouchableOpacity style={s.contactCloseBtn} onPress={() => setShowContact(false)}>
                <Text style={s.contactCloseBtnText}>我知道了</Text>
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
          {selectedCard && parseGallery(selectedCard.galleryImages)[galleryIndex] && (
            <Image source={{ uri: parseGallery(selectedCard.galleryImages)[galleryIndex] }} style={s.galleryFullImage} resizeMode="contain" />
          )}
          <View style={s.galleryNav}>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.max(0, galleryIndex - 1))}>
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={s.galleryCounter}>{galleryIndex + 1} / {parseGallery(selectedCard?.galleryImages).length}</Text>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.min(parseGallery(selectedCard?.galleryImages).length - 1, galleryIndex + 1))}>
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
  heroBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(217,119,6,0.15)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: "rgba(217,119,6,0.3)" },
  heroDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D97706", marginRight: 8 },
  heroBadgeText: { color: "#D97706", fontSize: 13, fontWeight: "700" },
  heroTitle: { color: "#F1F5F9", fontSize: 32, fontWeight: "900", marginBottom: 8, textAlign: "center", letterSpacing: 2 },
  heroSubtitle: { color: "#D97706", fontSize: 16, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  heroDesc: { color: "#94A3B8", fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 24, maxWidth: 500 },

  // Capability
  capabilityRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, width: "100%" },
  capabilityItem: { alignItems: "center", width: isDesktop ? 120 : 72, backgroundColor: "rgba(30,41,59,0.8)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#334155" },
  capabilityIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(217,119,6,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 6 },
  capabilityNum: { color: "#D97706", fontSize: 18, fontWeight: "900", marginBottom: 2 },
  capabilityTitle: { color: "#F1F5F9", fontSize: 11, fontWeight: "700", textAlign: "center" },
  capabilityDesc: { color: "#64748B", fontSize: 9, textAlign: "center", marginTop: 2 },

  // Section Header
  sectionHeader: { alignItems: "center", marginBottom: 24 },
  sectionBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(217,119,6,0.1)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  sectionBadgeText: { color: "#D97706", fontSize: 11, fontWeight: "700" },
  sectionTitle: { color: "#F1F5F9", fontSize: 24, fontWeight: "900", marginBottom: 6, textAlign: "center" },
  sectionSubtitle: { color: "#94A3B8", fontSize: 13, textAlign: "center" },

  // Studio
  studioSection: { paddingVertical: 32, paddingHorizontal: 16 },
  studioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  studioCard: { width: isDesktop ? "31.5%" : "48.5%", flexGrow: 1 },
  studioCardGradient: { borderRadius: 14, padding: 16, minHeight: 140, justifyContent: "flex-end" },
  studioCardTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 8, marginBottom: 4 },
  studioCardDesc: { color: "rgba(255,255,255,0.8)", fontSize: 11, lineHeight: 16 },

  // Strategies
  strategiesSection: { paddingVertical: 32, paddingHorizontal: 16 },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  strategyCard: { width: CARD_WIDTH, backgroundColor: "#1E293B", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#334155" },
  cardCoverWrap: { position: "relative" },
  cardCover: { width: "100%", height: 120 },
  cardCoverPlaceholder: { width: "100%", height: 120, justifyContent: "center", alignItems: "center" },
  cardBadge: { position: "absolute", top: 0, right: 0, paddingHorizontal: 10, paddingVertical: 5, borderBottomLeftRadius: 12 },
  cardBadgeText: { fontSize: 11, fontWeight: "800" },
  cardPlatform: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(30,64,175,0.9)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  cardPlatformText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  cardBody: { padding: 12 },
  cardTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "800", marginBottom: 3 },
  cardSubtitle: { color: "#D97706", fontSize: 11, fontWeight: "600", marginBottom: 6 },
  cardMetaRow: { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  cardTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#334155", flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#475569" },
  cardTagText: { color: "#94A3B8", fontSize: 10, fontWeight: "600" },
  riskDot: { width: 6, height: 6, borderRadius: 3 },

  highlightsWrap: { gap: 4, marginBottom: 8 },
  highlightItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  highlightText: { color: "#CBD5E1", fontSize: 11 },

  observeHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#334155" },
  observeHintText: { color: "#94A3B8", fontSize: 10 },

  // Plans
  plansSection: { paddingVertical: 32, paddingHorizontal: 16 },
  plansGrid: { gap: 16 },
  planCard: { backgroundColor: "#1E293B", padding: 24, borderRadius: 16, borderWidth: 1, borderColor: "#334155", position: "relative", overflow: "hidden" },
  planCardRecommended: { borderColor: "#D97706", borderWidth: 2 },
  planRecommendedTag: { position: "absolute", top: 0, right: 0, paddingHorizontal: 16, paddingVertical: 4, borderBottomLeftRadius: 12 },
  planRecommendedTagText: { color: "#0F172A", fontSize: 12, fontWeight: "800" },
  planTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "800", marginBottom: 6 },
  planBadge: { backgroundColor: "#334155", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start", marginBottom: 12 },
  planBadgeText: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  planPriceArea: { marginBottom: 16 },
  planPrice: { color: "#F1F5F9", fontSize: 28, fontWeight: "900" },
  planPriceNote: { color: "#94A3B8", fontSize: 14, marginTop: 4 },
  planDivider: { height: 1, backgroundColor: "#334155", marginBottom: 16 },
  planFeatures: { gap: 10, marginBottom: 20 },
  planFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planFeatureText: { color: "#CBD5E1", fontSize: 13, flex: 1 },
  planCTA: { paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: "#334155" },
  planCTARecommended: { backgroundColor: "#D97706" },
  planCTAText: { color: "#F1F5F9", fontSize: 15, fontWeight: "700" },

  // Service
  serviceSection: { paddingHorizontal: 16, paddingBottom: 24 },
  serviceGrid: { flexDirection: "row", gap: 10 },
  serviceCard: { flex: 1, backgroundColor: "#1E293B", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#334155" },
  serviceCardTitle: { color: "#D97706", fontSize: 14, fontWeight: "700", marginTop: 8, marginBottom: 6 },
  serviceCardDesc: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },

  // Bottom CTA
  bottomCta: { marginHorizontal: 16, marginTop: 8, marginBottom: 24, backgroundColor: "#1E293B", borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#D97706" },
  bottomCtaTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "900", marginBottom: 6 },
  bottomCtaDesc: { color: "#94A3B8", fontSize: 13, marginBottom: 16, textAlign: "center" },
  bottomCtaBtn: { overflow: "hidden", borderRadius: 24 },
  bottomCtaBtnGradient: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  bottomCtaBtnText: { color: "#0F172A", fontSize: 15, fontWeight: "800" },

  // Footer
  footer: { paddingVertical: 32, paddingHorizontal: 20, alignItems: "center", borderTopWidth: 1, borderTopColor: "#1E293B" },
  footerBrand: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  footerBrandText: { color: "#D97706", fontSize: 16, fontWeight: "700" },
  footerSlogan: { color: "#94A3B8", fontSize: 13, marginBottom: 16 },
  footerDisclaimer: { color: "#475569", fontSize: 11, textAlign: "center", lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "92%", backgroundColor: "#1E293B", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#334155" },
  modalTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "800", flex: 1, marginRight: 12 },
  modalBody: { padding: 20 },
  modalCover: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16 },
  modalSubtitle: { color: "#D97706", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  modalMetaRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  modalTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  modalTagText: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },

  modalDataRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  modalDataItem: { flex: 1, backgroundColor: "#0F172A", padding: 14, borderRadius: 10, alignItems: "center" },
  modalDataLabel: { color: "#94A3B8", fontSize: 11, marginBottom: 4 },
  modalDataValue: { color: "#F1F5F9", fontSize: 16, fontWeight: "800" },

  modalDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginBottom: 16 },

  modalHighlights: { marginBottom: 16 },
  modalSectionTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  modalHighlightItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  modalHighlightText: { color: "#CBD5E1", fontSize: 13 },

  modalGallery: { marginBottom: 16 },
  galleryThumb: { width: 160, height: 110, borderRadius: 8, marginRight: 10, backgroundColor: "#334155" },

  observeNote: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 10, gap: 10, marginBottom: 20, backgroundColor: "rgba(217,119,6,0.1)", borderWidth: 1, borderColor: "rgba(217,119,6,0.3)" },
  observeNoteText: { color: "#D97706", fontSize: 13, flex: 1, fontWeight: "600" },

  modalCTA: { marginBottom: 20, overflow: "hidden", borderRadius: 12 },
  modalCTAGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  modalCTAText: { color: "#0F172A", fontSize: 15, fontWeight: "800" },

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
  contactCloseBtn: { alignItems: "center", paddingVertical: 12, backgroundColor: "#334155", borderRadius: 10 },
  contactCloseBtnText: { color: "#F1F5F9", fontSize: 14, fontWeight: "600" },

  // Gallery Modal
  galleryModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  galleryClose: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  galleryFullImage: { width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40, borderRadius: 8 },
  galleryNav: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 20 },
  galleryCounter: { color: "#fff", fontSize: 14 },
});
