import { useState, useRef, useEffect } from "react";
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
import { glassStyle } from "@/lib/glass-styles";

const { width: SW } = Dimensions.get("window");
const isDesktop = SW >= 768;
const CONTENT_W = Math.min(SW, 960);

// ─── 卡片主题配色 ───
const CARD_THEMES = [
  { gradient: ["#1a0a2e", "#2d1b69", "#44318d"] as const, accent: "#e9c46a", glow: "rgba(233,196,106,0.15)" },
  { gradient: ["#0a192f", "#112240", "#1d3557"] as const, accent: "#64ffda", glow: "rgba(100,255,218,0.15)" },
  { gradient: ["#1a1a2e", "#16213e", "#0f3460"] as const, accent: "#e94560", glow: "rgba(233,69,96,0.15)" },
  { gradient: ["#0d1b2a", "#1b263b", "#415a77"] as const, accent: "#f77f00", glow: "rgba(247,127,0,0.15)" },
  { gradient: ["#2d0a0a", "#4a1010", "#6b1d1d"] as const, accent: "#ffd700", glow: "rgba(255,215,0,0.15)" },
  { gradient: ["#0a2e1a", "#1b4332", "#2d6a4f"] as const, accent: "#95d5b2", glow: "rgba(149,213,178,0.15)" },
  { gradient: ["#1a0a1e", "#2e1a3e", "#4a2c6e"] as const, accent: "#c77dff", glow: "rgba(199,125,255,0.15)" },
  { gradient: ["#1e1a0a", "#3e2e1a", "#6e4a2c"] as const, accent: "#ffb703", glow: "rgba(255,183,3,0.15)" },
];

// ─── 默认策略档案（后台无数据时展示） ───
const DEFAULT_CARDS: any[] = [
  {
    id: -1, title: "极限黄金对冲 Pro", subtitle: "日均几百~几千单 · 回撤稳定",
    description: "专业级对冲策略，多账户分散风险，回撤可控。已有多个工作室实盘运行超过6个月，经历多次极端行情考验。",
    badge: "🔥 热门", badgeColor: "red", strategyType: "对冲策略", platform: "MT4",
    observeNote: "私聊备注「极限对冲」获取观摩账户",
    coverImage: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/ZHsaMQOjNNmhOyDO.png", galleryImages: null,
  },
  {
    id: -2, title: "一单一结（武汉小艺）", subtitle: "日均20-80单 · 历史零爆仓",
    description: "极致安全的一次一单策略，历史零爆仓记录。适合风险厌恶型客户和保守型工作室，口碑极佳。",
    badge: "🛡️ 零爆仓", badgeColor: "green", strategyType: "一次一单", platform: "MT5",
    observeNote: "私聊备注「一单一结」获取观摩账户",
    coverImage: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/UVwvYYtrcWTlJENF.png", galleryImages: null,
  },
  {
    id: -3, title: "超级黄金调优 2026", subtitle: "两个月战绩600%",
    description: "主力网格策略，经过深度参数调优。高收益高风险，适合激进型工作室。已有多个实盘账户验证。",
    badge: "⚡ 主力", badgeColor: "gold", strategyType: "网格策略", platform: "MT4",
    observeNote: "私聊备注「超级调优」获取观摩账户",
    coverImage: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/LXzzcgHZcdfIghSr.png", galleryImages: null,
  },
  {
    id: -4, title: "趋势刷单 · 军火库独家版", subtitle: "单边1000点暴跌不爆仓",
    description: "趋势马丁策略，抗单能力极强。独家调优版本，市面无同款。经过2024年多次极端行情验证。",
    badge: "💎 独家", badgeColor: "gold", strategyType: "趋势马丁", platform: "MT4",
    observeNote: "私聊备注「趋势刷单」获取观摩账户",
    coverImage: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/vNtkFswQtKnMDizI.png", galleryImages: null,
  },
  {
    id: -5, title: "点金订单流", subtitle: "四维共振 · 专业机构选择",
    description: "机构级订单流分析系统，四维共振信号。适合专业交易团队和工作室，是我们的旗舰产品。",
    badge: "👑 旗舰", badgeColor: "gold", strategyType: "订单流", platform: "MT4/MT5",
    observeNote: "私聊备注「点金订单流」获取观摩账户",
    coverImage: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512759674/wjERAPAgIuvumwkn.png", galleryImages: null,
  },
];

export default function CooperationPage() {
  const colors = useColors();
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [showContact, setShowContact] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: backendCards, isLoading: cardsLoading } = trpc.cooperation.cards.useQuery();
  const { data: plans } = trpc.cooperation.plans.useQuery();
  const { data: contactSettings } = trpc.siteSettings.getContact.useQuery();

  const telegram = contactSettings?.telegram || "@xau6000";
  const qq1 = "1226426670";
  const qq2 = contactSettings?.qq || "3832001817";
  const wechat1 = "oooiniooo0624";
  const wechat2 = "xau6000";
  const cards = (backendCards && backendCards.length > 0) ? backendCards : DEFAULT_CARDS;

  const parseGallery = (g?: string | null): string[] => {
    if (!g) return []; try { return JSON.parse(g); } catch { return []; }
  };
  const parseFeatures = (f?: string | null): string[] => {
    if (!f) return []; try { return JSON.parse(f); } catch { return []; }
  };

  const getTheme = (idx: number) => {
    if (idx < 0 || !Number.isFinite(idx)) return CARD_THEMES[0];
    return CARD_THEMES[idx % CARD_THEMES.length];
  };

  if (cardsLoading) {
    return <ScreenContainer><View style={s.loadingWrap}><ActivityIndicator size="large" color="#D97706" /></View></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView style={s.page} showsVerticalScrollIndicator={false}>
        {/* 返回按钮 */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F1F5F9" />
        </TouchableOpacity>

        {/* ═══════════════════ HERO ═══════════════════ */}
        <LinearGradient colors={["#0A0E1A", "#111827", "#0A0E1A"]} style={s.hero}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: "center" }}>
            <View style={s.heroAccent} />
            <View style={s.heroBadge}>
              <View style={s.liveDot} />
              <Text style={s.heroBadgeText}>量化军火库 · 策略源头</Text>
            </View>
            <Text style={s.heroTitle}>工作室深度合作</Text>
            <Text style={s.heroTagline}>源码掌控 · 独家优化 · 源头直供</Text>
            <Text style={s.heroDesc}>
              我们持有全网200+款主流EA的源码{"\n"}
              具备100%破解与独家优化能力{"\n"}
              与我们合作 = 源头价 + 独家版 + 终身技术支持
            </Text>

            {/* 核心数据 */}
            <View style={s.statsRow}>
              {[
                { num: "200+", label: "EA源码库" },
                { num: "30+", label: "合作工作室" },
                { num: "50+", label: "独家调优版" },
                { num: "7×24", label: "技术支持" },
              ].map((item, i) => (
                <View key={i} style={s.statItem}>
                  <Text style={s.statNum}>{item.num}</Text>
                  <Text style={s.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.heroCTA} onPress={() => setShowContact(true)}>
              <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.heroCTAInner}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#0A0E1A" />
                <Text style={s.heroCTAText}>立即咨询合作</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>

        {/* ═══════════════════ 策略档案 ═══════════════════ */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionLine} />
            <Text style={s.sectionLabel}>STRATEGY PORTFOLIO</Text>
            <Text style={s.sectionTitle}>精选策略档案</Text>
            <Text style={s.sectionSubtitle}>每一款都经过实盘验证 · 点击查看详情与观摩</Text>
          </View>

          {/* ═══ 策略卡片 - 全新视觉设计 ═══ */}
          {cards.map((card: any, index: number) => {
            const theme = getTheme(index);
            const gallery = parseGallery(card.galleryImages);
            const hasCover = !!card.coverImage;

            return (
              <TouchableOpacity
                key={card.id}
                style={s.cardOuter}
                onPress={() => setSelectedCard(card)}
                activeOpacity={0.92}
              >
                {/* 外发光层 */}
                <View style={[s.cardGlow, { backgroundColor: theme.glow }]} />

                <LinearGradient
                  colors={[...theme.gradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.cardContainer}
                >
                  {/* 序号水印 */}
                  <Text style={[s.cardWatermark, { color: theme.accent }]}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>

                  {/* 顶部区域：封面图 + 信息 */}
                  <View style={s.cardTopSection}>
                    {/* 封面图区域 */}
                    <View style={s.coverSection}>
                      {hasCover ? (
                        <Image source={{ uri: card.coverImage }} style={s.coverImage} resizeMode="cover" />
                      ) : (
                        <LinearGradient
                          colors={[`${theme.accent}15`, `${theme.accent}05`]}
                          style={s.coverPlaceholder}
                        >
                          <View style={[s.coverIconRing, { borderColor: `${theme.accent}40` }]}>
                            <Ionicons name="trending-up" size={28} color={`${theme.accent}60`} />
                          </View>
                        </LinearGradient>
                      )}
                      {/* 封面上的角标 */}
                      {card.badge && (
                        <View style={[s.coverBadge, { backgroundColor: theme.accent }]}>
                          <Text style={s.coverBadgeText}>{card.badge}</Text>
                        </View>
                      )}
                      {/* 平台标签 */}
                      {card.platform && (
                        <View style={s.coverPlatform}>
                          <Text style={s.coverPlatformText}>{card.platform}</Text>
                        </View>
                      )}
                    </View>

                    {/* 右侧信息区 */}
                    <View style={s.cardInfoSection}>
                      {/* 策略类型 */}
                      {card.strategyType && (
                        <View style={[s.typeTag, { borderColor: `${theme.accent}50` }]}>
                          <View style={[s.typeDot, { backgroundColor: theme.accent }]} />
                          <Text style={[s.typeTagText, { color: theme.accent }]}>{card.strategyType}</Text>
                        </View>
                      )}

                      {/* 标题 */}
                      <Text style={s.cardTitle} numberOfLines={2}>{card.title}</Text>

                      {/* 副标题 */}
                      {card.subtitle && (
                        <Text style={[s.cardSubtitle, { color: theme.accent }]} numberOfLines={1}>
                          {card.subtitle}
                        </Text>
                      )}

                      {/* 描述 */}
                      <Text style={s.cardDesc} numberOfLines={2}>{card.description}</Text>
                    </View>
                  </View>

                  {/* 分隔线 */}
                  <View style={[s.cardDivider, { backgroundColor: `${theme.accent}20` }]} />

                  {/* 底部操作栏 */}
                  <View style={s.cardBottom}>
                    <View style={s.cardBottomLeft}>
                      <Ionicons name="eye-outline" size={14} color="#94A3B8" />
                      <Text style={s.cardObserveText}>
                        {gallery.length > 0 ? `${gallery.length}张观摩截图` : "可获取观摩账户"}
                      </Text>
                    </View>
                    <View style={[s.cardViewBtn, { backgroundColor: `${theme.accent}18`, borderColor: `${theme.accent}50` }]}>
                      <Text style={[s.cardViewBtnText, { color: theme.accent }]}>查看详情</Text>
                      <Ionicons name="arrow-forward" size={13} color={theme.accent} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ═══════════════════ 工作室扶持 ═══════════════════ */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionLine} />
            <Text style={s.sectionLabel}>STUDIO SUPPORT</Text>
            <Text style={s.sectionTitle}>工作室扶持计划</Text>
            <Text style={s.sectionSubtitle}>从策略选型到运营落地 · 一站式深度扶持</Text>
          </View>

          <View style={s.supportGrid}>
            {[
              { icon: "diamond", title: "策略选型", desc: "根据资金量、风险偏好、客户类型，精准推荐最适合的策略组合", color: "#8B5CF6" },
              { icon: "construct", title: "深度调优", desc: "针对合作平台的点差、杠杆、延迟进行专属参数优化", color: "#3B82F6" },
              { icon: "analytics", title: "实盘观摩", desc: "所有策略均提供实盘观摩账户，数据透明可查，眼见为实", color: "#10B981" },
              { icon: "headset", title: "1对1陪跑", desc: "专属技术顾问，7×24小时响应，从部署到运维全程陪跑", color: "#EF4444" },
              { icon: "cash", title: "源头直供", desc: "成本直降80%，比市面任何渠道都便宜。发我对比给你更优价", color: "#F59E0B" },
              { icon: "infinite", title: "无限授权", desc: "有效期内不限窗口、不限账户，一个价格覆盖所有需求", color: "#06B6D4" },
            ].map((item, i) => (
              <View key={i} style={[s.supportCard, glassStyle("subtle") as any]}
            >
                <View style={[s.supportIconWrap, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={s.supportTitle}>{item.title}</Text>
                <Text style={s.supportDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ═══════════════════ 专属EA定制服务 ═══════════════════ */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionLine} />
            <Text style={s.sectionLabel}>CUSTOM EA SERVICE</Text>
            <Text style={s.sectionTitle}>专属EA定制服务</Text>
            <Text style={s.sectionSubtitle}>你的策略，你的品牌 · 从源码到版权全部归你</Text>
          </View>

          <View style={[s.customEABlock]}>
            <LinearGradient colors={["#1E293B", "#0F172A"]} style={s.customEAInner}>
              <View style={s.customEABadge}>
                <Ionicons name="code-slash" size={16} color="#D97706" />
                <Text style={s.customEABadgeText}>核心服务</Text>
              </View>
              <Text style={s.customEATitle}>为工作室量身打造专属EA</Text>
              <Text style={s.customEADesc}>
                我们提供从策略开发到品牌包装的一站式定制服务。将成熟策略改造成工作室的专属产品，完全属于你的品牌。
              </Text>

              <View style={s.customEAFeatures}>
                {[
                  { icon: "brush", text: "自定义策略名称，打造工作室专属品牌形象" },
                  { icon: "options", text: "专属调优模式，根据平台环境深度优化参数" },
                  { icon: "infinite", text: "无限授权不受限，不限账户、不限终端、不限客户" },
                  { icon: "shield-checkmark", text: "版权信息替换为工作室自有品牌与联系方式" },
                  { icon: "rocket", text: "从源码编译到最终交付，全流程透明可控" },
                ].map((f, i) => (
                  <View key={i} style={s.customEAFeatureRow}>
                    <View style={s.customEAFeatureIcon}>
                      <Ionicons name={f.icon as any} size={16} color="#D97706" />
                    </View>
                    <Text style={s.customEAFeatureText}>{f.text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={s.customEACTA} onPress={() => setShowContact(true)}>
                <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.customEACTAInner}>
                  <Ionicons name="chatbubbles" size={18} color="#0A0E1A" />
                  <Text style={s.customEACTAText}>咨询定制方案</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        {/* ═══════════════════ 合作方案 ═══════════════════ */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionLine} />
            <Text style={s.sectionLabel}>COOPERATION PLANS</Text>
            <Text style={s.sectionTitle}>灵活的合作方案</Text>
            <Text style={s.sectionSubtitle}>从零门槛试用到源码买断 · 总有适合你的方案</Text>
          </View>

          <View style={s.plansRow}>
            {(plans && plans.length > 0 ? plans : [
              { id: -1, title: "试用合作", badge: "零门槛", price: "免费", priceNote: "体验", features: '["可选一款策略实盘测试","无资金量要求","不拿佣金","指定合作平台账户授权"]' },
              { id: -2, title: "策略授权", badge: "推荐", price: "¥1,000/月", priceNote: "¥2,500/年", features: '["有效期内无限开窗口/授权","永久免费更新迭代","不需要分成"]' },
              { id: -3, title: "源码买断", badge: null, price: "¥9,800起", priceNote: null, features: '["完整源码交付·支持二次开发","终身技术支持","不限平台·无限开窗口/授权"]' },
            ]).map((plan: any, idx: number) => {
              const isMain = idx === 1 || plan.badge === "推荐";
              return (
                <View key={plan.id} style={[s.planCard, isMain && s.planCardMain, glassStyle(isMain ? "strong" : "medium") as any]}
                >
                  {isMain && (
                    <LinearGradient colors={["#D97706", "#F59E0B"]} style={s.planRibbon}>
                      <Text style={s.planRibbonText}>推荐</Text>
                    </LinearGradient>
                  )}
                  <Text style={s.planTitle}>{plan.title}</Text>
                  {plan.badge && plan.badge !== "推荐" && (
                    <View style={s.planBadge}><Text style={s.planBadgeText}>{plan.badge}</Text></View>
                  )}
                  <Text style={[s.planPrice, isMain && { color: "#D97706" }]}>{plan.price}</Text>
                  {plan.priceNote && <Text style={s.planPriceNote}>{plan.priceNote}</Text>}
                  <View style={s.planDivider} />
                  {parseFeatures(plan.features).map((f: string, fi: number) => (
                    <View key={fi} style={s.planFeatureRow}>
                      <Ionicons name="checkmark-circle" size={15} color={isMain ? "#D97706" : "#64748B"} />
                      <Text style={s.planFeatureText}>{f}</Text>
                    </View>
                  ))}
                  <TouchableOpacity style={[s.planCTA, isMain && s.planCTAMain]} onPress={() => setShowContact(true)}>
                    <Text style={[s.planCTAText, isMain && { color: "#0A0E1A" }]}>立即咨询</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* ═══════════════════ 底部CTA ═══════════════════ */}
        <View style={s.bottomCTA}>
          <LinearGradient colors={["#1E293B", "#0F172A"]} style={s.bottomCTAInner}>
            <Text style={s.bottomCTATitle}>准备好开始合作了吗？</Text>
            <Text style={s.bottomCTADesc}>私聊备注「策略名称」获取观摩账户 & 专属报价</Text>
            <TouchableOpacity style={s.bottomCTABtnWrap} onPress={() => setShowContact(true)}>
              <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bottomCTABtnInner}>
                <Ionicons name="chatbubbles" size={20} color="#0A0E1A" />
                <Text style={s.bottomCTABtnText}>立即联系</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* 底部免责 */}
        <View style={s.footer}>
          <View style={s.footerBrand}><View style={s.liveDot} /><Text style={s.footerBrandText}>量化军火库</Text></View>
          <Text style={s.footerSlogan}>源头价直供 · 策略持续更新 · 全方位技术支持</Text>
          <Text style={s.footerDisclaimer}>免责声明：不同平台行情、点差、延迟存在差异，策略表现因此可能不同。我们不作收益保证，不做本金承诺，仅提供优质工具。</Text>
        </View>
      </ScrollView>

      {/* ═══════════════════ 策略详情弹窗 ═══════════════════ */}
      {selectedCard && <Modal visible={!!selectedCard} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{selectedCard?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedCard(null)}>
                <Ionicons name="close-circle" size={28} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {/* 封面 - 大图展示 */}
              {selectedCard?.coverImage ? (
                <Image source={{ uri: selectedCard.coverImage }} style={s.modalCover} resizeMode="cover" />
              ) : (
                <LinearGradient
                  colors={[...(getTheme(Math.max(0, cards.indexOf(selectedCard)))?.gradient || ["#1E293B", "#334155", "#475569"])]}
                  style={[s.modalCover, { justifyContent: "center", alignItems: "center" }]}
                >
                  <Ionicons name="trending-up" size={48} color="rgba(255,255,255,0.2)" />
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 8 }}>暂无封面 · 后台可上传</Text>
                </LinearGradient>
              )}

              {/* 副标题 */}
              {selectedCard?.subtitle && <Text style={s.modalSubtitle}>{selectedCard.subtitle}</Text>}

              {/* 标签行 */}
              <View style={s.modalTags}>
                {selectedCard?.strategyType && <View style={s.modalTag}><Text style={s.modalTagText}>{selectedCard.strategyType}</Text></View>}
                {selectedCard?.platform && <View style={[s.modalTag, { backgroundColor: "#1E40AF" }]}><Text style={s.modalTagText}>{selectedCard.platform}</Text></View>}
              </View>

              {/* 描述 */}
              <Text style={s.modalDesc}>{selectedCard?.description}</Text>

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

              {/* 观摩说明 */}
              {selectedCard?.observeNote && (
                <View style={s.modalObserve}>
                  <Ionicons name="eye" size={18} color="#D97706" />
                  <Text style={s.modalObserveText}>{selectedCard.observeNote}</Text>
                </View>
              )}

              {/* CTA */}
              <TouchableOpacity style={s.modalCTA} onPress={() => { setSelectedCard(null); setShowContact(true); }}>
                <LinearGradient colors={["#D97706", "#F59E0B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.modalCTAInner}>
                  <Ionicons name="chatbubble-ellipses" size={18} color="#0A0E1A" />
                  <Text style={s.modalCTAText}>立即咨询获取观摩账户</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>}

      {/* ═══════════════════ 联系方式弹窗 ═══════════════════ */}
      <Modal visible={showContact} animationType="fade" transparent>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowContact(false)}>
          <View style={s.contactSheet}>
            <LinearGradient colors={["#1E293B", "#0F172A"]} style={s.contactInner}>
              <View style={s.contactIconWrap}>
                <Ionicons name="chatbubbles" size={28} color="#D97706" />
              </View>
              <Text style={s.contactTitle}>联系我们</Text>
              <Text style={s.contactDesc}>私聊备注「策略名称」获取观摩账户 & 专属报价</Text>

              {/* 微信 */}
              <View style={[s.contactBtn, { backgroundColor: "#07C160" }]}>
                <Ionicons name="logo-wechat" size={20} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={s.contactBtnLabel}>微信</Text>
                  <Text style={s.contactBtnValue}>1号: {wechat1}</Text>
                  <Text style={[s.contactBtnValue, { fontSize: 14, marginTop: 2 }]}>2号: {wechat2}</Text>
                </View>
              </View>

              {/* QQ */}
              <View style={[s.contactBtn, { backgroundColor: "#12B7F5" }]}>
                <Ionicons name="chatbox" size={20} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={s.contactBtnLabel}>QQ</Text>
                  <Text style={s.contactBtnValue}>1号: {qq1}</Text>
                  <Text style={[s.contactBtnValue, { fontSize: 14, marginTop: 2 }]}>2号: {qq2}</Text>
                </View>
              </View>

              {/* Telegram */}
              <TouchableOpacity style={[s.contactBtn, { backgroundColor: "#0088cc" }]} onPress={() => Linking.openURL(`https://t.me/${telegram.replace("@", "")}`)}>
                <Ionicons name="paper-plane" size={20} color="#fff" />
                <View><Text style={s.contactBtnLabel}>Telegram</Text><Text style={s.contactBtnValue}>{telegram}</Text></View>
              </TouchableOpacity>
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
            <Image source={{ uri: parseGallery(selectedCard.galleryImages)[galleryIndex] }} style={s.galleryFull} resizeMode="contain" />
          )}
          <View style={s.galleryNav}>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.max(0, galleryIndex - 1))}><Ionicons name="chevron-back" size={32} color="#fff" /></TouchableOpacity>
            <Text style={s.galleryCounter}>{galleryIndex + 1} / {parseGallery(selectedCard?.galleryImages).length}</Text>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.min(parseGallery(selectedCard?.galleryImages).length - 1, galleryIndex + 1))}><Ionicons name="chevron-forward" size={32} color="#fff" /></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ═══════════════════ 样式 ═══════════════════
const COVER_SIZE = isDesktop ? 180 : 130;

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0F172A" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  backBtn: { position: "absolute", top: 16, left: 16, zIndex: 10, padding: 8, backgroundColor: "rgba(10,14,26,0.7)", borderRadius: 20 },

  // Hero
  hero: { paddingTop: 72, paddingBottom: 36, paddingHorizontal: 20, alignItems: "center" },
  heroAccent: { width: 60, height: 3, backgroundColor: "#D97706", borderRadius: 2, marginBottom: 24 },
  heroBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(217,119,6,0.12)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: "rgba(217,119,6,0.25)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D97706", marginRight: 8 },
  heroBadgeText: { color: "#D97706", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  heroTitle: { color: "#F1F5F9", fontSize: 32, fontWeight: "900", marginBottom: 8, textAlign: "center", letterSpacing: 1 },
  heroTagline: { color: "#D97706", fontSize: 14, fontWeight: "700", marginBottom: 16, letterSpacing: 2 },
  heroDesc: { color: "#94A3B8", fontSize: 13, lineHeight: 22, textAlign: "center", marginBottom: 28 },
  statsRow: { flexDirection: "row", gap: 0, marginBottom: 28, width: "100%", maxWidth: 500 },
  statItem: { flex: 1, alignItems: "center", borderRightWidth: 1, borderRightColor: "#1E293B" },
  statNum: { color: "#F1F5F9", fontSize: 22, fontWeight: "900", marginBottom: 2 },
  statLabel: { color: "#64748B", fontSize: 11 },
  heroCTA: { borderRadius: 28, overflow: "hidden" },
  heroCTAInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14 },
  heroCTAText: { color: "#0A0E1A", fontSize: 15, fontWeight: "800" },

  // Section
  section: { marginTop: 12, paddingHorizontal: 16 },
  sectionHeader: { alignItems: "center", marginBottom: 24, paddingTop: 20 },
  sectionLine: { width: 40, height: 2, backgroundColor: "#D97706", borderRadius: 1, marginBottom: 16 },
  sectionLabel: { color: "#64748B", fontSize: 11, fontWeight: "700", letterSpacing: 3, marginBottom: 8 },
  sectionTitle: { color: "#F1F5F9", fontSize: 24, fontWeight: "900", marginBottom: 6 },
  sectionSubtitle: { color: "#94A3B8", fontSize: 13 },

  // ═══ 全新策略卡片样式 ═══
  cardOuter: {
    marginBottom: 20,
    borderRadius: 18,
    position: "relative",
  },
  cardGlow: {
    position: "absolute",
    top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 18,
    // 外发光效果
  },
  cardContainer: {
    borderRadius: 18,
    padding: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardWatermark: {
    position: "absolute",
    top: 12,
    right: 16,
    fontSize: 56,
    fontWeight: "900",
    opacity: 0.06,
  },

  // 卡片顶部：封面 + 信息
  cardTopSection: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 12,
    gap: 14,
  },

  // 封面图区域
  coverSection: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    // 添加内阴影效果
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  coverImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  coverPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  coverIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  coverBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  coverBadgeText: {
    color: "#0A0E1A",
    fontSize: 10,
    fontWeight: "900",
  },
  coverPlatform: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  coverPlatformText: {
    color: "#E2E8F0",
    fontSize: 10,
    fontWeight: "700",
  },

  // 右侧信息区
  cardInfoSection: {
    flex: 1,
    justifyContent: "center",
  },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  typeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  typeTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#F1F5F9",
    fontSize: isDesktop ? 20 : 17,
    fontWeight: "900",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardDesc: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.85,
  },

  // 分隔线
  cardDivider: {
    height: 1,
    marginHorizontal: 16,
  },

  // 底部操作栏
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardBottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardObserveText: {
    color: "#64748B",
    fontSize: 12,
  },
  cardViewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardViewBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Support Grid
  supportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  supportCard: { width: isDesktop ? "31%" : "47%", flexGrow: 1, backgroundColor: "rgba(30,41,59,0.5)", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.08)" },
  supportIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  supportTitle: { color: "#F1F5F9", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  supportDesc: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },

  // Plans
  plansRow: { flexDirection: isDesktop ? "row" : "column", gap: 12, marginBottom: 20 },
  planCard: { flex: isDesktop ? 1 : undefined, backgroundColor: "rgba(30,41,59,0.55)", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: "rgba(148,163,184,0.1)" },
  planCardMain: { borderColor: "#D97706", borderWidth: 2, position: "relative" },
  planRibbon: { position: "absolute", top: 0, right: 24, paddingHorizontal: 14, paddingVertical: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  planRibbonText: { color: "#0A0E1A", fontSize: 12, fontWeight: "800" },
  planTitle: { color: "#F1F5F9", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  planBadge: { backgroundColor: "rgba(217,119,6,0.15)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  planBadgeText: { color: "#D97706", fontSize: 11, fontWeight: "700" },
  planPrice: { color: "#F1F5F9", fontSize: 28, fontWeight: "900", marginBottom: 2 },
  planPriceNote: { color: "#64748B", fontSize: 13, marginBottom: 12 },
  planDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 14 },
  planFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  planFeatureText: { color: "#CBD5E1", fontSize: 13, flex: 1 },
  planCTA: { marginTop: 16, backgroundColor: "rgba(30,41,59,0.7)", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  planCTAMain: { backgroundColor: "#D97706" },
  planCTAText: { color: "#F1F5F9", fontSize: 14, fontWeight: "700" },

  // Bottom CTA
  bottomCTA: { margin: 16 },
  bottomCTAInner: { borderRadius: 16, padding: 28, alignItems: "center", borderWidth: 1, borderColor: "#D97706" },
  bottomCTATitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  bottomCTADesc: { color: "#94A3B8", fontSize: 13, marginBottom: 20, textAlign: "center" },
  bottomCTABtnWrap: { borderRadius: 28, overflow: "hidden" },
  bottomCTABtnInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14 },
  bottomCTABtnText: { color: "#0A0E1A", fontSize: 15, fontWeight: "800" },

  // Footer
  footer: { paddingVertical: 32, paddingHorizontal: 20, alignItems: "center", borderTopWidth: 1, borderTopColor: "#1E293B" },
  footerBrand: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  footerBrandText: { color: "#D97706", fontSize: 16, fontWeight: "700", marginLeft: 6 },
  footerSlogan: { color: "#94A3B8", fontSize: 13, marginBottom: 16 },
  footerDisclaimer: { color: "#475569", fontSize: 11, textAlign: "center", lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  modalSheet: { maxHeight: "92%", backgroundColor: "rgba(17,24,39,0.95)", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHandle: { width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginTop: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  modalTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "900", flex: 1, marginRight: 12 },
  modalBody: { padding: 20 },
  modalCover: { width: "100%", height: 220, borderRadius: 12, marginBottom: 16 },
  modalSubtitle: { color: "#D97706", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  modalTags: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  modalTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#334155" },
  modalTagText: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },
  modalDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginBottom: 16 },
  modalSectionTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  modalGallery: { marginBottom: 16 },
  galleryThumb: { width: 160, height: 110, borderRadius: 8, marginRight: 10, backgroundColor: "#334155" },
  modalObserve: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 10, gap: 10, marginBottom: 20, backgroundColor: "rgba(217,119,6,0.1)", borderWidth: 1, borderColor: "rgba(217,119,6,0.3)" },
  modalObserveText: { color: "#D97706", fontSize: 13, flex: 1, fontWeight: "600" },
  modalCTA: { marginBottom: 24, borderRadius: 12, overflow: "hidden" },
  modalCTAInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  modalCTAText: { color: "#0A0E1A", fontSize: 15, fontWeight: "800" },

  // Contact
  contactSheet: { marginHorizontal: 20, borderRadius: 20, overflow: "hidden" },
  contactInner: { padding: 24, alignItems: "center" },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(217,119,6,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  contactTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "800", marginBottom: 6 },
  contactDesc: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 20 },
  contactBtn: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 12, width: "100%", marginBottom: 10 },
  contactBtnLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  contactBtnValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
  contactCloseBtn: { alignItems: "center", paddingVertical: 12, backgroundColor: "#334155", borderRadius: 10, width: "100%", marginTop: 6 },
  contactCloseBtnText: { color: "#F1F5F9", fontSize: 14, fontWeight: "600" },

  // Gallery
  galleryModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  galleryClose: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  galleryFull: { width: SW - 40, height: SW - 40, borderRadius: 8 },
  galleryNav: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 20 },
  galleryCounter: { color: "#fff", fontSize: 14 },

  // 专属EA定制服务
  customEABlock: { marginHorizontal: 4, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(217,119,6,0.2)" },
  customEAInner: { padding: 24, alignItems: "center" },
  customEABadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(217,119,6,0.12)", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "rgba(217,119,6,0.25)" },
  customEABadgeText: { color: "#D97706", fontSize: 12, fontWeight: "700" },
  customEATitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "900", marginBottom: 10, textAlign: "center" },
  customEADesc: { color: "#94A3B8", fontSize: 13, lineHeight: 22, textAlign: "center", marginBottom: 20 },
  customEAFeatures: { width: "100%", gap: 12, marginBottom: 24 },
  customEAFeatureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  customEAFeatureIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(217,119,6,0.1)", justifyContent: "center", alignItems: "center" },
  customEAFeatureText: { color: "#CBD5E1", fontSize: 13, lineHeight: 20, flex: 1 },
  customEACTA: { borderRadius: 24, overflow: "hidden" },
  customEACTAInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 12 },
  customEACTAText: { color: "#0A0E1A", fontSize: 14, fontWeight: "800" },
});
