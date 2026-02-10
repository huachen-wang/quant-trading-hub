import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { useColors } from "@/hooks/use-colors";
import { useFavorites } from "@/hooks/use-favorites";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function FavoritesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { favorites, loading, isFavorite, toggleFavorite, clearFavorites } = useFavorites();

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
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-4">
        <View>
            <Text className="text-3xl font-bold text-foreground">❤️ 我的收藏</Text>
          <Text className="text-sm text-muted mt-1">
            {favorites.length > 0 ? `共 ${favorites.length} 个策略` : "还没有收藏任何策略"}
          </Text>
        </View>
        {favorites.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            className="px-4 py-2 bg-error/10 rounded-full"
            activeOpacity={0.7}
          >
            <Text className="text-error font-semibold text-sm">清空</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center justify-center py-16">
      <Text style={{ fontSize: 56 }}>💫</Text>
      <Text className="text-foreground text-lg font-bold mt-4">还没有收藏任何策略</Text>
      <Text className="text-muted text-sm mt-2">点击策略卡片上的❤️收藏感兴趣的EA</Text>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)" as any)}
        className="mt-6 bg-primary px-6 py-3 rounded-full"
        activeOpacity={0.8}
      >
        <Text className="text-background font-semibold">去逛逛</Text>
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
        numColumns={2}
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
        columnWrapperStyle={favorites.length > 0 ? { justifyContent: "space-between" } : undefined}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
      />
    </ScreenContainer>
  );
}
