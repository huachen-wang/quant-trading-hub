import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, Linking, StyleSheet, Platform, Animated, Easing } from "react-native";
import { Image } from "expo-image";
import { QuickNav } from "@/components/quick-nav";

// 卡片入场动画组件
function AnimatedListItem({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index * 80, 400);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// 进度条动画组件
function AnimatedProgressBar({ progress, color, delay = 0 }: { progress: number; color: string; delay?: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(widthAnim, {
        toValue: progress,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, delay);

    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    shimmerAnimation.start();

    return () => {
      clearTimeout(timer);
      shimmerAnimation.stop();
    };
  }, [progress]);

  const animWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%" as any, "100%" as any],
    extrapolate: "clamp",
  });

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.8, 0.3],
  });

  return (
    <View style={[styles.progressTrack, { backgroundColor: color + "15" }]}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: animWidth,
            backgroundColor: color,
          },
        ]}
      />
      {progress < 100 && (
        <Animated.View
          style={[
            styles.progressShimmer,
            {
              width: animWidth,
              opacity: shimmerOpacity,
            },
          ]}
        />
      )}
    </View>
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
  coverImage?: string | null;
  targetPrice: string;
  currentParticipants: number;
  targetParticipants: number;
  pricePerPerson: string;
  contactInfo: string;
  status: string;
  createdAt: Date;
}

type GroupBuyGuideItem = {
  kind: "guide";
  id: string;
  kicker: string;
  title: string;
  body: string;
  accent: string;
  points: string[];
};

type GroupBuyListItem = GroupBuyItem | GroupBuyGuideItem;

export default function GroupBuyScreen() {
  const router = useRouter();
  const colors = useColors();
  const { numColumns, isDesktop, isTablet } = useResponsive();
  const [selectedItem, setSelectedItem] = useState<GroupBuyItem | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const { data: groupBuys, isLoading } = trpc.groupBuys.list.useQuery({
    status: "active",
    limit: 50,
  });

  const groupBuyItems = useMemo(() => (groupBuys as GroupBuyItem[]) || [], [groupBuys]);

  const listItems = useMemo<GroupBuyListItem[]>(() => {
    if (!isDesktop) return groupBuyItems;
    const guideItems: GroupBuyGuideItem[] = [
      {
        kind: "guide",
        id: "guide-flow",
        kicker: "MATCHING FLOW",
        title: "合购执行流程",
        body: "从发起到交付保留清晰记录，避免微信群里反复对账。",
        accent: "#60A5FA",
        points: ["确认授权版本", "凑齐参与名额", "统一交付凭证"],
      },
      {
        kind: "guide",
        id: "guide-risk",
        kicker: "RISK CONTROL",
        title: "授权与资金说明",
        body: "价格、人数、联系方式集中展示，付款前先确认交付范围。",
        accent: "#C9A96E",
        points: ["人数进度透明", "原价/人均价对照", "联系渠道留痕"],
      },
    ];
    if (groupBuyItems.length >= 3) return groupBuyItems;
    return [...groupBuyItems, ...guideItems.slice(0, 3 - groupBuyItems.length)];
  }, [groupBuyItems, isDesktop]);

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
      ["#050810", "#111827", "#D8BC83"],
      ["#07111F", "#102033", "#60A5FA"],
      ["#06140F", "#12382B", "#34D399"],
      ["#100D07", "#2A2112", "#C9A96E"],
    ];
    return palettes[index % palettes.length];
  };

  // 解析联系方式
  const parseContactInfo = (contactInfo: string) => {
    const contacts: { type: string; value: string; link?: string }[] = [];
    // 尝试解析 contactInfo 字段
    if (contactInfo) {
      // 检查是否包含 Telegram
      if (contactInfo.includes("t.me/") || contactInfo.startsWith("@")) {
        const tgHandle = contactInfo.startsWith("@") ? contactInfo : contactInfo.split("t.me/")[1];
        contacts.push({
          type: "Telegram",
          value: tgHandle || contactInfo,
          link: contactInfo.startsWith("http") ? contactInfo : `https://t.me/${tgHandle?.replace("@", "")}`,
        });
      } else {
        contacts.push({ type: "联系方式", value: contactInfo });
      }
    }
    // 始终添加默认联系方式
    if (!contacts.find(c => c.type === "Telegram")) {
      contacts.push({ type: "Telegram", value: "@xau6000", link: "https://t.me/xau6000" });
    }
    contacts.push({ type: "QQ1号", value: "1226426670" });
    contacts.push({ type: "QQ2号", value: "3832001817" });
    contacts.push({ type: "微信1号", value: "oooiniooo0624" });
    contacts.push({ type: "微信2号", value: "xau6000" });
    return contacts;
  };

  // 桌面端3列，平板2列，手机1列
  const cardColumns = isDesktop ? 3 : isTablet ? 2 : numColumns >= 3 ? 2 : 1;
  const cardGap = isDesktop ? 20 : isTablet ? 16 : 10;

  // 计算节省金额
  const calcSavings = (item: GroupBuyItem) => {
    const total = parseFloat(item.targetPrice);
    const perPerson = parseFloat(item.pricePerPerson);
    if (total > 0 && perPerson > 0) {
      const savings = total - perPerson;
      const savingsPercent = Math.round((savings / total) * 100);
      return { savings: savings.toFixed(0), percent: savingsPercent };
    }
    return null;
  };

  const renderCard = ({ item, index }: { item: GroupBuyItem; index: number }) => {
    const progress = getProgressPercentage(item.currentParticipants, item.targetParticipants);
    const gradientColors = getGradientColors(index);
    const accentColor = gradientColors[2];
    const savings = calcSavings(item);

    return (
      <AnimatedListItem
        index={index}
        style={{
          width: `${100 / cardColumns}%` as any,
          paddingHorizontal: cardGap / 2,
          marginBottom: cardGap,
        }}
      >
      <TouchableOpacity
        onPress={() => handleCardPress(item)}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}

        >
          {/* 封面区域 - 支持封面图 */}
          {(item as any).coverImage ? (
            <View style={styles.coverContainer}>
              <Image
                source={{ uri: (item as any).coverImage }}
                style={styles.coverImage}
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
              />
              <View style={[styles.statusBadge, { backgroundColor: progress >= 100 ? "rgba(239,68,68,0.9)" : "rgba(16,185,129,0.9)" }]}>
                <Text style={styles.statusText}>
                  {progress >= 100 ? "已满员" : "招募中"}
                </Text>
              </View>
              {savings && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>省 {savings.percent}%</Text>
                </View>
              )}
            </View>
          ) : (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCover}
            >
              <View style={styles.coverCodeBox}>
                <Text style={styles.coverCodeText}>GB</Text>
                <Text style={styles.coverCodeSub} numberOfLines={1}>{item.eaName || "GROUP BUY"}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Text style={styles.statusText}>
                  {progress >= 100 ? "已满员" : "招募中"}
                </Text>
              </View>
              {savings && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>省 {savings.percent}%</Text>
                </View>
              )}
            </LinearGradient>
          )}

          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.eaName, { color: colors.muted }]} numberOfLines={1}>
              EA: {item.eaName}
            </Text>

            {/* 描述（如果有） */}
            {item.description && (
              <Text style={[styles.descText, { color: colors.muted }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            {/* 进度条 */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.foreground }]}>
                  {item.currentParticipants}/{item.targetParticipants} 人
                </Text>
                <Text style={[styles.progressPercent, { color: accentColor }]}>
                  {progress.toFixed(0)}%
                </Text>
              </View>
              <AnimatedProgressBar progress={progress} color={accentColor} delay={Math.min(index * 80, 400) + 300} />
            </View>

            {/* 价格对比区 - 参考1mt5风格 */}
            <View style={[styles.priceCompare, { borderTopColor: colors.border }]}>
              <View style={styles.priceCompareLeft}>
                <Text style={[styles.priceCompareLabel, { color: colors.muted }]}>原价</Text>
                <Text style={[styles.priceCompareOriginal, { color: colors.muted }]}>¥{item.targetPrice}</Text>
              </View>
              <View style={styles.priceCompareArrow}>
                <Text style={{ color: colors.muted, fontSize: 16 }}>→</Text>
              </View>
              <View style={styles.priceCompareRight}>
                <Text style={[styles.priceCompareLabel, { color: colors.muted }]}>合购价/人</Text>
                <Text style={[styles.priceCompareValue, { color: "#C9A96E" }]}>¥{item.pricePerPerson}</Text>
              </View>
            </View>

            <View style={[styles.tapHint, { backgroundColor: accentColor + "16", borderColor: accentColor + "38" }]}>
              <Text style={[styles.tapHintText, { color: accentColor }]}>
                查看参与方式 →
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      </AnimatedListItem>
    );
  };

  const renderGuideCard = (item: GroupBuyGuideItem, index: number) => (
    <AnimatedListItem
      index={index}
      style={{
        width: `${100 / cardColumns}%` as any,
        paddingHorizontal: cardGap / 2,
        marginBottom: cardGap,
      }}
    >
      <View style={[styles.guideCard, { borderColor: `${item.accent}55` }]}>
        <Text style={[styles.guideKicker, { color: item.accent }]}>{item.kicker}</Text>
        <Text style={styles.guideTitle}>{item.title}</Text>
        <Text style={styles.guideBody}>{item.body}</Text>
        <View style={styles.guidePoints}>
          {item.points.map((point) => (
            <View key={point} style={styles.guidePointRow}>
              <View style={[styles.guidePointDot, { backgroundColor: item.accent }]} />
              <Text style={styles.guidePointText}>{point}</Text>
            </View>
          ))}
        </View>
      </View>
    </AnimatedListItem>
  );

  const renderListItem = ({ item, index }: { item: GroupBuyListItem; index: number }) => {
    if ("kind" in item) return renderGuideCard(item, index);
    return renderCard({ item, index });
  };

  const renderHeader = () => (
    <View style={[styles.headerSection, isDesktop && styles.headerSectionDesktop]}>
      <View style={[styles.headerRow, isDesktop && styles.headerRowDesktop]}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>GROUP BUY DESK</Text>
          <Text style={[styles.headerTitle, isDesktop && styles.headerTitleDesktop, { color: colors.foreground }]}>合购撮合台</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>多人分摊 EA 授权成本，保留进度、价格和交付信息的清晰对照。</Text>
        </View>
        <TouchableOpacity
          onPress={handleCreateGroupBuy}
          activeOpacity={0.8}
          style={[styles.createBtn, isDesktop && styles.createBtnDesktop, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.createBtnText}>+ 发起合购</Text>
        </TouchableOpacity>
      </View>

      {/* 合购优势说明 - 参考1mt5 */}
      <View
        style={[styles.advantageCard, isDesktop && styles.advantageCardDesktop, { backgroundColor: colors.surface, borderColor: colors.border }]}

      >
        <View style={styles.advantageRow}>
          <View style={styles.advantageItem}>
            <Text style={styles.advantageCode}>COST</Text>
            <Text style={[styles.advantageLabel, { color: colors.foreground }]}>低至1/10</Text>
            <Text style={[styles.advantageDesc, { color: colors.muted }]}>人均费用</Text>
          </View>
          <View style={styles.advantageItem}>
            <Text style={styles.advantageCode}>AUTH</Text>
            <Text style={[styles.advantageLabel, { color: colors.foreground }]}>正版授权</Text>
            <Text style={[styles.advantageDesc, { color: colors.muted }]}>官方渠道</Text>
          </View>
          <View style={styles.advantageItem}>
            <Text style={styles.advantageCode}>POOL</Text>
            <Text style={[styles.advantageLabel, { color: colors.foreground }]}>多人拼团</Text>
            <Text style={[styles.advantageDesc, { color: colors.muted }]}>共享使用</Text>
          </View>
          <View style={styles.advantageItem}>
            <Text style={styles.advantageCode}>SAFE</Text>
            <Text style={[styles.advantageLabel, { color: colors.foreground }]}>平台担保</Text>
            <Text style={[styles.advantageDesc, { color: colors.muted }]}>安全保障</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
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

    const contacts = parseContactInfo(selectedItem.contactInfo);
    const savings = calcSavings(selectedItem);
    const progress = getProgressPercentage(selectedItem.currentParticipants, selectedItem.targetParticipants);

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

            {/* 价格对比卡片 */}
            <View style={[styles.modalPriceCard, { backgroundColor: colors.surface }]}>
              <View style={styles.modalPriceRow}>
                <View style={styles.modalPriceItem}>
                  <Text style={[styles.modalPriceLabel, { color: colors.muted }]}>合购价/人</Text>
                  <Text style={[styles.modalPriceValue, { color: "#C9A96E" }]}>
                    ¥{selectedItem.pricePerPerson}
                  </Text>
                </View>
                <View style={[styles.modalPriceDivider, { backgroundColor: colors.border }]} />
                <View style={styles.modalPriceItem}>
                  <Text style={[styles.modalPriceLabel, { color: colors.muted }]}>参与进度</Text>
                  <Text style={[styles.modalPriceValue, { color: colors.primary }]}>
                    {selectedItem.currentParticipants}/{selectedItem.targetParticipants}
                  </Text>
                </View>
              </View>
              {savings && (
                <View style={[styles.modalSavingsRow, { backgroundColor: colors.success + "10" }]}>
                  <Text style={[styles.modalSavingsText, { color: colors.success }]}>
                    比原价 ¥{selectedItem.targetPrice} 节省 {savings.percent}%，每人仅需 ¥{selectedItem.pricePerPerson}
                  </Text>
                </View>
              )}
            </View>

            {/* 描述 */}
            {selectedItem.description && (
              <View style={[styles.modalDescCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalDescText, { color: colors.foreground }]}>
                  {selectedItem.description}
                </Text>
              </View>
            )}

            <View style={styles.contactList}>
              <Text style={[styles.contactTitle, { color: colors.foreground }]}>联系方式</Text>
              {contacts.map((contact, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => contact.link && Linking.openURL(contact.link)}
                  activeOpacity={contact.link ? 0.7 : 1}
                  style={[styles.contactItem, { backgroundColor: colors.surface }]}
                >
                  <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Text style={styles.contactIconText}>
                      {contact.type === "Telegram" ? "TG" : contact.type.includes("QQ") ? "QQ" : contact.type.includes("微信") ? "WX" : "CT"}
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
                请通过以上联系方式咨询合购详情，确认后付款参与。
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
      <FlatList
        data={listItems}
        keyExtractor={(item) => ("kind" in item ? item.id : item.id.toString())}
        key={cardColumns}
        numColumns={cardColumns}
        renderItem={renderListItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={() => <QuickNav />}
        columnWrapperStyle={cardColumns > 1 ? { justifyContent: "flex-start" } : undefined}
        contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 20 },
  listContentDesktop: { width: "100%", maxWidth: 1320, alignSelf: "center", paddingHorizontal: 24, paddingTop: 22 },
  headerSection: { marginBottom: 12 },
  headerSectionDesktop: {
    backgroundColor: "rgba(15,23,42,0.68)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    borderRadius: 8,
    padding: 22,
    marginBottom: 22,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerRowDesktop: { alignItems: "flex-start", gap: 24 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerKicker: { color: "#C9A96E", fontSize: 11, fontWeight: "900", letterSpacing: 0, marginBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: "800" },
  headerTitleDesktop: { fontSize: 34, lineHeight: 40 },
  headerSubtitle: { fontSize: 13, lineHeight: 20, maxWidth: 620, marginTop: 8 },
  createBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  createBtnDesktop: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 6 },
  createBtnText: { color: "#07111F", fontWeight: "900", fontSize: 14 },
  // 优势说明卡片
  advantageCard: { borderRadius: 8, padding: 16, borderWidth: 1, marginBottom: 4 },
  advantageCardDesktop: { borderRadius: 8, paddingVertical: 18 },
  advantageRow: { flexDirection: "row", justifyContent: "space-around" },
  advantageItem: { alignItems: "center", flex: 1 },
  advantageCode: { color: "#D8BC83", fontSize: 10, fontWeight: "900", marginBottom: 8 },
  advantageLabel: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  advantageDesc: { fontSize: 10 },
  // 卡片
  card: { borderRadius: 8, overflow: "hidden", borderWidth: 1 },
  guideCard: {
    minHeight: 312,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(15,23,42,0.74)",
    padding: 20,
    justifyContent: "space-between",
  },
  guideKicker: { fontSize: 11, fontWeight: "900", letterSpacing: 0, marginBottom: 8 },
  guideTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  guideBody: { color: "rgba(226,232,240,0.72)", fontSize: 13, lineHeight: 20 },
  guidePoints: { gap: 10, marginTop: 18 },
  guidePointRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guidePointDot: { width: 7, height: 7, borderRadius: 4 },
  guidePointText: { color: "rgba(248,250,252,0.84)", fontSize: 13, fontWeight: "600" },
  coverContainer: { height: 100, position: "relative", overflow: "hidden" },
  coverImage: { width: "100%", height: "100%" },
  gradientCover: { height: 92, alignItems: "center", justifyContent: "center", position: "relative" },
  coverCodeBox: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(216,188,131,0.28)", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(2,6,23,0.28)" },
  coverCodeText: { color: "#D8BC83", fontSize: 22, fontWeight: "900" },
  coverCodeSub: { color: "rgba(248,250,252,0.72)", fontSize: 10, fontWeight: "800", marginTop: 2, maxWidth: 160 },
  statusBadge: { position: "absolute", top: 8, right: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  savingsBadge: { position: "absolute", top: 8, left: 8, backgroundColor: "#7F1D1D", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  savingsText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cardContent: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4, lineHeight: 24 },
  eaName: { fontSize: 13, marginBottom: 4, lineHeight: 20 },
  descText: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  progressSection: { marginBottom: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: "600" },
  progressPercent: { fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", position: "relative" as any },
  progressFill: { height: "100%", borderRadius: 3 },
  progressShimmer: { position: "absolute" as any, top: 0, left: 0, height: "100%", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  // 价格对比区
  priceCompare: { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  priceCompareLeft: { flex: 1, alignItems: "center" },
  priceCompareArrow: { paddingHorizontal: 8 },
  priceCompareRight: { flex: 1, alignItems: "center" },
  priceCompareLabel: { fontSize: 10, marginBottom: 2 },
  priceCompareOriginal: { fontSize: 14, fontWeight: "600", textDecorationLine: "line-through" },
  priceCompareValue: { fontSize: 18, fontWeight: "800" },
  tapHint: { borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center", borderWidth: 1 },
  tapHintText: { fontSize: 12, fontWeight: "600" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 6 },
  emptyBtnText: { color: "#07111F", fontWeight: "900", fontSize: 15 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalContent: { width: "100%", maxWidth: 440, borderRadius: 8, padding: 24 },
  modalHeader: { alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  modalSubtitle: { fontSize: 14 },
  modalPriceCard: { borderRadius: 8, padding: 16, marginBottom: 16 },
  modalPriceRow: { flexDirection: "row", alignItems: "center" },
  modalPriceItem: { flex: 1, alignItems: "center" },
  modalPriceDivider: { width: 1, height: 40 },
  modalPriceLabel: { fontSize: 12, marginBottom: 4 },
  modalPriceValue: { fontSize: 22, fontWeight: "800" },
  modalSavingsRow: { marginTop: 12, borderRadius: 10, padding: 10, alignItems: "center" },
  modalSavingsText: { fontSize: 12, fontWeight: "600" },
  modalDescCard: { borderRadius: 12, padding: 14, marginBottom: 16 },
  modalDescText: { fontSize: 13, lineHeight: 20 },
  contactList: { marginBottom: 16 },
  contactTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  contactItem: { flexDirection: "row", alignItems: "center", borderRadius: 8, padding: 14, marginBottom: 10 },
  contactIcon: { width: 44, height: 36, borderRadius: 4, alignItems: "center", justifyContent: "center", marginRight: 14 },
  contactIconText: { color: "#D8BC83", fontSize: 11, fontWeight: "900" },
  contactInfoView: { flex: 1 },
  contactType: { fontSize: 12, marginBottom: 2 },
  contactValue: { fontSize: 16, fontWeight: "600" },
  contactArrow: { fontSize: 18, fontWeight: "700" },
  modalHint: { borderRadius: 12, padding: 14, marginBottom: 16 },
  modalHintText: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  closeBtn: { borderRadius: 6, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { color: "#07111F", fontWeight: "900", fontSize: 16 },
});
