import { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, Linking, StyleSheet, Platform, RefreshControl, Animated } from "react-native";

// 列表项入场动画组件
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
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";

// 动态数据类型
interface MomentItem {
  id: number;
  type: "official" | "news" | "update" | "tip" | "promo";
  title: string;
  content: string;
  emoji: string;
  time: string;
  link?: string;
  tags?: string[];
}

// 静态动态数据（后续可改为API获取）
const MOMENTS_DATA: MomentItem[] = [
  {
    id: 1,
    type: "official",
    title: "量化军火库正式上线",
    content: "欢迎来到量化军火库！我们致力于为MT4/MT5交易者提供最优质的EA策略评测和分享平台。在这里，您可以浏览各类经过实盘验证的量化策略，查看真实的交易数据和回测报告。",
    emoji: "🎉",
    time: "2025-02-10",
    tags: ["官方公告", "平台上线"],
  },
  {
    id: 2,
    type: "update",
    title: "新增合购功能",
    content: "为了降低大家的EA使用成本，我们推出了合购功能！多人拼团购买高价EA，人均费用大幅降低。快去合购专区看看有没有感兴趣的策略吧。",
    emoji: "🤝",
    time: "2025-02-09",
    tags: ["功能更新", "合购"],
  },
  {
    id: 3,
    type: "news",
    title: "2025年黄金市场展望",
    content: "随着全球央行持续购金和地缘政治不确定性加剧，2025年黄金市场有望延续强势。多家机构预测金价将突破2800美元/盎司。对于黄金EA交易者来说，这意味着更多的交易机会和波动空间。",
    emoji: "📊",
    time: "2025-02-08",
    tags: ["行业资讯", "黄金"],
  },
  {
    id: 4,
    type: "tip",
    title: "EA选择指南：如何评估一个EA的真实表现",
    content: "选择EA时，不要只看总收益率。关键指标包括：1) 最大回撤 - 控制在20%以内为佳；2) 夏普比率 - 大于1.5说明风险调整后收益优秀；3) 胜率 - 结合盈亏比综合评估；4) 实盘运行时间 - 至少3个月以上的实盘数据才有参考价值。",
    emoji: "💡",
    time: "2025-02-07",
    tags: ["交易技巧", "EA评测"],
  },
  {
    id: 5,
    type: "official",
    title: "关注我们的官方频道",
    content: "加入我们的Telegram频道和QQ群，获取最新的EA策略更新、市场分析和独家优惠信息。\n\nTelegram: @quant_arsenal\nQQ群: 888888888\n微信公众号: 量化军火库",
    emoji: "📢",
    time: "2025-02-06",
    tags: ["官方", "联系方式"],
    link: "https://t.me/quant_arsenal",
  },
  {
    id: 6,
    type: "news",
    title: "MT5平台新功能：支持Python集成",
    content: "MetaQuotes最新更新为MT5平台添加了Python集成支持，交易者现在可以直接在MT5中运行Python脚本进行数据分析和策略开发。这对于量化交易者来说是一个重大利好。",
    emoji: "🐍",
    time: "2025-02-05",
    tags: ["行业资讯", "MT5"],
  },
  {
    id: 7,
    type: "promo",
    title: "新用户专享：首单EA 8折优惠",
    content: "新注册用户首次购买任意付费EA策略，均可享受8折优惠！活动时间有限，抓紧机会入手心仪的策略。详情请联系客服获取优惠码。",
    emoji: "🎁",
    time: "2025-02-04",
    tags: ["优惠活动"],
  },
  {
    id: 8,
    type: "tip",
    title: "风险管理：EA交易中的仓位控制",
    content: "无论使用多么优秀的EA策略，合理的仓位管理都是盈利的关键。建议：1) 单笔交易风险不超过账户的2%；2) 同时运行多个EA时，总风险敞口不超过10%；3) 定期提取利润，保护本金安全。",
    emoji: "🛡️",
    time: "2025-02-03",
    tags: ["交易技巧", "风险管理"],
  },
  {
    id: 9,
    type: "update",
    title: "策略详情页优化",
    content: "我们对策略详情页进行了全面优化，现在可以查看更详细的回测数据、收益曲线和月度收益报告。同时新增了匿名评价功能，欢迎大家分享使用体验。",
    emoji: "✨",
    time: "2025-02-02",
    tags: ["功能更新"],
  },
  {
    id: 10,
    type: "news",
    title: "外汇市场波动率创新高",
    content: "受美联储政策预期变化影响，近期外汇市场波动率显著上升。EUR/USD、GBP/USD等主要货币对日内波幅扩大，为EA交易提供了更多机会。建议交易者适当调整止损距离以适应当前市场环境。",
    emoji: "📈",
    time: "2025-02-01",
    tags: ["行业资讯", "外汇"],
  },
];

// 类型对应的颜色和标签
const TYPE_CONFIG: Record<string, { label: string; gradient: readonly [string, string, ...string[]] }> = {
  official: { label: "官方", gradient: ["#1a365d", "#2563eb", "#60a5fa"] },
  news: { label: "资讯", gradient: ["#065f46", "#10b981", "#6ee7b7"] },
  update: { label: "更新", gradient: ["#4c1d95", "#7c3aed", "#a78bfa"] },
  tip: { label: "技巧", gradient: ["#7c2d12", "#f97316", "#fdba74"] },
  promo: { label: "活动", gradient: ["#831843", "#ec4899", "#f9a8d4"] },
};

type FilterType = "all" | "official" | "news" | "update" | "tip" | "promo";

export default function MomentsScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  const filteredData = useMemo(() => {
    if (filter === "all") return MOMENTS_DATA;
    return MOMENTS_DATA.filter((item) => item.type === filter);
  }, [filter]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleLinkPress = (link: string) => {
    Linking.openURL(link);
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "official", label: "官方" },
    { key: "news", label: "资讯" },
    { key: "update", label: "更新" },
    { key: "tip", label: "技巧" },
    { key: "promo", label: "活动" },
  ];

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <Text style={[styles.headerTitle, { color: colors.foreground }]}>📣 动态</Text>
      <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
        最新公告、行业资讯、交易技巧
      </Text>

      {/* 筛选标签 */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f.key ? colors.primary : colors.surface,
                borderColor: filter === f.key ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filter === f.key ? "#fff" : colors.foreground },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderMomentCard = ({ item, index }: { item: MomentItem; index: number }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.news;

    return (
      <AnimatedListItem index={index}>
      <View style={[styles.momentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* 顶部：类型标签和时间 */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <LinearGradient
              colors={config.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.typeBadge}
            >
              <Text style={styles.typeBadgeText}>{config.label}</Text>
            </LinearGradient>
            <Text style={[styles.cardTime, { color: colors.muted }]}>{item.time}</Text>
          </View>
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
        </View>

        {/* 标题 */}
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>

        {/* 内容 */}
        <Text style={[styles.cardContent, { color: colors.muted }]}>{item.content}</Text>

        {/* 标签 */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagRow}>
            {item.tags.map((tag, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: config.gradient[1] + "12" }]}>
                <Text style={[styles.tagText, { color: config.gradient[1] }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 链接按钮 */}
        {item.link && (
          <TouchableOpacity
            onPress={() => handleLinkPress(item.link!)}
            activeOpacity={0.7}
            style={[styles.linkBtn, { backgroundColor: config.gradient[1] + "10" }]}
          >
            <Text style={[styles.linkBtnText, { color: config.gradient[1] }]}>
              查看详情 →
            </Text>
          </TouchableOpacity>
        )}
      </View>
      </AnimatedListItem>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>暂无动态</Text>
      <Text style={[styles.emptySubtitle, { color: colors.muted }]}>该分类下还没有内容，请查看其他分类</Text>
    </View>
  );

  return (
    <ScreenContainer>
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMomentCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerSection: { marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, marginBottom: 14 },
  filterRow: { flexDirection: "row", flexWrap: "wrap" },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontWeight: "600" },
  momentCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 1px 4px rgba(0,0,0,0.06)" } as any
      : {}),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center" },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 10,
  },
  typeBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  cardTime: { fontSize: 12 },
  cardEmoji: { fontSize: 28 },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8, lineHeight: 24 },
  cardContent: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 8, marginBottom: 4 },
  tagText: { fontSize: 12, fontWeight: "600" },
  linkBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 4 },
  linkBtnText: { fontSize: 14, fontWeight: "700" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 14 },
});
