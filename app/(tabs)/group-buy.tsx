import { useState, useRef, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, Linking, StyleSheet, Platform, Animated } from "react-native";

// 卡片入场动画组件
function AnimatedListItem({ children, index }: { children: React.ReactNode; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const delay = Math.min(index * 80, 400);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

interface GroupBuyItem {
  id: number;
  title: string;
  eaName: string;
  description?: string | null;
  targetPrice: string;
  currentParticipants: number;
  targetParticipants: number;
  pricePerPerson: string;
  contactInfo: string;
  status: string;
  createdAt: Date;
}

export default function GroupBuyScreen() {
  const router = useRouter();
  const colors = useColors();
  const { numColumns, isDesktop } = useResponsive();
  const [selectedItem, setSelectedItem] = useState<GroupBuyItem | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const { data: groupBuys, isLoading } = trpc.groupBuys.list.useQuery({
    status: "active",
    limit: 50,
  });

  const handleCardPress = async (item: GroupBuyItem) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedItem(item);
    setShowContactModal(true);
  };

  const handleCreateGroupBuy = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/group-buy/create" as any);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getGradientColors = (index: number): readonly [string, string, ...string[]] => {
    const palettes: readonly [string, string, ...string[]][] = [
      ["#1a365d", "#2563eb", "#60a5fa"],
      ["#4c1d95", "#7c3aed", "#a78bfa"],
      ["#065f46", "#10b981", "#6ee7b7"],
      ["#7c2d12", "#f97316", "#fdba74"],
      ["#831843", "#ec4899", "#f9a8d4"],
      ["#1e3a5f", "#0ea5e9", "#7dd3fc"],
    ];
    return palettes[index % palettes.length];
  };

  const getEmoji = (index: number) => {
    const emojis = ["🤝", "💎", "🚀", "⚡", "🔥", "💰", "🎯", "📊"];
    return emojis[index % emojis.length];
  };

  const cardColumns = isDesktop ? 2 : numColumns >= 3 ? 2 : 1;
  const cardGap = isDesktop ? 20 : 10;

  const renderCard = ({ item, index }: { item: GroupBuyItem; index: number }) => {
    const progress = getProgressPercentage(item.currentParticipants, item.targetParticipants);
    const gradientColors = getGradientColors(index);
    const emoji = getEmoji(index);

    return (
      <AnimatedListItem index={index}>
      <TouchableOpacity
        onPress={() => handleCardPress(item)}
        activeOpacity={0.85}
        style={[
          styles.cardWrapper,
          {
            width: `${100 / cardColumns}%` as any,
            paddingHorizontal: cardGap / 2,
            marginBottom: cardGap,
          },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              ...(Platform.OS === "web"
                ? { boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)" } as any
                : {}),
            },
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientCover}
          >
            <Text style={styles.coverEmoji}>{emoji}</Text>
            <View style={[styles.statusBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Text style={styles.statusText}>
                {progress >= 100 ? "已满员" : "招募中"}
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.eaName, { color: colors.muted }]} numberOfLines={2}>
              EA: {item.eaName}
            </Text>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.foreground }]}>
                  {item.currentParticipants}/{item.targetParticipants} 人
                </Text>
                <Text style={[styles.progressPercent, { color: gradientColors[1] }]}>
                  {progress.toFixed(0)}%
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress}%` as any, backgroundColor: gradientColors[1] },
                  ]}
                />
              </View>
            </View>

            <View style={[styles.priceRow, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.priceLabel, { color: colors.muted }]}>人均</Text>
                <Text style={[styles.priceValue, { color: "#F59E0B" }]}>
                  ¥{item.pricePerPerson}
                </Text>
              </View>
              <View style={styles.priceRight}>
                <Text style={[styles.priceLabel, { color: colors.muted }]}>目标总价</Text>
                <Text style={[styles.targetPrice, { color: colors.foreground }]}>
                  ¥{item.targetPrice}
                </Text>
              </View>
            </View>

            <View style={[styles.tapHint, { backgroundColor: gradientColors[1] + "10" }]}>
              <Text style={[styles.tapHintText, { color: gradientColors[1] }]}>
                点击查看联系方式 →
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      </AnimatedListItem>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>🤝 合购专区</Text>
        <TouchableOpacity
          onPress={handleCreateGroupBuy}
          activeOpacity={0.8}
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.createBtnText}>+ 发起合购</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
        <Text style={[styles.infoText, { color: colors.foreground }]}>
          💡 合购是多人分摊EA费用的方式，降低单人成本。点击卡片查看联系方式加入合购。
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📦</Text>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>暂无进行中的合购</Text>
      <Text style={[styles.emptySubtitle, { color: colors.muted }]}>成为第一个发起合购的人</Text>
      <TouchableOpacity
        onPress={handleCreateGroupBuy}
        activeOpacity={0.8}
        style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
      >
        <Text style={styles.emptyBtnText}>发起合购</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContactModal = () => {
    if (!selectedItem) return null;

    const contactInfo = selectedItem.contactInfo;
    const contacts: { type: string; value: string; link?: string }[] = [];

    if (contactInfo.includes("t.me") || contactInfo.toLowerCase().includes("telegram")) {
      const tgMatch = contactInfo.match(/(?:https?:\/\/)?t\.me\/(\S+)/);
      contacts.push({
        type: "Telegram",
        value: tgMatch ? `@${tgMatch[1]}` : contactInfo,
        link: tgMatch ? `https://t.me/${tgMatch[1]}` : undefined,
      });
    }

    if (contactInfo.match(/\d{5,12}/)) {
      const qqMatch = contactInfo.match(/(\d{5,12})/);
      if (qqMatch) {
        contacts.push({ type: "QQ群", value: qqMatch[1] });
      }
    }

    if (contactInfo.toLowerCase().includes("wechat") || contactInfo.includes("微信")) {
      contacts.push({
        type: "微信",
        value: contactInfo.replace(/微信[:：]?\s*/i, "").replace(/wechat[:：]?\s*/i, ""),
      });
    }

    if (contacts.length === 0) {
      contacts.push({ type: "联系方式", value: contactInfo });
    }

    return (
      <Modal
        visible={showContactModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowContactModal(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalContent, { backgroundColor: colors.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {selectedItem.title}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
                EA: {selectedItem.eaName}
              </Text>
            </View>

            <View style={[styles.modalPriceCard, { backgroundColor: colors.surface }]}>
              <View style={styles.modalPriceRow}>
                <View style={styles.modalPriceItem}>
                  <Text style={[styles.modalPriceLabel, { color: colors.muted }]}>人均价格</Text>
                  <Text style={[styles.modalPriceValue, { color: "#F59E0B" }]}>
                    ¥{selectedItem.pricePerPerson}
                  </Text>
                </View>
                <View style={[styles.modalPriceDivider, { backgroundColor: colors.border }]} />
                <View style={styles.modalPriceItem}>
                  <Text style={[styles.modalPriceLabel, { color: colors.muted }]}>参与人数</Text>
                  <Text style={[styles.modalPriceValue, { color: colors.primary }]}>
                    {selectedItem.currentParticipants}/{selectedItem.targetParticipants}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.contactList}>
              <Text style={[styles.contactTitle, { color: colors.foreground }]}>📱 联系方式</Text>
              {contacts.map((contact, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => contact.link && Linking.openURL(contact.link)}
                  activeOpacity={contact.link ? 0.7 : 1}
                  style={[styles.contactItem, { backgroundColor: colors.surface }]}
                >
                  <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Text style={styles.contactIconText}>
                      {contact.type === "Telegram" ? "✈️" : contact.type === "QQ群" ? "💬" : contact.type === "微信" ? "💚" : "📞"}
                    </Text>
                  </View>
                  <View style={styles.contactInfoView}>
                    <Text style={[styles.contactType, { color: colors.muted }]}>{contact.type}</Text>
                    <Text style={[styles.contactValue, { color: colors.foreground }]}>{contact.value}</Text>
                  </View>
                  {contact.link && (
                    <Text style={[styles.contactArrow, { color: colors.primary }]}>→</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.modalHint, { backgroundColor: colors.primary + "08" }]}>
              <Text style={[styles.modalHintText, { color: colors.muted }]}>
                请通过以上联系方式联系发起人加入合购，确认后完成付款。
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowContactModal(false)}
              activeOpacity={0.8}
              style={[styles.closeBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.closeBtnText}>关闭</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {renderContactModal()}
      <View style={isDesktop ? styles.desktopContainer : undefined}>
        <FlatList
          data={(groupBuys as GroupBuyItem[]) || []}
          keyExtractor={(item) => item.id.toString()}
          key={cardColumns}
          numColumns={cardColumns}
          renderItem={renderCard}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          columnWrapperStyle={cardColumns > 1 ? { justifyContent: "flex-start" } : undefined}
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 0 : 10,
            paddingTop: 12,
            paddingBottom: 20,
          }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  desktopContainer: { width: "100%", maxWidth: 1100, alignSelf: "center", paddingHorizontal: 24 },
  headerSection: { marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: "800" },
  createBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  infoCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 20 },
  cardWrapper: {},
  card: { borderRadius: 14, overflow: "hidden", borderWidth: 0.5 },
  gradientCover: { height: 80, alignItems: "center", justifyContent: "center", position: "relative" },
  coverEmoji: { fontSize: 36 },
  statusBadge: { position: "absolute", top: 8, right: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  cardContent: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6, lineHeight: 24 },
  eaName: { fontSize: 13, marginBottom: 10, lineHeight: 20 },
  progressSection: { marginBottom: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: "600" },
  progressPercent: { fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  priceLabel: { fontSize: 11, marginBottom: 2 },
  priceValue: { fontSize: 18, fontWeight: "800" },
  priceRight: { alignItems: "flex-end" },
  targetPrice: { fontSize: 14, fontWeight: "600" },
  tapHint: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignItems: "center" },
  tapHintText: { fontSize: 12, fontWeight: "600" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalContent: { width: "100%", maxWidth: 400, borderRadius: 24, padding: 24 },
  modalHeader: { alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  modalSubtitle: { fontSize: 14 },
  modalPriceCard: { borderRadius: 16, padding: 16, marginBottom: 20 },
  modalPriceRow: { flexDirection: "row", alignItems: "center" },
  modalPriceItem: { flex: 1, alignItems: "center" },
  modalPriceDivider: { width: 1, height: 40 },
  modalPriceLabel: { fontSize: 12, marginBottom: 4 },
  modalPriceValue: { fontSize: 22, fontWeight: "800" },
  contactList: { marginBottom: 16 },
  contactTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  contactItem: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, marginBottom: 10 },
  contactIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  contactIconText: { fontSize: 22 },
  contactInfoView: { flex: 1 },
  contactType: { fontSize: 12, marginBottom: 2 },
  contactValue: { fontSize: 16, fontWeight: "600" },
  contactArrow: { fontSize: 18, fontWeight: "700" },
  modalHint: { borderRadius: 12, padding: 14, marginBottom: 16 },
  modalHintText: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  closeBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
