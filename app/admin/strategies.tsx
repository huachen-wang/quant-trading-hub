import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function AdminStrategies() {
  const router = useRouter();
  const colors = useColors();
  const [statusFilter, setStatusFilter] = useState<"draft" | "published" | "archived" | undefined>(undefined);

  const { data: strategies, isLoading, refetch } = trpc.admin.strategies.list.useQuery({
    status: statusFilter,
    limit: 100,
    offset: 0,
  });

  const deleteMutation = trpc.admin.strategies.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleDelete = (id: number, title: string) => {
    Alert.alert("确认删除", `确定要删除策略"${title}"吗?此操作不可撤销。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => deleteMutation.mutate({ id }),
      },
    ]);
  };

  const statusOptions = [
    { label: "全部", value: undefined },
    { label: "草稿", value: "draft" as const },
    { label: "已发布", value: "published" as const },
    { label: "已归档", value: "archived" as const },
  ];

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* 筛选和添加按钮 */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">策略列表</Text>
            <TouchableOpacity
              onPress={() => router.push("/admin/strategy-form?mode=create" as any)}
              className="bg-primary px-4 py-2 rounded-full flex-row items-center"
              activeOpacity={0.8}
            >
              <IconSymbol name="paperplane.fill" size={16} color={colors.background} />
              <Text className="text-background font-semibold ml-1">添加策略</Text>
            </TouchableOpacity>
          </View>

          {/* 状态筛选 */}
          <View className="flex-row gap-2">
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.label}
                onPress={() => setStatusFilter(option.value)}
                className={`px-3 py-1.5 rounded-full ${
                  statusFilter === option.value ? "bg-primary" : "bg-surface"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-semibold ${
                    statusFilter === option.value ? "text-background" : "text-foreground"
                  }`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 策略列表 */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={strategies || []}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View className="p-4 border-b border-border">
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center mb-1">
                      <Text className="text-base font-semibold text-foreground mr-2">{item.title}</Text>
                      <View
                        className={`px-2 py-0.5 rounded ${
                          item.platform === "MT4" ? "bg-primary/20" : "bg-accent/20"
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            item.platform === "MT4" ? "text-primary" : "text-accent"
                          }`}
                        >
                          {item.platform}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm text-muted mb-1" numberOfLines={2}>
                      {item.description || "无描述"}
                    </Text>
                    <View className="flex-row items-center gap-3">
                      <Text className="text-xs text-muted">收益: {item.totalReturn}%</Text>
                      <Text className="text-xs text-muted">胜率: {item.winRate}%</Text>
                      <Text className="text-xs text-muted">下载: {item.downloadCount}</Text>
                    </View>
                  </View>
                  <View
                    className={`px-2 py-1 rounded ${
                      item.status === "published"
                        ? "bg-success/20"
                        : item.status === "draft"
                          ? "bg-warning/20"
                          : "bg-muted/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        item.status === "published"
                          ? "text-success"
                          : item.status === "draft"
                            ? "text-warning"
                            : "text-muted"
                      }`}
                    >
                      {item.status === "published" ? "已发布" : item.status === "draft" ? "草稿" : "已归档"}
                    </Text>
                  </View>
                </View>

                {/* 操作按钮 */}
                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity
                    onPress={() => router.push(`/admin/strategy-form?mode=edit&id=${item.id}` as any)}
                    className="flex-1 bg-primary/10 py-2 rounded-lg flex-row items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <IconSymbol name="paperplane.fill" size={16} color={colors.primary} />
                    <Text className="text-primary font-semibold ml-1">编辑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id, item.title)}
                    className="flex-1 bg-error/10 py-2 rounded-lg flex-row items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <IconSymbol name="paperplane.fill" size={16} color={colors.error} />
                    <Text className="text-error font-semibold ml-1">删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="p-8 items-center">
                <Text className="text-base text-muted">暂无策略</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
