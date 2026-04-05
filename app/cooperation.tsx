import React, { useState, useCallback } from "react";
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
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

  const getBadgeStyle = (badgeColor?: string) => {
    switch (badgeColor) {
      case "red": return { bg: "#FEE2E2", text: "#DC2626" };
      case "green": return { bg: "#D1FAE5", text: "#059669" };
      case "blue": return { bg: "#DBEAFE", text: "#2563EB" };
      default: return { bg: "#FEF3C7", text: "#D97706" }; // gold
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
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>加载中...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
        {/* 返回按钮 */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* 顶部 Hero 区域 */}
        <View style={[styles.heroSection, { backgroundColor: "#0F172A" }]}>
          <View style={styles.heroBadge}>
            <View style={[styles.heroDot, { backgroundColor: "#D97706" }]} />
            <Text style={styles.heroBadgeText}>量化军火库</Text>
          </View>
          <Text style={styles.heroTitle}>EA 策略合作方案</Text>
          <Text style={styles.heroSubtitle}>
            源头价直供 · 成本直降 80% · 手里款式多，发我对比给你更优价
          </Text>

          {/* 四个核心卖点 */}
          <View style={styles.sellingPoints}>
            {[
              { icon: "infinite", title: "无限授权", desc: "有效期内不限窗口" },
              { icon: "people", title: "合作平台最优", desc: "带你进场拿最好条件" },
              { icon: "trending-up", title: "每月更新", desc: "策略持续迭代优化" },
              { icon: "shield-checkmark", title: "全方位支持", desc: "技术问题随时响应" },
            ].map((item, i) => (
              <View key={i} style={[styles.sellingPointCard, { backgroundColor: "#1E293B", borderColor: "#334155" }]}>
                <Ionicons name={item.icon as any} size={24} color="#D97706" />
                <Text style={styles.sellingPointTitle}>{item.title}</Text>
                <Text style={styles.sellingPointDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 工作室扶持专区 */}
        <View style={[styles.studioSection, { backgroundColor: "#0F172A" }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: "#D97706" }]}>工作室扶持计划</Text>
            <View style={[styles.sectionLine, { backgroundColor: "#D97706" }]} />
          </View>
          <Text style={styles.studioDesc}>
            我们深度扶持量化交易工作室，提供从策略选型、参数调优到运营指导的一站式服务。
            无论您是刚起步的小型工作室还是成熟的交易团队，我们都有适合您的合作方案。
          </Text>
          <View style={styles.studioFeatures}>
            {[
              { icon: "rocket", title: "快速启动", desc: "零门槛试用，选定策略即可上线" },
              { icon: "analytics", title: "数据透明", desc: "实盘观摩账户，数据公开可查" },
              { icon: "cash", title: "成本优势", desc: "源头直供，比市面价低80%以上" },
              { icon: "headset", title: "专属服务", desc: "1对1技术支持，问题即时响应" },
            ].map((item, i) => (
              <View key={i} style={[styles.studioFeatureCard, { backgroundColor: "#1E293B", borderColor: "#334155" }]}>
                <View style={[styles.studioFeatureIcon, { backgroundColor: "rgba(217,119,6,0.15)" }]}>
                  <Ionicons name={item.icon as any} size={20} color="#D97706" />
                </View>
                <View style={styles.studioFeatureText}>
                  <Text style={styles.studioFeatureTitle}>{item.title}</Text>
                  <Text style={styles.studioFeatureDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 合作模式 */}
        <View style={[styles.plansSection, { backgroundColor: "#0F172A" }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: "#D97706" }]}>合作模式</Text>
            <View style={[styles.sectionLine, { backgroundColor: "#D97706" }]} />
          </View>
          <View style={styles.plansGrid}>
            {(plans || []).map((plan: any, index: number) => (
              <View key={plan.id} style={[styles.planCard, { backgroundColor: "#1E293B", borderColor: index === 1 ? "#D97706" : "#334155" }]}>
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  {plan.badge && (
                    <View style={[styles.planBadge, { backgroundColor: index === 1 ? "#D97706" : "#334155" }]}>
                      <Text style={[styles.planBadgeText, { color: index === 1 ? "#0F172A" : "#F1F5F9" }]}>{plan.badge}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.planPriceArea}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  {plan.priceNote && <Text style={styles.planPriceNote}>{plan.priceNote}</Text>}
                </View>
                <View style={styles.planFeatures}>
                  {parseFeatures(plan.features).map((feature: string, fi: number) => (
                    <View key={fi} style={styles.planFeatureRow}>
                      <Ionicons name="checkmark" size={16} color="#D97706" />
                      <Text style={styles.planFeatureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.planCTA, { backgroundColor: index === 1 ? "#D97706" : "#334155" }]}
                  onPress={() => setShowContact(true)}
                >
                  <Text style={[styles.planCTAText, { color: index === 1 ? "#0F172A" : "#F1F5F9" }]}>立即咨询</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* 可用策略 */}
        <View style={[styles.strategiesSection, { backgroundColor: "#0F172A" }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: "#D97706" }]}>可用策略</Text>
            <View style={[styles.sectionLine, { backgroundColor: "#D97706" }]} />
          </View>
          <View style={styles.strategiesGrid}>
            {(cards || []).map((card: any) => {
              const badgeStyle = getBadgeStyle(card.badgeColor);
              const gallery = parseGallery(card.galleryImages);
              return (
                <TouchableOpacity
                  key={card.id}
                  style={[styles.strategyCard, { backgroundColor: "#1E293B", borderColor: "#334155" }]}
                  onPress={() => setSelectedCard(card)}
                  activeOpacity={0.8}
                >
                  {card.coverImage && (
                    <Image source={{ uri: card.coverImage }} style={styles.strategyImage} resizeMode="cover" />
                  )}
                  <View style={styles.strategyContent}>
                    <View style={styles.strategyTitleRow}>
                      <Text style={styles.strategyTitle} numberOfLines={1}>{card.title}</Text>
                      {card.badge && (
                        <View style={[styles.strategyBadge, { backgroundColor: badgeStyle.bg }]}>
                          <Text style={[styles.strategyBadgeText, { color: badgeStyle.text }]}>{card.badge}</Text>
                        </View>
                      )}
                    </View>
                    {card.subtitle && (
                      <Text style={styles.strategySubtitle} numberOfLines={1}>{card.subtitle}</Text>
                    )}
                    <View style={styles.strategyMeta}>
                      {card.strategyType && (
                        <View style={[styles.strategyTag, { backgroundColor: "#334155" }]}>
                          <Text style={styles.strategyTagText}>{card.strategyType}</Text>
                        </View>
                      )}
                      {card.platform && (
                        <View style={[styles.strategyTag, { backgroundColor: "#334155" }]}>
                          <Text style={styles.strategyTagText}>{card.platform}</Text>
                        </View>
                      )}
                    </View>
                    {gallery.length > 0 && (
                      <View style={styles.galleryHint}>
                        <Ionicons name="images" size={14} color="#94A3B8" />
                        <Text style={styles.galleryHintText}>{gallery.length}张观摩截图</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CTA 区域 */}
        <View style={[styles.ctaSection, { backgroundColor: "#0F172A" }]}>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: "#D97706" }]}
            onPress={() => setShowContact(true)}
          >
            <Text style={styles.ctaButtonText}>私聊备注「策略名称」获取观摩账户 & 专属报价</Text>
          </TouchableOpacity>
        </View>

        {/* 服务保障 */}
        <View style={[styles.serviceSection, { backgroundColor: "#0F172A" }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: "#D97706" }]}>服务保障</Text>
            <View style={[styles.sectionLine, { backgroundColor: "#D97706" }]} />
          </View>
          <View style={styles.serviceGrid}>
            {[
              { title: "合作平台", desc: "我们带客户直接对接合作平台，拿到的都是最优条件。杠杆500即可，美刀美分均可。" },
              { title: "专属返佣", desc: "深度合作客户免费获得专属返佣渠道，全额返佣，无抽成，无截留。" },
              { title: "持续更新", desc: "每月持续更新迭代，确保策略始终处于最优状态。任何技术问题，全方位支持。" },
            ].map((item, i) => (
              <View key={i} style={[styles.serviceCard, { backgroundColor: "#1E293B", borderColor: "#334155" }]}>
                <Text style={[styles.serviceCardTitle, { color: "#D97706" }]}>{item.title}</Text>
                <Text style={styles.serviceCardDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 底部品牌 */}
        <View style={[styles.footer, { backgroundColor: "#0F172A" }]}>
          <View style={styles.footerBrand}>
            <View style={[styles.heroDot, { backgroundColor: "#D97706" }]} />
            <Text style={styles.footerBrandText}>量化军火库</Text>
          </View>
          <Text style={styles.footerSlogan}>源头价直供 · 策略持续更新 · 全方位技术支持</Text>
          <Text style={styles.footerDisclaimer}>
            免责声明：不同平台行情、点差、延迟存在差异，策略表现因此可能不同环境而变。我们不作收益保证，不做本金承诺，仅提供优质工具。
          </Text>
        </View>
      </ScrollView>

      {/* 策略详情弹窗 */}
      <Modal visible={!!selectedCard} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: "#1E293B" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCard?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedCard(null)}>
                <Ionicons name="close" size={24} color="#F1F5F9" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedCard?.subtitle && (
                <Text style={styles.modalSubtitle}>{selectedCard.subtitle}</Text>
              )}
              <View style={styles.modalMetaRow}>
                {selectedCard?.strategyType && (
                  <View style={[styles.strategyTag, { backgroundColor: "#334155" }]}>
                    <Text style={styles.strategyTagText}>{selectedCard.strategyType}</Text>
                  </View>
                )}
                {selectedCard?.platform && (
                  <View style={[styles.strategyTag, { backgroundColor: "#334155" }]}>
                    <Text style={styles.strategyTagText}>{selectedCard.platform}</Text>
                  </View>
                )}
                {selectedCard?.badge && (
                  <View style={[styles.strategyBadge, { backgroundColor: getBadgeStyle(selectedCard.badgeColor).bg }]}>
                    <Text style={[styles.strategyBadgeText, { color: getBadgeStyle(selectedCard.badgeColor).text }]}>{selectedCard.badge}</Text>
                  </View>
                )}
              </View>
              {selectedCard?.description && (
                <Text style={styles.modalDesc}>{selectedCard.description}</Text>
              )}

              {/* 观摩截图画廊 */}
              {parseGallery(selectedCard?.galleryImages).length > 0 && (
                <View style={styles.modalGallery}>
                  <Text style={styles.modalGalleryTitle}>实盘观摩截图</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {parseGallery(selectedCard?.galleryImages).map((img: string, i: number) => (
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

              {/* 观摩说明 */}
              {selectedCard?.observeNote && (
                <View style={[styles.observeNote, { backgroundColor: "rgba(217,119,6,0.1)", borderColor: "#D97706" }]}>
                  <Ionicons name="eye" size={18} color="#D97706" />
                  <Text style={styles.observeNoteText}>{selectedCard.observeNote}</Text>
                </View>
              )}

              {/* 联系按钮 */}
              <TouchableOpacity
                style={[styles.modalCTA, { backgroundColor: "#D97706" }]}
                onPress={() => { setSelectedCard(null); setShowContact(true); }}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#0F172A" />
                <Text style={styles.modalCTAText}>立即咨询获取观摩账户</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 联系方式弹窗 */}
      <Modal visible={showContact} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowContact(false)}>
          <View style={[styles.contactModal, { backgroundColor: "#1E293B" }]}>
            <Text style={styles.contactTitle}>联系我们</Text>
            <Text style={styles.contactDesc}>私聊备注「策略名称」获取观摩账户 & 专属报价</Text>
            <View style={styles.contactItem}>
              <Ionicons name="paper-plane" size={20} color="#0088cc" />
              <Text style={styles.contactLabel}>Telegram:</Text>
              <TouchableOpacity onPress={() => Linking.openURL(`https://t.me/${telegram.replace("@", "")}`)}>
                <Text style={[styles.contactValue, { color: "#0088cc" }]}>{telegram}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="chatbox" size={20} color="#12B7F5" />
              <Text style={styles.contactLabel}>QQ:</Text>
              <Text style={[styles.contactValue, { color: "#12B7F5" }]}>{qq}</Text>
            </View>
            <TouchableOpacity style={[styles.contactClose, { backgroundColor: "#D97706" }]} onPress={() => setShowContact(false)}>
              <Text style={styles.contactCloseText}>我知道了</Text>
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
          {selectedCard && parseGallery(selectedCard.galleryImages)[galleryIndex] && (
            <Image
              source={{ uri: parseGallery(selectedCard.galleryImages)[galleryIndex] }}
              style={styles.galleryFullImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.galleryNav}>
            <TouchableOpacity onPress={() => setGalleryIndex(Math.max(0, galleryIndex - 1))}>
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.galleryCounter}>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  backButton: { position: "absolute", top: 16, left: 16, zIndex: 10, padding: 8 },

  // Hero
  heroSection: { paddingTop: 60, paddingBottom: 32, paddingHorizontal: 20, alignItems: "center" },
  heroBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(217,119,6,0.15)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  heroDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  heroBadgeText: { color: "#D97706", fontSize: 14, fontWeight: "600" },
  heroTitle: { color: "#F1F5F9", fontSize: 32, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  heroSubtitle: { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Selling Points
  sellingPoints: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 24 },
  sellingPointCard: { width: SCREEN_WIDTH > 768 ? 160 : (SCREEN_WIDTH - 60) / 2, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  sellingPointTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "700", marginTop: 8 },
  sellingPointDesc: { color: "#94A3B8", fontSize: 11, marginTop: 4, textAlign: "center" },

  // Studio Section
  studioSection: { paddingVertical: 32, paddingHorizontal: 20 },
  studioDesc: { color: "#94A3B8", fontSize: 14, lineHeight: 22, marginBottom: 20 },
  studioFeatures: { gap: 12 },
  studioFeatureCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 1 },
  studioFeatureIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 14 },
  studioFeatureText: { flex: 1 },
  studioFeatureTitle: { color: "#F1F5F9", fontSize: 15, fontWeight: "700" },
  studioFeatureDesc: { color: "#94A3B8", fontSize: 12, marginTop: 2 },

  // Section Header
  sectionHeader: { alignItems: "center", marginBottom: 24 },
  sectionTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  sectionLine: { width: 40, height: 3, borderRadius: 2 },

  // Plans
  plansSection: { paddingVertical: 32, paddingHorizontal: 20 },
  plansGrid: { gap: 16 },
  planCard: { padding: 24, borderRadius: 16, borderWidth: 1.5 },
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  planTitle: { color: "#F1F5F9", fontSize: 18, fontWeight: "700" },
  planBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  planBadgeText: { fontSize: 12, fontWeight: "600" },
  planPriceArea: { marginBottom: 16 },
  planPrice: { color: "#F1F5F9", fontSize: 28, fontWeight: "800" },
  planPriceNote: { color: "#94A3B8", fontSize: 14, marginTop: 4 },
  planFeatures: { gap: 10, marginBottom: 20 },
  planFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planFeatureText: { color: "#CBD5E1", fontSize: 13, flex: 1 },
  planCTA: { paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  planCTAText: { fontSize: 15, fontWeight: "700" },

  // Strategies
  strategiesSection: { paddingVertical: 32, paddingHorizontal: 20 },
  strategiesGrid: { gap: 12 },
  strategyCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  strategyImage: { width: "100%", height: 120 },
  strategyContent: { padding: 14 },
  strategyTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  strategyTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "700", flex: 1, marginRight: 8 },
  strategyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  strategyBadgeText: { fontSize: 11, fontWeight: "600" },
  strategySubtitle: { color: "#94A3B8", fontSize: 13, marginBottom: 8 },
  strategyMeta: { flexDirection: "row", gap: 8, marginBottom: 6 },
  strategyTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  strategyTagText: { color: "#94A3B8", fontSize: 11 },
  galleryHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  galleryHintText: { color: "#94A3B8", fontSize: 11 },

  // CTA
  ctaSection: { paddingVertical: 24, paddingHorizontal: 20 },
  ctaButton: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  ctaButtonText: { color: "#0F172A", fontSize: 15, fontWeight: "700" },

  // Service
  serviceSection: { paddingVertical: 32, paddingHorizontal: 20 },
  serviceGrid: { gap: 12 },
  serviceCard: { padding: 20, borderRadius: 12, borderWidth: 1 },
  serviceCardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  serviceCardDesc: { color: "#94A3B8", fontSize: 13, lineHeight: 20 },

  // Footer
  footer: { paddingVertical: 32, paddingHorizontal: 20, alignItems: "center", borderTopWidth: 1, borderTopColor: "#334155" },
  footerBrand: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  footerBrandText: { color: "#D97706", fontSize: 16, fontWeight: "700", marginLeft: 8 },
  footerSlogan: { color: "#94A3B8", fontSize: 13, marginBottom: 16 },
  footerDisclaimer: { color: "#475569", fontSize: 11, textAlign: "center", lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "85%", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#334155" },
  modalTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "700", flex: 1 },
  modalBody: { padding: 20 },
  modalSubtitle: { color: "#D97706", fontSize: 15, fontWeight: "600", marginBottom: 12 },
  modalMetaRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  modalDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginBottom: 20 },
  modalGallery: { marginBottom: 20 },
  modalGalleryTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  galleryThumb: { width: 200, height: 140, borderRadius: 8, marginRight: 10, backgroundColor: "#334155" },
  observeNote: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 10, borderWidth: 1, gap: 10, marginBottom: 20 },
  observeNoteText: { color: "#D97706", fontSize: 13, flex: 1 },
  modalCTA: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10 },
  modalCTAText: { color: "#0F172A", fontSize: 15, fontWeight: "700" },

  // Contact Modal
  contactModal: { margin: 30, padding: 28, borderRadius: 16, alignItems: "center" },
  contactTitle: { color: "#F1F5F9", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  contactDesc: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 20 },
  contactItem: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, width: "100%" },
  contactLabel: { color: "#94A3B8", fontSize: 14 },
  contactValue: { fontSize: 15, fontWeight: "600" },
  contactClose: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 10 },
  contactCloseText: { color: "#0F172A", fontSize: 15, fontWeight: "700" },

  // Gallery Modal
  galleryModal: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  galleryClose: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 },
  galleryFullImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 },
  galleryNav: { flexDirection: "row", alignItems: "center", gap: 30, marginTop: 20 },
  galleryCounter: { color: "#fff", fontSize: 16 },
});
