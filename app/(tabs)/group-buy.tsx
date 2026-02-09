import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function GroupBuyScreen() {
  const router = useRouter();
  const colors = useColors();

  const { data: groupBuys, isLoading } = trpc.groupBuys.list.useQuery({
    status: "active",
    limit: 50,
  });

  const handlePress = async (id: number) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/group-buy/${id}` as any);
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

  return (
    <ScreenContainer>
      <View className="flex-1 px-4 pt-4">
        {/* 标题和发起按钮 */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-foreground">🤝 合购专区</Text>
          <TouchableOpacity
            onPress={handleCreateGroupBuy}
            className="bg-primary px-4 py-2 rounded-full"
            activeOpacity={0.8}
          >
            <Text className="text-background font-semibold text-sm">发起合购</Text>
          </TouchableOpacity>
        </View>

        {/* 说明文字 */}
        <View className="bg-surface rounded-2xl p-4 mb-4">
          <Text className="text-sm text-foreground leading-relaxed">
            💡 合购是多人分摊EA费用的方式,降低单人成本。发起合购后,我们会审核并展示在列表中,感兴趣的用户可通过联系方式加入。
          </Text>
        </View>

        {/* 合购列表 */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : groupBuys && groupBuys.length > 0 ? (
          <FlatList
            data={groupBuys}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const progress = getProgressPercentage(item.currentParticipants, item.targetParticipants);
              return (
                <TouchableOpacity
                  onPress={() => handlePress(item.id)}
                  className="bg-surface rounded-2xl p-4 mb-3"
                  activeOpacity={0.7}
                >
                  {/* 标题和EA名称 */}
                  <View className="mb-3">
                    <Text className="text-lg font-bold text-foreground mb-1">{item.title}</Text>
                    <Text className="text-sm text-muted">EA: {item.eaName}</Text>
                  </View>

                  {/* 进度条 */}
                  <View className="mb-3">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm text-foreground">
                        {item.currentParticipants}/{item.targetParticipants} 人
                      </Text>
                      <Text className="text-sm font-semibold text-primary">{progress.toFixed(0)}%</Text>
                    </View>
                    <View className="h-2 bg-border rounded-full overflow-hidden">
                      <View
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </View>
                  </View>

                  {/* 价格信息 */}
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-xs text-muted mb-1">人均价格</Text>
                      <Text className="text-xl font-bold text-primary">¥{item.pricePerPerson}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-xs text-muted mb-1">目标总价</Text>
                      <Text className="text-base text-foreground">¥{item.targetPrice}</Text>
                    </View>
                  </View>

                  {/* 联系方式 */}
                  <View className="mt-3 pt-3 border-t border-border">
                    <Text className="text-xs text-muted mb-1">联系方式</Text>
                    <Text className="text-sm text-foreground">{item.contactInfo}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted text-base mb-4">暂无进行中的合购</Text>
            <TouchableOpacity
              onPress={handleCreateGroupBuy}
              className="bg-primary px-6 py-3 rounded-full"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold">发起第一个合购</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
