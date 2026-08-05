import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Animated, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

const HOT_SEARCH_TAGS = ["XAUUSD", "MT5", "网格", "趋势", "剥头皮", "AI"];
const DESKTOP_SEARCH_NOTES = [
  { label: "主市场", value: "XAUUSD / 外汇 / 指数" },
  { label: "平台", value: "MT4 / MT5" },
  { label: "策略类型", value: "趋势 / 网格 / 对冲 / AI" },
  { label: "交付", value: "联系咨询 / 版本确认 / 人工交付" },
];
const DESKTOP_SEARCH_CARDS = [
  { code: "XAU", title: "黄金策略", body: "剥头皮、突破、网格与 AI 黄金模型", query: "XAUUSD" },
  { code: "MT5", title: "平台筛选", body: "快速查看 MT5 策略与指标工具", query: "MT5" },
  { code: "GRID", title: "策略结构", body: "网格、对冲、趋势跟随组合检索", query: "网格" },
];

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // 入场动画
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 300);
  };

  const { data: strategies, isLoading } = trpc.strategies.search.useQuery(
    { keyword: debouncedQuery, limit: 20 },
    { enabled: debouncedQuery.length > 0 }
  );

  const handleStrategyPress = (id: number) => {
    router.push(`/strategy/${id}` as any);
  };

  return (
    <ScreenContainer>
      <Animated.View style={[styles.container, isDesktop && styles.containerDesktop, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* 搜索栏 - 居中对齐 */}
        <View style={styles.searchBarRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          
          <View
            style={[styles.searchInputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="搜索EA策略名称、交易对..."
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => { setSearchQuery(""); setDebouncedQuery(""); }}
                style={[styles.clearBtn, { backgroundColor: colors.muted + "20" }]}
              >
                <Text style={[styles.clearText, { color: colors.muted }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 搜索结果 */}
        {debouncedQuery.length === 0 ? (
          isDesktop ? (
            <>
              <View style={[styles.desktopSearchDesk, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.desktopSearchMain}>
                  <Text style={[styles.desktopKicker, { color: colors.primary }]}>STRATEGY QUERY DESK</Text>
                  <Text style={[styles.desktopTitle, { color: colors.foreground }]}>按交易品种、平台或策略逻辑筛选 EA</Text>
                  <Text style={[styles.desktopSubtitle, { color: colors.muted }]}>
                    输入关键词后会直接读取策略库，适合快速定位黄金、MT5、趋势、网格、AI 等策略组合。
                  </Text>
                  <View style={styles.hotSearchRowDesktop}>
                    {HOT_SEARCH_TAGS.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => { setSearchQuery(tag); setDebouncedQuery(tag); }}
                        style={[styles.hotTag, styles.hotTagDesktop, { backgroundColor: colors.background, borderColor: colors.border }]}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.hotTagText, { color: colors.foreground }]}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={[styles.desktopIndexPanel, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.indexPanelTitle, { color: colors.foreground }]}>检索索引</Text>
                  {DESKTOP_SEARCH_NOTES.map((item) => (
                    <View key={item.label} style={[styles.indexRow, { borderColor: colors.border }]}>
                      <Text style={[styles.indexLabel, { color: colors.muted }]}>{item.label}</Text>
                      <Text style={[styles.indexValue, { color: colors.foreground }]}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.desktopSuggestionHeader}>
                <Text style={[styles.desktopSuggestionEyebrow, { color: colors.primary }]}>快速检索队列</Text>
                <Text style={[styles.desktopSuggestionHint, { color: colors.muted }]}>按常用交易场景一键载入关键词</Text>
              </View>
              <View style={styles.desktopSuggestionGrid}>
                {DESKTOP_SEARCH_CARDS.map((item) => (
                  <TouchableOpacity
                    key={item.code}
                    onPress={() => { setSearchQuery(item.query); setDebouncedQuery(item.query); }}
                    activeOpacity={0.76}
                    style={[styles.desktopSuggestionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={[styles.desktopSuggestionCode, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "34" }]}>
                      <Text style={[styles.desktopSuggestionCodeText, { color: colors.primary }]}>{item.code}</Text>
                    </View>
                    <View style={styles.desktopSuggestionBody}>
                      <Text style={[styles.desktopSuggestionTitle, { color: colors.foreground }]}>{item.title}</Text>
                      <Text style={[styles.desktopSuggestionText, { color: colors.muted }]}>{item.body}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
                <Text style={[styles.emptyCode, { color: colors.primary }]}>SEARCH</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>搜索EA策略</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>支持策略名称、交易对、平台等关键词</Text>
              <View style={styles.hotSearchRow}>
                {HOT_SEARCH_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => { setSearchQuery(tag); setDebouncedQuery(tag); }}
                    style={[styles.hotTag, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.hotTagText, { color: colors.foreground }]}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )
        ) : isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>搜索中...</Text>
          </View>
        ) : strategies && strategies.length > 0 ? (
          <FlatList
            data={strategies}
            keyExtractor={(item) => item.id.toString()}
            numColumns={numColumns}
            key={numColumns}
            renderItem={({ item }) => (
              <StrategyCard
                id={item.id}
                title={item.title}
                platform={item.platform}
                totalReturn={item.totalReturn || "0.00"}
                winRate={item.winRate || "0.00"}
                price={item.price || "0.00"}
                isFree={item.isFree}
                downloadCount={item.downloadCount}
                virtualDownloads={item.virtualDownloads || 0}
                coverImage={item.coverImage}
                pairs={item.pairs}
                viewCount={item.viewCount}
                createdAt={item.createdAt}
                onPress={() => handleStrategyPress(item.id)}
              />
            )}
            ListHeaderComponent={() => (
              <Text style={[styles.resultCount, { color: colors.muted }]}>
                找到 {strategies.length} 个相关策略
              </Text>
            )}
            columnWrapperStyle={numColumns > 1 ? { justifyContent: "flex-start" } : undefined}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={[styles.emptyState, isDesktop && styles.emptyStateDesktop]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.error + "10", borderColor: colors.error + "30" }]}>
              <Text style={[styles.emptyCode, { color: colors.error }]}>ZERO</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>未找到相关策略</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>试试其他关键词</Text>
          </View>
        )}
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  containerDesktop: {
    width: "100%",
    maxWidth: 1360,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 76,
    paddingBottom: 40,
  },
  emptyStateDesktop: {
    paddingTop: 60,
    justifyContent: "flex-start",
  },
  emptyIconCircle: {
    width: 96,
    height: 54,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyCode: { fontSize: 12, fontWeight: "900" },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  hotSearchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  hotSearchRowDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
  },
  hotTag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  hotTagDesktop: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hotTagText: {
    fontSize: 13,
    fontWeight: "500",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  resultCount: {
    fontSize: 13,
    marginBottom: 10,
  },
  desktopSearchDesk: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    padding: 22,
    gap: 18,
    minHeight: 250,
  },
  desktopSearchMain: {
    flex: 1,
    justifyContent: "center",
  },
  desktopKicker: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 10,
  },
  desktopTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    maxWidth: 620,
  },
  desktopSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 700,
  },
  desktopIndexPanel: {
    width: 360,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  indexPanelTitle: {
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
  },
  indexRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  indexLabel: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
  },
  indexValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  desktopSuggestionGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  desktopSuggestionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
  },
  desktopSuggestionEyebrow: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
  },
  desktopSuggestionHint: {
    fontSize: 12,
    fontWeight: "700",
  },
  desktopSuggestionCard: {
    flex: 1,
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  desktopSuggestionCode: {
    width: 54,
    height: 38,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  desktopSuggestionCodeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  desktopSuggestionBody: {
    flex: 1,
    minWidth: 0,
  },
  desktopSuggestionTitle: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  desktopSuggestionText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
