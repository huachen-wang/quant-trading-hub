import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Animated, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns } = useResponsive();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // 入场动画
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setTimeout(() => {
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
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* 搜索栏 - 居中对齐 */}
        <View style={styles.searchBarRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          
          <View style={[styles.searchInputBox, { backgroundColor: colors.surface }]}>
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
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + "10" }]}>
              <Text style={styles.emptyIcon}>🔍</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>搜索EA策略</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>支持策略名称、交易对、平台等关键词</Text>
            {/* 热门搜索提示 */}
            <View style={styles.hotSearchRow}>
              {["XAUUSD", "MT5", "网格", "趋势"].map((tag, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { setSearchQuery(tag); setDebouncedQuery(tag); }}
                  style={[styles.hotTag, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.hotTagText, { color: colors.foreground }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.error + "10" }]}>
              <Text style={styles.emptyIcon}>😔</Text>
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
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
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
    justifyContent: "center",
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
  },
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
  hotTag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 0.5,
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
});
