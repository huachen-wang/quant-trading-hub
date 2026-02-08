import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function AdminComments() {
  const colors = useColors();

  const { data: comments, isLoading, refetch } = trpc.admin.comments.list.useQuery({
    limit: 100,
    offset: 0,
  });

  const deleteMutation = trpc.admin.comments.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleDelete = (id: number) => {
    Alert.alert("确认删除", "确定要删除这条评论吗?", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => deleteMutation.mutate({ id }),
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* 标题 */}
        <View className="p-4 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">评论管理</Text>
          <Text className="text-sm text-muted mt-1">查看和管理用户评论</Text>
        </View>

        {/* 评论列表 */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={comments || []}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View className="p-4 border-b border-border">
                {/* 用户和策略信息 */}
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">
                      {item.user?.name || "匿名用户"}
                    </Text>
                    <Text className="text-xs text-muted">
                      评论于: {item.strategy?.title || "未知策略"}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                {/* 评论内容 */}
                <Text className="text-sm text-foreground mb-3">{item.content}</Text>

                {/* 删除按钮 */}
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  className="bg-error/10 py-2 px-4 rounded-lg flex-row items-center justify-center self-start"
                  activeOpacity={0.7}
                >
                  <IconSymbol name="paperplane.fill" size={14} color={colors.error} />
                  <Text className="text-error font-semibold ml-1 text-sm">删除</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View className="p-8 items-center">
                <Text className="text-base text-muted">暂无评论</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
