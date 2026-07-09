import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { useColors } from "@/hooks/use-colors";
import { useFavorites } from "@/hooks/use-favorites";
import { useResponsive } from "@/hooks/use-responsive";
import * as Haptics from "expo-haptics";

export default function FavoritesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const { favorites, loading, toggleFavorite, clearFavorites } = useFavorites();

  const handleStrategyPress = (id: number) => {
    router.push(`/strategy/${id}` as any);
  };

  const handleFavoritePress = async (strategy: any) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await toggleFavorite(strategy);
  };

  const handleClearAll = () => {
    Alert.alert(
      "清空收藏",
      "确定要清空所有收藏的策略吗?",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定",
          style: "destructive",
          onPress: clearFavorites,
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={[styles.headerPanel, { borderColor: colors.border }]}>
        <View>
          <Text style={[styles.kicker, { color: colors.primary }]}>FAVORITE WATCHLIST</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>我的收藏</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {favorites.length > 0 ? `共 ${favorites.length} 个策略` : "还没有收藏任何策略"}
          </Text>
        </View>
        {favorites.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            style={[styles.clearAllBtn, { backgroundColor: colors.error + "14", borderColor: colors.error + "35" }]}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.error, fontWeight: "800", fontSize: 13 }}>清空</Text>
          </TouchableOpacity>
        )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>还没有收藏任何策略</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>收藏感兴趣的 EA 后，这里会形成你的策略观察列表。</Text>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)" as any)}
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnText}>去策略广场</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id.toString()}
        numColumns={numColumns}
        key={numColumns}
        renderItem={({ item }) => (
          <StrategyCard
            id={item.id}
            title={item.title}
            platform={item.platform as "MT4" | "MT5"}
            totalReturn={item.totalReturn}
            winRate={item.winRate}
            price={item.price}
            isFree={item.isFree}
            downloadCount={0}
            onPress={() => handleStrategyPress(item.id)}
            onSubscribePress={() => {}}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        columnWrapperStyle={favorites.length > 0 && numColumns > 1 ? { justifyContent: "flex-start" } : undefined}
        contentContainerStyle={[
          styles.listContent,
          isDesktop && styles.listContentDesktop,
          { flexGrow: 1 },
        ]}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listContentDesktop: {
    width: "100%",
    maxWidth: 1360,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  headerPanel: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 15,
    marginBottom: 14,
    backgroundColor: "rgba(9,15,28,0.84)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  kicker: { fontSize: 11, fontWeight: "900", marginBottom: 6 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: "900", marginBottom: 5 },
  subtitle: { fontSize: 13, lineHeight: 20 },
  clearAllBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyState: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 52,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", marginBottom: 8 },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: "center", maxWidth: 380 },
  primaryBtn: {
    marginTop: 20,
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  primaryBtnText: { color: "#07111F", fontWeight: "900", fontSize: 14 },
});
