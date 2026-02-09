import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function StrategyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");

  const strategyId = parseInt(id || "0");

  const { data: strategy, isLoading } = trpc.strategies.detail.useQuery({ id: strategyId });
  const { data: comments, refetch: refetchComments } = trpc.comments.list.useQuery({
    strategyId,
  });

  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      refetchComments();
    },
  });

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      refetchComments();
    },
  });

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    createCommentMutation.mutate({
      strategyId,
      content: commentText.trim(),
    });
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert("删除评论", "确定要删除这条评论吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => deleteCommentMutation.mutate({ id: commentId }),
      },
    ]);
  };

  const handleDownload = () => {
    if (strategy?.downloadUrl) {
      Linking.openURL(strategy.downloadUrl);
    }
  };

  const handleContact = (type: "telegram" | "qq") => {
    if (type === "telegram" && strategy?.telegramGroup) {
      Linking.openURL(strategy.telegramGroup);
    } else if (type === "qq" && strategy?.qqGroup) {
      Alert.alert("QQ群", `QQ群号: ${strategy.qqGroup}`, [{ text: "确定" }]);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!strategy) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-lg text-muted">策略不存在</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 bg-primary rounded-full"
        >
          <Text className="text-background font-semibold">返回</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const gradientColors: readonly [string, string, ...string[]] =
    strategy.platform === "MT4" ? ["#1E3A8A", "#3B82F6"] : ["#7C3AED", "#A78BFA"];

  const returnValue = parseFloat(strategy.totalReturn || "0");
  const isPositive = returnValue >= 0;
  const isAdmin = user?.role === "admin";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView className="flex-1">
        {/* 返回按钮 */}
        <View className="p-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-surface rounded-full items-center justify-center"
          >
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* 封面 */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="mx-4 h-48 rounded-3xl items-center justify-center mb-6"
        >
          <Text className="text-6xl">📈</Text>
          <View className="absolute top-4 right-4 bg-background/90 px-3 py-1 rounded-full">
            <Text className="text-sm font-bold" style={{ color: gradientColors[1] }}>
              {strategy.platform}
            </Text>
          </View>
        </LinearGradient>

        {/* 策略信息 */}
        <View className="px-4 mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">{strategy.title}</Text>
          <Text className="text-base text-muted leading-relaxed">{strategy.description}</Text>
        </View>

        {/* 实盘数据 */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">实盘数据</Text>
          <View className="bg-surface rounded-2xl p-4">
            <View className="flex-row flex-wrap">
              <View className="w-1/2 mb-4">
                <Text className="text-xs text-muted mb-1">总收益率</Text>
                <Text
                  className={`text-2xl font-bold ${isPositive ? "text-success" : "text-error"}`}
                >
                  {isPositive ? "+" : ""}
                  {strategy.totalReturn}%
                </Text>
              </View>
              <View className="w-1/2 mb-4">
                <Text className="text-xs text-muted mb-1">胜率</Text>
                <Text className="text-2xl font-bold text-primary">{strategy.winRate}%</Text>
              </View>
              <View className="w-1/2 mb-4">
                <Text className="text-xs text-muted mb-1">最大回撤</Text>
                <Text className="text-2xl font-bold text-error">{strategy.maxDrawdown}%</Text>
              </View>
              <View className="w-1/2 mb-4">
                <Text className="text-xs text-muted mb-1">夏普比率</Text>
                <Text className="text-2xl font-bold text-foreground">{strategy.sharpeRatio}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 交易信息 */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">交易信息</Text>
          <View className="bg-surface rounded-2xl p-4">
            <View className="mb-3">
              <Text className="text-xs text-muted mb-1">交易对</Text>
              <Text className="text-base text-foreground">{strategy.pairs}</Text>
            </View>
            <View>
              <Text className="text-xs text-muted mb-1">时间周期</Text>
              <Text className="text-base text-foreground">{strategy.timeframe}</Text>
            </View>
          </View>
        </View>

        {/* 价格和操作 */}
        <View className="px-4 mb-6">
          <View className="bg-surface rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-xs text-muted mb-1">价格</Text>
                {strategy.isFree ? (
                  <Text className="text-2xl font-bold text-success">免费</Text>
                ) : (
                  <Text className="text-2xl font-bold text-accent">¥{strategy.price}</Text>
                )}
              </View>
              <View className="items-end">
                <Text className="text-xs text-muted mb-1">下载量</Text>
                <Text className="text-base text-foreground">💾 {strategy.downloadCount}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleDownload}
              className="bg-primary rounded-full py-3 items-center mb-3"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-base">下载EA</Text>
            </TouchableOpacity>

            <View className="flex-row">
              {strategy.telegramGroup && (
                <TouchableOpacity
                  onPress={() => handleContact("telegram")}
                  className="flex-1 mr-2 bg-primary/10 rounded-full py-2 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-primary font-semibold text-sm">Telegram</Text>
                </TouchableOpacity>
              )}
              {strategy.qqGroup && (
                <TouchableOpacity
                  onPress={() => handleContact("qq")}
                  className="flex-1 ml-2 bg-primary/10 rounded-full py-2 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-primary font-semibold text-sm">QQ群</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 评论区 */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">备注说明</Text>

          {/* 管理员评论输入 */}
          {isAdmin && (
            <View className="bg-surface rounded-2xl p-4 mb-4">
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="添加备注或说明..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                className="text-base text-foreground mb-3"
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
              <TouchableOpacity
                onPress={handleAddComment}
                disabled={!commentText.trim() || createCommentMutation.isPending}
                className={`rounded-full py-2 items-center ${commentText.trim() ? "bg-primary" : "bg-border"}`}
                activeOpacity={0.8}
              >
                {createCommentMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text
                    className={`font-semibold text-sm ${commentText.trim() ? "text-background" : "text-muted"}`}
                  >
                    发布备注
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* 评论列表 */}
          {comments && comments.length > 0 ? (
            <View>
              {comments.map((comment) => (
                <View key={comment.id} className="bg-surface rounded-2xl p-4 mb-3">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground mb-1">
                        {comment.user?.name || "管理员"}
                      </Text>
                      <Text className="text-xs text-muted">
                        {new Date(comment.createdAt).toLocaleDateString("zh-CN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    {isAdmin && (
                      <TouchableOpacity
                        onPress={() => handleDeleteComment(comment.id)}
                        className="ml-2"
                      >
                        <IconSymbol name="trash" size={18} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text className="text-base text-foreground leading-relaxed">
                    {comment.content}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-surface rounded-2xl p-6 items-center">
              <Text className="text-muted">暂无备注说明</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
