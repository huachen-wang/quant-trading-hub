import { useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
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

  // 使用debounce避免频繁请求
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    // 简单的debounce实现
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
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
        {/* 搜索栏 */}
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-surface mr-3"
            activeOpacity={0.7}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          
          <View className="flex-1 flex-row items-center bg-surface rounded-2xl px-4 py-3">
            <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="搜索EA策略名称、交易对..."
              placeholderTextColor={colors.muted}
              className="flex-1 ml-2 text-foreground"
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery("");
                setDebouncedQuery("");
              }}>
                <Text className="text-muted">✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 搜索结果 */}
        {debouncedQuery.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>🔍</Text>
            <Text className="text-foreground text-lg font-bold">搜索EA策略</Text>
            <Text className="text-muted text-sm mt-2">支持策略名称、交易对、平台等关键词</Text>
          </View>
        ) : isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
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
            columnWrapperStyle={numColumns > 1 ? { justifyContent: "flex-start" } : undefined}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>😔</Text>
            <Text className="text-foreground text-lg font-bold">未找到相关策略</Text>
            <Text className="text-muted text-sm mt-2">试试其他关键词</Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
