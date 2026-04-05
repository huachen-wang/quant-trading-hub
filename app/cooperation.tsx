import React, { useState } from "react";
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

// 占位策略卡片（后台没有数据时展示）
const PLACEHOLDER_CARDS = [
  {
    id: "c1", title: "DDXAU 点金", subtitle: "四维共振 × 订单流 × AI量化",
    description: "$280,000+ 实盘验证，4年+ 稳定盈利。黄金专属趋势策略，结合订单流分析与AI动态调参，回撤控制在8%以内。",
    badge: "主推", badgeColor: "red", strategyType: "趋势跟踪", platform: "MT5",
    coverImage: null, galleryImages: null, observeNote: "提供实盘观摩账户，数据公开可查", isVisible: true, sortOrder: 1,
  },
  {
    id: "c2", title: "Quantum Emperor", subtitle: "AI神经网络量化引擎",
    description: "2024年度MQL5销量冠军，基于深度学习的黄金交易策略。多时间框架分析，自适应市场环境。",
    badge: "爆款", badgeColor: "gold", strategyType: "AI量化", platform: "MT5",
    coverImage: null, galleryImages: null, observeNote: "可提供3个月实盘观摩", isVisible: true, sortOrder: 2,
  },
  {
    id: "c3", title: "Waka Waka EA", subtitle: "7年实盘验证的网格对冲策略",
    description: "经典网格对冲策略，经过7年实盘考验。智能风控系统，自动识别震荡区间，适合稳健型交易者。",
    badge: "经典", badgeColor: "green", strategyType: "网格对冲", platform: "MT4/MT5",
    coverImage: null, galleryImages: null, observeNote: "提供历史回测报告", isVisible: true, sortOrder: 3,
  },
  {
    id: "c4", title: "Night Hunter Pro", subtitle: "亚盘剥头皮之王",
    description: "专注亚盘时段的高频剥头皮策略，低风险高胜率。特别适合Prop Firm考核，通过率极高。",
    badge: "热门", badgeColor: "blue", strategyType: "剥头皮", platform: "MT4/MT5",
    coverImage: null, galleryImages: null, observeNote: "适合Prop Firm考核", isVisible: true, sortOrder: 4,
  },
  {
    id: "c5", title: "Gold Trade Pro", subtitle: "黄金趋势智能跟踪系统",
    description: "专为黄金设计的趋势跟踪EA，结合多指标共振确认入场信号，动态止盈止损，月化收益15-25%。",
    badge: null, badgeColor: null, strategyType: "趋势跟踪", platform: "MT5",
    coverImage: null, galleryImages: null, observeNote: null, isVisible: true, sortOrder: 5,
  },
  {
    id: "c6", title: "Dark Algo V3", subtitle: "多品种对冲暗黑算法",
    description: "支持黄金、外汇、指数多品种同时运行，分散风险。适合大资金稳健运行，月化8-15%。",
    badge: null, badgeColor: null, strategyType: "多品种对冲", platform: "MT5",
    coverImage: null, galleryImages: null, observeNote: null, isVisible: true, sortOrder: 6,
  },
];

// 占位合作方案
const PLACEHOLDER_PLANS = [
  {
    id: "pl1", title: "试用体验", badge: null, price: "免费", priceNote: "7天试用期",
    features: JSON.stringify(["任选1款策略7天试用", "基础技术支持", "入门参数配置指导", "加入用户交流群"]),
    sortOrder: 1, isVisible: true,
  },
  {
    id: "pl2", title: "工作室合作", badge: "推荐", price: "$299/月", priceNote: "季付9折 · 年付7折",
    features: JSON.stringify(["全部策略无限使用", "源码级参数调优", "1对1专属技术顾问", "合作平台最优条件", "专属返佣渠道", "策略持续更新迭代", "优先体验新策略"]),
    sortOrder: 2, isVisible: true,
  },
  {
    id: "pl3", title: "深度定制", badge: "旗舰", price: "面议", priceNote: "按需定制",
    features: JSON.stringify(["定制开发专属策略", "独家参数优化", "7×24小时技术支持", "策略源码交付", "市场独占权可谈", "团队驻场支持"]),
    sortOrder: 3, isVisible: true,
  },
];

export default function CooperationPage() {
  const colors = useColors();
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showContact, setShowContact] = useState(false);

  const { data: cards, isLoading: cardsLoading } = trpc.cooperation.cards.useQuery();
  const { data: plans, isLoading: plansLoading } = trpc.cooperation.plans.useQuery();
  const { data: contactSettings } = trpc.siteSettings.getContact.useQuery();

  const telegram = contactSettings?.telegram || "@quantarsenal";
  const qq = contactSettings?.qq || "3832001817";

  const isLoading = cardsLoading || plansLoading;

  // 使用后台数据，如果没有则用占位数据
  const displayCards = (cards && cards.length > 0) ? cards : PLACEHOLDER_CARDS;
  const displayPlans = (plans && plans.length > 0) ? plans : PLACEHOLDER_PLANS;

  // 分离主推和普通策略
  const featuredCards = displayCards.filter((c: any) => c.badge === "主推" || c.badgeColor === "red");
  const normalCards = displayCards.filter((c: any) => c.badge !== "主推" && c.badgeColor !== "red");

  const getBadgeStyle = (badgeColor?: string) => {
    switch (badgeColor) {
      case "red": return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
      case "green": return { bg: "#D1FAE5", text: "#059669", border: "#A7F3D0" };
      case "blue": return { bg: "#DBEAFE", text: "#2563EB", border: "#BFDBFE" };
      default: return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
    }
  };

  const parseFeatures = (features?: string | null): string[] => {
    if (!features) return [];
    try { return JSON.parse(features); } catch { return []; }
  };

  const parseGallery = (gallery?: string | null): string[] => {
    if (!gallery) return [];
    try { return JSON.parse(gallery); } catch { return []; }
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
      <ScrollView style={[s.container, { backgroundColor: "#0A0E1A" }]} showsVerticalScrollIndicator={false}>
        {/* 返回按钮 */}
        <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
          <View style={s.backButtonInner}>
            <Ionicons name="arrow-back" size={20} color="#F1F5F9" />
          </View>
        </TouchableOpacity>

        {/* Hero 区域 */}
        <View style={s.heroSection}>
          <View style={s.heroGlow} />
          <View style={s.heroGlow2} />

          <View style={s.heroContent}>
            <View style={s.heroBadge}>
              <View style={s.heroBadgeDot} />
              <Text style={s.heroBadgeText}>量化军火库 · 策略合作</Text>
            </View>

            <Text style={s.heroTitle}>EA 策略合作方案</Text>
            <Text style={s.heroSubtitle}>
              我们是源头 · 市面上所有策略我们都有源码{"\n"}
              可破解 · 可独家优化 · 成本直降80%
            </Text>

            {/* 核心能力展示 */}
            <View style={s.capabilityRow}>
              {[
                { icon: "code-slash", title: "源码掌控", desc: "所有策略源码在手" },
                { icon: "key", title: "破解能力", desc: "市面EA均可破解" },
                { icon: "diamond", title: "独家优化", desc: "参数深度调优" },
                { icon: "people", title: "平台资源", desc: "最优合作条件" },
              ].map((item, i) => (
                <View key={i} style={s.capabilityCard}>
                  <View style={s.capabilityIconWrap}>
                    <Ionicons name={item.icon as any} size={18} color="#F59E0B" />
                  </View>
                  <Text style={s.capabilityTitle}>{item.title}</Text>
                  <Text style={s.capabilityDesc}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 权威声明条 */}
        <View style={s.authorityBanner}>
          <Ionicons name="shield-checkmark" size={18} color="#F59E0B" />
          <Text style={s.authorityBannerText}>
            全网EA源头供应商 · 117+策略实测 · 蓝莓总部深度合作
          </Text>
        </View>

        {/* 主推策略 */}
        {featuredCards.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.sectionTitleRow}>
                <Ionicons name="star" size={18} color="#EF4444" />
                <Text style={s.sectionTitle}>主推策略</Text>
              </View>
              <Text style={s.sectionSubtitle}>经过深度验证，团队重点推荐</Text>
            </View>
            <View style={s.featuredGrid}>
              {featuredCards.map((card: any) => renderStrategyCard(card, true))}
            </View>
          </View>
        )}

        {/* 全部可用策略 */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="grid" size={18} color="#F59E0B" />
              <Text style={s.sectionTitle}>全部可用策略</Text>
            </View>
            <Text style={s.sectionSubtitle}>所有策略均可提供观摩账户与专属报价</Text>
          </View>
          <View style={s.strategiesGrid}>
            {normalCards.map((card: any) => renderStrategyCard(card, false))}
          </View>
        </View>

        {/* 工作室扶持专区 */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="rocket" size={18} color="#F59E0B" />
              <Text style={s.sectionTitle}>工作室扶持计划</Text>
            </View>
            <Text style={s.sectionSubtitle}>从策略选型到运营指导的一站式服务</Text>
          </View>
          <View style={s.supportGrid}>
            {[
              { icon: "rocket", title: "快速启动", desc: "零门槛试用，选定策略即可上线运营", color: "#10B981" },
              { icon: "analytics", title: "数据透明", desc: "实盘观摩账户，所有数据公开可查验", color: "#3B82F6" },
              { icon: "cash", title: "成本优势", desc: "源头直供，比市面价低80%以上", color: "#F59E0B" },
              { icon: "headset", title: "专属服务", desc: "1对1技术支持，问题即时响应解决", color: "#8B5CF6" },
              { icon: "trending-up", title: "持续迭代", desc: "策略每月更新优化，确保最优状态", color: "#EF4444" },
              { icon: "people", title: "资源对接", desc: "合作平台最优条件，全额返佣无截留", color: "#06B6D4" },
            ].map((item, i) => (
              <View key={i} style={s.supportCard}>
                <View style={[s.supportIconWrap, { backgroundColor: item.color + "15" }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={s.supportTextWrap}>
                  <Text style={s.supportTitle}>{item.title}</Text>
                  <Text style={s.supportDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* CTA 中间 */}
        <View style={s.midCTA}>
          <TouchableOpacity style={s.midCTABtn} onPress={() => setShowContact(true)}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#0A0E1A" />
            <Text style={s.midCTABtnText}>私聊备注「策略名称」获取观摩账户 & 专属报价</Text>
          </TouchableOpacity>
        </View>

        {/* 合作模式 - 放在最后 */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="pricetags" size={18} color="#F59E0B" />
              <Text style={s.sectionTitle}>合作模式 & 价格</Text>
            </View>
            <Text style={s.sectionSubtitle}>灵活方案，适配不同规模的工作室</Text>
          </View>
          <View style={s.plansGrid}>
            {displayPlans.map((plan: any, index: number) => {
              const isRecommended = plan.badge === "推荐" || index === 1;
              return (
                <View key={plan.id} style={[s.planCard, isRecommended && s.planCardRecommended]}>
                  {isRecommended && (
                    <View style={s.planRecommendedTag}>
                      <Ionicons name="star" size={10} color="#0A0E1A" />
                      <Text style={s.planRecommendedTagText}>推荐</Text>
                    </View>
                  )}
                  <Text style={s.planTitle}>{plan.title}</Text>
                  {plan.badge && !isRecommended && (
                    <View style={s.planBadge}>
                      <Text style={s.planBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                  <View style={s.planPriceArea}>
                    <Text style={[s.planPrice, isRecommended && { color: "#F59E0B" }]}>{plan.price}</Text>
                    {plan.priceNote && <Text style={s.planPriceNote}>{plan.priceNote}</Text>}
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

        {/* 服务保障 */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="shield-checkmark" size={18} color="#F59E0B" />
              <Text style={s.sectionTitle}>服务保障</Text>
            </View>
          </View>
          <View style={s.serviceGrid}>
            {[
              { title: "合作平台", desc: "我们带客户直接对接合作平台，拿到的都是最优条件。杠杆500即可，美刀美分均可。", icon: "business" },
              { title: "专属返佣", desc: "深度合作客户免费获得专属返佣渠道，全额返佣，无抽成，无截留。", icon: "cash" },
              { title: "持续更新", desc: "每月持续更新迭代，确保策略始终处于最优状态。任何技术问题，全方位支持。", icon: "refresh" },
            ].map((item, i) => (
              <View key={i} style={s.serviceCard}>
                <View style={s.serviceIconWrap}>
                  <Ionicons name={item.icon as any} size={20} color="#F59E0B" />
                </View>
                <Text style={s.serviceCardTitle}>{item.title}</Text>
                <Text style={s.serviceCardDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 底部品牌 */}
        <View style={s.footer}>
          <View style={s.footerBrand}>
            <View style={s.footerBrandDot} />
            <Text style={s.footerBrandText}>量化军火库</Text>
          </View>
          <Text style={s.footerSlogan}>源头价直供 · 策略持续更新 · 全方位技术支持</Text>
          <Text style={s.footerDisclaimer}>
            免责声明：不同平台行情、点差、延迟存在差异，策略表现因此可能不同环境而变。我们不作收益保证，不做本金承诺，仅提供优质工具。
          </Text>
        </View>
      </ScrollView>

      {/* 策略详情弹窗 */}
      <Modal visible={!!selectedCard} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{selectedCard?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedCard(null)}>
                <Ionicons name="close" size={24} color="#F1F5F9" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {selectedCard?.coverImage && (
                <Image source={{ uri: selectedCard.coverImage }} style={s.modalCover} resizeMode="cover" />
              )}

              {selectedCard?.subtitle && (
                <Text style={s.modalSubtitle}>{selectedCard.subtitle}</Text>
              )}

              <View style={s.modalMetaRow}>
                {selectedCard?.strategyType && (
                  <View style={s.modalMetaTag}>
                    <Ionicons name="trending-up" size={12} color="#F59E0B" />
                    <Text style={s.modalMetaTagText}>{selectedCard.strategyType}</Text>
                  </View>
                )}
                {selectedCard?.platform && (
                  <View style={s.modalMetaTag}>
                    <Ionicons name="desktop" size={12} color="#3B82F6" />
                    <Text style={s.modalMetaTagText}>{selectedCard.platform}</Text>
                  </View>
                )}
                {selectedCard?.badge && (
                  <View style={[s.modalMetaBadge, { backgroundColor: getBadgeStyle(selectedCard.badgeColor).bg }]}>
                    <Text style={[s.modalMetaBadgeText, { color: getBadgeStyle(selectedCard.badgeColor).text }]}>{selectedCard.badge}</Text>
                  </View>
                )}
                <View style={[s.modalMetaTag, { backgroundColor: "rgba(245,158,11,0.1)" }]}>
                  <Ionicons name="code-slash" size={12} color="#F59E0B" />
                  <Text style={[s.modalMetaTagText, { color: "#F59E0B" }]}>源码可查</Text>
                </View>
              </View>

              {selectedCard?.description && (
                <Text style={s.modalDesc}>{selectedCard.description}</Text>
              )}

              {/* 观摩截图画廊 */}
              {parseGallery(selectedCard?.galleryImages).length > 0 && (
                <View style={s.modalGallery}>
                  <Text style={s.modalGalleryTitle}>实盘观摩截图</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {parseGallery(selectedCard?.galleryImages).map((img: string, i: number) => (
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

              {selectedCard?.observeNote && (
                <View style={s.observeNote}>
                  <Ionicons name="eye" size={18} color="#F59E0B" />
                  <Text style={s.observeNoteText}>{selectedCard.observeNote}</Text>
                </View>
              )}

              <TouchableOpacity
                style={s.modalCTA}
                onPress={() => { setSelectedCard(null); setShowContact(true); }}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#0A0E1A" />
                <Text style={s.modalCTAText}>立即咨询获取观摩账户</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 联系方式弹窗 */}
      <Modal visible={showContact} animationType="fade" transparent>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowContact(false)}>
          <View style={s.contactModal}>
            <View style={s.contactIconWrap}>
              <Ionicons name="chatbubble-ellipses" size={28} color="#F59E0B" />
            </View>
            <Text style={s.contactTitle}>联系我们</Text>
            <Text style={s.contactDesc}>私聊备注「策略名称」获取观摩账户 & 专属报价</Text>
            <View style={s.contactItem}>
              <Ionicons name="paper-plane" size={20} color="#0088cc" />
              <Text style={s.contactLabel}>Telegram:</Text>
              <TouchableOpacity onPress={() => Linking.openURL(`https://t.me/${telegram.replace("@", "")}`)}>
                <Text style={[s.contactValue, { color: "#0088cc" }]}>{telegram}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.contactItem}>
              <Ionicons name="chatbox" size={20} color="#12B7F5" />
              <Text style={s.contactLabel}>QQ:</Text>
              <Text style={[s.contactValue, { color: "#12B7F5" }]}>{qq}</Text>
            </View>
            <TouchableOpacity style={s.contactClose} onPress={() => setShowContact(false)}>
              <Text style={s.contactCloseText}>我知道了</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 全屏图片查看 */}
      <Modal visible={showGallery} animationType="fade" transparent>
        <View style={s.galleryModal}>
          <TouchableOpacity style={s.galleryCloseBtn} onPress={() => setShowGallery(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedCard && parseGallery(selectedCard.galleryImages)[galleryIndex] && (
            <Image
              source={{ uri: parseGallery(selectedCard.galleryImages)[galleryIndex] }}
              style={s.galleryFullImage}
              resizeMode="contain"
            />
          )}
          <View style={s.galleryNav}>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.max(0, galleryIndex - 1))}>
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={s.galleryCounter}>
              {galleryIndex + 1} / {parseGallery(selectedCard?.galleryImages).length}
            </Text>
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#94A3B8" },

  backButton: { position: "absolute", top: 16, left: 16, zIndex: 10 },
  backButtonInner: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },

  // Hero
  heroSection: { paddingTop: 60, paddingBottom: 32, paddingHorizontal: 20, backgroundColor: "#0A0E1A", position: "relative", overflow: "hidden" },
  heroGlow: { position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(245,158,11,0.08)" },
  heroGlow2: { position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(59,130,246,0.05)" },
  heroContent: { alignItems: "center", position: "relative", zIndex: 1 },
  heroBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", marginBottom: 16 },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F59E0B", marginRight: 8 },
  heroBadgeText: { color: "#F59E0B", fontSize: 13, fontWeight: "700" },
  heroTitle: { color: "#F1F5F9", fontSize: 30, fontWeight: "900", marginBottom: 12, textAlign: "center" },
  heroSubtitle: { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Capability Row
  capabilityRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 24 },
  capabilityCard: { width: isDesktop ? 140 : (SCREEN_WIDTH - 60) / 2, padding: 14, borderRadius: 12, backgroundColor: "#111827", borderWidth: 1, borderColor: "rgba(245,158,11,0.1)", alignItems: "center" },
  capabilityIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(245,158,11,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  capabilityTitle: { color: "#F1F5F9", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  capabilityDesc: { color: "#64748B", fontSize: 11, textAlign: "center" },

  // Authority Banner
  authorityBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, backgroundColor: "rgba(245,158,11,0.06)", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(245,158,11,0.12)" },
  authorityBannerText: { color: "#F59E0B", fontSize: 12, fontWeight: "700" },

  // Section
  section: { paddingVertical: 28, paddingHorizontal: 16 },
  sectionHeader: { marginBottom: 20 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "800" },
  sectionSubtitle: { color: "#64748B", fontSize: 13, marginLeft: 26 },

  // Strategy Cards
  featuredGrid: { gap: 14 },
  strategiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  strategyCard: {
    width: isDesktop ? (SCREEN_WIDTH - 56) / 3 : (SCREEN_WIDTH - 44) / 2,
    backgroundColor: "#111827",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  strategyCardFeatured: {
    width: "100%",
    borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1.5,
  },

  strategyImageWrap: { position: "relative" },
  strategyImage: { width: "100%", height: 120 },
  strategyImagePlaceholder: { backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center" },
  strategyPlaceholderIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(245,158,11,0.1)", justifyContent: "center", alignItems: "center" },

  strategyBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  strategyBadgeText: { fontSize: 11, fontWeight: "700" },
  strategyPlatform: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(30,64,175,0.9)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  strategyPlatformText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  strategyType: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  strategyTypeText: { color: "#CBD5E1", fontSize: 10, fontWeight: "600" },

  strategyContent: { padding: 12 },
  strategyTitle: { color: "#F1F5F9", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  strategySubtitle: { color: "#F59E0B", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  strategyDesc: { color: "#64748B", fontSize: 11, lineHeight: 16, marginBottom: 8 },

  strategyFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  galleryHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  galleryHintText: { color: "#94A3B8", fontSize: 10 },
  strategyViewBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  strategyViewBtnText: { color: "#F59E0B", fontSize: 11, fontWeight: "600" },

  // Support Grid
  supportGrid: { gap: 10 },
  supportCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, backgroundColor: "#111827", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  supportIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 14 },
  supportTextWrap: { flex: 1 },
  supportTitle: { color: "#F1F5F9", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  supportDesc: { color: "#64748B", fontSize: 12, lineHeight: 18 },

  // Mid CTA
  midCTA: { paddingHorizontal: 16, paddingBottom: 8 },
  midCTABtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F59E0B", paddingVertical: 16, borderRadius: 12 },
  midCTABtnText: { color: "#0A0E1A", fontSize: 14, fontWeight: "800" },

  // Plans
  plansGrid: { gap: 14 },
  planCard: { padding: 24, borderRadius: 16, backgroundColor: "#111827", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", position: "relative" },
  planCardRecommended: { borderColor: "#F59E0B", borderWidth: 2 },
  planRecommendedTag: { position: "absolute", top: -1, right: 20, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F59E0B", paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  planRecommendedTagText: { color: "#0A0E1A", fontSize: 11, fontWeight: "800" },
  planTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "800", marginBottom: 4 },
  planBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  planBadgeText: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },
  planPriceArea: { marginBottom: 16 },
  planPrice: { color: "#F1F5F9", fontSize: 28, fontWeight: "900" },
  planPriceNote: { color: "#64748B", fontSize: 13, marginTop: 4 },
  planDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 16 },
  planFeatures: { gap: 10, marginBottom: 20 },
  planFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planFeatureText: { color: "#CBD5E1", fontSize: 13, flex: 1 },
  planCTA: { paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  planCTARecommended: { backgroundColor: "#F59E0B" },
  planCTAText: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },

  // Service
  serviceGrid: { gap: 12 },
  serviceCard: { padding: 20, borderRadius: 12, backgroundColor: "#111827", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  serviceIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(245,158,11,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  serviceCardTitle: { color: "#F59E0B", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  serviceCardDesc: { color: "#94A3B8", fontSize: 13, lineHeight: 20 },

  // Footer
  footer: { paddingVertical: 32, paddingHorizontal: 20, alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  footerBrand: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  footerBrandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B", marginRight: 8 },
  footerBrandText: { color: "#F59E0B", fontSize: 16, fontWeight: "700" },
  footerSlogan: { color: "#94A3B8", fontSize: 13, marginBottom: 16 },
  footerDisclaimer: { color: "#475569", fontSize: 11, textAlign: "center", lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "85%", backgroundColor: "#111827", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  modalTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "700", flex: 1 },
  modalBody: { padding: 20 },
  modalCover: { width: "100%", height: 180, borderRadius: 12, marginBottom: 16 },
  modalSubtitle: { color: "#F59E0B", fontSize: 15, fontWeight: "600", marginBottom: 12 },
  modalMetaRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  modalMetaTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)" },
  modalMetaTagText: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  modalMetaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  modalMetaBadgeText: { fontSize: 12, fontWeight: "700" },
  modalDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginBottom: 20 },
  modalGallery: { marginBottom: 20 },
  modalGalleryTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  galleryThumb: { width: 200, height: 140, borderRadius: 8, marginRight: 10, backgroundColor: "#1E293B" },
  observeNote: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 10, backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)", gap: 10, marginBottom: 20 },
  observeNoteText: { color: "#F59E0B", fontSize: 13, flex: 1 },
  modalCTA: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F59E0B", paddingVertical: 14, borderRadius: 10 },
  modalCTAText: { color: "#0A0E1A", fontSize: 15, fontWeight: "700" },

  // Contact Modal
  contactModal: { margin: 30, padding: 28, borderRadius: 16, backgroundColor: "#111827", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)", alignItems: "center" },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(245,158,11,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  contactTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  contactDesc: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 20 },
  contactItem: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, width: "100%" },
  contactLabel: { color: "#94A3B8", fontSize: 14 },
  contactValue: { fontSize: 15, fontWeight: "600" },
  contactClose: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 10, backgroundColor: "#F59E0B" },
  contactCloseText: { color: "#0A0E1A", fontSize: 15, fontWeight: "700" },

  // Gallery Modal
  galleryModal: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  galleryCloseBtn: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 },
  galleryFullImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 },
  galleryNav: { flexDirection: "row", alignItems: "center", gap: 30, marginTop: 20 },
  galleryCounter: { color: "#fff", fontSize: 16 },
});
