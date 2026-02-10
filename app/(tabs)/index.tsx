import { useMemo, useState, useRef, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Animated } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StrategyCard } from "@/components/strategy-card";
import { ContactModal } from "@/components/contact-modal";
import { SubscribeModal } from "@/components/subscribe-modal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { trpc } from "@/lib/trpc";

type PlatformFilter = "MT4" | "MT5" | undefined;
type OrderBy = "latest" | "popular" | "return";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { numColumns, isDesktop } = useResponsive();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(undefined);
  const [orderBy, setOrderBy] = useState<OrderBy>("latest");
  const [showContactModal, setShowContactModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedStrategyTitle, setSelectedStrategyTitle] = useState("");

  // Header入场动画
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const { data: strategies, isLoading, refetch, isRefetching } = trpc.strategies.list.useQuery({
    platform: platformFilter,
    orderBy,
    limit: 30,
    offset: 0,
  });

  const navStats = useMemo(() => {
    const items = strategies || [];
    const totalCount = items.length;
    let totalReturnSum = 0;
    for (const item of items) {
      totalReturnSum += parseFloat(item.totalReturn || "0");
    }

    const avgReturn = totalCount > 0 ? (totalReturnSum / totalCount).toFixed(2) : "0.00";

    return {
      totalCount,
      avgReturn,
    };
  }, [strategies]);

  const handleSubscribePress = (title: string) => {
    setSelectedStrategyTitle(title);
    setShowSubscribeModal(true);
  };

  const handleStrategyPress = (id: number) => {
    router.push(`/strategy/${id}` as any);
  };

  const renderHeader = () => (
    <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }} className="mb-2">
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
          <Text className={`text-sm ${orderBy === "latest" ? "text-primary font-semibold" : "text-muted"}`}>最新</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("popular")}
          className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${orderBy === "popular" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "popular" ? "text-primary font-semibold" : "text-muted"}`}>最热</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOrderBy("return")}
          className={`px-3 py-1.5 rounded-full mb-2 ${orderBy === "return" ? "bg-surface border border-primary" : "bg-surface"}`}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${orderBy === "return" ? "text-primary font-semibold" : "text-muted"}`}>收益率</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mt-1">
        <View className="mr-2 px-3 py-2 rounded-xl bg-surface">
          <Text className="text-xs text-muted">当前展示</Text>
          <Text className="text-sm font-semibold text-foreground">{navStats.totalCount} / 30 条</Text>
        </View>
        <View className="px-3 py-2 rounded-xl bg-surface">
          <Text className="text-xs text-muted">平均收益率</Text>
          <Text className="text-sm font-semibold text-primary">{navStats.avgReturn}%</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderEmpty = () => (
    <View className="items-center justify-center py-16">
      <Text style={{ fontSize: 56 }}>📊</Text>
      <Text className="text-foreground text-lg font-bold mt-4">暂无策略</Text>
      <Text className="text-muted text-sm mt-2">策略广场正在上架中，敬请期待</Text>
      <TouchableOpacity
        onPress={() => setShowContactModal(true)}
        className="mt-6 bg-primary px-6 py-3 rounded-full"
        activeOpacity={0.8}
      >
        <Text className="text-background font-semibold">上架我的EA</Text>
      </TouchableOpacity>
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
      <SubscribeModal
        visible={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        strategyTitle={selectedStrategyTitle}
      />
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
            onSubscribePress={() => handleSubscribePress(item.title)}
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
