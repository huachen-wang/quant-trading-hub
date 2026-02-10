import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { ContactModal } from "@/components/contact-modal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFavorites } from "@/hooks/use-favorites";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform as RNPlatform } from "react-native";

type PlatformFilter = "MT4" | "MT5" | undefined;
type OrderBy = "latest" | "popular" | "return";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(undefined);
  const [orderBy, setOrderBy] = useState<OrderBy>("latest");
  const [showContactModal, setShowContactModal] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();

  const { data: strategies, isLoading, refetch, isRefetching } = trpc.strategies.list.useQuery({
    platform: platformFilter,
    orderBy,
    limit: 20,
    offset: 0,
  });

  const handleFavoritePress = async (strategy: any) => {
    if (RNPlatform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await toggleFavorite({
      id: strategy.id,
      title: strategy.title,
      platform: strategy.platform,
      totalReturn: strategy.totalReturn || "0.00",
      winRate: strategy.winRate || "0.00",
      price: strategy.price || "0.00",
      isFree: strategy.isFree,
      coverImage: strategy.coverImage,
    });
  };

  const handleStrategyPress = (id: number) => {
    router.push(`/strategy/${id}` as any);
  };

  const renderHeader = () => (
    <View className="mb-2">
      {/* 标题和操作按钮 */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-3xl font-bold text-foreground">📊 策略广场</Text>
        <View className="flex-row">
          <TouchableOpacity
            onPress={() => setShowContactModal(true)}
            className="mr-2 px-4 py-2 bg-primary rounded-full flex-row items-center"
            activeOpacity={0.8}
          >
            <IconSymbol name="paperplane.fill" size={16} color={colors.background} />
            <Text className="text-background font-semibold text-sm ml-1">上架EA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/search" as any)}
            className="w-10 h-10 items-center justify-center rounded-full bg-surface"
            activeOpacity={0.7}
          >
            <IconSymbol name="magnifyingglass" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 筛选和排序 - 单行布局 */}
      <View className="flex-row flex-wrap">
        <TouchableOpacity
          onPress={() => setPlatformFilter(undefined)}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${!platformFilter ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm font-medium ${!platformFilter ? "text-background" : "text-foreground"}`}>全部</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPlatformFilter("MT4")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${platformFilter === "MT4" ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm font-medium ${platformFilter === "MT4" ? "text-background" : "text-foreground"}`}>MT4</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPlatformFilter("MT5")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${platformFilter === "MT5" ? "bg-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm font-medium ${platformFilter === "MT5" ? "text-background" : "text-foreground"}`}>MT5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("latest")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${orderBy === "latest" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "latest" ? "text-primary font-semibold" : "text-muted"}`}>
            最新
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("popular")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${orderBy === "popular" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "popular" ? "text-primary font-semibold" : "text-muted"}`}>
            最热
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("return")}
          className={`px-3 py-1.5 rounded-full mb-2 ${orderBy === "return" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "return" ? "text-primary font-semibold" : "text-muted"}`}>
            收益率
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center justify-center py-12">
      <Text className="text-muted text-base">暂无策略</Text>
      <Text className="text-muted text-sm mt-1">成为第一个发布策略的用户</Text>
    </View>
  );

  if (isLoading && !strategies) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} />
      <FlatList
        data={strategies || []}
        keyExtractor={(item) => item.id.toString()}
        key={numColumns}
        numColumns={numColumns}
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
            onPress={() => handleStrategyPress(item.id)}
            isFavorite={isFavorite(item.id)}
            onFavoritePress={() => handleFavoritePress(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        columnWrapperStyle={{ justifyContent: "flex-start" }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 12, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      />
    </ScreenContainer>
  );
}
